#!/usr/bin/env python3
"""
General AI Agent - CLI chat loop and API entrypoint.

Usage:
  python main.py         # interactive CLI chat
  python main.py --api   # run the FastAPI server
"""
import argparse
import asyncio

from agent import GeneralAgent
from config import settings


async def chat_loop():
    settings.validate_config()
    print("Initializing General AI Agent...")
    agent = await GeneralAgent().setup()
    print("Ready. Type 'exit' to quit.\n")

    thread_id = "cli-session"
    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if user_input.lower() in {"exit", "quit"}:
            break
        if not user_input:
            continue

        response = await agent.chat(user_input, thread_id=thread_id)
        print(f"Agent: {response}\n")


def run_api():
    from api import start_server

    print("Starting General AI Agent API Server...")
    print("Make sure you have configured your .env file with API keys")
    start_server()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="General AI Agent")
    parser.add_argument(
        "--api", action="store_true", help="Run the FastAPI server instead of the CLI chat loop"
    )
    args = parser.parse_args()

    if args.api:
        run_api()
    else:
        asyncio.run(chat_loop())
