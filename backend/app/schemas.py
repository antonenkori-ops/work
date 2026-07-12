from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author: str | None
    body: str | None
    created: datetime | None
    updated: datetime | None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    summary: str
    description: str | None
    status: str
    status_category: str
    issue_type: str | None
    priority: str | None
    project_key: str | None
    assignee: str | None
    reporter: str | None
    created: datetime | None
    updated: datetime | None
    resolved: datetime | None
    comments: list[CommentOut] = []


class StatsOut(BaseModel):
    done_total: int
    done_this_year: int
    done_this_month: int
    done_this_week: int


class SyncResultOut(BaseModel):
    tasks_synced: int
    comments_synced: int
    last_sync: datetime
