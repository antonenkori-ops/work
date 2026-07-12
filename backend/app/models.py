from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
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
