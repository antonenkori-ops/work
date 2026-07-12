from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task
from app.schemas import StatsOut

router = APIRouter(prefix="/api", tags=["stats"])


def _done_count_since(db: Session, since: datetime | None) -> int:
    stmt = select(func.count(Task.key)).where(Task.status_category == "done")
    if since is not None:
        stmt = stmt.where(Task.resolved >= since)
    return db.execute(stmt).scalar_one()


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    now = datetime.now().astimezone()
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = start_of_today - timedelta(days=start_of_today.weekday())
    start_of_month = start_of_today.replace(day=1)
    start_of_year = start_of_today.replace(month=1, day=1)

    return StatsOut(
        done_total=_done_count_since(db, None),
        done_this_year=_done_count_since(db, start_of_year),
        done_this_month=_done_count_since(db, start_of_month),
        done_this_week=_done_count_since(db, start_of_week),
    )
