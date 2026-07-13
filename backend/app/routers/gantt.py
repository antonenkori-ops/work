from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import GanttChart, GanttStage, Task
from app.schemas import (
    GanttChartCreate,
    GanttChartOut,
    GanttStageCreate,
    GanttStageOut,
    GanttStageUpdate,
)

router = APIRouter(prefix="/api/gantt", tags=["gantt"])


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
    _get_chart(db, chart_id)  # 404, если диаграммы нет

    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="Дата окончания раньше даты начала")

    name = payload.name
    if payload.task_key:
        task = db.get(Task, payload.task_key)
        if task is None:
            raise HTTPException(status_code=404, detail=f"Задача {payload.task_key} не найдена")
        if not name:
            name = f"{task.key}: {task.summary}"
    elif not name:
        raise HTTPException(status_code=400, detail="Укажите название этапа или задачу Jira")

    stage = GanttStage(
        chart_id=chart_id,
        name=name,
        task_key=payload.task_key,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch("/stages/{stage_id}", response_model=GanttStageOut)
def update_stage(stage_id: int, payload: GanttStageUpdate, db: Session = Depends(get_db)):
    stage = _get_stage(db, stage_id)

    new_start = payload.start_date if payload.start_date is not None else stage.start_date
    new_end = payload.end_date if payload.end_date is not None else stage.end_date
    if new_end < new_start:
        raise HTTPException(status_code=400, detail="Дата окончания раньше даты начала")

    if payload.name is not None:
        stage.name = payload.name
    stage.start_date = new_start
    stage.end_date = new_end

    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/stages/{stage_id}", status_code=204)
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = _get_stage(db, stage_id)
    db.delete(stage)
    db.commit()
