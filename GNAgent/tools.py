from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_tavily import TavilySearch

from config import get_mcp_server_configs, settings


async def build_tools() -> list:
    """Assemble the tool list: Tavily web search + any configured MCP servers."""
    tools: list = []

    if settings.TAVILY_API_KEY:
        tools.append(
            TavilySearch(max_results=5, tavily_api_key=settings.TAVILY_API_KEY)
        )

    mcp_servers = get_mcp_server_configs()
    if mcp_servers:
        client = MultiServerMCPClient(mcp_servers)
        tools.extend(await client.get_tools())

    return tools
