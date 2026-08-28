import os
import re

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

# Convention: MCP_<NAME>_URL (required) + MCP_<NAME>_API_KEY (optional)
# e.g. MCP_GITHUB_URL=https://mcp.example.com/github  MCP_GITHUB_API_KEY=xxx -> server "github"
MCP_URL_PATTERN = re.compile(r"^MCP_(.+)_URL$")


class Settings(BaseSettings):
    """Configuration for the General AI Agent"""

    # OpenAI Configuration
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Tavily web search
    TAVILY_API_KEY: str = ""

    # Vector memory
    MEMORY_TOP_K: int = 3

    # FastAPI Configuration
    API_TITLE: str = "General AI Agent API"
    API_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8010

    class Config:
        env_file = ".env"
        case_sensitive = True

    def validate_config(self):
        """Validate that all required configuration is present"""
        if not self.OPENAI_API_KEY:
            raise ValueError("Missing required configuration: OPENAI_API_KEY")
        return True


settings = Settings()


def get_mcp_server_configs() -> dict:
    """
    Discover configured MCP servers from environment variables.

    For a server named <NAME>, set:
      MCP_<NAME>_URL=https://example.com/mcp
      MCP_<NAME>_API_KEY=optional-api-key (sent as X-API-Key header)

    Returns a dict keyed by lowercase server name, in the shape expected by
    langchain_mcp_adapters.client.MultiServerMCPClient.
    """
    servers: dict[str, dict] = {}
    for key, value in os.environ.items():
        match = MCP_URL_PATTERN.match(key)
        if not match or not value:
            continue
        raw_name = match.group(1)
        name = raw_name.lower()
        api_key = os.environ.get(f"MCP_{raw_name}_API_KEY", "")

        server_config: dict = {
            "url": value,
            "transport": "streamable_http",
        }
        if api_key:
            server_config["headers"] = {"X-API-Key": api_key}

        servers[name] = server_config

    return servers
