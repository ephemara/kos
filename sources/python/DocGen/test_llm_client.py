"""
Quick test script for LLMClient

This script tests the LLMClient implementation with a simple prompt.
Run with: python -m DocGen.test_llm_client
"""

import asyncio
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from core.llm_client import LLMClient, LLMResponse


async def test_llm_client():
    """Test LLMClient with a simple prompt."""
    
    # Load environment variables
    env_path = Path(__file__).parent / '.env.local'
    load_dotenv(env_path)
    
    # Load config
    config_path = Path(__file__).parent / 'docgen_config.json'
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    print("=" * 60)
    print("LLMClient Test")
    print("=" * 60)
    
    # Create client from config
    try:
        client = LLMClient.from_config(config['llm'])
        print(f"✓ Client initialized: {client.provider} / {client.model}")
    except ValueError as e:
        print(f"✗ Failed to initialize client: {e}")
        print("\nMake sure to set your API key in .env.local:")
        print(f"  OPENROUTER_API_KEY=your_key_here")
        return
    
    # Test prompt
    system_prompt = """You are a helpful AI assistant that provides concise, 
    accurate responses."""
    
    user_prompt = """What are the three key principles of good documentation? 
    Answer in 2-3 sentences."""
    
    print("\nSending test request...")
    print(f"System: {system_prompt[:50]}...")
    print(f"User: {user_prompt[:50]}...")
    
    try:
        # Generate response
        response = await client.generate(system_prompt, user_prompt, max_tokens=200)
        
        print("\n" + "=" * 60)
        print("Response:")
        print("=" * 60)
        print(response.content)
        print("\n" + "=" * 60)
        print("Usage Statistics:")
        print("=" * 60)
        print(f"Prompt tokens: {response.prompt_tokens}")
        print(f"Completion tokens: {response.completion_tokens}")
        print(f"Cost: ${response.cost_usd:.4f}")
        
        # Get cumulative stats
        stats = client.get_usage_stats()
        print("\n" + "=" * 60)
        print("Cumulative Statistics:")
        print("=" * 60)
        print(f"Total requests: {stats['request_count']}")
        print(f"Total tokens: {stats['total_tokens']}")
        print(f"Total cost: ${stats['total_cost_usd']:.4f}")
        
        print("\n✓ Test completed successfully!")
        
    except Exception as e:
        print(f"\n✗ Request failed: {e}")
        import traceback
        traceback.print_exc()


async def test_retry_logic():
    """Test exponential backoff retry logic with invalid API key."""
    
    print("\n" + "=" * 60)
    print("Testing Retry Logic (with invalid key)")
    print("=" * 60)
    
    # Create client with invalid key
    client = LLMClient(
        provider='openrouter',
        model='anthropic/claude-3.5-sonnet',
        api_key='invalid_key_for_testing',
        max_tokens=100
    )
    
    print("Attempting request with invalid API key...")
    print("(Should retry 5 times with exponential backoff: 1s, 2s, 4s, 8s, 16s)")
    
    try:
        await client.generate("Test", "Test")
        print("✗ Unexpected success")
    except Exception as e:
        print(f"\n✓ Failed as expected after retries: {type(e).__name__}")


async def test_cost_estimation():
    """Test cost estimation logic."""
    
    print("\n" + "=" * 60)
    print("Testing Cost Estimation")
    print("=" * 60)
    
    client = LLMClient(
        provider='openrouter',
        model='test-model',
        api_key='test-key',
        pricing={
            'prompt_tokens_per_dollar': 1000000,  # $1 per 1M tokens
            'completion_tokens_per_dollar': 500000  # $2 per 1M tokens
        }
    )
    
    # Test various token counts
    test_cases = [
        (1000, 500, 0.002),  # 1k prompt + 500 completion = $0.002
        (10000, 5000, 0.020),  # 10k prompt + 5k completion = $0.020
        (100000, 50000, 0.200),  # 100k prompt + 50k completion = $0.200
    ]
    
    for prompt_tokens, completion_tokens, expected_cost in test_cases:
        cost = client.estimate_cost(prompt_tokens, completion_tokens)
        print(f"Tokens: {prompt_tokens:6d} prompt + {completion_tokens:6d} completion = ${cost:.4f}")
        assert abs(cost - expected_cost) < 0.0001, f"Cost mismatch: {cost} != {expected_cost}"
    
    print("\n✓ Cost estimation working correctly!")


async def main():
    """Run all tests."""
    
    # Test 1: Basic functionality (requires valid API key)
    await test_llm_client()
    
    # Test 2: Cost estimation (no API key needed)
    await test_cost_estimation()
    
    # Test 3: Retry logic (optional - takes ~30 seconds)
    # Uncomment to test:
    # await test_retry_logic()


if __name__ == '__main__':
    asyncio.run(main())
