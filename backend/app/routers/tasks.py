from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import jira_client
from app.database import get_db
from app.models import SyncState, Task
from app.schemas import SyncResultOut, TaskOut

router = APIRouter(prefix="/api", tags=["tasks"])


@router.post("/sync", response_model=SyncResultOut)
def trigger_sync(db: Session = Depends(get_db)):
    try:
        tasks_count, comments_count = jira_client.sync(db)
    except jira_client.JiraSyncError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    state = db.get(SyncState, 1)
    return SyncResultOut(
        tasks_synced=tasks_count,
        comments_synced=comments_count,
        last_sync=state.last_sync,
    )


@router.get("/tasks", response_model=list[TaskOut])
def list_in_work_tasks(db: Session = Depends(get_db)):
    stmt = (
        select(Task)
        .where(Task.status_category.in_(["new", "indeterminate"]))
        .order_by(Task.updated.desc())
        .options(selectinload(Task.comments))
    )
    return db.execute(stmt).scalars().all()
