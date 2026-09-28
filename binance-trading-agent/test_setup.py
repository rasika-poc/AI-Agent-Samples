#!/usr/bin/env python3
"""
Test script to verify the Binance AI Agent setup
"""

import sys

def test_imports():
    """Test that all required imports work"""
    print("🧪 Testing imports...")
    
    try:
        from config import settings
        print("✅ config module imported")
        
        from langchain_tools import get_binance_tools
        print("✅ langchain_tools module imported")
        
        from agent import BinanceLangChainAgent
        print("✅ agent module imported")
        
        print("\n✅ All imports successful!")
        return True
    except ImportError as e:
        print(f"\n❌ Import error: {e}")
        return False


def test_binance_api():
    """Test Binance public API"""
    print("\n🧪 Testing Binance public API...")
    
    try:
        from langchain_tools import BinancePublicAPI
        
        # Test getting Bitcoin price
        data = BinancePublicAPI.get_price("BTCUSDT")
        price = float(data['price'])
        print(f"✅ Successfully fetched BTC price: ${price:,.2f}")
        
        return True
    except Exception as e:
        print(f"❌ Binance API error: {e}")
        return False


def test_config():
    """Test configuration"""
    print("\n🧪 Testing configuration...")
    
    try:
        from config import settings
        
        if settings.GEMINI_API_KEY:
            print(f"✅ Gemini API key is set (length: {len(settings.GEMINI_API_KEY)})")
        else:
            print("⚠️  Gemini API key is not set in .env file")
            print("   The agent will not work without it!")
            return False
        
        print(f"✅ API Host: {settings.API_HOST}")
        print(f"✅ API Port: {settings.API_PORT}")
        
        return True
    except Exception as e:
        print(f"❌ Config error: {e}")
        return False


def main():
    """Run all tests"""
    print("="*50)
    print("🚀 Binance AI Agent - Setup Test")
    print("="*50)
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("Binance API", test_binance_api()))
    results.append(("Configuration", test_config()))
    
    print("\n" + "="*50)
    print("📊 Test Results")
    print("="*50)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "="*50)
    if all_passed:
        print("✅ All tests passed! Ready to start the server.")
        print("\nRun: ./start.sh")
    else:
        print("❌ Some tests failed. Please fix the issues above.")
        if not results[2][1]:  # Config test failed
            print("\nTo fix: Add your Gemini API key to .env file")
    print("="*50)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())

