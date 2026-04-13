"""
Quick verification that models.py is syntactically valid.
This script just imports the module to check for syntax errors.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    # Import the models module
    from UI import models
    
    # Check that key classes exist
    assert hasattr(models, 'Template')
    assert hasattr(models, 'IconParams')
    assert hasattr(models, 'BrushParams')
    assert hasattr(models, 'AlphaParams')
    assert hasattr(models, 'AnimationConfig')
    assert hasattr(models, 'Layer')
    assert hasattr(models, 'FillStyle')
    assert hasattr(models, 'StrokeStyle')
    assert hasattr(models, 'AssetMetadata')
    assert hasattr(models, 'GenerationResult')
    
    # Check enums
    assert hasattr(models, 'GeneratorType')
    assert hasattr(models, 'OutputFormat')
    assert hasattr(models, 'AlphaMode')
    assert hasattr(models, 'MotionType')
    
    print("✓ All models imported successfully")
    print(f"✓ Template class: {models.Template.__name__}")
    print(f"✓ IconParams class: {models.IconParams.__name__}")
    print(f"✓ BrushParams class: {models.BrushParams.__name__}")
    print(f"✓ AlphaParams class: {models.AlphaParams.__name__}")
    print(f"✓ AnimationConfig class: {models.AnimationConfig.__name__}")
    print(f"✓ Total OutputFormat options: {len(models.OutputFormat)}")
    print(f"✓ Total MotionType options: {len(models.MotionType)}")
    
    print("\n=== Models module is valid! ===")
    
except Exception as e:
    print(f"✗ Error importing models: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
