# GNAgent — General-Purpose LangGraph Agent

A configurable, general-purpose AI agent built on LangGraph, with:

- **OpenAI** as the LLM (`OPENAI_MODEL`, default `gpt-4o-mini`)
- **Tavily** for live internet search
- **MCP servers** wired in purely via environment variables — no code changes needed to add one
- **In-memory vector recall** (FAISS + OpenAI embeddings) so the agent can semantically recall relevant past exchanges across turns

## Setup

```bash
cd GNAgent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in your keys
```

## Configuring MCP servers

For each MCP server, set two env vars named after it:

```
MCP_<NAME>_URL=https://your-mcp-server/endpoint
MCP_<NAME>_API_KEY=optional-token      # sent as an "X-API-Key" header
```

Each distinct `<NAME>` becomes one server, and every tool it exposes is added to the
agent's toolset automatically. The API key is optional — omit it for servers that
don't require auth. Servers are expected to speak MCP over streamable HTTP.

Example — two servers, `github` and `filesystem`:

```
MCP_GITHUB_URL=https://mcp.example.com/github
MCP_GITHUB_API_KEY=ghp_xxx

MCP_FILESYSTEM_URL=https://mcp.example.com/fs
```

## Running

```bash
python main.py          # interactive CLI chat
python main.py --api    # FastAPI server on API_HOST:API_PORT (default 0.0.0.0:8010)
```

API:

- `GET /health`
- `POST /chat` — body `{"message": "...", "thread_id": "optional-session-id"}`

## How memory works

- **Short-term (per-thread)**: LangGraph's `MemorySaver` checkpointer keeps full
  message history per `thread_id` for the life of the process.
- **Long-term (semantic)**: every finished exchange is embedded and stored in an
  in-process FAISS index. On each new turn, the top `MEMORY_TOP_K` most similar
  past exchanges (across all threads) are retrieved and injected as extra context
  for the model — this is not persisted to disk, so it resets on restart.
