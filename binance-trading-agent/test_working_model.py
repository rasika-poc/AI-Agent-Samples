#!/usr/bin/env python3
"""
Quick test for the working Gemini model
"""

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

api_key = os.getenv('GEMINI_API_KEY')

print("Testing gemini-2.0-flash with LangChain...")

try:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=api_key,
        temperature=0.7
    )
    
    response = llm.invoke("Say 'Hello from Gemini 2.0!' and tell me you're working correctly.")
    print(f"✅ SUCCESS!")
    print(f"Response: {response.content}")
    
except Exception as e:
    print(f"❌ Error: {e}")

