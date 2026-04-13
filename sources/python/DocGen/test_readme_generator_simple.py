"""
Simple unit tests for READMEGenerator core logic

Tests the core functionality without requiring external dependencies.
"""

import sys
from pathlib import Path
from unittest.mock import Mock, AsyncMock, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Create proper mocks for lancedb
mock_lance_model = MagicMock()
mock_vector = MagicMock()
mock_field = MagicMock()

# Mock the heavy dependencies before importing
sys.modules['lancedb'] = Mock()
sys.modules['lancedb.pydantic'] = Mock(LanceModel=mock_lance_model, Vector=mock_vector)
sys.modules['pydantic'] = Mock(Field=mock_field)
sys.modules['onnxruntime'] = Mock()
sys.modules['transformers'] = Mock()
sys.modules['optimum'] = Mock()
sys.modules['optimum.onnxruntime'] = Mock()

# Import directly from the module file to avoid __init__.py
import importlib.util
spec = importlib.util.spec_from_file_location(
    "readme_generator",
    Path(__file__).parent / "core" / "readme_generator.py"
)
readme_generator_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(readme_generator_module)

READMEGenerator = readme_generator_module.READMEGenerator
DirectoryContext = readme_generator_module.DirectoryContext


def test_staleness_disclaimer_constant():
    """Test that staleness disclaimer is defined correctly."""
    expected = (
        "*This README may be out of date and inspecting the current code is the best way. "
        "NEVER ASSUME THIS README IS CURRENT ARCHITECTURE, BUT RATHER TREAT IT AS A BASELINE "
        "FOR what's in this folder*"
    )
    assert READMEGenerator.STALENESS_DISCLAIMER == expected
    print("✓ Staleness disclaimer constant is correct")


def test_build_system_prompt():
    """Test that system prompt includes all required K_OS conventions."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    system_prompt = generator.build_system_prompt()
    
    # Verify K_OS principles are present (Requirement 16.3)
    assert "Data-driven" in system_prompt, "Missing data-driven principle"
    assert "Library-first" in system_prompt, "Missing library-first principle"
    assert "GPU-first" in system_prompt, "Missing GPU-first principle"
    
    # Verify constraints are present (Requirement 16.1)
    assert "READ access" in system_prompt, "Missing read access constraint"
    assert "WRITE access ONLY to .md files" in system_prompt, "Missing write constraint"
    
    # Verify staleness disclaimer requirement (Requirement 16.2)
    assert generator.STALENESS_DISCLAIMER in system_prompt, "Missing staleness disclaimer"
    
    # Verify output format is specified (Requirement 16.4)
    assert "OUTPUT FORMAT" in system_prompt, "Missing output format"
    assert "## Overview" in system_prompt, "Missing overview section"
    assert "## Architecture" in system_prompt, "Missing architecture section"
    
    print("✓ System prompt includes all K_OS conventions and requirements")


def test_build_user_prompt_with_rust_crate():
    """Test user prompt for Rust crate directory."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    context = DirectoryContext(
        dir_path=Path("crates/k-os-engine"),
        file_tree=[Path("lib.rs"), Path("mod.rs"), Path("compute.rs")],
        cargo_toml="[package]\nname = \"k-os-engine\"\nversion = \"0.1.0\"",
        directory_type="rust_crate"
    )
    
    user_prompt = generator.build_user_prompt(context)
    
    # Verify directory info (Requirement 16.5)
    assert "crates/k-os-engine" in user_prompt
    assert "rust_crate" in user_prompt
    
    # Verify Cargo.toml is included (Requirement 16.6)
    assert "Cargo.toml" in user_prompt
    assert "k-os-engine" in user_prompt
    
    # Verify file tree is included
    assert "lib.rs" in user_prompt
    
    print("✓ User prompt includes Rust crate context")


