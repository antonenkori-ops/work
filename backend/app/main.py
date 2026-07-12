from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.include_router(tasks.router)
app.include_router(stats.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
