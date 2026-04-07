#!/usr/bin/env python3
"""
Test script for parallel directory processing.

This script tests the parallel processing functionality without making actual API calls.
"""

import asyncio
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from scripts.generate import (
    GenerationResult,
    process_directories_parallel,
    aggregate_results,
    report_progress
)


# Mock classes for testing
class MockFileAccess:
    def __init__(self, root_path):
        self.root_path = root_path
    
    def write_file(self, path, content):
        print(f"[MOCK] Would write to: {path}")


class MockLLMClient:
    def __init__(self):
        self._last_response_cost = 0.15  # Mock cost
    
    async def generate(self, system_prompt, user_prompt):
        # Simulate API delay
        await asyncio.sleep(0.5)
        
        @dataclass
        class MockResponse:
            content: str
            cost_usd: float
        
        return MockResponse(
            content="# Mock README\n\nThis is a test README.",
            cost_usd=0.15
        )


class MockREADMEGenerator:
    def __init__(self, llm_client, file_access, lance_db):
        self.llm_client = llm_client
        self.file_access = file_access
        self.lance_db = lance_db
    
    async def generate_readme(self, dir_path):
        # Simulate README generation
        response = await self.llm_client.generate(
            system_prompt="Test system prompt",
            user_prompt="Test user prompt"
        )
        return response.content


async def test_parallel_processing():
    """Test parallel directory processing with mock objects."""
    print("Testing parallel directory processing...\n")
    
    # Create mock directories
    root_path = Path("M:/K_OS")
    test_dirs = [
        root_path / "crates" / "test1",
        root_path / "crates" / "test2",
        root_path / "crates" / "test3",
        root_path / "src-frontend" / "test4",
        root_path / "src-frontend" / "test5",
    ]
    
    # Initialize mock services
    file_access = MockFileAccess(root_path)
    llm_client = MockLLMClient()
    lance_db = None  # Not needed for this test
    readme_generator = MockREADMEGenerator(llm_client, file_access, lance_db)
    
    # Test with concurrency=3
    print(f"Processing {len(test_dirs)} directories with concurrency=3")
    print(f"Rate limit delay: 0.2s\n")
    
    import time
    start_time = time.time()
    
    results = await process_directories_parallel(
        directories=test_dirs,
        readme_generator=readme_generator,
        file_access=file_access,
        max_concurrency=3,
        rate_limit_delay=0.2
    )
    
    # Report results
    report_progress(results, start_time)
    
    # Verify results
    stats = aggregate_results(results)
    
    print("\nTest Results:")
    print(f"  Total directories: {stats['total']}")
    print(f"  Successful: {stats['successful']}")
    print(f"  Failed: {stats['failed']}")
    print(f"  Total cost: ${stats['total_cost_usd']:.4f}")
    
    # Check if all succeeded
    if stats['successful'] == len(test_dirs):
        print("\n✓ All directories processed successfully!")
        return 0
    else:
        print("\n✗ Some directories failed!")
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(test_parallel_processing())
    sys.exit(exit_code)
