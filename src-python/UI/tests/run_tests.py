#!/usr/bin/env python3
"""Simple test runner to verify all UI Forge tests pass"""
import subprocess
import sys

def main():
    print("Running UI Forge test suite...")
    print("=" * 60)
    
    result = subprocess.run(
        [sys.executable, "-m", "pytest", ".", "-v", "--tb=short"],
        capture_output=False,
        text=True
    )
    
    print("=" * 60)
    if result.returncode == 0:
        print("✓ All tests passed!")
    else:
        print(f"✗ Tests failed with exit code {result.returncode}")
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
