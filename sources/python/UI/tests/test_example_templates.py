"""
Test loading and validating the example templates
"""

from pathlib import Path
from template_manager import TemplateManager


def test_example_templates():
    """Test loading example templates"""
    manager = TemplateManager()
    
    # Test base icon template
    base_icon = manager.load_template(Path("templates/icons/base_icon.yaml"))
    print(f"\n✓ Loaded base_icon.yaml:")
    print(f"  Name: {base_icon.name}")
    print(f"  Generator: {base_icon.generator_type}")
    print(f"  Dimensions: {base_icon.dimensions}")
    print(f"  Formats: {base_icon.output_formats}")
    
    # Test sculpt tool template with inheritance
    sculpt_tool = manager.load_template(Path("templates/icons/sculpt_tool.json"))
    print(f"\n✓ Loaded sculpt_tool.json (with inheritance):")
    print(f"  Name: {sculpt_tool.name}")
    print(f"  Category: {sculpt_tool.category}")
    print(f"  Tags: {sculpt_tool.tags}")
    print(f"  Parent: {sculpt_tool.parent_template}")
    print(f"  Dimensions (inherited): {sculpt_tool.dimensions}")
    print(f"  Padding (inherited): {sculpt_tool.params.get('padding')}")
    print(f"  Colors: {sculpt_tool.colors}")
    print(f"  Theme variants: {sculpt_tool.theme_variants}")
    
    # Test color token resolution
    if sculpt_tool.colors:
        resolved_light = manager.resolve_color_tokens(sculpt_tool.colors, "light")
        resolved_dark = manager.resolve_color_tokens(sculpt_tool.colors, "dark")
        print(f"\n✓ Color token resolution:")
        print(f"  Light theme: {sculpt_tool.colors} → {resolved_light}")
        print(f"  Dark theme: {sculpt_tool.colors} → {resolved_dark}")
    
    # Test template discovery
    all_templates = manager.list_templates()
    print(f"\n✓ Template discovery:")
    print(f"  Found {len(all_templates)} templates")
    for template in all_templates:
        print(f"    - {template.name} ({template.category})")
    
    print("\n✅ All example templates loaded successfully!")


if __name__ == "__main__":
    test_example_templates()
