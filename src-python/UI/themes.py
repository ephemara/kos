"""
UI Forge Theme System

Provides theme definitions, color token management, and utilities for
multi-variant asset generation (light/dark/high-contrast modes).

Supports:
- Color token dictionaries for multiple themes
- Color token resolution with fallback handling
- Automatic color inversion for dark mode
- Theme variant validation and consistency checking
- Dynamic theme registration and management

Requirements: 14.1, 14.2, 14.4, 14.5, 14.7, 14.8
"""

import colorsys
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


# ============================================================================
# Theme Definitions
# ============================================================================

class ThemeVariant(str, Enum):
    """Supported theme variants"""
    LIGHT = "light"
    DARK = "dark"
    HIGH_CONTRAST = "high-contrast"


# Default color token definitions for each theme
DEFAULT_THEME_TOKENS = {
    ThemeVariant.LIGHT: {
        # Primary colors
        "$primary": "#2563eb",
        "$secondary": "#64748b",
        "$accent": "#f59e0b",
        
        # Background and foreground
        "$background": "#ffffff",
        "$foreground": "#0f172a",
        "$surface": "#f8fafc",
        "$border": "#e2e8f0",
        
        # Semantic colors
        "$success": "#10b981",
        "$warning": "#f59e0b",
        "$error": "#ef4444",
        "$info": "#3b82f6",
        
        # Text colors
        "$text-primary": "#0f172a",
        "$text-secondary": "#475569",
        "$text-tertiary": "#94a3b8",
        "$text-disabled": "#cbd5e1",
        
        # Interactive states
        "$hover": "#1e40af",
        "$active": "#1e3a8a",
        "$focus": "#3b82f6",
        "$disabled": "#e2e8f0",
        
        # Shadows and overlays
        "$shadow": "#00000020",
        "$overlay": "#00000040",
    },
    
    ThemeVariant.DARK: {
        # Primary colors
        "$primary": "#3b82f6",
        "$secondary": "#94a3b8",
        "$accent": "#fbbf24",
        
        # Background and foreground
        "$background": "#0f172a",
        "$foreground": "#f1f5f9",
        "$surface": "#1e293b",
        "$border": "#334155",
        
        # Semantic colors
        "$success": "#34d399",
        "$warning": "#fbbf24",
        "$error": "#f87171",
        "$info": "#60a5fa",
        
        # Text colors
        "$text-primary": "#f1f5f9",
        "$text-secondary": "#cbd5e1",
        "$text-tertiary": "#64748b",
        "$text-disabled": "#475569",
        
        # Interactive states
        "$hover": "#60a5fa",
        "$active": "#93c5fd",
        "$focus": "#3b82f6",
        "$disabled": "#334155",
        
        # Shadows and overlays
        "$shadow": "#00000060",
        "$overlay": "#00000080",
    },
    
    ThemeVariant.HIGH_CONTRAST: {
        # Primary colors
        "$primary": "#ffffff",
        "$secondary": "#cccccc",
        "$accent": "#ffff00",
        
        # Background and foreground
        "$background": "#000000",
        "$foreground": "#ffffff",
        "$surface": "#1a1a1a",
        "$border": "#ffffff",
        
        # Semantic colors
        "$success": "#00ff00",
        "$warning": "#ffff00",
        "$error": "#ff0000",
        "$info": "#00ffff",
        
        # Text colors
        "$text-primary": "#ffffff",
        "$text-secondary": "#cccccc",
        "$text-tertiary": "#999999",
        "$text-disabled": "#666666",
        
        # Interactive states
        "$hover": "#ffffff",
        "$active": "#ffff00",
        "$focus": "#00ffff",
        "$disabled": "#666666",
        
        # Shadows and overlays
        "$shadow": "#ffffff40",
        "$overlay": "#ffffff60",
    },
}


# ============================================================================
# Theme Manager
# ============================================================================

@dataclass
class ThemeInfo:
    """Theme variant information"""
    name: str
    variant: ThemeVariant
    tokens: Dict[str, str]
    description: str = ""
    is_custom: bool = False


