from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import close_pool, init_pool
from .routers import auth, files, folders
from .storage import ensure_bucket


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    ensure_bucket()
    yield
    await close_pool()


app = FastAPI(title="WebOffice — api-files", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(folders.router)
app.include_router(files.router)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
