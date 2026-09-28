#!/usr/bin/env python3
"""
Test the chat endpoint with the new thread_id format
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_chat():
    """Test the chat endpoint"""
    
    print("🧪 Testing Chat Endpoint")
    print("="*60)
    
    # Test 1: First message in a thread
    print("\n1. First message in thread 123:")
    payload1 = {
        "thread_id": 123,
        "question": "Hi, How can you help me?"
    }
    
    response = requests.post(f"{BASE_URL}/invocations", json=payload1)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {result['response'][:200]}...")
    print(f"Thread ID: {result['thread_id']}")
    print(f"Success: {result['success']}")
    
    # Test 2: Follow-up question in the same thread
    print("\n2. Follow-up question in same thread:")
    payload2 = {
        "thread_id": 123,
        "question": "What is the current price of Bitcoin?"
    }
    
    response = requests.post(f"{BASE_URL}/invocations", json=payload2)
    result = response.json()
    print(f"Response: {result['response'][:200]}...")
    
    # Test 3: New thread
    print("\n3. New thread 456:")
    payload3 = {
        "thread_id": 456,
        "question": "Tell me about Ethereum"
    }
    
    response = requests.post(f"{BASE_URL}/invocations", json=payload3)
    result = response.json()
    print(f"Response: {result['response'][:200]}...")
    print(f"Thread ID: {result['thread_id']}")
    
    print("\n" + "="*60)
    print("✅ All tests completed!")

if __name__ == "__main__":
    try:
        # Check if server is running
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Server is running\n")
            test_chat()
        else:
            print("❌ Server returned unexpected status")
    except requests.exceptions.ConnectionError:
        print("❌ Server is not running!")
        print("Please start the server first: ./start.sh")

