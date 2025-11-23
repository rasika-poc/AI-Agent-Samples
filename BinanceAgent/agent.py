from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory
from langchain_tools import get_binance_tools
from config import settings


class BinanceLangChainAgent:
    """LangChain agent for Binance cryptocurrency analysis"""
    
    def __init__(self):
        """Initialize the LangChain agent with Gemini and Binance tools"""
        
        # Initialize Gemini LLM with Gemini 2.0 Flash (latest fast model)
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7
        )
        
        # Get Binance tools
        self.tools = get_binance_tools()
        
        # Create system prompt
        self.system_prompt = """You are an expert cryptocurrency trading assistant with access to Binance market data.

Your capabilities:
- Access real-time cryptocurrency prices and market data from Binance
- View account balances and portfolio information
- Analyze historical price data and trends
- Provide educational insights about cryptocurrency trading

Guidelines:
1. Always use the available tools to get real-time data before answering
2. Provide objective, data-driven analysis
3. NEVER give direct financial advice like "buy" or "sell"
4. Instead, present facts, trends, and educational information
5. Always remind users that cryptocurrency trading is risky
6. Encourage users to do their own research (DYOR)
7. Be helpful, informative, and educational

When analyzing data:
- Look at price movements, volume, and market trends
- Explain what the data shows in simple terms
- Highlight both opportunities and risks
- Use technical analysis concepts when relevant

Remember: You're an educational assistant, not a financial advisor."""

        # Create prompt template
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self.system_prompt),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        
        # Create agent
        self.agent = create_tool_calling_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=self.prompt
        )
        
        # Create agent executor
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=5
        )
    
    def chat(self, message: str, chat_history: list = None) -> dict:
        """
        Process a chat message using the agent
        
        Args:
            message: User's message
            chat_history: Optional conversation history
            
        Returns:
            dict with 'output' key containing the response
        """
        try:
            result = self.agent_executor.invoke({
                "input": message,
                "chat_history": chat_history or []
            })
            
            return {
                "output": result.get("output", "I couldn't process your request."),
                "success": True
            }
        except Exception as e:
            return {
                "output": f"Error processing request: {str(e)}",
                "success": False,
                "error": str(e)
            }
    
    async def achat(self, message: str, chat_history: list = None) -> dict:
        """
        Async version of chat
        
        Args:
            message: User's message
            chat_history: Optional conversation history
            
        Returns:
            dict with 'output' key containing the response
        """
        try:
            result = await self.agent_executor.ainvoke({
                "input": message,
                "chat_history": chat_history or []
            })
            
            return {
                "output": result.get("output", "I couldn't process your request."),
                "success": True
            }
        except Exception as e:
            return {
                "output": f"Error processing request: {str(e)}",
                "success": False,
                "error": str(e)
            }

