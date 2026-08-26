from datetime import datetime, timedelta
from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    ReleaseAdmin,
    ReleaseItem,
    ReleaseModuleSet,
    ReleaseModuleSetEntry,
    ReleasePlan,
    ReleaseRisk,
    ReleaseTicket,
)
from app.release_export import build_workbook
from app.release_placeholders import build_placeholder_map, resolve_text
from app.release_templates import DEFAULT_TITLE, seed_planned_release
from app.schemas import (
    ReleaseAdminCreate,
    ReleaseAdminOut,
    ReleaseCreate,
    ReleaseItemCreate,
    ReleaseItemUpdate,
    ReleaseModuleSetBulkIn,
    ReleaseModuleSetCreate,
    ReleaseModuleSetUpdate,
    ReleaseOut,
    ReleaseReorderIn,
    ReleaseRiskCreate,
    ReleaseRiskUpdate,
    ReleaseTicketCreate,
    ReleaseTicketUpdate,
    ReleaseUpdate,
)

router = APIRouter(prefix="/api/releases", tags=["releases"])

MAX_CHAIN_DEPTH = 500

_RELEASE_OPTIONS = [
    selectinload(ReleasePlan.tickets),
    selectinload(ReleasePlan.items),
    selectinload(ReleasePlan.risks),
    selectinload(ReleasePlan.module_sets).selectinload(ReleaseModuleSet.entries),
]


def _assign_item_numbers(items: list[ReleaseItem]) -> None:
    by_section: dict[str, list[ReleaseItem]] = {}
    for item in items:
        by_section.setdefault(item.section, []).append(item)
    for group in by_section.values():
        group.sort(key=lambda i: i.sort_order)
        n = 0
        for item in group:
            if item.item_type == "work":
                n += 1
                item.number = n
            else:
                item.number = None


def _assign_risk_numbers(risks: list[ReleaseRisk]) -> None:
    for index, risk in enumerate(sorted(risks, key=lambda r: r.sort_order)):
        risk.number = index + 1


def _resolve_placeholders(release: ReleasePlan) -> None:
    placeholders = build_placeholder_map(release)
    for item in release.items:
        item.title_display = resolve_text(item.title, placeholders) or ""
        item.comment_display = resolve_text(item.comment, placeholders)


def _load_release(db: Session, release_id: int) -> ReleasePlan:
    release = db.get(ReleasePlan, release_id, options=_RELEASE_OPTIONS)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    _assign_item_numbers(release.items)
    _assign_risk_numbers(release.risks)
    _resolve_placeholders(release)
    return release


