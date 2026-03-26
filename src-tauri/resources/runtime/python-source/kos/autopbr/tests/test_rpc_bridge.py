"""
Test JSON-RPC Bridge for AutoPBR AI/ML Functions
=================================================
Tests that all AI functions are properly registered and callable via JSON-RPC.

Validates: Requirements 11.11, 11.12, 16.2, 16.3
"""

import sys
import json
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from kos.api import _REGISTRY


def test_rpc_registration():
    """Test that all AI functions are registered in the RPC registry"""
    
    expected_functions = [
        "upscale_texture",
        "denoise_texture",
        "identify_material",
        "make_seamless",
        "correct_perspective",
        "remove_folds"
    ]
    
    print("Testing RPC function registration...")
    print(f"Total registered functions: {len(_REGISTRY)}")
    print(f"Registered functions: {list(_REGISTRY.keys())}")
    
    missing = []
    for func_name in expected_functions:
        if func_name in _REGISTRY:
            print(f"✓ {func_name} is registered")
        else:
            print(f"✗ {func_name} is NOT registered")
            missing.append(func_name)
    
    if missing:
        print(f"\nERROR: Missing functions: {missing}")
        return False
    else:
        print("\n✓ All AI functions are properly registered!")
        return True


def test_function_signatures():
    """Test that registered functions have correct signatures"""
    
    print("\nTesting function signatures...")
    
    # Test upscale_texture signature
    try:
        import inspect
        from kos.autopbr import ai_processor
        
        sig = inspect.signature(ai_processor.upscale_texture)
        params = list(sig.parameters.keys())
        assert params == ['image_base64', 'scale_factor'], f"upscale_texture has wrong params: {params}"
        print("✓ upscale_texture signature correct")
    except Exception as e:
        print(f"✗ upscale_texture signature error: {e}")
        return False
    
    # Test denoise_texture signature
    try:
        sig = inspect.signature(ai_processor.denoise_texture)
        params = list(sig.parameters.keys())
        assert params == ['image_base64', 'strength'], f"denoise_texture has wrong params: {params}"
        print("✓ denoise_texture signature correct")
    except Exception as e:
        print(f"✗ denoise_texture signature error: {e}")
        return False
    
    # Test identify_material signature
    try:
        sig = inspect.signature(ai_processor.identify_material)
        params = list(sig.parameters.keys())
        assert params == ['image_base64'], f"identify_material has wrong params: {params}"
        print("✓ identify_material signature correct")
    except Exception as e:
        print(f"✗ identify_material signature error: {e}")
        return False
    
    # Test make_seamless signature
    try:
        from kos.autopbr import inpainting
        sig = inspect.signature(inpainting.make_seamless)
        params = list(sig.parameters.keys())
        assert params == ['image_base64', 'strength'], f"make_seamless has wrong params: {params}"
        print("✓ make_seamless signature correct")
    except Exception as e:
        print(f"✗ make_seamless signature error: {e}")
        return False
    
    print("\n✓ All function signatures are correct!")
    return True


def test_error_handling():
    """Test that functions handle errors gracefully"""
    
    print("\nTesting error handling...")
    
    try:
        from kos.autopbr import ai_processor
        
        # Test with invalid base64 (should not crash)
        try:
            result = ai_processor.upscale_texture("invalid_base64", 2)
            print("✗ upscale_texture should have raised an error for invalid input")
            return False
        except Exception as e:
            print(f"✓ upscale_texture correctly raises error: {type(e).__name__}")
        
        print("\n✓ Error handling works correctly!")
        return True
    except Exception as e:
        print(f"✗ Error handling test failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("AutoPBR AI/ML RPC Bridge Tests")
    print("=" * 60)
    print()
    
    # Import modules to trigger registration
    try:
        from kos.autopbr import ai_processor, inpainting
        print("✓ Successfully imported AI modules")
    except ImportError as e:
        print(f"✗ Failed to import AI modules: {e}")
        print("Note: This is expected if dependencies are not installed.")
        print("Install with: pip install -r requirements-autopbr.txt")
        sys.exit(1)
    
    # Run tests
    results = []
    results.append(("RPC Registration", test_rpc_registration()))
    results.append(("Function Signatures", test_function_signatures()))
    results.append(("Error Handling", test_error_handling()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All tests passed!")
        sys.exit(0)
    else:
        print(f"\n✗ {total - passed} test(s) failed")
        sys.exit(1)
