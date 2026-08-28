from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import GeneralAgent
from config import settings

_agent: Optional[GeneralAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _agent
    settings.validate_config()
    _agent = await GeneralAgent().setup()
    yield


app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="General-purpose LangGraph agent with MCP tools, Tavily search, and vector memory",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    thread_id: str = Field(default="default", description="Conversation thread ID")
    message: str = Field(description="User's message to the agent")


class ChatResponse(BaseModel):
    response: str = Field(description="Agent's response")
    thread_id: str = Field(description="Conversation thread ID")


class HealthResponse(BaseModel):
    status: str
    model: str


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", model=settings.OPENAI_MODEL)


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    try:
        response = await _agent.chat(request.message, thread_id=request.thread_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return ChatResponse(response=response, thread_id=request.thread_id)


def start_server():
    import uvicorn

    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
