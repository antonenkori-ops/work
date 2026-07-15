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
