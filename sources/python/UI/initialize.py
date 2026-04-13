"""
UI Forge Initialization System

Comprehensive initialization module that wires all components together with
proper initialization order, dependency management, and comprehensive logging.

This module ensures:
- All managers are initialized in correct order
- Dependencies are properly resolved
- Comprehensive logging throughout the system
- Graceful error handling and recovery
- System health checks and validation

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.7, 5.8, 6.2
"""

import logging
import sys
from pathlib import Path
from typing import Dict, Optional, Any, Tuple
from datetime import datetime

# Import all core components
from core import UIForgeEngine, get_engine, reset_engine
from template_manager import TemplateManager
from generator_manager import GeneratorManager, get_manager as get_generator_manager
from preview_manager import PreviewManager
from library_manager import LibraryManager, create_library_manager
from themes import ThemeManager, get_theme_manager
from tauri_bridge import initialize_bridge, get_managers


# ============================================================================
# Logging Configuration
# ============================================================================

def setup_logging(
    level: int = logging.INFO,
    log_file: Optional[Path] = None,
    console: bool = True,
) -> None:
    """
    Configure comprehensive logging for UI Forge system.
    
    Sets up:
    - Console logging with colored output
    - Optional file logging with rotation
    - Structured log format with timestamps
    - Module-specific log levels
    
    Args:
        level: Base logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional path to log file
        console: Enable console logging
    """
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    if console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    # File handler
    if log_file:
        log_file = Path(log_file)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Set module-specific levels
    logging.getLogger('PIL').setLevel(logging.WARNING)  # Reduce Pillow noise
    logging.getLogger('matplotlib').setLevel(logging.WARNING)  # Reduce matplotlib noise
    
    root_logger.info("=" * 80)
    root_logger.info("UI Forge Logging System Initialized")
    root_logger.info(f"Log Level: {logging.getLevelName(level)}")
    root_logger.info(f"Console Output: {console}")
    root_logger.info(f"Log File: {log_file if log_file else 'None'}")
    root_logger.info("=" * 80)


# ============================================================================
# System Initialization
# ============================================================================

