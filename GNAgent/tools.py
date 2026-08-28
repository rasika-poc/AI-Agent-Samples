import logging

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_tavily import TavilySearch

from config import get_mcp_server_configs, settings

logger = logging.getLogger(__name__)


async def build_tools() -> list:
    """Assemble the tool list: Tavily web search + any configured MCP servers.

    Each MCP server is loaded independently so a single unreachable/misconfigured
    server is skipped with a warning instead of blocking Tavily or the other
    MCP servers from loading.
    """
    tools: list = []

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
