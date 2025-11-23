#!/bin/bash

echo "🔧 Setting up Binance AI Agent with virtual environment..."
echo ""

# Check if venv exists
if [ -d "venv" ]; then
    echo "⚠️  Virtual environment already exists."
    read -p "Do you want to recreate it? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing old virtual environment..."
        rm -rf venv
    else
        echo "✅ Using existing virtual environment."
        source venv/bin/activate
        echo "✅ Virtual environment activated!"
        exit 0
    fi
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "✅ Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create a .env file with your Gemini API key:"
echo "   cp .env.example .env"
echo "   # Then edit .env with your API key"
echo ""
echo "2. Run the application:"
echo "   ./start.sh"
echo ""