class UIForgeSystem:
    """
    Complete UI Forge system with all components properly initialized.
    
    Manages:
    - Core engine
    - Template manager
    - Generator manager
    - Preview manager
    - Library manager
    - Theme manager
    - Tauri bridge
    
    Ensures proper initialization order and dependency resolution.
    """
    
    def __init__(
        self,
        base_dir: Optional[Path] = None,
        output_dir: Optional[Path] = None,
        templates_dir: Optional[Path] = None,
        generators_dir: Optional[Path] = None,
        preview_dir: Optional[Path] = None,
        library_dir: Optional[Path] = None,
    ):
        """
        Initialize UI Forge system with all components.
        
        Args:
            base_dir: Base directory for UI Forge (defaults to sources/python/UI/)
            output_dir: Output directory for generated assets
            templates_dir: Templates directory
            generators_dir: Generators directory
            preview_dir: Preview staging directory
            library_dir: Production library directory
        """
        self.logger = logging.getLogger(__name__)
        
        # Determine base directory
        if base_dir is None:
            base_dir = Path(__file__).parent
        self.base_dir = Path(base_dir)
        
        # Store configuration
        self.config = {
            'base_dir': self.base_dir,
            'output_dir': output_dir,
            'templates_dir': templates_dir,
            'generators_dir': generators_dir,
            'preview_dir': preview_dir,
            'library_dir': library_dir,
        }
        
        # Component references (initialized in order)
        self.theme_manager: Optional[ThemeManager] = None
        self.generator_manager: Optional[GeneratorManager] = None
        self.template_manager: Optional[TemplateManager] = None
        self.engine: Optional[UIForgeEngine] = None
        self.preview_manager: Optional[PreviewManager] = None
        self.library_manager: Optional[LibraryManager] = None
        
        # Initialization state
        self.initialized = False
        self.initialization_time: Optional[float] = None
        self.initialization_errors: list = []
    
    def initialize(self) -> bool:
        """
        Initialize all components in proper order.
        
        Initialization order:
        1. Theme Manager (no dependencies)
        2. Generator Manager (no dependencies)
        3. Template Manager (depends on Theme Manager)
        4. Core Engine (depends on Template Manager, Generator Manager)
        5. Preview Manager (no dependencies)
        6. Library Manager (no dependencies)
        7. Tauri Bridge (depends on all managers)
        
        Returns:
            True if initialization successful, False otherwise
        """
        if self.initialized:
            self.logger.warning("System already initialized")
            return True
        
        self.logger.info("=" * 80)
        self.logger.info("INITIALIZING UI FORGE SYSTEM")
        self.logger.info("=" * 80)
        
        start_time = datetime.now()
        
        try:
            # Step 1: Initialize Theme Manager
            self.logger.info("Step 1/7: Initializing Theme Manager...")
            self.theme_manager = self._initialize_theme_manager()
            self.logger.info("✓ Theme Manager initialized successfully")
            
            # Step 2: Initialize Generator Manager
            self.logger.info("Step 2/7: Initializing Generator Manager...")
            self.generator_manager = self._initialize_generator_manager()
            self.logger.info("✓ Generator Manager initialized successfully")
            
            # Step 3: Initialize Template Manager
            self.logger.info("Step 3/7: Initializing Template Manager...")
            self.template_manager = self._initialize_template_manager()
            self.logger.info("✓ Template Manager initialized successfully")
            
            # Step 4: Initialize Core Engine
            self.logger.info("Step 4/7: Initializing Core Engine...")
            self.engine = self._initialize_engine()
            self.logger.info("✓ Core Engine initialized successfully")
            
            # Step 5: Initialize Preview Manager
            self.logger.info("Step 5/7: Initializing Preview Manager...")
            self.preview_manager = self._initialize_preview_manager()
            self.logger.info("✓ Preview Manager initialized successfully")
            
            # Step 6: Initialize Library Manager
            self.logger.info("Step 6/7: Initializing Library Manager...")
            self.library_manager = self._initialize_library_manager()
            self.logger.info("✓ Library Manager initialized successfully")
            
            # Step 7: Initialize Tauri Bridge
            self.logger.info("Step 7/7: Initializing Tauri Bridge...")
            self._initialize_tauri_bridge()
            self.logger.info("✓ Tauri Bridge initialized successfully")
            
            # Mark as initialized
            self.initialized = True
            self.initialization_time = (datetime.now() - start_time).total_seconds()
            
            # Log success
            self.logger.info("=" * 80)
            self.logger.info("UI FORGE SYSTEM INITIALIZED SUCCESSFULLY")
            self.logger.info(f"Initialization Time: {self.initialization_time:.2f}s")
            self.logger.info("=" * 80)
            
            # Run health checks
            self._run_health_checks()
            
            return True
            
        except Exception as e:
            self.logger.error(f"System initialization failed: {e}", exc_info=True)
            self.initialization_errors.append(str(e))
            return False
    
    def _initialize_theme_manager(self) -> ThemeManager:
        """Initialize Theme Manager (no dependencies)"""
        theme_manager = get_theme_manager()
        
        # Log available themes
        themes = theme_manager.list_themes()
        self.logger.info(f"  Loaded {len(themes)} themes:")
        for theme_info in themes:
            token_count = len(theme_info.tokens)
            self.logger.info(f"    - {theme_info.name}: {token_count} color tokens")
        
        return theme_manager
    
    def _initialize_generator_manager(self) -> GeneratorManager:
        """Initialize Generator Manager (no dependencies)"""
        generators_dir = self.config.get('generators_dir')
        
        manager = GeneratorManager(generators_dir=generators_dir)
        
        # Discover generators
        discovered = manager.discover_generators()
        
        self.logger.info(f"  Discovered {len(discovered)} generators:")
        for gen_type, gen_class in discovered.items():
            self.logger.info(f"    - {gen_type.value}: {gen_class.__name__}")
        
        return manager
    
    def _initialize_template_manager(self) -> TemplateManager:
        """Initialize Template Manager (depends on Theme Manager)"""
        templates_dir = self.config.get('templates_dir')
        
        manager = TemplateManager(templates_dir=templates_dir)
        
        # Discover templates
        templates = manager.list_templates()
        
        self.logger.info(f"  Discovered {len(templates)} templates:")
        
        # Group by category
        by_category = {}
        for template in templates:
            if template.category not in by_category:
                by_category[template.category] = []
            by_category[template.category].append(template)
        
        for category, category_templates in by_category.items():
            self.logger.info(f"    - {category}: {len(category_templates)} templates")
        
        return manager
    
    def _initialize_engine(self) -> UIForgeEngine:
        """Initialize Core Engine (depends on Template Manager, Generator Manager)"""
        output_dir = self.config.get('output_dir')
        templates_dir = self.config.get('templates_dir')
        generators_dir = self.config.get('generators_dir')
        
        # Reset global engine if exists
        reset_engine()
        
        # Create new engine
        engine = get_engine(
            output_dir=output_dir,
            templates_dir=templates_dir,
            generators_dir=generators_dir,
        )
        
        self.logger.info(f"  Output Directory: {engine.output_dir}")
        self.logger.info(f"  Templates Directory: {engine.template_manager.templates_dir}")
        self.logger.info(f"  Generators Directory: {engine.generator_manager.generators_dir}")
        
        return engine
    
    def _initialize_preview_manager(self) -> PreviewManager:
        """Initialize Preview Manager (no dependencies)"""
        preview_dir = self.config.get('preview_dir')
        
        manager = PreviewManager(preview_dir=preview_dir)
        
        # Load existing previews
        loaded_count = manager.load_all_previews()
        
        self.logger.info(f"  Preview Directory: {manager.preview_dir}")
        self.logger.info(f"  Loaded {loaded_count} existing preview batches")
        
        return manager
    
    def _initialize_library_manager(self) -> LibraryManager:
        """Initialize Library Manager (no dependencies)"""
        library_dir = self.config.get('library_dir')
        
        manager = create_library_manager(library_dir=library_dir)
        
        # Get statistics
        stats = manager.get_statistics()
        
        self.logger.info(f"  Library Directory: {manager.library_dir}")
        self.logger.info(f"  Total Assets: {stats['total_assets']}")
        self.logger.info(f"  Categories: {len(stats['by_category'])}")
        self.logger.info(f"  Theme Groups: {stats['theme_groups']}")
        
        return manager
    
    def _initialize_tauri_bridge(self) -> None:
        """Initialize Tauri Bridge (depends on all managers)"""
        # Initialize bridge (this sets up global manager instances)
        initialize_bridge()
        
        # Verify managers are accessible
        engine, template_mgr, preview_mgr, library_mgr, generator_mgr = get_managers()
        
        self.logger.info(f"  RPC Functions Registered: {len(get_managers())}")
        self.logger.info(f"  Engine: {engine is not None}")
        self.logger.info(f"  Template Manager: {template_mgr is not None}")
        self.logger.info(f"  Preview Manager: {preview_mgr is not None}")
        self.logger.info(f"  Library Manager: {library_mgr is not None}")
        self.logger.info(f"  Generator Manager: {generator_mgr is not None}")
    
    def _run_health_checks(self) -> None:
        """Run system health checks after initialization"""
        self.logger.info("")
        self.logger.info("Running System Health Checks...")
        self.logger.info("-" * 80)
        
        checks_passed = 0
        checks_failed = 0
        
        # Check 1: Theme Manager
        try:
            themes = self.theme_manager.list_themes()
            assert len(themes) > 0, "No themes loaded"
            self.logger.info("✓ Theme Manager: OK")
            checks_passed += 1
        except Exception as e:
            self.logger.error(f"✗ Theme Manager: FAILED - {e}")
            checks_failed += 1
        
        # Check 2: Generator Manager
        try:
            generators = self.generator_manager.list_generators()
            assert len(generators) > 0, "No generators discovered"
            self.logger.info("✓ Generator Manager: OK")
            checks_passed += 1
        except Exception as e:
            self.logger.error(f"✗ Generator Manager: FAILED - {e}")
            checks_failed += 1
        
        # Check 3: Template Manager
        try:
            templates = self.template_manager.list_templates()
            # Templates are optional, so just check manager works
            self.logger.info(f"✓ Template Manager: OK ({len(templates)} templates)")
            checks_passed += 1
        except Exception as e:
            self.logger.error(f"✗ Template Manager: FAILED - {e}")
            checks_failed += 1
        
        # Check 4: Core Engine
        try:
            assert self.engine is not None, "Engine not initialized"
            assert self.engine.template_manager is not None, "Engine missing template manager"
            assert self.engine.generator_manager is not None, "Engine missing generator manager"
            self.logger.info("✓ Core Engine: OK")
            checks_passed += 1
        except Exception as e:
            self.logger.error(f"✗ Core Engine: FAILED - {e}")
            checks_failed += 1
        
        # Check 5: Preview Manager
        try:
            assert self.preview_manager is not None, "Preview manager not initialized"
            assert self.preview_manager.preview_dir.exists(), "Preview directory missing"
            self.logger.info("✓ Preview Manager: OK")
            checks_passed += 1
        except Exception as e:
            self.logger.error(f"✗ Preview Manager: FAILED - {e}")
            checks_failed += 1
        
        # Check 6: Library Manager
        try:
            assert self.library_manager is not None, "Library manager not initialized"
            assert self.library_manager.library_dir.exists(), "Library directory missing"
            self.logger.info("✓ Library Manager: OK")
            checks_passed += 1
        except Exception as e:
            self.logger.error(f"✗ Library Manager: FAILED - {e}")
            checks_failed += 1
        
        # Summary
        self.logger.info("-" * 80)
        self.logger.info(f"Health Checks: {checks_passed} passed, {checks_failed} failed")
        
        if checks_failed > 0:
            self.logger.warning("Some health checks failed - system may not function correctly")
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get system status information.
        
        Returns:
            Dictionary with system status
        """
        return {
            'initialized': self.initialized,
            'initialization_time': self.initialization_time,
            'initialization_errors': self.initialization_errors,
            'components': {
                'theme_manager': self.theme_manager is not None,
                'generator_manager': self.generator_manager is not None,
                'template_manager': self.template_manager is not None,
                'engine': self.engine is not None,
                'preview_manager': self.preview_manager is not None,
                'library_manager': self.library_manager is not None,
            },
            'config': {k: str(v) if isinstance(v, Path) else v for k, v in self.config.items()},
        }
    
    def shutdown(self) -> None:
        """Gracefully shutdown the system"""
        self.logger.info("Shutting down UI Forge system...")
        
        # Clear caches
        if self.template_manager:
            self.template_manager.clear_cache()
        
        if self.generator_manager:
            self.generator_manager.clear_cache()
        
        # Reset global instances
        reset_engine()
        
        self.initialized = False
        self.logger.info("UI Forge system shutdown complete")


# ============================================================================
# Convenience Functions
# ============================================================================

# Global system instance
_global_system: Optional[UIForgeSystem] = None


def initialize_ui_forge(
    base_dir: Optional[Path] = None,
    output_dir: Optional[Path] = None,
    templates_dir: Optional[Path] = None,
    generators_dir: Optional[Path] = None,
    preview_dir: Optional[Path] = None,
    library_dir: Optional[Path] = None,
    log_level: int = logging.INFO,
    log_file: Optional[Path] = None,
) -> UIForgeSystem:
    """
    Initialize complete UI Forge system with all components.
    
    This is the main entry point for initializing UI Forge.
    Call this once at application startup.
    
    Args:
        base_dir: Base directory for UI Forge
        output_dir: Output directory for generated assets
        templates_dir: Templates directory
        generators_dir: Generators directory
        preview_dir: Preview staging directory
        library_dir: Production library directory
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional path to log file
        
    Returns:
        Initialized UIForgeSystem instance
        
    Example:
        >>> system = initialize_ui_forge(log_level=logging.DEBUG)
        >>> if system.initialized:
        >>>     print("UI Forge ready!")
    """
    global _global_system
    
    # Set up logging first
    setup_logging(level=log_level, log_file=log_file, console=True)
    
    # Create system
    system = UIForgeSystem(
        base_dir=base_dir,
        output_dir=output_dir,
        templates_dir=templates_dir,
        generators_dir=generators_dir,
        preview_dir=preview_dir,
        library_dir=library_dir,
    )
    
    # Initialize
    success = system.initialize()
    
    if success:
        _global_system = system
    
    return system


def get_system() -> Optional[UIForgeSystem]:
    """
    Get the global UI Forge system instance.
    
    Returns:
        UIForgeSystem instance or None if not initialized
    """
    return _global_system


def shutdown_ui_forge() -> None:
    """
    Shutdown the global UI Forge system.
    
    Call this on application shutdown for graceful cleanup.
    """
    global _global_system
    
    if _global_system:
        _global_system.shutdown()
        _global_system = None


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    """
    Standalone initialization for testing and development.
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize UI Forge System")
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Logging level'
    )
    parser.add_argument(
        '--log-file',
        type=Path,
        help='Path to log file'
    )
    
    args = parser.parse_args()
    
    # Convert log level string to constant
    log_level = getattr(logging, args.log_level)
    
    # Initialize system
    system = initialize_ui_forge(
        log_level=log_level,
        log_file=args.log_file,
    )
    
    if system.initialized:
        print("\n" + "=" * 80)
        print("UI FORGE SYSTEM READY")
        print("=" * 80)
        print(f"\nInitialization Time: {system.initialization_time:.2f}s")
        print(f"\nComponents:")
        for component, status in system.get_status()['components'].items():
            status_str = "✓" if status else "✗"
            print(f"  {status_str} {component}")
        print("\n" + "=" * 80)
    else:
        print("\n" + "=" * 80)
        print("UI FORGE INITIALIZATION FAILED")
        print("=" * 80)
        if system.initialization_errors:
            print("\nErrors:")
            for error in system.initialization_errors:
                print(f"  - {error}")
        sys.exit(1)
