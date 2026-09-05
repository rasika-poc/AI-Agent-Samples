from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import close_pool, init_pool
from .routers import auth, documents, files, folders
from .storage import ensure_bucket


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    ensure_bucket()
    yield
    await close_pool()


app = FastAPI(title="WebOffice — api-files", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(folders.router)
app.include_router(files.router)
app.include_router(documents.router)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
