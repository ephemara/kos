"""
Unit tests for READMEGenerator

Tests the core functionality of README generation including:
- System prompt building with K_OS conventions
- User prompt building with directory context
- Manual section extraction and preservation
- Content merging
- Staleness disclaimer enforcement
"""

import asyncio
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.readme_generator import READMEGenerator, DirectoryContext
from core.llm_client import LLMResponse
from core.lance_db import SearchResult


def test_build_system_prompt():
    """Test that system prompt includes all required elements."""
    # Create mock dependencies
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    system_prompt = generator.build_system_prompt()
    
    # Verify key elements are present
    assert "K_OS DCC Suite" in system_prompt
    assert "READ access" in system_prompt
    assert "WRITE access ONLY to .md files" in system_prompt
    assert generator.STALENESS_DISCLAIMER in system_prompt
    assert "Data-driven" in system_prompt
    assert "Library-first" in system_prompt
    assert "GPU-first" in system_prompt
    assert "OUTPUT FORMAT" in system_prompt
    
    print("✓ System prompt includes all required elements")


def test_build_user_prompt():
    """Test that user prompt includes directory context."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Create test context
    context = DirectoryContext(
        dir_path=Path("crates/k-os-engine"),
        file_tree=[Path("lib.rs"), Path("mod.rs")],
        cargo_toml="[package]\nname = \"k-os-engine\"",
        directory_type="rust_crate",
        related_modules=[
            SearchResult(
                file_path="crates/k-os-gpu/lib.rs",
                similarity_score=0.85,
                content_hash="abc123",
                module_name="k_os_gpu",
                metadata={}
            )
        ]
    )
    
    user_prompt = generator.build_user_prompt(context)
    
    # Verify context elements are present
    assert "crates/k-os-engine" in user_prompt
    assert "rust_crate" in user_prompt
    assert "lib.rs" in user_prompt
    assert "Cargo.toml" in user_prompt
    assert "k-os-engine" in user_prompt
    assert "Related Modules" in user_prompt
    assert "crates/k-os-gpu/lib.rs" in user_prompt
    assert "0.85" in user_prompt
    
    print("✓ User prompt includes directory context")


def test_extract_manual_sections():
    """Test extraction of manual content sections."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Test README with manual sections
    existing_readme = """# Test Module

*Staleness disclaimer*

## Overview
Auto-generated content

<!-- MANUAL_CONTENT_START -->
## Custom Section
This is manually added content that should be preserved.
<!-- MANUAL_CONTENT_END -->

## More Content
More auto-generated content

<!-- MANUAL_CONTENT_START -->
## Another Custom Section
More manual content
<!-- MANUAL_CONTENT_END -->
"""
    
    manual_sections = generator.extract_manual_sections(existing_readme)
    
    assert len(manual_sections) == 2
    assert "Custom Section" in manual_sections[0]
    assert "manually added content" in manual_sections[0]
    assert "Another Custom Section" in manual_sections[1]
    assert generator.MANUAL_START_TAG in manual_sections[0]
    assert generator.MANUAL_END_TAG in manual_sections[0]
    
    print("✓ Manual sections extracted correctly")


def test_merge_content():
    """Test merging of generated and manual content."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    generated = """# Test Module

## Overview
Generated content here
"""
    
    manual_sections = [
        "<!-- MANUAL_CONTENT_START -->\n## Custom\nManual content\n<!-- MANUAL_CONTENT_END -->"
    ]
    
    merged = generator.merge_content(generated, manual_sections)
    
    assert "Generated content here" in merged
    assert "Manual content" in merged
    assert "Manual Sections" in merged
    assert merged.index("Generated content") < merged.index("Manual content")
    
    print("✓ Content merged correctly")


def test_ensure_staleness_disclaimer():
    """Test that staleness disclaimer is enforced at top."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Test content without disclaimer
    content_without = """# Test Module

## Overview
Some content
"""
    
    result = generator._ensure_staleness_disclaimer(content_without)
    
    assert generator.STALENESS_DISCLAIMER in result
    # Disclaimer should be after title
    lines = result.split('\n')
    title_idx = next(i for i, line in enumerate(lines) if line.startswith('# '))
    disclaimer_idx = next(i for i, line in enumerate(lines) if generator.STALENESS_DISCLAIMER in line)
    assert disclaimer_idx > title_idx
    
    print("✓ Staleness disclaimer enforced correctly")


def test_detect_directory_type():
    """Test directory type detection."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Test Rust crate detection
    rust_files = [Path("Cargo.toml"), Path("lib.rs")]
    assert generator._detect_directory_type(Path("crates/test"), rust_files) == "rust_crate"
    
    # Test React app detection
    react_files = [Path("KSculpt.tsx"), Path("index.ts")]
    assert generator._detect_directory_type(Path("src-frontend/features/sculpting"), react_files) == "react_app"
    
    # Test UI directory detection
    ui_files = [Path("Button.tsx"), Path("Panel.tsx")]
    assert generator._detect_directory_type(Path("src-frontend/ui"), ui_files) == "ui_components"
    
    # Test GPU shader detection
    shader_files = [Path("compute.wgsl"), Path("vertex.wgsl")]
    assert generator._detect_directory_type(Path("crates/gpu/shaders"), shader_files) == "gpu_shaders"
    
    print("✓ Directory type detection works correctly")


async def test_generate_readme_integration():
    """Integration test for full README generation flow."""
    # Create mocks
    llm_client = Mock()
    llm_client.generate = AsyncMock(return_value=LLMResponse(
        content="""# Test Module

*This README may be out of date...*

## Overview
This is a test module for the K_OS system.

## Architecture
Uses data-driven patterns.
""",
        prompt_tokens=1000,
        completion_tokens=500,
        model="test-model",
        cost_usd=0.01
    ))
    
    file_access = Mock()
    file_access.root_path = Path("/test/root")
    file_access.list_directory = Mock(return_value=[Path("lib.rs"), Path("mod.rs")])
    file_access.file_exists = Mock(return_value=False)
    
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Generate README
    context = DirectoryContext(
        dir_path=Path("crates/test"),
        file_tree=[Path("lib.rs")],
        directory_type="rust_crate"
    )
    
    readme = await generator.generate_readme(Path("crates/test"), context)
    
    # Verify result
    assert "Test Module" in readme
    assert generator.STALENESS_DISCLAIMER in readme
    assert "Overview" in readme
    assert llm_client.generate.called
    
    print("✓ Full README generation flow works")


def run_tests():
    """Run all tests."""
    print("Running READMEGenerator tests...\n")
    
    test_build_system_prompt()
    test_build_user_prompt()
    test_extract_manual_sections()
    test_merge_content()
    test_ensure_staleness_disclaimer()
    test_detect_directory_type()
    
    # Run async test
    asyncio.run(test_generate_readme_integration())
    
    print("\n✅ All tests passed!")


if __name__ == "__main__":
    run_tests()
