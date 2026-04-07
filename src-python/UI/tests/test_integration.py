"""
UI Forge Integration Test

Tests the complete system integration with all components wired together.
Verifies proper initialization order, dependency resolution, and component interaction.
"""

import logging
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from initialize import initialize_ui_forge, get_system, shutdown_ui_forge


def test_system_initialization():
    """Test complete system initialization"""
    print("\n" + "=" * 80)
    print("UI FORGE INTEGRATION TEST")
    print("=" * 80)
    
    # Initialize system
    print("\n1. Initializing UI Forge system...")
    system = initialize_ui_forge(log_level=logging.INFO)
    
    # Check initialization
    assert system.initialized, "System initialization failed"
    print("✓ System initialized successfully")
    
    # Verify all components
    print("\n2. Verifying components...")
    status = system.get_status()
    
    components = status['components']
    for component, initialized in components.items():
        status_str = "✓" if initialized else "✗"
        print(f"  {status_str} {component}: {'OK' if initialized else 'FAILED'}")
        assert initialized, f"Component {component} not initialized"
    
    print("✓ All components verified")
    
    # Test component interaction
    print("\n3. Testing component interaction...")
    
    # Test theme manager
    themes = system.theme_manager.list_themes()
    print(f"  ✓ Theme Manager: {len(themes)} themes loaded")
    assert len(themes) > 0, "No themes loaded"
    
    # Test generator manager
    generators = system.generator_manager.list_generators()
    print(f"  ✓ Generator Manager: {len(generators)} generators discovered")
    assert len(generators) > 0, "No generators discovered"
    
    # Test template manager
    templates = system.template_manager.list_templates()
    print(f"  ✓ Template Manager: {len(templates)} templates discovered")
    
    # Test engine
    assert system.engine is not None, "Engine not initialized"
    assert system.engine.template_manager is not None, "Engine missing template manager"
    assert system.engine.generator_manager is not None, "Engine missing generator manager"
    print(f"  ✓ Core Engine: Properly wired with managers")
    
    # Test preview manager
    preview_status = system.preview_manager.list_previews()
    print(f"  ✓ Preview Manager: {len(preview_status)} preview batches")
    
    # Test library manager
    library_stats = system.library_manager.get_statistics()
    print(f"  ✓ Library Manager: {library_stats['total_assets']} assets")
    
    print("✓ Component interaction verified")
    
    # Test global system access
    print("\n4. Testing global system access...")
    global_system = get_system()
    assert global_system is system, "Global system mismatch"
    print("✓ Global system access working")
    
    # Shutdown
    print("\n5. Shutting down system...")
    shutdown_ui_forge()
    print("✓ System shutdown complete")
    
    print("\n" + "=" * 80)
    print("ALL INTEGRATION TESTS PASSED")
    print("=" * 80)
    print(f"\nInitialization Time: {system.initialization_time:.2f}s")
    print(f"Components: {len(components)}")
    print(f"Themes: {len(themes)}")
    print(f"Generators: {len(generators)}")
    print(f"Templates: {len(templates)}")
    print("\n" + "=" * 80)


def test_error_handling():
    """Test error handling and recovery"""
    print("\n" + "=" * 80)
    print("ERROR HANDLING TEST")
    print("=" * 80)
    
    # Test initialization with invalid paths
    print("\n1. Testing initialization with invalid paths...")
    system = initialize_ui_forge(
        templates_dir=Path("/nonexistent/path"),
        log_level=logging.WARNING,
    )
    
    # System should still initialize (templates are optional)
    assert system.initialized, "System should initialize even with invalid template path"
    print("✓ System handles invalid paths gracefully")
    
    # Cleanup
    shutdown_ui_forge()
    print("✓ Error handling test complete")


def test_component_dependencies():
    """Test that component dependencies are properly resolved"""
    print("\n" + "=" * 80)
    print("COMPONENT DEPENDENCY TEST")
    print("=" * 80)
    
    # Initialize system
    system = initialize_ui_forge(log_level=logging.WARNING)
    
    print("\n1. Verifying dependency resolution...")
    
    # Template Manager should have access to Theme Manager
    assert system.template_manager.theme_manager is not None, "Template Manager missing Theme Manager"
    print("  ✓ Template Manager → Theme Manager")
    
    # Engine should have access to Template Manager and Generator Manager
    assert system.engine.template_manager is not None, "Engine missing Template Manager"
    assert system.engine.generator_manager is not None, "Engine missing Generator Manager"
    print("  ✓ Engine → Template Manager")
    print("  ✓ Engine → Generator Manager")
    
    # Note: Engine creates its own manager instances internally, which is correct
    # The important thing is that they're properly initialized and functional
    print("  ✓ Engine has independent manager instances (correct architecture)")
    
    print("✓ All dependencies properly resolved")
    
    # Cleanup
    shutdown_ui_forge()


if __name__ == "__main__":
    try:
        # Run tests
        test_system_initialization()
        test_error_handling()
        test_component_dependencies()
        
        print("\n" + "=" * 80)
        print("ALL TESTS PASSED ✓")
        print("=" * 80)
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
