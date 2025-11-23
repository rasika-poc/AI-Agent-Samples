#!/usr/bin/env python3
"""
Test Gemini API directly to diagnose issues
"""

import os
from dotenv import load_dotenv

load_dotenv()

print("="*60)
print("🧪 Testing Gemini API Connection")
print("="*60)

api_key = os.getenv('GEMINI_API_KEY')

if not api_key:
    print("❌ GEMINI_API_KEY not found in .env")
    exit(1)

print(f"✅ API Key found (length: {len(api_key)})")
print()

# Test 1: Try with google-generativeai directly
print("Test 1: Using google-generativeai directly")
print("-"*60)
try:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    
    # Try gemini-pro first
    print("Testing model: gemini-pro")
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Say hello in one word")
    print(f"✅ Response: {response.text}")
    print()
except Exception as e:
    print(f"❌ Error with gemini-pro: {e}")
    print()
    
    # Try other models
    try:
        print("Testing model: gemini-1.5-flash")
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content("Say hello in one word")
        print(f"✅ Response: {response.text}")
        print()
    except Exception as e2:
        print(f"❌ Error with gemini-1.5-flash: {e2}")
        print()
        
        try:
            print("Testing model: gemini-1.5-pro")
            model = genai.GenerativeModel('gemini-1.5-pro')
            response = model.generate_content("Say hello in one word")
            print(f"✅ Response: {response.text}")
            print()
        except Exception as e3:
            print(f"❌ Error with gemini-1.5-pro: {e3}")
            print()

# Test 2: Try with LangChain's ChatGoogleGenerativeAI
print("Test 2: Using LangChain's ChatGoogleGenerativeAI")
print("-"*60)

models_to_test = [
    "gemini-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "models/gemini-pro",
    "models/gemini-1.5-flash"
]

for model_name in models_to_test:
    try:
        print(f"Testing model: {model_name}")
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.7
        )
        
        response = llm.invoke("Say hello in one word")
        print(f"✅ Response: {response.content}")
        print(f"✅ SUCCESS! Working model: {model_name}")
        print()
        break
    except Exception as e:
        print(f"❌ Error: {str(e)[:100]}...")
        print()

print("="*60)
print("🔍 Listing available models:")
print("="*60)
try:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"✅ {model.name}")
except Exception as e:
    print(f"❌ Error listing models: {e}")

