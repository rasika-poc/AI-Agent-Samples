import "dotenv/config";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import OpenAI from "openai";
import { toolDefinitions, callTool } from "./tools.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
if (!process.env.TAVILY_API_KEY) {
  console.warn("Warning: TAVILY_API_KEY is not set — the web_search tool will fail if used.");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  {
    role: "system",
    content:
      "You are a helpful assistant with access to tools: `get_current_date_time` and `web_search`. " +
      "Use them whenever they'd help answer the user accurately, rather than guessing.",
  },
];

/** Runs one full turn: sends messages to the model, executes any tool calls, and loops until a final answer is produced. */
async function runTurn(): Promise<string> {
  while (true) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefinitions,
    });

    const message = completion.choices[0].message;
    messages.push(message);

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return message.content ?? "";
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
      console.log(`  \x1b[2m→ calling tool: ${toolCall.function.name}(${JSON.stringify(args)})\x1b[0m`);
      const result = await callTool(toolCall.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
    // Loop again so the model can see the tool results and respond.
  }
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("Simple TypeScript agent. Type a message (or 'exit' to quit).\n");

  while (true) {
    const userInput = await rl.question("You: ");
    if (userInput.trim().toLowerCase() === "exit") break;

    messages.push({ role: "user", content: userInput });
    const reply = await runTurn();
    console.log(`Agent: ${reply}\n`);
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
