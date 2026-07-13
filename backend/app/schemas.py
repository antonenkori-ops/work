from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field

from app.config import settings


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

    @computed_field
    @property
    def jira_url(self) -> str:
        return f"{settings.jira_base_url.rstrip('/')}/browse/{self.key}"


class StatsOut(BaseModel):
    done_total: int
    done_this_year: int
    done_this_month: int
    done_this_week: int
    open_total: int
    status_counts: dict[str, int]


class SyncResultOut(BaseModel):
    tasks_synced: int
    comments_synced: int
    last_sync: datetime


class GanttStageCreate(BaseModel):
    name: str | None = None
    task_key: str | None = None
    start_date: date
    end_date: date


class GanttStageUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class GanttStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    task_key: str | None
    start_date: date
    end_date: date

    @computed_field
    @property
    def jira_url(self) -> str | None:
        if not self.task_key:
            return None
        return f"{settings.jira_base_url.rstrip('/')}/browse/{self.task_key}"


class GanttChartCreate(BaseModel):
    title: str


class GanttChartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    stages: list[GanttStageOut] = []
