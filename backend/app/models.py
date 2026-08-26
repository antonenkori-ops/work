from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    key = Column(String, primary_key=True)  # напр. "PROJ-123"
    summary = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String, nullable=False)
    status_category = Column(String, nullable=False)  # new / indeterminate / done

    issue_type = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    project_key = Column(String, nullable=True)

    assignee = Column(String, nullable=True)
    reporter = Column(String, nullable=True)

    created = Column(DateTime, nullable=True)
    updated = Column(DateTime, nullable=True)
    resolved = Column(DateTime, nullable=True)

    comments = relationship(
        "Comment", back_populates="task", cascade="all, delete-orphan", order_by="Comment.created"
    )


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)  # id комментария в Jira
    task_key = Column(String, ForeignKey("tasks.key"), nullable=False)
    author = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    created = Column(DateTime, nullable=True)
    updated = Column(DateTime, nullable=True)

    task = relationship("Task", back_populates="comments")


class SyncState(Base):
    __tablename__ = "sync_state"

    id = Column(Integer, primary_key=True)
    last_sync = Column(DateTime, nullable=True)
    last_sync_tasks_count = Column(Integer, nullable=True)


class GanttChart(Base):
    __tablename__ = "gantt_charts"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)

    stages = relationship(
        "GanttStage",
        back_populates="chart",
        cascade="all, delete-orphan",
        order_by="GanttStage.start_date",
    )


class GanttStage(Base):
    __tablename__ = "gantt_stages"

    id = Column(Integer, primary_key=True)
    chart_id = Column(Integer, ForeignKey("gantt_charts.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("gantt_stages.id"), nullable=True)
    # Этап-предшественник: этот этап не должен начинаться раньше, чем закончится предшественник.
    depends_on_id = Column(Integer, ForeignKey("gantt_stages.id"), nullable=True)

    name = Column(String, nullable=False)
    task_key = Column(String, ForeignKey("tasks.key"), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    # Ручная отметка выполнения — имеет смысл только для этапов без task_key
    # (у этапов, привязанных к Jira, готовность определяется статусом задачи).
    done = Column(Boolean, nullable=False, default=False)

    chart = relationship("GanttChart", back_populates="stages")
    task = relationship("Task")
    children = relationship(
        "GanttStage",
        back_populates="parent",
        foreign_keys=[parent_id],
        cascade="all, delete-orphan",
        order_by="GanttStage.sort_order",
    )
    parent = relationship(
        "GanttStage", back_populates="children", remote_side=[id], foreign_keys=[parent_id]
    )

    @property
    def task_status_category(self) -> str | None:
        return self.task.status_category if self.task is not None else None


class ReleasePlan(Base):
    __tablename__ = "release_plans"

    id = Column(Integer, primary_key=True)
    kind = Column(String, nullable=False, default="planned")
    title = Column(String, nullable=False)
    main_admin = Column(String, nullable=True)
    second_admin = Column(String, nullable=True)
    rollback_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    tickets = relationship(
        "ReleaseTicket", back_populates="release", cascade="all, delete-orphan",
        order_by="ReleaseTicket.sort_order",
    )
    items = relationship(
        "ReleaseItem", back_populates="release", cascade="all, delete-orphan",
        order_by="ReleaseItem.sort_order",
    )
    risks = relationship(
        "ReleaseRisk", back_populates="release", cascade="all, delete-orphan",
        order_by="ReleaseRisk.sort_order",
    )
    module_sets = relationship(
        "ReleaseModuleSet", back_populates="release", cascade="all, delete-orphan",
        order_by="ReleaseModuleSet.sort_order",
    )


class ReleaseTicket(Base):
    __tablename__ = "release_tickets"

    id = Column(Integer, primary_key=True)
    release_id = Column(Integer, ForeignKey("release_plans.id"), nullable=False)
    label = Column(String, nullable=False)
    key = Column(String, nullable=False)
    # Роль тикета в плане: sprint | bundle | rov | other. Тексты пунктов плана
    # (релизная ветка, ссылки в анонсах) подставляют значения тикетов с ролью
    # sprint/bundle через плейсхолдеры вида {{sprint_key}} — см. release_placeholders.py.
    kind = Column(String, nullable=False, default="other")
    sort_order = Column(Integer, nullable=False, default=0)

    release = relationship("ReleasePlan", back_populates="tickets")


class ReleaseItem(Base):
    __tablename__ = "release_items"

    id = Column(Integer, primary_key=True)
    release_id = Column(Integer, ForeignKey("release_plans.id"), nullable=False)
    section = Column(String, nullable=False)  # prep | main | closing | rollback
    item_type = Column(String, nullable=False, default="work")  # work | marker

    title = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    depends_on_id = Column(Integer, ForeignKey("release_items.id"), nullable=True)
    executor = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    marker_at = Column(DateTime, nullable=True)
    # Ссылка на общий набор модулей релиза (см. ReleaseModuleSet) — несколько
    # пунктов (напр. установка "site" в СЦОД и в МЦОД) могут ссылаться на один
    # и тот же набор, чтобы список модулей правился в одном месте.
    module_set_id = Column(Integer, ForeignKey("release_module_sets.id"), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    release = relationship("ReleasePlan", back_populates="items")
    module_set = relationship("ReleaseModuleSet")


class ReleaseModuleSet(Base):
    __tablename__ = "release_module_sets"

    id = Column(Integer, primary_key=True)
    release_id = Column(Integer, ForeignKey("release_plans.id"), nullable=False)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    release = relationship("ReleasePlan", back_populates="module_sets")
    entries = relationship(
        "ReleaseModuleSetEntry", back_populates="module_set", cascade="all, delete-orphan",
        order_by="ReleaseModuleSetEntry.sort_order",
    )


class ReleaseModuleSetEntry(Base):
    __tablename__ = "release_module_set_entries"

    id = Column(Integer, primary_key=True)
    module_set_id = Column(Integer, ForeignKey("release_module_sets.id"), nullable=False)
    name = Column(String, nullable=False)
    version = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    module_set = relationship("ReleaseModuleSet", back_populates="entries")


class ReleaseRisk(Base):
    __tablename__ = "release_risks"

    id = Column(Integer, primary_key=True)
    release_id = Column(Integer, ForeignKey("release_plans.id"), nullable=False)
    description = Column(Text, nullable=False)
    level = Column(String, nullable=True)
    measures = Column(Text, nullable=True)
    owners = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    release = relationship("ReleasePlan", back_populates="risks")


class ReleaseAdmin(Base):
    __tablename__ = "release_admins"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)


class ReleaseAcSystem(Base):
    """Справочник АС (автоматизированных систем) для шапки плана — заголовок
    документа собирается как "План работ по внедрению релиза {name}"."""

    __tablename__ = "release_ac_systems"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
