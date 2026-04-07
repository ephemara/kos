"""
UI Forge Generator Manager

Manages generator discovery, routing, hot-reload, and lifecycle.
Auto-discovers generator modules from the generators/ directory and
routes templates to appropriate generator instances.

Design Philosophy:
- Auto-discovery: Generators are discovered automatically from generators/ directory
- Hot-reload: Generators can be reloaded without restarting the Python sidecar
- Type-safe routing: Templates are routed to generators based on generator_type
- Extensibility: Easy to add new generators by dropping files in generators/
"""

import importlib
import importlib.util
import inspect
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional, Type
from dataclasses import dataclass

from models import Template, GeneratorType
from generators.base import BaseGenerator, get_registry


# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class GeneratorInfo:
    """Information about a registered generator"""
    generator_type: GeneratorType
    class_name: str
    module_name: str
    file_path: str
    supported_params: Dict[str, Type]


class GeneratorManager:
    """
    Manages generator discovery, routing, and lifecycle.
    
    Responsibilities:
    - Auto-discover generator modules from generators/ directory
    - Route templates to appropriate generator instances
    - Support hot-reload of generator modules
    - Provide generator enumeration and metadata
    
    Usage:
        manager = GeneratorManager()
        manager.discover_generators()
        
        # Get generator for a template
        generator = manager.get_generator(GeneratorType.ICON)
        result = generator.generate(template)
        
        # Hot-reload a generator
        manager.reload_generator(GeneratorType.ICON)
    """
    
    def __init__(self, generators_dir: Optional[Path] = None):
        """
        Initialize GeneratorManager.
        
        Args:
            generators_dir: Path to generators directory (defaults to ./generators/)
        """
        if generators_dir is None:
            # Default to generators/ directory relative to this file
            generators_dir = Path(__file__).parent / "generators"
        
        self.generators_dir = Path(generators_dir)
        self._generator_instances: Dict[GeneratorType, BaseGenerator] = {}
        self._generator_modules: Dict[GeneratorType, str] = {}  # type -> module name
        
        logger.info(f"GeneratorManager initialized with directory: {self.generators_dir}")
    
    def discover_generators(self) -> Dict[GeneratorType, Type[BaseGenerator]]:
        """
        Auto-discover generator modules from generators/ directory.
        
        Scans the generators/ directory for Python files, imports them,
        and registers any BaseGenerator subclasses found.
        
        Returns:
            Dictionary mapping GeneratorType to generator class
            
        Raises:
            ImportError: If a generator module fails to import
            ValueError: If generator registration fails
            
        Notes:
            - Skips __init__.py and base.py
            - Skips files starting with underscore or dot
            - Logs discovery progress and any errors
            - Generators must use @register_generator decorator or
              be manually registered in the module
        """
        if not self.generators_dir.exists():
            logger.warning(f"Generators directory not found: {self.generators_dir}")
            return {}
        
        discovered = {}
        registry = get_registry()
        
        logger.info(f"Discovering generators in: {self.generators_dir}")
        
        # Scan for Python files
        for file_path in self.generators_dir.glob("*.py"):
            # Skip special files
            if file_path.name in ["__init__.py", "base.py"]:
                continue
            if file_path.name.startswith("_") or file_path.name.startswith("."):
                continue
            
            module_name = file_path.stem
            logger.debug(f"Attempting to import generator module: {module_name}")
            
            try:
                # Import the module
                full_module_name = f"generators.{module_name}"
                
                # Check if already imported
                if full_module_name in sys.modules:
                    # Reload existing module
                    module = importlib.reload(sys.modules[full_module_name])
                else:
                    # Import new module
                    module = importlib.import_module(full_module_name)
                
                # Find BaseGenerator subclasses in the module
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    # Check if it's a BaseGenerator subclass (but not BaseGenerator itself)
                    if (issubclass(obj, BaseGenerator) and 
                        obj is not BaseGenerator and
                        obj.__module__ == full_module_name):
                        
                        # Create instance to get generator type
                        try:
                            instance = obj()
                            gen_type = instance.generator_type
                            
                            # Store module name for hot-reload
                            self._generator_modules[gen_type] = full_module_name
                            
                            # Check if already registered
                            if registry.is_registered(gen_type):
                                logger.info(
                                    f"Generator {name} ({gen_type.value}) already registered, "
                                    f"using existing registration"
                                )
                            else:
                                # Register with global registry
                                registry.register(obj)
                                logger.info(
                                    f"Discovered and registered generator: {name} "
                                    f"({gen_type.value}) from {module_name}"
                                )
                            
                            discovered[gen_type] = obj
                            
                        except Exception as e:
                            logger.error(
                                f"Failed to instantiate generator {name} from {module_name}: {e}"
                            )
                
            except ImportError as e:
                logger.error(f"Failed to import generator module {module_name}: {e}")
            except Exception as e:
                logger.error(f"Error processing generator module {module_name}: {e}")
        
        logger.info(f"Discovery complete. Found {len(discovered)} generators: {list(discovered.keys())}")
        return discovered
    
    def get_generator(self, generator_type: GeneratorType) -> BaseGenerator:
        """
        Get generator instance for the specified type.
        
        Routes templates to appropriate generator instances based on
        generator_type. Creates and caches generator instances on first use.
        
        Args:
            generator_type: Type of generator to retrieve
            
        Returns:
            Generator instance ready to generate assets
            
        Raises:
            KeyError: If no generator registered for the specified type
            
        Notes:
            - Generator instances are cached for reuse
            - Use reload_generator() to refresh a cached instance
        """
        # Check if we have a cached instance
        if generator_type in self._generator_instances:
            return self._generator_instances[generator_type]
        
        # Get generator class from registry
        registry = get_registry()
        generator_class = registry.get(generator_type)
        
        # Create and cache instance
        instance = generator_class()
        self._generator_instances[generator_type] = instance
        
        logger.debug(f"Created generator instance for type: {generator_type.value}")
        return instance
    
    def reload_generator(self, generator_type: GeneratorType) -> None:
        """
        Hot-reload a generator module without restarting the Python sidecar.
        
        Reloads the generator module from disk, re-registers it, and
        clears the cached instance. Useful for development and live updates.
        
        Args:
            generator_type: Type of generator to reload
            
        Raises:
            KeyError: If generator type not found
            ImportError: If module reload fails
            
        Notes:
            - Clears cached generator instance
            - Re-imports and re-registers the generator class
            - Next call to get_generator() will use the reloaded version
            - Does not affect in-progress generation operations
        """
        # Check if we know about this generator
        if generator_type not in self._generator_modules:
            raise KeyError(
                f"Cannot reload generator type {generator_type.value}: "
                f"not discovered or registered"
            )
        
        module_name = self._generator_modules[generator_type]
        logger.info(f"Reloading generator module: {module_name} ({generator_type.value})")
        
        try:
            # Clear cached instance
            if generator_type in self._generator_instances:
                del self._generator_instances[generator_type]
                logger.debug(f"Cleared cached instance for {generator_type.value}")
            
            # Reload the module
            if module_name in sys.modules:
                module = importlib.reload(sys.modules[module_name])
                logger.debug(f"Reloaded module: {module_name}")
            else:
                # Module not in sys.modules, import it fresh
                module = importlib.import_module(module_name)
                logger.debug(f"Imported module: {module_name}")
            
            # Find and re-register the generator class
            registry = get_registry()
            found = False
            
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, BaseGenerator) and 
                    obj is not BaseGenerator and
                    obj.__module__ == module_name):
                    
                    # Create instance to verify it's the right type
                    instance = obj()
                    if instance.generator_type == generator_type:
                        # Update registry (this will replace the old class)
                        # We need to clear the old registration first
                        if hasattr(registry, '_generators'):
                            registry._generators[generator_type] = obj
                        
                        logger.info(
                            f"Successfully reloaded generator: {name} ({generator_type.value})"
                        )
                        found = True
                        break
            
            if not found:
                raise ImportError(
                    f"Could not find generator class for type {generator_type.value} "
                    f"in reloaded module {module_name}"
                )
                
        except Exception as e:
            logger.error(f"Failed to reload generator {generator_type.value}: {e}")
            raise
    
    def list_generators(self) -> List[GeneratorInfo]:
        """
        List all available generators with metadata.
        
        Returns:
            List of GeneratorInfo objects containing generator metadata
            
        Notes:
            - Includes generator type, class name, module name, file path
            - Includes supported parameters schema
            - Useful for UI display and debugging
        """
        registry = get_registry()
        generator_infos = []
        
        for gen_type in registry.list_types():
            try:
                # Get generator class
                gen_class = registry.get(gen_type)
                
                # Create temporary instance to get metadata
                instance = gen_class()
                
                # Get module info
                module_name = self._generator_modules.get(gen_type, "unknown")
                
                # Try to find file path
                file_path = "unknown"
                if module_name in sys.modules:
                    module = sys.modules[module_name]
                    if hasattr(module, '__file__') and module.__file__:
                        file_path = module.__file__
                
                # Create info object
                info = GeneratorInfo(
                    generator_type=gen_type,
                    class_name=gen_class.__name__,
                    module_name=module_name,
                    file_path=file_path,
                    supported_params=instance.supported_params()
                )
                
                generator_infos.append(info)
                
            except Exception as e:
                logger.error(f"Error getting info for generator {gen_type.value}: {e}")
        
        return generator_infos
    
    def is_generator_available(self, generator_type: GeneratorType) -> bool:
        """
        Check if a generator is available for the specified type.
        
        Args:
            generator_type: Type to check
            
        Returns:
            True if generator is registered and available
        """
        registry = get_registry()
        return registry.is_registered(generator_type)
    
    def clear_cache(self) -> None:
        """
        Clear all cached generator instances.
        
        Forces recreation of generator instances on next use.
        Useful for testing or after bulk reloads.
        """
        count = len(self._generator_instances)
        self._generator_instances.clear()
        logger.info(f"Cleared {count} cached generator instances")
    
    def get_generator_for_template(self, template: Template) -> BaseGenerator:
        """
        Get appropriate generator for a template.
        
        Convenience method that extracts generator_type from template
        and returns the corresponding generator instance.
        
        Args:
            template: Template to generate
            
        Returns:
            Generator instance for the template's generator_type
            
        Raises:
            KeyError: If no generator available for template's type
        """
        return self.get_generator(template.generator_type)
    
    def __repr__(self) -> str:
        """String representation"""
        registry = get_registry()
        available = len(registry.list_types())
        cached = len(self._generator_instances)
        return (
            f"GeneratorManager(generators_dir={self.generators_dir}, "
            f"available={available}, cached={cached})"
        )


# ============================================================================
# Convenience Functions
# ============================================================================

# Global manager instance (singleton pattern)
_manager: Optional[GeneratorManager] = None


def get_manager() -> GeneratorManager:
    """
    Get the global GeneratorManager instance.
    
    Creates and initializes the manager on first call.
    Automatically discovers generators.
    
    Returns:
        Global GeneratorManager instance
    """
    global _manager
    if _manager is None:
        _manager = GeneratorManager()
        _manager.discover_generators()
    return _manager


def reset_manager() -> None:
    """
    Reset the global GeneratorManager instance.
    
    Useful for testing or when generators directory changes.
    """
    global _manager
    _manager = None
