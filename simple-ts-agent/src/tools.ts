import type OpenAI from "openai";

/**
 * Tool 1: get_current_date_time
 * Returns the current date/time — no API key needed.
 */
async function getCurrentDateTime(args: { timezone?: string }): Promise<string> {
  const now = new Date();
  const timezone = args?.timezone || "UTC";

  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: timezone,
    }).format(now);

    return JSON.stringify({
      iso: now.toISOString(),
      formatted,
      timezone,
      unix_ms: now.getTime(),
    });
  } catch {
    // Invalid timezone provided — fall back to UTC/ISO.
    return JSON.stringify({
      iso: now.toISOString(),
      formatted: now.toUTCString(),
      timezone: "UTC",
      unix_ms: now.getTime(),
      note: `Unknown timezone "${timezone}", fell back to UTC`,
    });
  }
}

/**
 * Tool 2: web_search (Tavily)
 * Searches the web via the Tavily API.
 */
async function webSearch(args: { query: string; max_results?: number }): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return JSON.stringify({ error: "TAVILY_API_KEY is not set in the environment." });
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: args.query,
      max_results: args.max_results ?? 5,
      search_depth: "basic",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return JSON.stringify({ error: `Tavily API error (${response.status}): ${text}` });
  }

  const data = await response.json();
  const results = (data.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));

  return JSON.stringify({ answer: data.answer ?? null, results });
}

// --- Tool definitions (OpenAI function-calling schema) ---

export const toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_current_date_time",
      description:
        "Get the current date and time. Use this whenever you need to know 'today', 'now', or the current time in a given timezone.",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description:
              "IANA timezone name, e.g. 'America/New_York', 'Asia/Colombo'. Defaults to UTC if omitted.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for up-to-date information using Tavily. Use this for questions about current events, facts you're unsure of, or anything requiring fresh information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query.",
          },
          max_results: {
            type: "number",
            description: "Maximum number of results to return (default 5).",
          },
        },
        required: ["query"],
      },
    },
  },
];

// --- Tool dispatcher ---

export async function callTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "get_current_date_time":
      return getCurrentDateTime(args ?? {});
    case "web_search":
      return webSearch(args);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
