from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import ReleaseAcSystem
from app.routers import gantt, releases, stats, tasks

Base.metadata.create_all(bind=engine)

DEFAULT_AC_SYSTEMS = [
    "АС Веб-сайт Сбербанк России",
    "Короткие ссылки",
    "SberLive",
]

with SessionLocal() as _db:
    if _db.execute(select(ReleaseAcSystem)).first() is None:
        for _name in DEFAULT_AC_SYSTEMS:
            _db.add(ReleaseAcSystem(name=_name))
        _db.commit()

app = FastAPI(title="Work Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
def unhandled_exception_handler(request: Request, exc: Exception):
    # Без этого обработчика необработанное исключение улетает мимо CORS-заголовков,
    # и браузер вместо текста ошибки показывает нейтральное "Failed to fetch".
    return JSONResponse(status_code=500, content={"detail": str(exc)})


app.include_router(tasks.router)
app.include_router(stats.router)
app.include_router(gantt.router)
app.include_router(releases.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