def test_build_user_prompt_with_related_modules():
    """Test user prompt includes related modules from semantic search."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Mock SearchResult
    SearchResult = type('SearchResult', (), {
        'file_path': 'crates/k-os-gpu/lib.rs',
        'similarity_score': 0.87,
        'content_hash': 'abc123',
        'module_name': 'k_os_gpu',
        'metadata': {}
    })
    
    context = DirectoryContext(
        dir_path=Path("crates/k-os-engine"),
        directory_type="rust_crate",
        related_modules=[SearchResult()]
    )
    
    user_prompt = generator.build_user_prompt(context)
    
    # Verify related modules section (Requirement 28.2, 28.3)
    assert "Related Modules" in user_prompt
    assert "crates/k-os-gpu/lib.rs" in user_prompt
    assert "0.87" in user_prompt
    
    print("✓ User prompt includes related modules")


def test_extract_manual_sections():
    """Test extraction of manual content with preservation tags."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    readme_with_manual = """# Test Module

## Overview
Auto-generated content

<!-- MANUAL_CONTENT_START -->
## Custom Notes
These are my personal notes that should be preserved.
<!-- MANUAL_CONTENT_END -->

## More Content
More auto-generated stuff

<!-- MANUAL_CONTENT_START -->
## Another Section
More manual content here
<!-- MANUAL_CONTENT_END -->
"""
    
    manual_sections = generator.extract_manual_sections(readme_with_manual)
    
    # Verify extraction (Requirement 8.2)
    assert len(manual_sections) == 2, f"Expected 2 sections, got {len(manual_sections)}"
    assert "Custom Notes" in manual_sections[0]
    assert "personal notes" in manual_sections[0]
    assert "Another Section" in manual_sections[1]
    assert generator.MANUAL_START_TAG in manual_sections[0]
    assert generator.MANUAL_END_TAG in manual_sections[1]
    
    print("✓ Manual sections extracted correctly")


def test_merge_content():
    """Test merging generated content with manual sections."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    generated = """# Test Module

## Overview
This is generated content.

## Architecture
Data-driven patterns.
"""
    
    manual_sections = [
        "<!-- MANUAL_CONTENT_START -->\n## Notes\nManual notes\n<!-- MANUAL_CONTENT_END -->"
    ]
    
    merged = generator.merge_content(generated, manual_sections)
    
    # Verify merge (Requirement 8.3)
    assert "generated content" in merged
    assert "Manual notes" in merged
    assert "Manual Sections" in merged
    # Generated content should come before manual
    assert merged.index("generated content") < merged.index("Manual notes")
    
    print("✓ Content merged correctly")


def test_ensure_staleness_disclaimer():
    """Test staleness disclaimer enforcement at top of README."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Test 1: Content without disclaimer
    content_no_disclaimer = """# Test Module

## Overview
Some content here
"""
    
    result = generator._ensure_staleness_disclaimer(content_no_disclaimer)
    
    # Verify disclaimer is added (Requirement 2.1, 2.3)
    assert generator.STALENESS_DISCLAIMER in result
    lines = result.split('\n')
    title_idx = next(i for i, line in enumerate(lines) if line.startswith('# '))
    disclaimer_idx = next(i for i, line in enumerate(lines) if generator.STALENESS_DISCLAIMER in line)
    assert disclaimer_idx > title_idx, "Disclaimer should be after title"
    
    # Test 2: Content with disclaimer in wrong place
    content_wrong_place = """# Test Module

## Overview
Some content

*This README may be out of date and inspecting the current code is the best way. NEVER ASSUME THIS README IS CURRENT ARCHITECTURE, BUT RATHER TREAT IT AS A BASELINE FOR what's in this folder*
"""
    
    result2 = generator._ensure_staleness_disclaimer(content_wrong_place)
    lines2 = result2.split('\n')
    title_idx2 = next(i for i, line in enumerate(lines2) if line.startswith('# '))
    disclaimer_idx2 = next(i for i, line in enumerate(lines2) if generator.STALENESS_DISCLAIMER in line)
    assert disclaimer_idx2 > title_idx2, "Disclaimer should be moved after title"
    assert disclaimer_idx2 < 5, "Disclaimer should be near the top"
    
    print("✓ Staleness disclaimer enforced correctly")