def _get_item(db: Session, item_id: int) -> ReleaseItem:
    item = db.get(ReleaseItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Пункт плана не найден")
    return item


def _get_risk(db: Session, risk_id: int) -> ReleaseRisk:
    risk = db.get(ReleaseRisk, risk_id)
    if risk is None:
        raise HTTPException(status_code=404, detail="Риск не найден")
    return risk


def _get_ticket(db: Session, ticket_id: int) -> ReleaseTicket:
    ticket = db.get(ReleaseTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return ticket


def _get_module_set(db: Session, set_id: int) -> ReleaseModuleSet:
    module_set = db.get(ReleaseModuleSet, set_id)
    if module_set is None:
        raise HTTPException(status_code=404, detail="Набор модулей не найден")
    return module_set


def _touch(release: ReleasePlan) -> None:
    release.updated_at = datetime.now().astimezone()


def _validate_dependency(
    db: Session, release_id: int, item_id: int | None, depends_on_id: int
) -> ReleaseItem:
    predecessor = db.get(ReleaseItem, depends_on_id)
    if predecessor is None or predecessor.release_id != release_id:
        raise HTTPException(status_code=400, detail="Пункт-предшественник не найден в этом релизе")
    if predecessor.item_type != "work":
        raise HTTPException(status_code=400, detail="Нельзя зависеть от строки-маркера")
    if item_id is not None:
        if predecessor.id == item_id:
            raise HTTPException(status_code=400, detail="Пункт не может зависеть от самого себя")
        current: ReleaseItem | None = predecessor
        depth = 0
        while current is not None and depth < MAX_CHAIN_DEPTH:
            if current.id == item_id:
                raise HTTPException(status_code=400, detail="Циклическая зависимость между пунктами")
            current = db.get(ReleaseItem, current.depends_on_id) if current.depends_on_id else None
            depth += 1
    return predecessor


def _recompute_schedule(item: ReleaseItem, predecessor: ReleaseItem | None) -> None:
    if predecessor is not None:
        item.start_at = predecessor.end_at
    if item.start_at is not None:
        minutes = item.duration_minutes or 0
        item.end_at = item.start_at + timedelta(minutes=minutes)
    else:
        item.end_at = None


def _cascade_dependents(db: Session, item: ReleaseItem, visited: set[int]) -> None:
    stmt = select(ReleaseItem).where(ReleaseItem.depends_on_id == item.id)
    for dependent in db.execute(stmt).scalars().all():
        if dependent.id in visited:
            continue
        visited.add(dependent.id)
        _recompute_schedule(dependent, item)
        _cascade_dependents(db, dependent, visited)


def _clear_dangling_dependencies(db: Session, removed_ids: set[int]) -> None:
    if not removed_ids:
        return
    stmt = select(ReleaseItem).where(ReleaseItem.depends_on_id.in_(removed_ids))
    for item in db.execute(stmt).scalars().all():
        if item.id not in removed_ids:
            item.depends_on_id = None
            _recompute_schedule(item, None)


# --- Releases -------------------------------------------------------------


@router.get("", response_model=list[ReleaseOut])
def list_releases(db: Session = Depends(get_db)):
    stmt = select(ReleasePlan).order_by(ReleasePlan.created_at.desc()).options(*_RELEASE_OPTIONS)
    releases = db.execute(stmt).scalars().all()
    for release in releases:
        _assign_item_numbers(release.items)
        _assign_risk_numbers(release.risks)
        _resolve_placeholders(release)
    return releases


@router.post("", response_model=ReleaseOut)
def create_release(payload: ReleaseCreate, db: Session = Depends(get_db)):
    title = payload.title or (DEFAULT_TITLE if payload.kind == "planned" else None)
    if not title:
        raise HTTPException(status_code=400, detail="Укажите название релиза")

    now = datetime.now().astimezone()
    release = ReleasePlan(
        kind=payload.kind,
        title=title,
        main_admin=payload.main_admin,
        second_admin=payload.second_admin,
        created_at=now,
        updated_at=now,
    )
    db.add(release)
    db.flush()

    for order, t in enumerate(payload.tickets):
        release.tickets.append(
            ReleaseTicket(label=t.label, key=t.key, kind=t.kind, sort_order=order)
        )

    if payload.kind == "planned":
        seed_planned_release(release, db)

    db.commit()
    return _load_release(db, release.id)


@router.get("/admins", response_model=list[ReleaseAdminOut])
def list_admins(db: Session = Depends(get_db)):
    stmt = select(ReleaseAdmin).order_by(ReleaseAdmin.name)
    return db.execute(stmt).scalars().all()


@router.post("/admins", response_model=ReleaseAdminOut)
def add_admin(payload: ReleaseAdminCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Укажите имя администратора")
    existing = db.execute(select(ReleaseAdmin).where(ReleaseAdmin.name == name)).scalar_one_or_none()
    if existing:
        return existing
    admin = ReleaseAdmin(name=name)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@router.get("/{release_id}", response_model=ReleaseOut)
def get_release(release_id: int, db: Session = Depends(get_db)):
    return _load_release(db, release_id)


@router.patch("/{release_id}", response_model=ReleaseOut)
def update_release(release_id: int, payload: ReleaseUpdate, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(release, key, value)
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.delete("/{release_id}", status_code=204)
def delete_release(release_id: int, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    db.delete(release)
    db.commit()


@router.get("/{release_id}/export.xlsx")
def export_release(release_id: int, db: Session = Depends(get_db)):
    release = _load_release(db, release_id)
    workbook = build_workbook(release)
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    ascii_title = "".join(c for c in release.title if c.isascii() and (c.isalnum() or c in " _-"))
    ascii_title = ascii_title.strip() or "release"
    ascii_filename = f"Plan_{ascii_title}.xlsx"
    utf8_filename = quote(f"Plan_{release.title}.xlsx")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{utf8_filename}'
            )
        },
    )


# --- Tickets ----------------------------------------------------------------


@router.post("/{release_id}/tickets", response_model=ReleaseOut)
def add_ticket(release_id: int, payload: ReleaseTicketCreate, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    next_order = (max((t.sort_order for t in release.tickets), default=-1)) + 1
    db.add(
        ReleaseTicket(
            release_id=release_id,
            label=payload.label,
            key=payload.key,
            kind=payload.kind,
            sort_order=next_order,
        )
    )
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.patch("/tickets/{ticket_id}", response_model=ReleaseOut)
def update_ticket(ticket_id: int, payload: ReleaseTicketUpdate, db: Session = Depends(get_db)):
    ticket = _get_ticket(db, ticket_id)
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(ticket, key, value)
    release = db.get(ReleasePlan, ticket.release_id)
    _touch(release)
    db.commit()
    return _load_release(db, ticket.release_id)


@router.delete("/tickets/{ticket_id}", response_model=ReleaseOut)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = _get_ticket(db, ticket_id)
    release_id = ticket.release_id
    release = db.get(ReleasePlan, release_id)
    db.delete(ticket)
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


# --- Items --------------------------------------------------------------


@router.post("/{release_id}/items", response_model=ReleaseOut)
def add_item(release_id: int, payload: ReleaseItemCreate, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    if payload.item_type not in ("work", "marker"):
        raise HTTPException(status_code=400, detail="Неизвестный тип пункта")

    siblings = [i for i in release.items if i.section == payload.section]
    next_order = (max((i.sort_order for i in siblings), default=-1)) + 1

    item = ReleaseItem(
        release_id=release_id,
        section=payload.section,
        item_type=payload.item_type,
        title=payload.title,
        duration_minutes=payload.duration_minutes,
        executor=payload.executor,
        comment=payload.comment,
        marker_at=payload.marker_at,
        module_set_id=payload.module_set_id,
        sort_order=next_order,
    )

    if payload.item_type == "work":
        predecessor = None
        if payload.depends_on_id is not None:
            predecessor = _validate_dependency(db, release_id, None, payload.depends_on_id)
            item.depends_on_id = payload.depends_on_id
        item.start_at = payload.start_at
        db.add(item)
        db.flush()
        _recompute_schedule(item, predecessor)
    else:
        db.add(item)

    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.patch("/items/{item_id}", response_model=ReleaseOut)
def update_item(item_id: int, payload: ReleaseItemUpdate, db: Session = Depends(get_db)):
    item = _get_item(db, item_id)
    fields = payload.model_dump(exclude_unset=True)

    if "title" in fields:
        item.title = fields["title"]
    if "executor" in fields:
        item.executor = fields["executor"]
    if "comment" in fields:
        item.comment = fields["comment"]
    if "marker_at" in fields:
        item.marker_at = fields["marker_at"]
    if "module_set_id" in fields:
        item.module_set_id = fields["module_set_id"]

    if item.item_type == "work":
        new_depends_on_id = (
            fields["depends_on_id"] if "depends_on_id" in fields else item.depends_on_id
        )
        predecessor = None
        if new_depends_on_id is not None:
            predecessor = _validate_dependency(db, item.release_id, item.id, new_depends_on_id)
        item.depends_on_id = new_depends_on_id

        if "duration_minutes" in fields:
            item.duration_minutes = fields["duration_minutes"]

        if predecessor is None and "start_at" in fields:
            item.start_at = fields["start_at"]

        _recompute_schedule(item, predecessor)

    release = db.get(ReleasePlan, item.release_id)
    _touch(release)
    db.commit()

    if item.item_type == "work":
        _cascade_dependents(db, item, {item.id})
        db.commit()

    return _load_release(db, item.release_id)


@router.delete("/items/{item_id}", response_model=ReleaseOut)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = _get_item(db, item_id)
    release_id = item.release_id
    release = db.get(ReleasePlan, release_id)
    _clear_dangling_dependencies(db, {item.id})
    db.delete(item)
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.post("/{release_id}/items/reorder", response_model=ReleaseOut)
def reorder_items(release_id: int, payload: ReleaseReorderIn, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    by_id = {i.id: i for i in release.items}
    for index, item_id in enumerate(payload.item_ids):
        item = by_id.get(item_id)
        if item is None:
            raise HTTPException(status_code=400, detail=f"Пункт {item_id} не найден в этом релизе")
        item.sort_order = index
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


# --- Module sets ------------------------------------------------------
# Именованные наборы модулей на уровне релиза (напр. "site", "sbercraft") —
# несколько пунктов плана (установка в СЦОД и в МЦОД) могут ссылаться на один
# и тот же набор через ReleaseItem.module_set_id, чтобы список правился один раз.


@router.post("/{release_id}/module-sets", response_model=ReleaseOut)
def add_module_set(release_id: int, payload: ReleaseModuleSetCreate, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    next_order = (max((s.sort_order for s in release.module_sets), default=-1)) + 1
    db.add(ReleaseModuleSet(release_id=release_id, name=payload.name, sort_order=next_order))
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.patch("/module-sets/{set_id}", response_model=ReleaseOut)
def rename_module_set(set_id: int, payload: ReleaseModuleSetUpdate, db: Session = Depends(get_db)):
    module_set = _get_module_set(db, set_id)
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(module_set, key, value)
    release = db.get(ReleasePlan, module_set.release_id)
    _touch(release)
    db.commit()
    return _load_release(db, module_set.release_id)


@router.delete("/module-sets/{set_id}", response_model=ReleaseOut)
def delete_module_set(set_id: int, db: Session = Depends(get_db)):
    module_set = _get_module_set(db, set_id)
    release_id = module_set.release_id
    release = db.get(ReleasePlan, release_id)
    for item in db.execute(
        select(ReleaseItem).where(ReleaseItem.module_set_id == set_id)
    ).scalars().all():
        item.module_set_id = None
    db.delete(module_set)
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.post("/module-sets/{set_id}/entries/bulk", response_model=ReleaseOut)
def bulk_set_module_entries(set_id: int, payload: ReleaseModuleSetBulkIn, db: Session = Depends(get_db)):
    """Заменяет весь список модулей набора на вставленный текст — по строке на
    модуль, в формате "имя:версия" (версия необязательна)."""
    module_set = _get_module_set(db, set_id)
    for entry in list(module_set.entries):
        db.delete(entry)
    db.flush()

    order = 0
    for line in payload.text.splitlines():
        line = line.strip()
        if not line:
            continue
        name, _, version = line.partition(":")
        db.add(
            ReleaseModuleSetEntry(
                module_set_id=set_id,
                name=name.strip(),
                version=version.strip() or None,
                sort_order=order,
            )
        )
        order += 1

    release = db.get(ReleasePlan, module_set.release_id)
    _touch(release)
    db.commit()
    return _load_release(db, module_set.release_id)


# --- Risks ------------------------------------------------------------


@router.post("/{release_id}/risks", response_model=ReleaseOut)
def add_risk(release_id: int, payload: ReleaseRiskCreate, db: Session = Depends(get_db)):
    release = db.get(ReleasePlan, release_id)
    if release is None:
        raise HTTPException(status_code=404, detail="Релиз не найден")
    next_order = (max((r.sort_order for r in release.risks), default=-1)) + 1
    db.add(
        ReleaseRisk(
            release_id=release_id,
            description=payload.description,
            level=payload.level,
            measures=payload.measures,
            owners=payload.owners,
            sort_order=next_order,
        )
    )
    _touch(release)
    db.commit()
    return _load_release(db, release_id)


@router.patch("/risks/{risk_id}", response_model=ReleaseOut)
def update_risk(risk_id: int, payload: ReleaseRiskUpdate, db: Session = Depends(get_db)):
    risk = _get_risk(db, risk_id)
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(risk, key, value)
    release = db.get(ReleasePlan, risk.release_id)
    _touch(release)
    db.commit()
    return _load_release(db, risk.release_id)


@router.delete("/risks/{risk_id}", response_model=ReleaseOut)
def delete_risk(risk_id: int, db: Session = Depends(get_db)):
    risk = _get_risk(db, risk_id)
    release_id = risk.release_id
    release = db.get(ReleasePlan, release_id)
    db.delete(risk)
    _touch(release)
    db.commit()
    return _load_release(db, release_id)
