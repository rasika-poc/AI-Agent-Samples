#!/usr/bin/env python3
"""
Binance AI Agent - Start FastAPI Server
This is the main entry point for the API server
"""

from api import start_server

if __name__ == "__main__":
    print("🚀 Starting Binance AI Agent API Server...")
    print("⚠️  Make sure you have configured your .env file with API keys")
    start_server()

