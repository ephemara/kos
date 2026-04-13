"""
UI Forge Template Data Models

Comprehensive dataclass models for the UI Forge template system.
Supports arbitrary dimensions, multi-format output, theme variants,
optional animations, and generator-specific parameters.

All visual properties are data-driven from templates with zero hardcoded values.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from enum import Enum


# ============================================================================
# Enums and Type Definitions
# ============================================================================

class GeneratorType(str, Enum):
    """Supported generator categories"""
    ICON = "icon"
    BRUSH = "brush"
    PATTERN = "pattern"
    CURSOR = "cursor"
    OVERLAY = "overlay"
    ALPHA = "alpha"


class OutputFormat(str, Enum):
    """Supported output formats"""
    PNG = "png"
    APNG = "apng"
    SVG = "svg"
    JPEG = "jpeg"
    WEBP = "webp"
    TIFF = "tiff"
    BMP = "bmp"
    ICO = "ico"


class AlphaMode(str, Enum):
    """Alpha channel handling modes"""
    EMBEDDED = "embedded"  # Alpha in RGBA
    SEPARATE = "separate"  # Separate grayscale mask file
    BOTH = "both"  # Both embedded and separate
    NONE = "none"  # No alpha channel


class AspectRatio(str, Enum):
    """Aspect ratio constraints"""
    FIXED = "fixed"  # Use exact dimensions
    FREE = "free"  # Allow any aspect ratio
    LOCKED = "locked"  # Maintain specific ratio (e.g., "16:9")


class BlendMode(str, Enum):
    """Layer blend modes"""
    NORMAL = "normal"
    MULTIPLY = "multiply"
    SCREEN = "screen"
    OVERLAY = "overlay"
    ADD = "add"


class GradientType(str, Enum):
    """Gradient fill types"""
    SOLID = "solid"
    LINEAR = "linear_gradient"
    RADIAL = "radial_gradient"
    ANGULAR = "angular_gradient"


class StrokeCap(str, Enum):
    """Stroke cap styles"""
    BUTT = "butt"
    ROUND = "round"
    SQUARE = "square"


class StrokeJoin(str, Enum):
    """Stroke join styles"""
    MITER = "miter"
    ROUND = "round"
    BEVEL = "bevel"


class BrushShape(str, Enum):
    """Brush shape types"""
    CIRCULAR = "circular"
    SQUARE = "square"
    CUSTOM = "custom"


class FalloffCurve(str, Enum):
    """Brush falloff curve types"""
    LINEAR = "linear"
    SMOOTH = "smooth"
    SHARP = "sharp"
    CUSTOM = "custom"


class AlphaType(str, Enum):
    """Alpha generation types"""
    GRADIENT = "gradient"
    SHAPE = "shape"
    PROCEDURAL = "procedural"
    LUMINANCE = "luminance"
    EDGE = "edge"


class NoiseType(str, Enum):
    """Procedural noise types"""
    PERLIN = "perlin"
    SIMPLEX = "simplex"
    VORONOI = "voronoi"
    CELLULAR = "cellular"


class MotionType(str, Enum):
    """Animation motion types"""
    # Classics
    ORBIT = "orbit"
    FLOAT = "float"
    PULSE = "pulse"
    SHAKE = "shake"
    ELASTIC = "elastic"
    
    # Intermediate
    PENDULUM = "pendulum"
    WOBBLE = "wobble"
    FIGURE8 = "figure8"
    HEARTBEAT = "heartbeat"
    GLITCH = "glitch"
    
    # Physics
    BOUNCE = "bounce"
    TUMBLE = "tumble"
    STROBE = "strobe"
    CORKSCREW = "corkscrew"
    SHIVER = "shiver"
    SWAY = "sway"
    
    # Complex
    LISSAJOUS = "lissajous"
    FLIP = "flip"
    TREMOR = "tremor"
    SCAN = "scan"
    WARP = "warp"
    DRIFT = "drift"

    # Extended procedural motions
    BOB = "bob"
    HOVER = "hover"
    BREATH = "breath"
    JELLY = "jelly"
    SWING = "swing"
    SNAP = "snap"
    REVEAL = "reveal"
    BLINK = "blink"
    POP = "pop"
    TWITCH = "twitch"
    HELIX = "helix"
    SPIRAL = "spiral"
    ZIGZAG = "zigzag"
    RICOCHET = "ricochet"
    SWIRL = "swirl"
    RIPPLE = "ripple"
    PING = "ping"
    JITTER = "jitter"
    GLIDE = "glide"
    ORBITAL_PULSE = "orbital_pulse"


class AnimationEasing(str, Enum):
    """Animation easing functions"""
    LINEAR = "linear"
    EASE_IN = "ease-in"
    EASE_OUT = "ease-out"
    EASE_IN_OUT = "ease-in-out"


class SpriteSheetLayout(str, Enum):
    """Sprite sheet layout types"""
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"
    GRID = "grid"


class AnimationOutputType(str, Enum):
    """Animation output formats"""
    SVG_SMIL = "svg_smil"
    SPRITE_SHEET = "sprite_sheet"
    APNG = "apng"
    BOTH = "both"
    ALL = "all"


# ============================================================================
# Icon Generation Models
# ============================================================================

@dataclass
class FillStyle:
    """Fill style for icon layers"""
    type: GradientType
    colors: List[str]  # Color hex codes or token references (e.g., "$primary")
    stops: Optional[List[float]] = None  # Gradient stops (0.0 to 1.0)
    angle: Optional[float] = None  # For linear/angular gradients (degrees)
    center: Optional[Tuple[float, float]] = None  # For radial gradients (normalized 0-1)


@dataclass
class StrokeStyle:
    """Stroke style for icon layers"""
    color: str  # Color hex code or token reference
    width: float
    cap: StrokeCap = StrokeCap.ROUND
    join: StrokeJoin = StrokeJoin.ROUND
    miter_limit: float = 4.0


@dataclass
class Layer:
    """Icon layer definition"""
    type: str  # 'circle', 'rect', 'polygon', 'path', 'ellipse', 'line'
    geometry: Dict[str, Any]  # Type-specific geometry parameters
    fill: Optional[FillStyle] = None
    stroke: Optional[StrokeStyle] = None
    blend_mode: BlendMode = BlendMode.NORMAL
    opacity: float = 1.0
    transform: Optional[Dict[str, Any]] = None  # Rotation, scale, translate


@dataclass
class IconParams:
    """Icon generator parameters"""
    layers: List[Layer]
    background: Optional[str] = None  # Background color (None for transparent)
    padding: int = 0  # Safe area margin in pixels
    antialias_factor: int = 2  # Supersampling multiplier (1 = no AA, 2-4 recommended)


# ============================================================================
# Brush Generation Models
# ============================================================================

@dataclass
class BrushParams:
    """Brush generator parameters"""
    shape: BrushShape
    size: int  # Brush diameter in pixels
    hardness: float  # 0.0 (soft) to 1.0 (hard)
    spacing: float  # Spacing between stamps (0.0 to 1.0)
    texture: Optional[str] = None  # Path to texture image
    falloff_curve: FalloffCurve = FalloffCurve.SMOOTH
    custom_curve: Optional[List[float]] = None  # For custom falloff (0.0 to 1.0)
    stroke_preview: bool = True  # Render full stroke vs single stamp
    background_color: str = "#808080"  # Neutral background for preview
    generate_thumbnail: bool = True  # Generate 64x64 thumbnail
    generate_detail: bool = True  # Generate 256x256 detail preview


# ============================================================================
# Alpha Generation Models
# ============================================================================

@dataclass
class AlphaParams:
    """Alpha generator parameters"""
    type: AlphaType
    
    # Gradient alpha
    gradient_type: Optional[str] = None  # 'linear', 'radial', 'angular'
    gradient_angle: Optional[float] = None  # Degrees
    gradient_center: Optional[Tuple[float, float]] = None  # Normalized (0-1, 0-1)
    gradient_stops: Optional[List[float]] = None  # Alpha stops (0.0 to 1.0)
    
    # Shape alpha
    shape: Optional[str] = None  # 'circle', 'rect', 'polygon', 'ellipse'
    shape_geometry: Optional[Dict[str, Any]] = None  # Shape-specific parameters
    feather: Optional[float] = None  # Feathering radius in pixels
    
    # Procedural alpha
    noise_type: Optional[NoiseType] = None
    noise_scale: Optional[float] = None
    noise_octaves: Optional[int] = None
    noise_persistence: Optional[float] = None
    noise_lacunarity: Optional[float] = None
    
    # Operations
    invert: bool = False
    blend_mode: Optional[BlendMode] = None  # For compositing multiple alpha sources
    threshold: Optional[float] = None  # Threshold for binary alpha (0.0 to 1.0)
    
    # Luminance conversion
    luminance_weights: Optional[Tuple[float, float, float]] = None  # RGB weights
    
    # Edge detection
    edge_threshold: Optional[float] = None
    edge_blur: Optional[float] = None


# ============================================================================
# Animation Models
# ============================================================================

@dataclass
class AnimationConfig:
    """Animation configuration"""
    enabled: bool
    motion_types: List[MotionType]  # Can combine multiple motions
    duration: float  # Animation duration in seconds
    fps: int = 30  # Frames per second
    loop: bool = True
    easing: AnimationEasing = AnimationEasing.LINEAR
    
    # Motion-specific parameters (keyed by motion type)
    motion_params: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # Output configuration
    output_type: AnimationOutputType = AnimationOutputType.SVG_SMIL
    sprite_sheet_layout: Optional[SpriteSheetLayout] = None
    
    # Advanced options
    reverse: bool = False  # Play animation in reverse
    alternate: bool = False  # Alternate direction each loop
    delay: float = 0.0  # Delay before animation starts (seconds)


# ============================================================================
# Main Template Model
# ============================================================================

@dataclass
class Template:
    """
    Main template data model for UI Forge.
    
    All visual properties are data-driven with zero hardcoded values.
    Supports arbitrary dimensions, multi-format output, theme variants,
    and optional animations.
    """
    # Identity
    name: str
    description: str
    generator_type: GeneratorType
    category: str
    tags: List[str] = field(default_factory=list)
    
    # Output configuration (arbitrary dimensions and formats)
    output_formats: List[OutputFormat] = field(default_factory=lambda: [OutputFormat.PNG])
    dimensions: Dict[str, int] = field(default_factory=lambda: {"width": 64, "height": 64})
    aspect_ratio: AspectRatio = AspectRatio.FIXED
    aspect_ratio_value: Optional[str] = None  # e.g., "16:9" when aspect_ratio is LOCKED
    
    # Format-specific quality parameters
    jpeg_quality: int = 95  # 1-100
    png_compression: int = 6  # 0-9
    webp_lossless: bool = True
    ico_sizes: Optional[List[int]] = None  # Multi-resolution Windows icon sizes
    
    # Visual properties
    colors: Optional[List[str]] = None  # Color palette or token references
    theme_variants: Optional[List[str]] = None  # ['light', 'dark', 'high-contrast']
    
    # Generator-specific parameters
    params: Dict[str, Any] = field(default_factory=dict)
    
    # Alpha channel configuration
    alpha_mode: AlphaMode = AlphaMode.EMBEDDED
    alpha_params: Optional[AlphaParams] = None
    
    # Optional animation
    animation: Optional[AnimationConfig] = None
    
    # Metadata
    version: str = "1.0"
    parent_template: Optional[str] = None  # For inheritance
    author: Optional[str] = None
    created: Optional[datetime] = None
    modified: Optional[datetime] = None
    
    # Internal tracking
    template_id: Optional[str] = None  # Auto-generated unique ID
    
    def __post_init__(self):
        """Validate template after initialization"""
        # Ensure dimensions are positive
        if self.dimensions.get("width", 0) <= 0 or self.dimensions.get("height", 0) <= 0:
            raise ValueError("Template dimensions must be positive integers")
        
        # Validate format compatibility with alpha mode
        if self.alpha_mode in [AlphaMode.EMBEDDED, AlphaMode.BOTH]:
            transparent_formats = {OutputFormat.PNG, OutputFormat.WEBP, OutputFormat.SVG, OutputFormat.ICO}
            if not any(fmt in transparent_formats for fmt in self.output_formats):
                raise ValueError(
                    f"Alpha mode '{self.alpha_mode}' requires at least one format "
                    f"supporting transparency (PNG, WebP, SVG, or ICO)"
                )
        
        # Validate aspect ratio
        if self.aspect_ratio == AspectRatio.LOCKED and not self.aspect_ratio_value:
            raise ValueError("aspect_ratio_value required when aspect_ratio is LOCKED")

        # Validate ICO sizes
        if self.ico_sizes is not None:
            if not self.ico_sizes:
                raise ValueError("ico_sizes cannot be empty when provided")

            normalized_ico_sizes: List[int] = []
            seen_sizes = set()
            for size in self.ico_sizes:
                if not isinstance(size, int):
                    raise ValueError("ico_sizes must contain integers")
                if size <= 0 or size > 256:
                    raise ValueError("ico_sizes entries must be between 1 and 256")
                if size in seen_sizes:
                    continue
                seen_sizes.add(size)
                normalized_ico_sizes.append(size)

            self.ico_sizes = sorted(normalized_ico_sizes)
        
        # Generate template ID if not provided
        if not self.template_id:
            import hashlib
            import json
            # Generate deterministic ID from template content
            content = json.dumps({
                "name": self.name,
                "generator_type": self.generator_type.value,
                "category": self.category,
                "version": self.version
            }, sort_keys=True)
            self.template_id = hashlib.sha256(content.encode()).hexdigest()[:16]


# ============================================================================
# Asset Metadata Models
# ============================================================================

@dataclass
class AssetMetadata:
    """Metadata for generated assets"""
    # Identity
    name: str
    description: str
    category: str
    tags: List[str]
    
    # Generation info
    generator: str
    template_source: str
    generation_timestamp: datetime
    
    # Technical properties
    dimensions: Tuple[int, int]  # (width, height)
    format: str
    file_size: int  # Bytes
    color_mode: str  # 'RGBA', 'RGB', 'L'
    has_alpha: bool
    dpi: int
    
    # Theme info
    theme_variant: Optional[str] = None
    theme_group: Optional[str] = None  # Links related theme variants
    
    # Animation info
    is_animated: bool = False
    animation_type: Optional[str] = None
    frame_count: Optional[int] = None
    duration: Optional[float] = None  # Seconds
    
    # Usage tracking
    usage_count: int = 0
    last_used: Optional[datetime] = None
    
    # Validation
    validation_passed: bool = True
    validation_warnings: List[str] = field(default_factory=list)


@dataclass
class GenerationResult:
    """Result of asset generation"""
    success: bool
    asset_id: str
    template_name: str
    output_paths: Dict[str, str]  # format -> file path
    metadata: AssetMetadata
    generation_time: float  # Seconds
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    """Asset validation result"""
    passed: bool
    checks: Dict[str, bool]  # Check name -> pass/fail
    errors: List[str]
    warnings: List[str]
    metrics: Dict[str, Any]  # Quality metrics


@dataclass
class ProgressInfo:
    """Batch generation progress"""
    batch_id: str
    total: int
    completed: int
    failed: int
    current_asset: Optional[str]
    percent_complete: float
    estimated_time_remaining: Optional[float]  # Seconds
    errors: List[Tuple[str, str]] = field(default_factory=list)  # (asset_name, error_message)


# ============================================================================
# Helper Functions
# ============================================================================

def parse_color_token(color: str, theme: str = "light") -> str:
    """
    Parse color token reference to actual color value.
    
    Args:
        color: Color string (hex code or token like "$primary")
        theme: Theme variant name
        
    Returns:
        Resolved hex color code
    """
    # This will be implemented in template_manager.py
    # Placeholder for now
    if color.startswith("$"):
        # Token reference - will be resolved by TemplateManager
        return color
    return color


def validate_hex_color(color: str) -> bool:
    """Validate hex color format"""
    import re
    if color.startswith("$"):
        return True  # Token reference
    pattern = r'^#(?:[0-9a-fA-F]{3}){1,2}$|^#(?:[0-9a-fA-F]{4}){1,2}$'
    return bool(re.match(pattern, color))
