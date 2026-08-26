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
    parent_id: int | None = None
    depends_on_id: int | None = None
    start_date: date | None = None  # можно не указывать, если задан depends_on_id
    end_date: date


class GanttStageUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    depends_on_id: int | None = None
    done: bool | None = None


class GanttReorderIn(BaseModel):
    stage_ids: list[int]


class GanttStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    depends_on_id: int | None
    name: str
    task_key: str | None
    task_status_category: str | None
    start_date: date
    end_date: date
    sort_order: int
    done: bool

    @computed_field
    @property
    def jira_url(self) -> str | None:
        if not self.task_key:
            return None
        return f"{settings.jira_base_url.rstrip('/')}/browse/{self.task_key}"

    @computed_field
    @property
    def duration_days(self) -> int:
        return (self.end_date - self.start_date).days + 1

    @computed_field
    @property
    def is_done(self) -> bool:
        if self.task_status_category is not None:
            return self.task_status_category == "done"
        return self.done

    @computed_field
    @property
    def is_overdue(self) -> bool:
        return not self.is_done and self.end_date < date.today()


class GanttChartCreate(BaseModel):
    title: str


class GanttChartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    stages: list[GanttStageOut] = []

    @computed_field
    @property
    def stage_count(self) -> int:
        return len(self.stages)

    @computed_field
    @property
    def overall_start(self) -> date | None:
        dates = [s.start_date for s in self.stages]
        return min(dates) if dates else None

    @computed_field
    @property
    def overall_end(self) -> date | None:
        dates = [s.end_date for s in self.stages]
        return max(dates) if dates else None

    @computed_field
    @property
    def overall_duration_days(self) -> int | None:
        start, end = self.overall_start, self.overall_end
        if start is None or end is None:
            return None
        return (end - start).days + 1


class ReleaseTicketCreate(BaseModel):
    label: str
    key: str
    kind: str = "other"


class ReleaseTicketUpdate(BaseModel):
    label: str | None = None
    key: str | None = None
    kind: str | None = None


class ReleaseTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    key: str
    kind: str
    sort_order: int

    @computed_field
    @property
    def jira_url(self) -> str:
        return f"{settings.jira_base_url.rstrip('/')}/browse/{self.key}"


class ReleaseModuleSetEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    version: str | None
    sort_order: int


class ReleaseModuleSetCreate(BaseModel):
    name: str


class ReleaseModuleSetUpdate(BaseModel):
    name: str | None = None


class ReleaseModuleSetBulkIn(BaseModel):
    text: str


class ReleaseModuleSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort_order: int
    entries: list[ReleaseModuleSetEntryOut] = []


class ReleaseItemCreate(BaseModel):
    section: str
    item_type: str = "work"
    title: str
    duration_minutes: int | None = None
    depends_on_id: int | None = None
    start_at: datetime | None = None
    executor: str | None = None
    comment: str | None = None
    marker_at: datetime | None = None
    module_set_id: int | None = None


class ReleaseItemUpdate(BaseModel):
    title: str | None = None
    duration_minutes: int | None = None
    depends_on_id: int | None = None
    start_at: datetime | None = None
    executor: str | None = None
    comment: str | None = None
    marker_at: datetime | None = None
    module_set_id: int | None = None


class ReleaseItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section: str
    item_type: str
    title: str
    # Текст с подставленными вместо {{sprint_key}}/{{sprint_branch}}/{{bundle_key}}/
    # {{bundle_label}} реальными значениями тикетов из шапки — для отображения
    # (в форме редактирования показывается исходный title с плейсхолдерами).
    title_display: str = ""
    comment_display: str | None = None
    duration_minutes: int | None
    start_at: datetime | None
    end_at: datetime | None
    depends_on_id: int | None
    executor: str | None
    executor_display: str | None = None
    comment: str | None
    marker_at: datetime | None
    sort_order: int
    number: int | None = None
    module_set_id: int | None


class ReleaseRiskCreate(BaseModel):
    description: str
    level: str | None = None
    measures: str | None = None
    owners: str | None = None


class ReleaseRiskUpdate(BaseModel):
    description: str | None = None
    level: str | None = None
    measures: str | None = None
    owners: str | None = None


class ReleaseRiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    level: str | None
    measures: str | None
    owners: str | None
    sort_order: int
    number: int | None = None


class ReleaseReorderIn(BaseModel):
    item_ids: list[int]


class ReleaseAdminCreate(BaseModel):
    name: str


class ReleaseAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ReleaseAcSystemCreate(BaseModel):
    name: str


class ReleaseAcSystemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ReleaseCreate(BaseModel):
    kind: str = "planned"
    title: str | None = None
    main_admin: str | None = None
    second_admin: str | None = None
    tickets: list[ReleaseTicketCreate] = []


class ReleaseUpdate(BaseModel):
    title: str | None = None
    main_admin: str | None = None
    second_admin: str | None = None
    rollback_note: str | None = None


class ReleaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str
    main_admin: str | None
    second_admin: str | None
    rollback_note: str | None
    created_at: datetime
    updated_at: datetime
    tickets: list[ReleaseTicketOut] = []
    items: list[ReleaseItemOut] = []
    risks: list[ReleaseRiskOut] = []
    module_sets: list[ReleaseModuleSetOut] = []

    @computed_field
    @property
    def item_count(self) -> int:
        return len([i for i in self.items if i.item_type == "work"])
