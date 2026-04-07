"""
UI Forge Base Generator

Abstract base class defining the interface for all UI asset generators.
All generators (icon, brush, pattern, cursor, overlay, alpha) inherit from
this base class and implement the required methods.

Design Philosophy:
- Data-driven: All visual properties come from template parameters
- Library-first: Leverage numpy and Pillow for performance
- Extensible: Easy to add custom generators via inheritance
- Type-safe: Clear parameter schemas with validation
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Type
import numpy as np
from models import Template, GeneratorType


class BaseGenerator(ABC):
    """
    Abstract base class for all UI asset generators.
    
    Generators transform template data into numpy arrays representing
    RGBA images. The core engine handles format conversion, validation,
    and file I/O.
    
    Subclasses must implement:
    - generate(): Create asset as numpy array
    - supported_params(): Declare parameter schema
    - validate_params(): Validate parameters (optional override)
    """
    
    def __init__(self):
        """Initialize generator"""
        self.generator_type: GeneratorType = self._get_generator_type()
    
    @abstractmethod
    def _get_generator_type(self) -> GeneratorType:
        """
        Return the generator type enum value.
        
        Returns:
            GeneratorType enum value (ICON, BRUSH, PATTERN, etc.)
        """
        pass
    
    @abstractmethod
    def generate(self, template: Template) -> np.ndarray:
        """
        Generate asset as numpy array from template.
        
        Args:
            template: Template containing all generation parameters
            
        Returns:
            Numpy array with shape (H, W, C) where:
            - H: Height in pixels
            - W: Width in pixels
            - C: Channels (4 for RGBA)
            - dtype: uint8 (0-255 range)
            
        Raises:
            ValueError: If template parameters are invalid
            RuntimeError: If generation fails
            
        Notes:
            - Output dimensions must match template.dimensions
            - Always return RGBA (4 channels) even if alpha is unused
            - Use alpha channel for transparency (0 = transparent, 255 = opaque)
            - Color values are in sRGB color space
        """
        pass
    
    @abstractmethod
    def supported_params(self) -> Dict[str, Type]:
        """
        Return schema of supported parameters.
        
        Returns:
            Dictionary mapping parameter names to their expected types.
            Used for validation and documentation.
            
        Example:
            {
                "layers": list,
                "background": str,
                "padding": int,
                "antialias_factor": int
            }
            
        Notes:
            - Parameter names should match template.params keys
            - Types should be Python built-in types or typing module types
            - Optional parameters should use Optional[Type] from typing
        """
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """
        Validate parameters against schema.
        
        Args:
            params: Parameter dictionary from template.params
            
        Returns:
            True if parameters are valid
            
        Raises:
            ValueError: If parameters are invalid (with descriptive message)
            
        Notes:
            - Default implementation checks parameter types against schema
            - Subclasses can override for custom validation logic
            - Should validate ranges, constraints, and dependencies
        """
        schema = self.supported_params()
        
        # Check for unknown parameters
        unknown = set(params.keys()) - set(schema.keys())
        if unknown:
            raise ValueError(
                f"Unknown parameters for {self.generator_type.value} generator: {unknown}"
            )
        
        # Check parameter types
        for param_name, expected_type in schema.items():
            if param_name in params:
                value = params[param_name]
                
                # Handle Optional types from typing module
                if hasattr(expected_type, '__origin__'):
                    # This is a generic type like Optional[int]
                    if expected_type.__origin__ is type(None) or \
                       (hasattr(expected_type, '__args__') and type(None) in expected_type.__args__):
                        # Optional type - None is allowed
                        if value is None:
                            continue
                        # Get the actual type (first arg of Optional)
                        if hasattr(expected_type, '__args__'):
                            actual_types = [t for t in expected_type.__args__ if t is not type(None)]
                            if actual_types:
                                expected_type = actual_types[0]
                
                # Check type
                if not isinstance(value, expected_type):
                    raise ValueError(
                        f"Parameter '{param_name}' must be of type {expected_type.__name__}, "
                        f"got {type(value).__name__}"
                    )
        
        return True
    
    def get_dimensions(self, template: Template) -> tuple[int, int]:
        """
        Extract dimensions from template.
        
        Args:
            template: Template with dimensions configuration
            
        Returns:
            Tuple of (width, height) in pixels
            
        Raises:
            ValueError: If dimensions are invalid
        """
        width = template.dimensions.get("width")
        height = template.dimensions.get("height")
        
        if width is None or height is None:
            raise ValueError("Template must specify both width and height")
        
        if width <= 0 or height <= 0:
            raise ValueError(f"Dimensions must be positive: got {width}x{height}")
        
        return (width, height)
    
    def create_blank_canvas(self, width: int, height: int, background: str = None) -> np.ndarray:
        """
        Create blank RGBA canvas.
        
        Args:
            width: Canvas width in pixels
            height: Canvas height in pixels
            background: Optional background color (hex code or None for transparent)
            
        Returns:
            Numpy array (H, W, 4) with uint8 dtype
            
        Notes:
            - If background is None, creates transparent canvas (all zeros)
            - If background is provided, fills with that color at full opacity
        """
        canvas = np.zeros((height, width, 4), dtype=np.uint8)
        
        if background:
            # Parse hex color
            color = self._parse_hex_color(background)
            canvas[:, :, :3] = color  # RGB channels
            canvas[:, :, 3] = 255  # Full opacity
        
        return canvas
    
    def _parse_hex_color(self, hex_color: str) -> tuple[int, int, int]:
        """
        Parse hex color string to RGB tuple.
        
        Args:
            hex_color: Hex color string (e.g., "#FF5733" or "#F57")
            
        Returns:
            Tuple of (R, G, B) values (0-255)
            
        Raises:
            ValueError: If hex color format is invalid
        """
        hex_color = hex_color.lstrip('#')
        
        # Handle 3-digit hex codes
        if len(hex_color) == 3:
            hex_color = ''.join([c*2 for c in hex_color])
        
        if len(hex_color) != 6:
            raise ValueError(f"Invalid hex color format: #{hex_color}")
        
        try:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            return (r, g, b)
        except ValueError:
            raise ValueError(f"Invalid hex color format: #{hex_color}")
    
    def __repr__(self) -> str:
        """String representation"""
        return f"{self.__class__.__name__}(type={self.generator_type.value})"


class GeneratorRegistry:
    """
    Registry for auto-discovered generators.
    
    Used by GeneratorManager to track available generators and
    route templates to appropriate generator instances.
    """
    
    def __init__(self):
        """Initialize empty registry"""
        self._generators: Dict[GeneratorType, Type[BaseGenerator]] = {}
    
    def register(self, generator_class: Type[BaseGenerator]) -> None:
        """
        Register a generator class.
        
        Args:
            generator_class: Generator class (not instance) to register
            
        Raises:
            ValueError: If generator type is already registered by a different class
        """
        # Create temporary instance to get generator type
        temp_instance = generator_class()
        gen_type = temp_instance.generator_type
        
        if gen_type in self._generators:
            existing = self._generators[gen_type]
            # Allow re-registration of the same class (idempotent)
            # Compare by identity first, then by module and name for reloaded modules
            if existing is generator_class or (
                existing.__module__ == generator_class.__module__ and
                existing.__name__ == generator_class.__name__
            ):
                # Update to the new class reference (in case of reload)
                self._generators[gen_type] = generator_class
                return
            # Raise error if trying to register a different class for the same type
            raise ValueError(
                f"Generator type {gen_type.value} already registered "
                f"by {existing.__module__}.{existing.__name__}, "
                f"cannot register {generator_class.__module__}.{generator_class.__name__}"
            )
        
        self._generators[gen_type] = generator_class
    
    def get(self, generator_type: GeneratorType) -> Type[BaseGenerator]:
        """
        Get generator class by type.
        
        Args:
            generator_type: Generator type enum value
            
        Returns:
            Generator class (not instance)
            
        Raises:
            KeyError: If generator type not registered
        """
        if generator_type not in self._generators:
            raise KeyError(
                f"No generator registered for type {generator_type.value}. "
                f"Available types: {list(self._generators.keys())}"
            )
        
        return self._generators[generator_type]
    
    def list_types(self) -> list[GeneratorType]:
        """
        List all registered generator types.
        
        Returns:
            List of registered GeneratorType enum values
        """
        return list(self._generators.keys())
    
    def is_registered(self, generator_type: GeneratorType) -> bool:
        """
        Check if generator type is registered.
        
        Args:
            generator_type: Generator type to check
            
        Returns:
            True if registered, False otherwise
        """
        return generator_type in self._generators


# Global registry instance
_registry = GeneratorRegistry()


def register_generator(generator_class: Type[BaseGenerator]) -> Type[BaseGenerator]:
    """
    Decorator to register a generator class.
    
    Usage:
        @register_generator
        class IconGenerator(BaseGenerator):
            ...
    
    Args:
        generator_class: Generator class to register
        
    Returns:
        The same generator class (for decorator chaining)
    """
    _registry.register(generator_class)
    return generator_class


def get_registry() -> GeneratorRegistry:
    """
    Get the global generator registry.
    
    Returns:
        Global GeneratorRegistry instance
    """
    return _registry
