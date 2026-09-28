from langchain.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
from config import settings
import requests
import json


class BinancePublicAPI:
    """Public Binance API client (no authentication required)"""
    
    @staticmethod
    def get_price(symbol: str) -> dict:
        """Get current price for a symbol"""
        url = f"{settings.BINANCE_API_URL}/api/v3/ticker/price"
        params = {"symbol": symbol.upper()}
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    def get_24h_ticker(symbol: str) -> dict:
        """Get 24h ticker statistics"""
        url = f"{settings.BINANCE_API_URL}/api/v3/ticker/24hr"
        params = {"symbol": symbol.upper()}
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    def get_klines(symbol: str, interval: str = "1h", limit: int = 100) -> list:
        """Get historical kline/candlestick data"""
        url = f"{settings.BINANCE_API_URL}/api/v3/klines"
        params = {
            "symbol": symbol.upper(),
            "interval": interval,
            "limit": min(limit, 1000)
        }
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()


# Input schemas for tools
class GetPriceInput(BaseModel):
    """Input schema for getting current price"""
    symbol: str = Field(description="Trading pair symbol, e.g., BTCUSDT")


class GetMarketSummaryInput(BaseModel):
    """Input schema for getting market summary"""
    symbol: str = Field(description="Trading pair symbol, e.g., BTCUSDT")


class GetHistoricalDataInput(BaseModel):
    """Input schema for getting historical data"""
    symbol: str = Field(description="Trading pair symbol, e.g., BTCUSDT")
    interval: str = Field(default="1h", description="Kline interval: 1m, 5m, 15m, 1h, 4h, 1d")
    limit: int = Field(default=100, description="Number of candles to retrieve (max 1000)")


# LangChain Tools
class GetCurrentPriceTool(BaseTool):
    name: str = "get_current_price"
    description: str = """
    Get the current price for a cryptocurrency trading pair.
    Input should be a trading pair symbol like BTCUSDT, ETHUSDT, BNBUSDT, etc.
    Use this when user asks about current price or 'how much is' a cryptocurrency.
    """
    args_schema: Type[BaseModel] = GetPriceInput
    
    def _run(self, symbol: str) -> str:
        """Get current price"""
        try:
            data = BinancePublicAPI.get_price(symbol)
            price = float(data['price'])
            return f"Current price of {symbol.upper()}: ${price:,.2f}"
        except Exception as e:
            return f"Error getting price for {symbol}: {str(e)}"
    
    async def _arun(self, symbol: str) -> str:
        """Async version"""
        return self._run(symbol)


class GetMarketSummaryTool(BaseTool):
    name: str = "get_market_summary"
    description: str = """
    Get comprehensive market summary including 24h statistics.
    Input should be a trading pair symbol like BTCUSDT, ETHUSDT.
    Returns current price, 24h change, high, low, volume.
    Use this for market analysis or when user asks about market conditions.
    """
    args_schema: Type[BaseModel] = GetMarketSummaryInput
    
    def _run(self, symbol: str) -> str:
        """Get market summary"""
        try:
            data = BinancePublicAPI.get_24h_ticker(symbol)
            
            summary = {
                'symbol': data['symbol'],
                'current_price': float(data['lastPrice']),
                'price_change_24h': float(data['priceChange']),
                'price_change_percent_24h': float(data['priceChangePercent']),
                'high_24h': float(data['highPrice']),
                'low_24h': float(data['lowPrice']),
                'volume_24h': float(data['volume']),
                'quote_volume_24h': float(data['quoteVolume']),
                'number_of_trades': int(data['count']),
                'open_price': float(data['openPrice']),
                'close_price': float(data['lastPrice'])
            }
            
            return json.dumps(summary, indent=2)
        except Exception as e:
            return f"Error getting market summary for {symbol}: {str(e)}"
    
    async def _arun(self, symbol: str) -> str:
        """Async version"""
        return self._run(symbol)


class GetHistoricalDataTool(BaseTool):
    name: str = "get_historical_data"
    description: str = """
    Get historical candlestick/kline data for a trading pair.
    Inputs: symbol (e.g., BTCUSDT), interval (e.g., 1h, 4h, 1d), limit (number of candles).
    Use this for technical analysis or when user asks about price history or trends.
    """
    args_schema: Type[BaseModel] = GetHistoricalDataInput
    
    def _run(self, symbol: str, interval: str = "1h", limit: int = 100) -> str:
        """Get historical data"""
        try:
            klines = BinancePublicAPI.get_klines(symbol, interval, limit)
            
            # Parse kline data
            candles = []
            for k in klines[-10:]:  # Last 10 candles
                candles.append({
                    'timestamp': k[0],
                    'open': float(k[1]),
                    'high': float(k[2]),
                    'low': float(k[3]),
                    'close': float(k[4]),
                    'volume': float(k[5])
                })
            
            # Calculate statistics
            all_highs = [float(k[2]) for k in klines]
            all_lows = [float(k[3]) for k in klines]
            all_volumes = [float(k[5]) for k in klines]
            first_open = float(klines[0][1])
            last_close = float(klines[-1][4])
            
            result = {
                'symbol': symbol.upper(),
                'interval': interval,
                'total_candles': len(klines),
                'recent_candles': candles,
                'statistics': {
                    'highest_price': max(all_highs),
                    'lowest_price': min(all_lows),
                    'average_volume': sum(all_volumes) / len(all_volumes),
                    'price_change': last_close - first_open,
                    'price_change_percent': ((last_close - first_open) / first_open * 100)
                }
            }
            
            return json.dumps(result, indent=2)
        except Exception as e:
            return f"Error getting historical data for {symbol}: {str(e)}"
    
    async def _arun(self, symbol: str, interval: str = "1h", limit: int = 100) -> str:
        """Async version"""
        return self._run(symbol, interval, limit)


# Export all tools
def get_binance_tools():
    """Get all Binance tools for LangChain agent"""
    return [
        GetCurrentPriceTool(),
        GetMarketSummaryTool(),
        GetHistoricalDataTool()
    ]
