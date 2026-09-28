import ast
import logging
import operator
from datetime import datetime
from zoneinfo import ZoneInfo

from langchain_core.tools import tool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_tavily import TavilySearch

from config import get_mcp_server_configs, settings

logger = logging.getLogger(__name__)

_ALLOWED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_OPERATORS:
        return _ALLOWED_OPERATORS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_OPERATORS:
        return _ALLOWED_OPERATORS[type(node.op)](_eval_node(node.operand))
    raise ValueError(f"unsupported expression: {ast.dump(node)}")


@tool
def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression, e.g. "(3 + 4) * 2 / 7". Supports + - * / // % ** and parentheses."""
    try:
        result = _eval_node(ast.parse(expression, mode="eval").body)
    except Exception as exc:
        return f"Error evaluating expression: {exc}"
    return str(result)


@tool
def current_datetime(timezone: str = "UTC") -> str:
    """Get the current date and time. `timezone` is an IANA name like "America/New_York"; defaults to UTC."""
    try:
        tz = ZoneInfo(timezone)
    except Exception:
        return f"Unknown timezone: {timezone}"
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S %Z")


async def build_tools() -> list:
    """Assemble the tool list: calculator + current time, Tavily web search, and any configured MCP servers.

    Each MCP server is loaded independently so a single unreachable/misconfigured
    server is skipped with a warning instead of blocking Tavily or the other
    MCP servers from loading.
    """
    tools: list = [calculator, current_datetime]

    if settings.TAVILY_API_KEY:
        tools.append(
            TavilySearch(max_results=5, tavily_api_key=settings.TAVILY_API_KEY)
        )

    mcp_servers = get_mcp_server_configs()
    if mcp_servers:
        client = MultiServerMCPClient(mcp_servers)
        for name in mcp_servers:
            try:
                tools.extend(await client.get_tools(server_name=name))
            except Exception:
                logger.warning("Skipping MCP server '%s': failed to load tools", name, exc_info=True)

    return tools
