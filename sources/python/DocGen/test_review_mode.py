#!/usr/bin/env python3
"""
Test script for review mode functionality.

This script tests the review_readme_content function to ensure it properly
handles user input for approve/reject/edit actions.
"""

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
from io import StringIO

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Import the review function
from scripts.generate import review_readme_content


async def test_review_approve():
    """Test approve action."""
    print("\n=== Test 1: Approve Action ===")
    
    dir_path = Path("test/directory")
    readme_content = "# Test README\n\nThis is test content."
    readme_path = Path("test/directory/README.md")
    
    # Mock user input to return 'a' (approve)
    with patch('builtins.input', return_value='a'):
        should_write, final_content = await review_readme_content(
            dir_path=dir_path,
            readme_content=readme_content,
            readme_path=readme_path
        )
    
    assert should_write == True, "Should write when approved"
    assert final_content == readme_content, "Content should be unchanged"
    print("✓ Approve action works correctly")


async def test_review_reject():
    """Test reject action."""
    print("\n=== Test 2: Reject Action ===")
    
    dir_path = Path("test/directory")
    readme_content = "# Test README\n\nThis is test content."
    readme_path = Path("test/directory/README.md")
    
    # Mock user input to return 'r' (reject)
    with patch('builtins.input', return_value='r'):
        should_write, final_content = await review_readme_content(
            dir_path=dir_path,
            readme_content=readme_content,
            readme_path=readme_path
        )
    
    assert should_write == False, "Should not write when rejected"
    assert final_content is None, "Content should be None when rejected"
    print("✓ Reject action works correctly")


async def test_review_invalid_then_approve():
    """Test invalid input followed by approve."""
    print("\n=== Test 3: Invalid Input Then Approve ===")
    
    dir_path = Path("test/directory")
    readme_content = "# Test README\n\nThis is test content."
    readme_path = Path("test/directory/README.md")
    
    # Mock user input to return invalid input first, then 'a' (approve)
    with patch('builtins.input', side_effect=['x', 'invalid', 'a']):
        should_write, final_content = await review_readme_content(
            dir_path=dir_path,
            readme_content=readme_content,
            readme_path=readme_path
        )
    
    assert should_write == True, "Should write when approved after invalid input"
    assert final_content == readme_content, "Content should be unchanged"
    print("✓ Invalid input handling works correctly")


async def test_review_keyboard_interrupt():
    """Test keyboard interrupt handling."""
    print("\n=== Test 4: Keyboard Interrupt ===")
    
    dir_path = Path("test/directory")
    readme_content = "# Test README\n\nThis is test content."
    readme_path = Path("test/directory/README.md")
    
    # Mock user input to raise KeyboardInterrupt
    with patch('builtins.input', side_effect=KeyboardInterrupt()):
        should_write, final_content = await review_readme_content(
            dir_path=dir_path,
            readme_content=readme_content,
            readme_path=readme_path
        )
    
    assert should_write == False, "Should not write when interrupted"
    assert final_content is None, "Content should be None when interrupted"
    print("✓ Keyboard interrupt handling works correctly")


async def main():
    """Run all tests."""
    print("Testing review mode functionality...")
    
    try:
        await test_review_approve()
        await test_review_reject()
        await test_review_invalid_then_approve()
        await test_review_keyboard_interrupt()
        
        print("\n" + "="*60)
        print("✓ All tests passed!")
        print("="*60)
        return 0
    
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return 1
    
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
