# Simple TypeScript Agent

A minimal chat agent (OpenAI function-calling loop) with two tools:

- **get_current_date_time** — returns the current date/time (optionally in a given IANA timezone). No API key needed.
- **web_search** — searches the web via [Tavily](https://tavily.com).

## Setup

```bash
npm install
cp .env.example .env
# then edit .env and add your keys
```

`.env`:
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

## Run

```bash
npm run dev     # run directly with tsx (no build step)
# or
npm run build && npm start
```

Chat in the terminal; type `exit` to quit.
