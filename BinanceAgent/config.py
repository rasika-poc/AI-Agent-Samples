from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables
load_dotenv()


class Settings(BaseSettings):
    """Configuration class for the Binance AI Agent"""
    
    # Gemini API Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"  # Fast and efficient latest model
    
    # Binance Public API
    BINANCE_API_URL: str = "https://api.binance.com"
    
    # FastAPI Configuration
    API_TITLE: str = "Binance AI Agent API"
    API_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Trading Parameters
    DEFAULT_SYMBOL: str = "BTCUSDT"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def validate_config(self):
        """Validate that all required configuration is present"""
        if not self.GEMINI_API_KEY:
            raise ValueError("Missing required configuration: GEMINI_API_KEY")
        return True


# Create global settings instance
settings = Settings()