def test_detect_directory_type():
    """Test directory type detection for various scenarios."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Test Rust crate
    assert generator._detect_directory_type(
        Path("crates/k-os-engine"),
        [Path("Cargo.toml"), Path("lib.rs")]
    ) == "rust_crate"
    
    # Test React app (K*.tsx pattern)
    assert generator._detect_directory_type(
        Path("src-frontend/features/sculpting"),
        [Path("KSculpt.tsx"), Path("index.ts")]
    ) == "react_app"
    
    # Test UI components
    assert generator._detect_directory_type(
        Path("src-frontend/ui"),
        [Path("Button.tsx"), Path("Panel.tsx")]
    ) == "ui_components"
    
    # Test GPU shaders
    assert generator._detect_directory_type(
        Path("crates/gpu/shaders"),
        [Path("compute.wgsl"), Path("vertex.wgsl")]
    ) == "gpu_shaders"
    
    # Test TypeScript module
    assert generator._detect_directory_type(
        Path("src-frontend/services"),
        [Path("client.ts"), Path("types.ts")]
    ) == "typescript_module"
    
    # Test Python module
    assert generator._detect_directory_type(
        Path("sources/python/kos"),
        [Path("__init__.py"), Path("main.py")]
    ) == "python_module"
    
    print("✓ Directory type detection works for all cases")


def test_identify_key_files():
    """Test identification of key files based on directory type."""
    llm_client = Mock()
    file_access = Mock()
    lance_db = Mock()
    
    generator = READMEGenerator(llm_client, file_access, lance_db)
    
    # Test Rust crate - should identify lib.rs
    rust_files = [Path("lib.rs"), Path("mod.rs"), Path("utils.rs")]
    key_files = generator._identify_key_files(
        Path("crates/test"),
        rust_files,
        "rust_crate"
    )
    assert Path("lib.rs") in key_files
    
    # Test React app - should identify K*.tsx
    react_files = [Path("KSculpt.tsx"), Path("index.ts"), Path("types.ts")]
    key_files = generator._identify_key_files(
        Path("src-frontend/features/sculpting"),
        react_files,
        "react_app"
    )
    assert Path("KSculpt.tsx") in key_files
    
    # Test TypeScript module - should identify index.ts
    ts_files = [Path("index.ts"), Path("client.ts"), Path("types.ts")]
    key_files = generator._identify_key_files(
        Path("src-frontend/services"),
        ts_files,
        "typescript_module"
    )
    assert Path("index.ts") in key_files
    
    print("✓ Key file identification works correctly")


def run_tests():
    """Run all tests."""
    print("Running READMEGenerator core logic tests...\n")
    
    test_staleness_disclaimer_constant()
    test_build_system_prompt()
    test_build_user_prompt_with_rust_crate()
    test_build_user_prompt_with_related_modules()
    test_extract_manual_sections()
    test_merge_content()
    test_ensure_staleness_disclaimer()
    test_detect_directory_type()
    test_identify_key_files()
    
    print("\n✅ All core logic tests passed!")
    print("\nImplementation verified:")
    print("  ✓ System prompt with K_OS conventions (Req 16.1-16.4)")
    print("  ✓ User prompt with directory context (Req 16.5-16.7)")
    print("  ✓ Manual section preservation (Req 8.2)")
    print("  ✓ Content merging (Req 8.3)")
    print("  ✓ Staleness disclaimer enforcement (Req 2.1-2.3)")
    print("  ✓ Directory type detection (Req 8.3)")
    print("  ✓ Related modules integration (Req 28.1-28.3)")


if __name__ == "__main__":
    run_tests()
