from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from config import settings
from memory import VectorMemory
from tools import build_tools

SYSTEM_PROMPT = """You are a helpful, general-purpose AI assistant.

You have access to tools for web search and any MCP servers the operator has
configured, plus a memory of relevant past conversation turns. Use tools when
they would improve the accuracy or freshness of your answer, cite what you
found when it came from a search, and say so plainly when you don't know
something rather than guessing."""


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


class GeneralAgent:
    """General-purpose LangGraph agent with tool use and vector memory."""

    def __init__(self):
        self.memory = VectorMemory()
        self.checkpointer = MemorySaver()
        self.tools: list = []
        self.llm = None
        self.graph = None

    async def setup(self) -> "GeneralAgent":
        self.tools = await build_tools()

        base_llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.LLM_URL or None,
            temperature=0.3,
        )
        self.llm = base_llm.bind_tools(self.tools) if self.tools else base_llm

        graph_builder = StateGraph(AgentState)
        graph_builder.add_node("agent", self._call_model)
        graph_builder.add_node("remember", self._remember)

        graph_builder.add_edge(START, "agent")

        if self.tools:
            graph_builder.add_node("tools", ToolNode(self.tools))
            graph_builder.add_conditional_edges(
                "agent", tools_condition, {"tools": "tools", END: "remember"}
            )
            graph_builder.add_edge("tools", "agent")
        else:
            graph_builder.add_edge("agent", "remember")

        graph_builder.add_edge("remember", END)

        self.graph = graph_builder.compile(checkpointer=self.checkpointer)
        return self

    async def _call_model(self, state: AgentState) -> dict:
        messages = state["messages"]
        last_human = next(
            (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
        )

        context_messages = []
        if last_human:
            hits = self.memory.search(last_human.content)
            if hits:
                recalled = "\n".join(f"- {hit}" for hit in hits)
                context_messages.append(
                    SystemMessage(
                        content=f"Relevant context from earlier conversations:\n{recalled}"
                    )
                )

        full_messages = [SystemMessage(content=SYSTEM_PROMPT), *context_messages, *messages]
        response = await self.llm.ainvoke(full_messages)
        return {"messages": [response]}

    def _remember(self, state: AgentState) -> dict:
        messages = state["messages"]
        last_ai = messages[-1] if messages and isinstance(messages[-1], AIMessage) else None
        last_human = next(
            (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
        )

        if last_human and last_ai and last_ai.content:
            self.memory.add(f"User: {last_human.content}\nAssistant: {last_ai.content}")

        return {}

    async def chat(self, message: str, thread_id: str = "default") -> str:
        config = {"configurable": {"thread_id": thread_id}}
        result = await self.graph.ainvoke(
            {"messages": [HumanMessage(content=message)]}, config=config
        )
        return result["messages"][-1].content
