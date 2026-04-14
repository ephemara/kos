"""
Unit tests for ChangeDetector

Tests file change detection, hash computation, and change classification.
"""

import sys
import tempfile
import shutil
from pathlib import Path

# Import directly from the module to avoid dependency issues
sys.path.insert(0, str(Path(__file__).parent / "core"))
from change_detector import ChangeDetector, ChangeType, ChangeReport


def test_compute_file_hash():
    """Test SHA-256 hash computation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        # Create test file
        test_file = tmpdir / "test.py"
        test_file.write_text("def hello():\n    print('Hello')\n")
        
        # Compute hash
        hash1 = detector.compute_file_hash(test_file)
        assert len(hash1) == 64  # SHA-256 produces 64 hex characters
        
        # Same content should produce same hash
        hash2 = detector.compute_file_hash(test_file)
        assert hash1 == hash2
        
        # Different content should produce different hash
        test_file.write_text("def goodbye():\n    print('Goodbye')\n")
        hash3 = detector.compute_file_hash(test_file)
        assert hash1 != hash3
        
        print("✓ Hash computation test passed")


def test_classify_change_structural():
    """Test structural change classification."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        old_content = """
def hello():
    print('Hello')
"""
        
        new_content = """
def hello():
    print('Hello')

def goodbye():
    print('Goodbye')
"""
        
        change_type = detector.classify_change(old_content, new_content)
        assert change_type == ChangeType.STRUCTURAL
        
        print("✓ Structural change classification test passed")


def test_classify_change_behavioral():
    """Test behavioral change classification."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        old_content = """
def hello():
    print('Hello')
"""
        
        new_content = """
def hello():
    print('Hello, World!')
"""
        
        change_type = detector.classify_change(old_content, new_content)
        assert change_type == ChangeType.BEHAVIORAL
        
        print("✓ Behavioral change classification test passed")


def test_classify_change_cosmetic():
    """Test cosmetic change classification."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        old_content = """
def hello():
    print('Hello')
"""
        
        new_content = """
# This is a comment
def hello():
    # Another comment
    print('Hello')
"""
        
        change_type = detector.classify_change(old_content, new_content)
        assert change_type == ChangeType.COSMETIC
        
        print("✓ Cosmetic change classification test passed")


def test_scan_directory_added_files():
    """Test detection of added files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        # Create test directory with files
        test_dir = tmpdir / "test_project"
        test_dir.mkdir()
        
        file1 = test_dir / "module1.py"
        file1.write_text("def func1(): pass")
        
        # First scan - should detect as added
        report = detector.scan_directory(test_dir)
        assert len(report.added_files) == 1
        assert file1 in report.added_files
        
        print("✓ Added files detection test passed")


def test_scan_directory_modified_files():
    """Test detection of modified files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        # Create test directory with files
        test_dir = tmpdir / "test_project"
        test_dir.mkdir()
        
        file1 = test_dir / "module1.py"
        file1.write_text("def func1(): pass")
        
        # First scan - cache the file
        report1 = detector.scan_directory(test_dir)
        assert len(report1.added_files) == 1
        
        # Modify the file
        file1.write_text("def func1():\n    return 42")
        
        # Second scan - should detect as modified
        report2 = detector.scan_directory(test_dir)
        assert len(report2.modified_files) == 1
        assert file1 in report2.modified_files
        assert file1 in report2.change_classifications
        
        print("✓ Modified files detection test passed")


def test_scan_directory_unchanged_files():
    """Test detection of unchanged files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        # Create test directory with files
        test_dir = tmpdir / "test_project"
        test_dir.mkdir()
        
        file1 = test_dir / "module1.py"
        file1.write_text("def func1(): pass")
        
        # First scan
        report1 = detector.scan_directory(test_dir)
        
        # Second scan without changes
        report2 = detector.scan_directory(test_dir)
        assert len(report2.unchanged_files) == 1
        assert file1 in report2.unchanged_files
        
        print("✓ Unchanged files detection test passed")


def test_update_cache():
    """Test cache update functionality."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        detector = ChangeDetector(cache_dir)
        
        # Create test file
        test_file = tmpdir / "test.py"
        test_file.write_text("def hello(): pass")
        
        # Update cache
        file_hash = detector.compute_file_hash(test_file)
        detector.update_cache(test_file, file_hash)
        
        # Verify cache entry exists
        assert str(test_file) in detector.cache
        assert detector.cache[str(test_file)]['hash'] == file_hash
        assert 'timestamp' in detector.cache[str(test_file)]
        assert 'last_analyzed' in detector.cache[str(test_file)]
        
        print("✓ Cache update test passed")


def run_all_tests():
    """Run all tests."""
    print("\n=== Running ChangeDetector Tests ===\n")
    
    test_compute_file_hash()
    test_classify_change_structural()
    test_classify_change_behavioral()
    test_classify_change_cosmetic()
    test_scan_directory_added_files()
    test_scan_directory_modified_files()
    test_scan_directory_unchanged_files()
    test_update_cache()
    
    print("\n=== All ChangeDetector Tests Passed ===\n")


if __name__ == "__main__":
    run_all_tests()
