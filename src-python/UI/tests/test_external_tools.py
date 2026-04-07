"""
Test script for external tool integration.

Verifies that external tools are properly detected and can be used with graceful degradation.
"""

import logging
from external import get_tool_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_tool_detection():
    """Test external tool detection."""
    logger.info("=" * 60)
    logger.info("Testing External Tool Detection")
    logger.info("=" * 60)
    
    manager = get_tool_manager()
    
    # Get tool information
    tool_info = manager.get_tool_info()
    
    print("\nExternal Tool Status:")
    print("-" * 60)
    for tool_name, info in tool_info.items():
        status = "✓ Available" if info['available'] else "✗ Not Available"
        version = info['version']
        path = info['path'] or "N/A"
        
        print(f"{tool_name.upper():15} {status:20} v{version:15} {path}")
    
    print("-" * 60)
    
    # Check available tools
    available_tools = manager.get_available_tools()
    print(f"\nAvailable tools: {len(available_tools)}/{len(tool_info)}")
    
    return manager


def test_imagemagick(manager):
    """Test ImageMagick functionality."""
    logger.info("\n" + "=" * 60)
    logger.info("Testing ImageMagick")
    logger.info("=" * 60)
    
    if not manager.is_tool_available('imagemagick'):
        print("\n⚠ ImageMagick not available")
        print(manager.get_fallback_message('imagemagick', 'format conversion'))
        return
    
    imagemagick = manager.get_tool('imagemagick')
    print(f"\n✓ ImageMagick {imagemagick.get_version()} is available")
    print(f"  Path: {imagemagick._executable_path}")
    print(f"  Legacy mode: {imagemagick._legacy_mode}")


def test_inkscape(manager):
    """Test Inkscape functionality."""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Inkscape")
    logger.info("=" * 60)
    
    if not manager.is_tool_available('inkscape'):
        print("\n⚠ Inkscape not available")
        print(manager.get_fallback_message('inkscape', 'SVG optimization'))
        return
    
    inkscape = manager.get_tool('inkscape')
    print(f"\n✓ Inkscape {inkscape.get_version()} is available")
    print(f"  Path: {inkscape._executable_path}")


def test_gimp(manager):
    """Test GIMP functionality."""
    logger.info("\n" + "=" * 60)
    logger.info("Testing GIMP")
    logger.info("=" * 60)
    
    if not manager.is_tool_available('gimp'):
        print("\n⚠ GIMP not available")
        print(manager.get_fallback_message('gimp', 'batch processing'))
        return
    
    gimp = manager.get_tool('gimp')
    print(f"\n✓ GIMP {gimp.get_version()} is available")
    print(f"  Path: {gimp._executable_path}")
    print(f"  Console mode: {gimp._console_mode}")


def test_requirements_check(manager):
    """Test requirements checking."""
    logger.info("\n" + "=" * 60)
    logger.info("Testing Requirements Check")
    logger.info("=" * 60)
    
    # Test various requirement scenarios
    scenarios = [
        (['imagemagick'], "Format conversion"),
        (['inkscape'], "SVG optimization"),
        (['gimp'], "Batch processing"),
        (['imagemagick', 'inkscape'], "Advanced SVG workflow"),
        (['imagemagick', 'inkscape', 'gimp'], "Full external tool suite")
    ]
    
    print("\nRequirement Checks:")
    print("-" * 60)
    
    for required_tools, description in scenarios:
        all_available, missing = manager.check_requirements(required_tools)
        
        if all_available:
            print(f"✓ {description:40} All tools available")
        else:
            print(f"✗ {description:40} Missing: {', '.join(missing)}")
    
    print("-" * 60)


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("UI Forge External Tool Integration Test")
    print("=" * 60)
    
    # Test tool detection
    manager = test_tool_detection()
    
    # Test individual tools
    test_imagemagick(manager)
    test_inkscape(manager)
    test_gimp(manager)
    
    # Test requirements checking
    test_requirements_check(manager)
    
    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)
    print("\nNote: This test only checks tool availability.")
    print("Actual operations require valid input files.")


if __name__ == '__main__':
    main()
