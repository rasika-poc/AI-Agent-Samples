"""
Example client usage for the Binance AI Agent API
"""

import requests
import json


class BinanceAgentClient:
    """Client for interacting with the Binance AI Agent API"""
    
    def health_check(self):
        """Check if the API is healthy"""
        response = requests.get(f"{self.base_url}/health")
        return response.json()
    
    def __init__(self, base_url: str = "http://localhost:8000", thread_id: int = 1):
        self.base_url = base_url
        self.thread_id = thread_id
    
    def chat(self, question: str):
        """
        Send a chat message to the agent
        
        Args:
            question: The question to ask
        """
        payload = {
            "thread_id": self.thread_id,
            "question": question
        }
        
        response = requests.post(f"{self.base_url}/invocations", json=payload)
        result = response.json()
        
        return result
    
    def analyze_market(self, symbol: str):
        """Get market analysis for a symbol"""
        response = requests.post(
            f"{self.base_url}/analyze-market",
            json={"symbol": symbol}
        )
        return response.json()
    
    def get_price(self, symbol: str):
        """Get current price for a symbol"""
        response = requests.post(
            f"{self.base_url}/price",
            json={"symbol": symbol}
        )
        return response.json()
    
    def get_historical_data(self, symbol: str, interval: str = "1h", limit: int = 100):
        """Get historical data"""
        response = requests.post(
            f"{self.base_url}/historical-data",
            json={
                "symbol": symbol,
                "interval": interval,
                "limit": limit
            }
        )
        return response.json()
    
    def explain_concept(self, concept: str):
        """Get explanation of a concept"""
        response = requests.post(
            f"{self.base_url}/explain",
            params={"concept": concept}
        )
        return response.json()
    
    def set_thread(self, thread_id: int):
        """Change the conversation thread"""
        self.thread_id = thread_id


# Example usage
if __name__ == "__main__":
    # Create client with thread_id
    client = BinanceAgentClient(thread_id=123)
    
    # Check health
    print("Checking API health...")
    health = client.health_check()
    print(json.dumps(health, indent=2))
    
    # Get current price
    print("\n" + "="*50)
    print("Getting BTC price...")
    price = client.get_price("BTCUSDT")
    print(price["response"])
    
    # Chat with agent
    print("\n" + "="*50)
    print("Chatting with agent...")
    response = client.chat("What's the current market situation for BTCUSDT?")
    print(f"Thread {response['thread_id']}: {response['response']}")
    
    # Follow-up question (same thread)
    print("\n" + "="*50)
    print("Follow-up question...")
    response = client.chat("What about Ethereum?")
    print(f"Thread {response['thread_id']}: {response['response']}")
    
    # Switch to new thread
    print("\n" + "="*50)
    print("Switching to thread 456...")
    client.set_thread(456)
    response = client.chat("Hi, How can you help me?")
    print(f"Thread {response['thread_id']}: {response['response']}")

