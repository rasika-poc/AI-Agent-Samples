from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from config import settings
from agent import BinanceLangChainAgent
import uvicorn


# Request/Response Models
class ChatRequest(BaseModel):
    thread_id: int = Field(description="Conversation thread ID")
    question: str = Field(description="User's question to the agent")


class ChatResponse(BaseModel):
    response: str = Field(description="Agent's response")
    success: bool = Field(description="Whether the request was successful")
    thread_id: int = Field(description="Conversation thread ID")
    error: Optional[str] = Field(default=None, description="Error message if any")


class HealthResponse(BaseModel):
    status: str
    model: str


class MarketDataRequest(BaseModel):
    symbol: str = Field(description="Trading pair symbol, e.g., BTCUSDT")


class HistoricalDataRequest(BaseModel):
    symbol: str = Field(description="Trading pair symbol")
    interval: str = Field(default="1h", description="Kline interval")
    limit: int = Field(default=100, description="Number of candles")


# Initialize FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="AI-powered cryptocurrency trading assistant using Binance API and Google Gemini"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agent (singleton)
agent: Optional[BinanceLangChainAgent] = None

# Store conversation histories by thread_id
conversation_histories: Dict[int, List] = {}


@app.on_event("startup")
async def startup_event():
    """Initialize the agent on startup"""
    global agent
    try:
        settings.validate_config()
        agent = BinanceLangChainAgent()
        print(f"✅ Binance AI Agent initialized successfully")
        print(f"🌐 API running on http://{settings.API_HOST}:{settings.API_PORT}")
        print(f"📚 Docs available at http://{settings.API_HOST}:{settings.API_PORT}/docs")
        print(f"💰 Using Binance Public API (no authentication required)")
    except Exception as e:
        print(f"❌ Error initializing agent: {e}")
        raise


@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "message": "Binance AI Agent API",
        "version": settings.API_VERSION,
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        model=settings.GEMINI_MODEL
    )


@app.post("/invocations", response_model=ChatResponse)
async def invocations(request: ChatRequest):
    """
    Chat with the AI agent about cryptocurrency markets
    
    Request body:
    {
        "thread_id": 123,
        "question": "What is the current price of Bitcoin?"
    }
    
    The agent has access to:
    - Real-time cryptocurrency prices from Binance
    - 24h market statistics and trends
    - Historical price data and charts
    - Technical analysis capabilities
    
    Conversation history is automatically maintained per thread_id.
    """
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent not initialized"
        )
    
    try:
        # Get or create conversation history for this thread
        if request.thread_id not in conversation_histories:
            conversation_histories[request.thread_id] = []
        
        chat_history = conversation_histories[request.thread_id]
        
        # Get response from agent
        result = await agent.achat(request.question, chat_history)
        
        # Update conversation history
        conversation_histories[request.thread_id].append(("human", request.question))
        conversation_histories[request.thread_id].append(("assistant", result["output"]))
        
        return ChatResponse(
            response=result["output"],
            success=result["success"],
            thread_id=request.thread_id,
            error=result.get("error")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/analyze-market")
async def analyze_market(request: MarketDataRequest):
    """
    Get AI analysis of a specific market
    
    This endpoint fetches market data and provides AI-powered analysis
    """
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent not initialized"
        )
    
    try:
        message = f"Please analyze the market for {request.symbol}. Include current price, 24h statistics, and provide insights about the market conditions."
        
        result = await agent.achat(message)
        
        return ChatResponse(
            response=result["output"],
            success=result["success"],
            error=result.get("error")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/price")
async def get_price(request: MarketDataRequest):
    """
    Get current price for a trading pair
    """
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent not initialized"
        )
    
    try:
        message = f"What is the current price of {request.symbol}?"
        result = await agent.achat(message)
        
        return ChatResponse(
            response=result["output"],
            success=result["success"],
            error=result.get("error")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/historical-data")
async def get_historical_data(request: HistoricalDataRequest):
    """
    Get historical price data with analysis
    """
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent not initialized"
        )
    
    try:
        message = f"Get historical data for {request.symbol} with {request.interval} interval and {request.limit} candles. Analyze the price trends and provide insights."
        result = await agent.achat(message)
        
        return ChatResponse(
            response=result["output"],
            success=result["success"],
            error=result.get("error")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/explain")
async def explain_concept(concept: str):
    """
    Get explanation of a cryptocurrency or trading concept
    """
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent not initialized"
        )
    
    try:
        message = f"Please explain the following cryptocurrency/trading concept: {concept}"
        result = await agent.achat(message)
        
        return ChatResponse(
            response=result["output"],
            success=result["success"],
            error=result.get("error")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def start_server():
    """Start the FastAPI server"""
    uvicorn.run(
        "api:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )


if __name__ == "__main__":
    start_server()