class ThemeManager:
    """
    Manages theme variants and color token resolution.
    
    Provides:
    - Color token resolution for any theme
    - Dynamic theme registration
    - Color inversion utilities for dark mode
    - Theme validation and consistency checking
    """
    
    def __init__(self):
        """Initialize ThemeManager with default themes"""
        self._themes: Dict[str, Dict[str, str]] = {}
        
        # Register default themes
        for variant, tokens in DEFAULT_THEME_TOKENS.items():
            self._themes[variant.value] = tokens.copy()
    
    def get_theme_tokens(self, theme: str = "light") -> Dict[str, str]:
        """
        Get all color tokens for a specific theme.
        
        Args:
            theme: Theme variant name
            
        Returns:
            Dictionary of token names to hex colors
            
        Raises:
            ValueError: If theme doesn't exist
        """
        if theme not in self._themes:
            raise ValueError(
                f"Unknown theme: {theme}. Available: {list(self._themes.keys())}"
            )
        return self._themes[theme].copy()
    
    def resolve_color_token(
        self,
        color: str,
        theme: str = "light",
        fallback: Optional[str] = None,
    ) -> str:
        """
        Resolve a single color token to actual color value.
        
        Args:
            color: Color string (hex code or token like "$primary")
            theme: Theme variant name
            fallback: Fallback color if token not found
            
        Returns:
            Resolved hex color code
            
        Raises:
            ValueError: If theme doesn't exist or token not found (and no fallback)
        """
        # If not a token, return as-is
        if not color.startswith("$"):
            return color
        
        # Get theme tokens
        if theme not in self._themes:
            raise ValueError(f"Unknown theme: {theme}")
        
        theme_tokens = self._themes[theme]
        
        # Resolve token
        if color in theme_tokens:
            return theme_tokens[color]
        
        # Use fallback if provided
        if fallback is not None:
            return fallback
        
        # Token not found and no fallback
        raise ValueError(
            f"Unknown color token '{color}' for theme '{theme}'. "
            f"Available tokens: {list(theme_tokens.keys())}"
        )
    
    def resolve_color_tokens(
        self,
        colors: List[str],
        theme: str = "light",
        fallback: Optional[str] = None,
    ) -> List[str]:
        """
        Resolve multiple color tokens to actual color values.
        
        Args:
            colors: List of color strings (hex codes or tokens)
            theme: Theme variant name
            fallback: Fallback color for unknown tokens
            
        Returns:
            List of resolved hex color codes
        """
        resolved = []
        for color in colors:
            try:
                resolved_color = self.resolve_color_token(color, theme, fallback)
                resolved.append(resolved_color)
            except ValueError as e:
                # Log warning but continue with original color
                print(f"Warning: {e}")
                resolved.append(color)
        
        return resolved
    
    def add_theme(
        self,
        name: str,
        tokens: Dict[str, str],
        overwrite: bool = False,
    ) -> None:
        """
        Register a new theme or update existing theme.
        
        Args:
            name: Theme name
            tokens: Dictionary of token names to hex colors
            overwrite: Allow overwriting existing theme
            
        Raises:
            ValueError: If theme exists and overwrite=False
        """
        if name in self._themes and not overwrite:
            raise ValueError(
                f"Theme '{name}' already exists. Use overwrite=True to replace."
            )
        
        # Validate token format
        for token, color in tokens.items():
            if not token.startswith("$"):
                raise ValueError(f"Token names must start with '$': {token}")
            if not self._is_valid_hex_color(color):
                raise ValueError(f"Invalid hex color for token '{token}': {color}")
        
        self._themes[name] = tokens.copy()
    
    def add_color_token(
        self,
        token: str,
        color: str,
        theme: str = "light",
    ) -> None:
        """
        Add or update a single color token for a specific theme.
        
        Args:
            token: Token name (will be prefixed with $ if not present)
            color: Hex color code
            theme: Theme variant name
            
        Raises:
            ValueError: If theme doesn't exist or color is invalid
        """
        if not token.startswith("$"):
            token = f"${token}"
        
        if theme not in self._themes:
            raise ValueError(f"Unknown theme: {theme}")
        
        if not self._is_valid_hex_color(color):
            raise ValueError(f"Invalid hex color: {color}")
        
        self._themes[theme][token] = color
    
    def list_themes(self) -> List[ThemeInfo]:
        """
        List all registered themes.
        
        Returns:
            List of ThemeInfo objects
        """
        themes = []
        
        for name, tokens in self._themes.items():
            # Check if it's a default theme
            is_default = name in [v.value for v in ThemeVariant]
            
            # Try to get variant enum
            try:
                variant = ThemeVariant(name)
            except ValueError:
                variant = None
            
            themes.append(ThemeInfo(
                name=name,
                variant=variant,
                tokens=tokens.copy(),
                is_custom=not is_default,
            ))
        
        return themes
    
    def validate_theme_consistency(
        self,
        themes: Optional[List[str]] = None,
    ) -> Dict[str, List[str]]:
        """
        Validate that themes have consistent token sets.
        
        Checks that all themes define the same set of tokens for consistency.
        
        Args:
            themes: List of theme names to validate (defaults to all themes)
            
        Returns:
            Dictionary of validation results:
            - 'missing_tokens': List of (theme, token) tuples for missing tokens
            - 'extra_tokens': List of (theme, token) tuples for extra tokens
            - 'common_tokens': List of tokens present in all themes
        """
        if themes is None:
            themes = list(self._themes.keys())
        
        if not themes:
            return {
                'missing_tokens': [],
                'extra_tokens': [],
                'common_tokens': [],
            }
        
        # Get token sets for each theme
        token_sets = {
            theme: set(self._themes[theme].keys())
            for theme in themes
            if theme in self._themes
        }
        
        # Find common tokens (intersection of all sets)
        common_tokens = set.intersection(*token_sets.values()) if token_sets else set()
        
        # Find missing and extra tokens
        missing_tokens = []
        extra_tokens = []
        
        for theme, tokens in token_sets.items():
            # Tokens in other themes but not this one
            for other_theme, other_tokens in token_sets.items():
                if other_theme != theme:
                    missing = other_tokens - tokens
                    for token in missing:
                        missing_tokens.append((theme, token))
            
            # Tokens in this theme but not in others
            extra = tokens - common_tokens
            for token in extra:
                extra_tokens.append((theme, token))
        
        return {
            'missing_tokens': missing_tokens,
            'extra_tokens': extra_tokens,
            'common_tokens': sorted(list(common_tokens)),
        }
    
    def invert_color_for_dark_mode(self, color: str) -> str:
        """
        Automatically invert a color for dark mode.
        
        Uses HSL color space to invert lightness while preserving hue and saturation.
        This creates visually consistent dark mode variants.
        
        Args:
            color: Hex color code (e.g., "#2563eb")
            
        Returns:
            Inverted hex color code
        """
        # Parse hex color
        r, g, b = self._hex_to_rgb(color)
        
        # Convert to HSL
        h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
        
        # Invert lightness
        l_inverted = 1.0 - l
        
        # Convert back to RGB
        r_inv, g_inv, b_inv = colorsys.hls_to_rgb(h, l_inverted, s)
        
        # Convert to hex
        return self._rgb_to_hex(
            int(r_inv * 255),
            int(g_inv * 255),
            int(b_inv * 255),
        )
    
    def generate_dark_mode_theme(
        self,
        source_theme: str = "light",
        target_theme: str = "dark-auto",
    ) -> Dict[str, str]:
        """
        Automatically generate a dark mode theme by inverting colors.
        
        Args:
            source_theme: Source theme to invert
            target_theme: Name for generated dark theme
            
        Returns:
            Dictionary of inverted color tokens
        """
        if source_theme not in self._themes:
            raise ValueError(f"Unknown source theme: {source_theme}")
        
        source_tokens = self._themes[source_theme]
        inverted_tokens = {}
        
        for token, color in source_tokens.items():
            inverted_tokens[token] = self.invert_color_for_dark_mode(color)
        
        # Register the generated theme
        self.add_theme(target_theme, inverted_tokens, overwrite=True)
        
        return inverted_tokens
    
    def adjust_color_brightness(
        self,
        color: str,
        factor: float,
    ) -> str:
        """
        Adjust color brightness by a factor.
        
        Args:
            color: Hex color code
            factor: Brightness factor (0.0 = black, 1.0 = original, 2.0 = double brightness)
            
        Returns:
            Adjusted hex color code
        """
        r, g, b = self._hex_to_rgb(color)
        
        # Adjust brightness
        r = min(255, int(r * factor))
        g = min(255, int(g * factor))
        b = min(255, int(b * factor))
        
        return self._rgb_to_hex(r, g, b)
    
    def adjust_color_saturation(
        self,
        color: str,
        factor: float,
    ) -> str:
        """
        Adjust color saturation by a factor.
        
        Args:
            color: Hex color code
            factor: Saturation factor (0.0 = grayscale, 1.0 = original, 2.0 = double saturation)
            
        Returns:
            Adjusted hex color code
        """
        r, g, b = self._hex_to_rgb(color)
        
        # Convert to HSL
        h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
        
        # Adjust saturation
        s = min(1.0, s * factor)
        
        # Convert back to RGB
        r_adj, g_adj, b_adj = colorsys.hls_to_rgb(h, l, s)
        
        return self._rgb_to_hex(
            int(r_adj * 255),
            int(g_adj * 255),
            int(b_adj * 255),
        )
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _is_valid_hex_color(self, color: str) -> bool:
        """Validate hex color format"""
        import re
        pattern = r'^#(?:[0-9a-fA-F]{3}){1,2}$|^#(?:[0-9a-fA-F]{4}){1,2}$'
        return bool(re.match(pattern, color))
    
    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB tuple"""
        hex_color = hex_color.lstrip('#')
        
        # Handle 3-digit hex
        if len(hex_color) == 3:
            hex_color = ''.join([c * 2 for c in hex_color])
        
        # Handle 8-digit hex (RGBA) - ignore alpha
        if len(hex_color) == 8:
            hex_color = hex_color[:6]
        
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def _rgb_to_hex(self, r: int, g: int, b: int) -> str:
        """Convert RGB tuple to hex color"""
        return f"#{r:02x}{g:02x}{b:02x}"


# ============================================================================
# Global Theme Manager Instance
# ============================================================================

# Create global instance for easy access
_global_theme_manager = ThemeManager()


def get_theme_manager() -> ThemeManager:
    """Get the global ThemeManager instance"""
    return _global_theme_manager


def resolve_color_tokens(
    colors: List[str],
    theme: str = "light",
) -> List[str]:
    """
    Convenience function to resolve color tokens using global theme manager.
    
    Args:
        colors: List of color strings (hex codes or tokens)
        theme: Theme variant name
        
    Returns:
        List of resolved hex color codes
    """
    return _global_theme_manager.resolve_color_tokens(colors, theme)


def invert_color_for_dark_mode(color: str) -> str:
    """
    Convenience function to invert color for dark mode.
    
    Args:
        color: Hex color code
        
    Returns:
        Inverted hex color code
    """
    return _global_theme_manager.invert_color_for_dark_mode(color)
