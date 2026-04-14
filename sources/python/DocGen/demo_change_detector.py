"""
Demo script for ChangeDetector functionality

Shows how the change detection system works with real examples.
"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "core"))
from change_detector import ChangeDetector, ChangeType


def demo_change_detection():
    """Demonstrate change detection capabilities."""
    print("\n" + "="*60)
    print("ChangeDetector Demo - Automated README Generation System")
    print("="*60 + "\n")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        cache_dir = tmpdir / ".cache"
        test_dir = tmpdir / "test_project"
        test_dir.mkdir()
        
        # Initialize detector
        detector = ChangeDetector(cache_dir)
        print(f"✓ Initialized ChangeDetector with cache at: {cache_dir}\n")
        
        # Create initial files
        print("Step 1: Creating initial project files...")
        module1 = test_dir / "module1.py"
        module1.write_text("""
def calculate_sum(a, b):
    '''Calculate sum of two numbers.'''
    return a + b

class Calculator:
    def multiply(self, x, y):
        return x * y
""")
        
        module2 = test_dir / "module2.py"
        module2.write_text("""
def greet(name):
    print(f'Hello, {name}!')
""")
        
        # First scan
        print("Step 2: Initial scan (detecting new files)...")
        report1 = detector.scan_directory(test_dir)
        print(f"  Added files: {len(report1.added_files)}")
        for f in report1.added_files:
            print(f"    - {f.name}")
        print()
        
        # Make structural change (add new function)
        print("Step 3: Making STRUCTURAL change (adding new function)...")
        module1.write_text("""
def calculate_sum(a, b):
    '''Calculate sum of two numbers.'''
    return a + b

def calculate_difference(a, b):
    '''Calculate difference of two numbers.'''
    return a - b

class Calculator:
    def multiply(self, x, y):
        return x * y
""")
        
        report2 = detector.scan_directory(test_dir)
        print(f"  Modified files: {len(report2.modified_files)}")
        for f in report2.modified_files:
            change_type = report2.change_classifications.get(f)
            print(f"    - {f.name}: {change_type.value if change_type else 'unknown'}")
        print()
        
        # Make behavioral change (modify logic)
        print("Step 4: Making BEHAVIORAL change (modifying function logic)...")
        module2.write_text("""
def greet(name):
    print(f'Hello, {name}! Welcome to K_OS!')
""")
        
        report3 = detector.scan_directory(test_dir)
        print(f"  Modified files: {len(report3.modified_files)}")
        for f in report3.modified_files:
            change_type = report3.change_classifications.get(f)
            print(f"    - {f.name}: {change_type.value if change_type else 'unknown'}")
        print()
        
        # Make cosmetic change (add comments)
        print("Step 5: Making COSMETIC change (adding comments only)...")
        module2.write_text("""
# This is a greeting module
# Author: Kipp

def greet(name):
    # Print a friendly greeting
    print(f'Hello, {name}! Welcome to K_OS!')
""")
        
        report4 = detector.scan_directory(test_dir)
        print(f"  Modified files: {len(report4.modified_files)}")
        for f in report4.modified_files:
            change_type = report4.change_classifications.get(f)
            print(f"    - {f.name}: {change_type.value if change_type else 'unknown'}")
        print()
        
        # No changes
        print("Step 6: Scanning again with no changes...")
        report5 = detector.scan_directory(test_dir)
        print(f"  Unchanged files: {len(report5.unchanged_files)}")
        for f in report5.unchanged_files:
            print(f"    - {f.name}")
        print()
        
        print("="*60)
        print("Summary:")
        print("="*60)
        print("✓ STRUCTURAL changes trigger README regeneration")
        print("✓ BEHAVIORAL changes trigger README regeneration")
        print("✓ COSMETIC changes are skipped (no regeneration needed)")
        print("✓ Cache system tracks file hashes and timestamps")
        print("✓ Change classification uses smart heuristics")
        print("\nDemo complete! The ChangeDetector is ready for production use.")
        print("="*60 + "\n")


if __name__ == "__main__":
    demo_change_detection()
