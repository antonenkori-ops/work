from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import GanttChart, GanttStage, Task
from app.schemas import (
    GanttChartCreate,
    GanttChartOut,
    GanttReorderIn,
    GanttStageCreate,
    GanttStageOut,
    GanttStageUpdate,
)

router = APIRouter(prefix="/api/gantt", tags=["gantt"])

MAX_CHAIN_DEPTH = 200


def _get_chart(db: Session, chart_id: int) -> GanttChart:
    chart = db.get(GanttChart, chart_id, options=[selectinload(GanttChart.stages)])
    if chart is None:
        raise HTTPException(status_code=404, detail="Диаграмма не найдена")
    return chart


def _get_stage(db: Session, stage_id: int) -> GanttStage:
    stage = db.get(GanttStage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Этап не найден")
    return stage


def _collect_descendant_ids(stage: GanttStage) -> set[int]:
    ids: set[int] = set()
    stack = list(stage.children)
    while stack:
        child = stack.pop()
        ids.add(child.id)
        stack.extend(child.children)
    return ids


def _validate_parent(db: Session, chart_id: int, stage_id: int | None, parent_id: int) -> None:
    parent = db.get(GanttStage, parent_id)
    if parent is None or parent.chart_id != chart_id:
        raise HTTPException(status_code=400, detail="Родительский этап не найден в этой диаграмме")
    if stage_id is not None:
        current: GanttStage | None = parent
        depth = 0
        while current is not None and depth < MAX_CHAIN_DEPTH:
            if current.id == stage_id:
                raise HTTPException(
                    status_code=400, detail="Этап не может быть подпунктом самого себя"
                )
            current = db.get(GanttStage, current.parent_id) if current.parent_id else None
            depth += 1


def _validate_dependency(
    db: Session, chart_id: int, stage_id: int | None, depends_on_id: int
) -> GanttStage:
    predecessor = db.get(GanttStage, depends_on_id)
    if predecessor is None or predecessor.chart_id != chart_id:
        raise HTTPException(
            status_code=400, detail="Этап-предшественник не найден в этой диаграмме"
        )
    if stage_id is not None:
        if predecessor.id == stage_id:
            raise HTTPException(status_code=400, detail="Этап не может зависеть от самого себя")
        current: GanttStage | None = predecessor
        depth = 0
        while current is not None and depth < MAX_CHAIN_DEPTH:
            if current.id == stage_id:
                raise HTTPException(
                    status_code=400, detail="Циклическая зависимость между этапами"
                )
            current = db.get(GanttStage, current.depends_on_id) if current.depends_on_id else None
            depth += 1
    return predecessor


def _cascade_dependents(db: Session, stage: GanttStage, visited: set[int]) -> None:
    # Если у этапа сдвинулась дата окончания, все этапы, которые от него зависят,
    # должны "приехать" вслед за ним — сохраняя свою длительность.
    stmt = select(GanttStage).where(GanttStage.depends_on_id == stage.id)
    for dependent in db.execute(stmt).scalars().all():
        if dependent.id in visited:
            continue
        visited.add(dependent.id)
        duration_days = (dependent.end_date - dependent.start_date).days
        dependent.start_date = stage.end_date
        dependent.end_date = stage.end_date + timedelta(days=duration_days)
        _cascade_dependents(db, dependent, visited)


def _clear_dangling_dependencies(db: Session, removed_ids: set[int]) -> None:
    if not removed_ids:
        return
    stmt = select(GanttStage).where(GanttStage.depends_on_id.in_(removed_ids))
    for stage in db.execute(stmt).scalars().all():
        if stage.id not in removed_ids:
            stage.depends_on_id = None


@router.get("/charts", response_model=list[GanttChartOut])
def list_charts(db: Session = Depends(get_db)):
    stmt = (
        select(GanttChart)
        .order_by(GanttChart.created_at.desc())
        .options(selectinload(GanttChart.stages))
    )
    return db.execute(stmt).scalars().all()


@router.post("/charts", response_model=GanttChartOut)
def create_chart(payload: GanttChartCreate, db: Session = Depends(get_db)):
    chart = GanttChart(title=payload.title, created_at=datetime.now().astimezone())
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return chart


@router.get("/charts/{chart_id}", response_model=GanttChartOut)
def get_chart(chart_id: int, db: Session = Depends(get_db)):
    return _get_chart(db, chart_id)


@router.delete("/charts/{chart_id}", status_code=204)
def delete_chart(chart_id: int, db: Session = Depends(get_db)):
    chart = _get_chart(db, chart_id)
    db.delete(chart)
    db.commit()


@router.post("/charts/{chart_id}/stages", response_model=GanttStageOut)
def add_stage(chart_id: int, payload: GanttStageCreate, db: Session = Depends(get_db)):
    chart = _get_chart(db, chart_id)

    name = payload.name
    if payload.task_key:
        task = db.get(Task, payload.task_key)
        if task is None:
            raise HTTPException(status_code=404, detail=f"Задача {payload.task_key} не найдена")
        if not name:
            name = f"{task.key}: {task.summary}"
    elif not name:
        raise HTTPException(status_code=400, detail="Укажите название этапа или задачу Jira")

    if payload.parent_id is not None:
        _validate_parent(db, chart_id, None, payload.parent_id)

    predecessor = None
    if payload.depends_on_id is not None:
        predecessor = _validate_dependency(db, chart_id, None, payload.depends_on_id)

    # Если у этапа есть предшественник — дата начала всегда берётся из его даты
    # окончания, ручной ввод даты начала в этом случае игнорируется.
    if predecessor is not None:
        start_date = predecessor.end_date
    elif payload.start_date is not None:
        start_date = payload.start_date
    else:
        raise HTTPException(
            status_code=400, detail="Укажите дату начала или выберите этап-предшественник"
        )

    if payload.end_date < start_date:
        raise HTTPException(status_code=400, detail="Дата окончания раньше даты начала")

    siblings = [s for s in chart.stages if s.parent_id == payload.parent_id]
    next_order = (max((s.sort_order for s in siblings), default=-1)) + 1

    stage = GanttStage(
        chart_id=chart_id,
        parent_id=payload.parent_id,
        depends_on_id=payload.depends_on_id,
        name=name,
        task_key=payload.task_key,
        start_date=start_date,
        end_date=payload.end_date,
        sort_order=next_order,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch("/stages/{stage_id}", response_model=GanttStageOut)
def update_stage(stage_id: int, payload: GanttStageUpdate, db: Session = Depends(get_db)):
    stage = _get_stage(db, stage_id)
    fields = payload.model_dump(exclude_unset=True)

    new_depends_on_id = (
        fields["depends_on_id"] if "depends_on_id" in fields else stage.depends_on_id
    )
    predecessor = None
    if new_depends_on_id is not None:
        predecessor = _validate_dependency(db, stage.chart_id, stage.id, new_depends_on_id)

    if predecessor is not None:
        # Дата начала всегда синхронизирована с окончанием предшественника —
        # ручная дата начала (если пришла) игнорируется.
        new_start = predecessor.end_date
    else:
        new_start = fields.get("start_date", stage.start_date)

    if "end_date" in fields:
        new_end = fields["end_date"]
    elif new_start != stage.start_date:
        # Старт сместился (например, подтянулся к предшественнику) — сохраняем длительность.
        duration_days = (stage.end_date - stage.start_date).days
        new_end = new_start + timedelta(days=duration_days)
    else:
        new_end = stage.end_date

    if new_end < new_start:
        raise HTTPException(status_code=400, detail="Дата окончания раньше даты начала")

    if "name" in fields:
        stage.name = fields["name"]
    if "depends_on_id" in fields:
        stage.depends_on_id = new_depends_on_id

    end_changed = new_end != stage.end_date
    stage.start_date = new_start
    stage.end_date = new_end
    db.commit()
    db.refresh(stage)

    if end_changed:
        _cascade_dependents(db, stage, {stage.id})
        db.commit()
        db.refresh(stage)

    return stage


@router.delete("/stages/{stage_id}", status_code=204)
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = _get_stage(db, stage_id)
    removed_ids = _collect_descendant_ids(stage) | {stage.id}
    _clear_dangling_dependencies(db, removed_ids)
    db.delete(stage)
    db.commit()


@router.post("/charts/{chart_id}/reorder", status_code=204)
def reorder_stages(chart_id: int, payload: GanttReorderIn, db: Session = Depends(get_db)):
    # Ожидается id-шники одной группы "братьев" (с общим parent_id), в новом порядке —
    # именно так фронтенд шлёт результат drag&drop внутри одного уровня вложенности.
    chart = _get_chart(db, chart_id)
    by_id = {s.id: s for s in chart.stages}
    for index, stage_id in enumerate(payload.stage_ids):
        stage = by_id.get(stage_id)
        if stage is None:
            raise HTTPException(
                status_code=400, detail=f"Этап {stage_id} не найден в этой диаграмме"
            )
        stage.sort_order = index
    db.commit()
