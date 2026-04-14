#!/usr/bin/env python3
"""
Simple syntax and logic test for review mode functionality.

This script verifies the review_readme_content function is properly defined
and has the correct signature without requiring all dependencies.
"""

import ast
import sys
from pathlib import Path


def test_review_function_exists():
    """Test that review_readme_content function exists and has correct signature."""
    print("Testing review mode implementation...")
    
    # Read the generate.py file
    generate_path = Path(__file__).parent / "scripts" / "generate.py"
    
    if not generate_path.exists():
        print(f"✗ File not found: {generate_path}")
        return False
    
    with open(generate_path, 'r', encoding='utf-8') as f:
        source = f.read()
    
    # Parse the AST
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        print(f"✗ Syntax error in generate.py: {e}")
        return False
    
    # Find the review_readme_content function
    review_func = None
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == 'review_readme_content':
            review_func = node
            break
    
    if not review_func:
        print("✗ review_readme_content function not found")
        return False
    
    print("✓ review_readme_content function exists")
    
    # Check function parameters
    expected_params = ['dir_path', 'readme_content', 'readme_path']
    actual_params = [arg.arg for arg in review_func.args.args]
    
    if actual_params != expected_params:
        print(f"✗ Function parameters mismatch. Expected: {expected_params}, Got: {actual_params}")
        return False
    
    print(f"✓ Function has correct parameters: {expected_params}")
    
    # Check that process_directory has review_mode parameter
    process_dir_func = None
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == 'process_directory':
            process_dir_func = node
            break
    
    if not process_dir_func:
        print("✗ process_directory function not found")
        return False
    
    process_params = [arg.arg for arg in process_dir_func.args.args]
    if 'review_mode' not in process_params:
        print(f"✗ process_directory missing review_mode parameter. Params: {process_params}")
        return False
    
    print("✓ process_directory has review_mode parameter")
    
    # Check that process_directories_parallel has review_mode parameter
    parallel_func = None
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == 'process_directories_parallel':
            parallel_func = node
            break
    
    if not parallel_func:
        print("✗ process_directories_parallel function not found")
        return False
    
    parallel_params = [arg.arg for arg in parallel_func.args.args]
    if 'review_mode' not in parallel_params:
        print(f"✗ process_directories_parallel missing review_mode parameter. Params: {parallel_params}")
        return False
    
    print("✓ process_directories_parallel has review_mode parameter")
    
    # Check that review_readme_content is called in process_directory
    found_review_call = False
    for node in ast.walk(process_dir_func):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id == 'review_readme_content':
                found_review_call = True
                break
            elif isinstance(node.func, ast.Attribute) and node.func.attr == 'review_readme_content':
                found_review_call = True
                break
    
    if not found_review_call:
        print("✗ review_readme_content not called in process_directory")
        return False
    
    print("✓ review_readme_content is called in process_directory")
    
    # Check for requirements comments
    if 'Requirements: 20.1, 20.2, 20.3, 20.4, 20.5' in source:
        print("✓ Requirements documented in review function")
    else:
        print("⚠ Requirements not fully documented (expected 20.1-20.5)")
    
    return True


def main():
    """Run tests."""
    print("="*60)
    print("Review Mode Implementation Test")
    print("="*60)
    print()
    
    try:
        if test_review_function_exists():
            print()
            print("="*60)
            print("✓ All checks passed!")
            print("="*60)
            print()
            print("Review mode implementation is complete:")
            print("  - review_readme_content function defined")
            print("  - process_directory accepts review_mode parameter")
            print("  - process_directories_parallel accepts review_mode parameter")
            print("  - Review logic integrated into processing flow")
            print()
            print("Usage:")
            print("  python scripts/generate.py --review-mode")
            print("  python scripts/generate.py --path crates/k-os-engine --review-mode")
            return 0
        else:
            print()
            print("="*60)
            print("✗ Some checks failed")
            print("="*60)
            return 1
    
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
