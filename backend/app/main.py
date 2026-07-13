from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import Base, engine
from app.routers import stats, tasks

Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
