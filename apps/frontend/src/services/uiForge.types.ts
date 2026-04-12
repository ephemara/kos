/**
 * uiForge.types.ts
 * 
 * TypeScript type definitions for UI Forge Python backend.
 * Auto-generated types matching Python dataclasses from src-python/UI/models.py
 * 
 * UI Forge is a procedural UI asset generation system that creates icons, brushes,
 * patterns, cursors, and overlays through data-driven templates.
 */

// ============================================================================
// Enums and Type Definitions
// ============================================================================

export enum GeneratorType {
    ICON = "icon",
    BRUSH = "brush",
    PATTERN = "pattern",
    CURSOR = "cursor",
    OVERLAY = "overlay",
    ALPHA = "alpha",
}

export enum OutputFormat {
    PNG = "png",
    SVG = "svg",
    JPEG = "jpeg",
    WEBP = "webp",
    TIFF = "tiff",
    BMP = "bmp",
    ICO = "ico",
}

export enum AlphaMode {
    EMBEDDED = "embedded",
    SEPARATE = "separate",
    BOTH = "both",
    NONE = "none",
}

export enum AspectRatio {
    FIXED = "fixed",
    FREE = "free",
    LOCKED = "locked",
}

export enum BlendMode {
    NORMAL = "normal",
    MULTIPLY = "multiply",
    SCREEN = "screen",
    OVERLAY = "overlay",
    ADD = "add",
}

export enum GradientType {
    SOLID = "solid",
    LINEAR = "linear_gradient",
    RADIAL = "radial_gradient",
    ANGULAR = "angular_gradient",
}

export enum StrokeCap {
    BUTT = "butt",
    ROUND = "round",
    SQUARE = "square",
}

export enum StrokeJoin {
    MITER = "miter",
    ROUND = "round",
    BEVEL = "bevel",
}

export enum BrushShape {
    CIRCULAR = "circular",
    SQUARE = "square",
    CUSTOM = "custom",
}

export enum FalloffCurve {
    LINEAR = "linear",
    SMOOTH = "smooth",
    SHARP = "sharp",
    CUSTOM = "custom",
}

export enum AlphaType {
    GRADIENT = "gradient",
    SHAPE = "shape",
    PROCEDURAL = "procedural",
    LUMINANCE = "luminance",
    EDGE = "edge",
}

export enum NoiseType {
    PERLIN = "perlin",
    SIMPLEX = "simplex",
    VORONOI = "voronoi",
    CELLULAR = "cellular",
}

export enum MotionType {
    // Classics
    ORBIT = "orbit",
    FLOAT = "float",
    PULSE = "pulse",
    SHAKE = "shake",
    ELASTIC = "elastic",
    
    // Intermediate
    PENDULUM = "pendulum",
    WOBBLE = "wobble",
    FIGURE8 = "figure8",
    HEARTBEAT = "heartbeat",
    GLITCH = "glitch",
    
    // Physics
    BOUNCE = "bounce",
    TUMBLE = "tumble",
    STROBE = "strobe",
    CORKSCREW = "corkscrew",
    SHIVER = "shiver",
    SWAY = "sway",
    
    // Complex
    LISSAJOUS = "lissajous",
    FLIP = "flip",
    TREMOR = "tremor",
    SCAN = "scan",
    WARP = "warp",
    DRIFT = "drift",

    // Extended procedural motions
    BOB = "bob",
    HOVER = "hover",
    BREATH = "breath",
    JELLY = "jelly",
    SWING = "swing",
    SNAP = "snap",
    REVEAL = "reveal",
    BLINK = "blink",
    POP = "pop",
    TWITCH = "twitch",
    HELIX = "helix",
    SPIRAL = "spiral",
    ZIGZAG = "zigzag",
    RICOCHET = "ricochet",
    SWIRL = "swirl",
    RIPPLE = "ripple",
    PING = "ping",
    JITTER = "jitter",
    GLIDE = "glide",
    ORBITAL_PULSE = "orbital_pulse",
}

export enum AnimationEasing {
    LINEAR = "linear",
    EASE_IN = "ease-in",
    EASE_OUT = "ease-out",
    EASE_IN_OUT = "ease-in-out",
}

export enum SpriteSheetLayout {
    HORIZONTAL = "horizontal",
    VERTICAL = "vertical",
    GRID = "grid",
}

export enum AnimationOutputType {
    SVG_SMIL = "svg_smil",
    SPRITE_SHEET = "sprite_sheet",
    APNG = "apng",
    BOTH = "both",
    ALL = "all",
}

// ============================================================================
// Icon Generation Types
// ============================================================================

export interface FillStyle {
    type: GradientType;
    colors: string[]; // Color hex codes or token references (e.g., "$primary")
    stops?: number[] | null; // Gradient stops (0.0 to 1.0)
    angle?: number | null; // For linear/angular gradients (degrees)
    center?: [number, number] | null; // For radial gradients (normalized 0-1)
}

export interface StrokeStyle {
    color: string; // Color hex code or token reference
    width: number;
    cap?: StrokeCap;
    join?: StrokeJoin;
    miter_limit?: number;
}

export interface Layer {
    type: string; // 'circle', 'rect', 'polygon', 'path', 'ellipse', 'line'
    geometry: Record<string, any>; // Type-specific geometry parameters
    fill?: FillStyle | null;
    stroke?: StrokeStyle | null;
    blend_mode?: BlendMode;
    opacity?: number;
    transform?: Record<string, any> | null; // Rotation, scale, translate
}

export interface IconParams {
    layers: Layer[];
    background?: string | null; // Background color (null for transparent)
    padding?: number; // Safe area margin in pixels
    antialias_factor?: number; // Supersampling multiplier (1 = no AA, 2-4 recommended)
}

// ============================================================================
// Brush Generation Types
// ============================================================================

export interface BrushParams {
    shape: BrushShape;
    size: number; // Brush diameter in pixels
    hardness: number; // 0.0 (soft) to 1.0 (hard)
    spacing: number; // Spacing between stamps (0.0 to 1.0)
    texture?: string | null; // Path to texture image
    falloff_curve?: FalloffCurve;
    custom_curve?: number[] | null; // For custom falloff (0.0 to 1.0)
    stroke_preview?: boolean; // Render full stroke vs single stamp
    background_color?: string; // Neutral background for preview
    generate_thumbnail?: boolean; // Generate 64x64 thumbnail
    generate_detail?: boolean; // Generate 256x256 detail preview
}

// ============================================================================
// Alpha Generation Types
// ============================================================================

export interface AlphaParams {
    type: AlphaType;
    
    // Gradient alpha
    gradient_type?: string | null;
    gradient_angle?: number | null;
    gradient_center?: [number, number] | null;
    gradient_stops?: number[] | null;
    
    // Shape alpha
    shape?: string | null;
    shape_geometry?: Record<string, any> | null;
    feather?: number | null;
    
    // Procedural alpha
    noise_type?: NoiseType | null;
    noise_scale?: number | null;
    noise_octaves?: number | null;
    noise_persistence?: number | null;
    noise_lacunarity?: number | null;
    
    // Operations
    invert?: boolean;
    blend_mode?: BlendMode | null;
    threshold?: number | null;
    
    // Luminance conversion
    luminance_weights?: [number, number, number] | null;
    
    // Edge detection
    edge_threshold?: number | null;
    edge_blur?: number | null;
}

// ============================================================================
// Animation Types
// ============================================================================

export interface AnimationConfig {
    enabled: boolean;
    motion_types: MotionType[]; // Can combine multiple motions
    duration: number; // Animation duration in seconds
    fps?: number; // Frames per second
    loop?: boolean;
    easing?: AnimationEasing;
    
    // Motion-specific parameters (keyed by motion type)
    motion_params?: Record<string, Record<string, any>>;
    
    // Output configuration
    output_type?: AnimationOutputType;
    sprite_sheet_layout?: SpriteSheetLayout | null;
    
    // Advanced options
    reverse?: boolean; // Play animation in reverse
    alternate?: boolean; // Alternate direction each loop
    delay?: number; // Delay before animation starts (seconds)
}

// ============================================================================
// Main Template Type
// ============================================================================

export interface Template {
    // Identity
    name: string;
    description: string;
    generator_type: GeneratorType;
    category: string;
    tags?: string[];
    
    // Output configuration (arbitrary dimensions and formats)
    output_formats?: OutputFormat[];
    dimensions?: { width: number; height: number };
    aspect_ratio?: AspectRatio;
    aspect_ratio_value?: string | null; // e.g., "16:9" when aspect_ratio is LOCKED
    
    // Format-specific quality parameters
    jpeg_quality?: number; // 1-100
    png_compression?: number; // 0-9
    webp_lossless?: boolean;
    
    // Visual properties
    colors?: string[] | null; // Color palette or token references
    theme_variants?: string[] | null; // ['light', 'dark', 'high-contrast']
    
    // Generator-specific parameters
    params?: Record<string, any>;
    
    // Alpha channel configuration
    alpha_mode?: AlphaMode;
    alpha_params?: AlphaParams | null;
    
    // Optional animation
    animation?: AnimationConfig | null;
    
    // Metadata
    version?: string;
    parent_template?: string | null; // For inheritance
    author?: string | null;
    created?: string | null; // ISO datetime string
    modified?: string | null; // ISO datetime string
    
    // Internal tracking
    template_id?: string | null; // Auto-generated unique ID
}

// ============================================================================
// Asset Metadata Types
// ============================================================================

export interface AssetMetadata {
    // Identity
    name: string;
    description: string;
    category: string;
    tags: string[];
    
    // Generation info
    generator: string;
    template_source: string;
    generation_timestamp: string; // ISO datetime string
    
    // Technical properties
    dimensions: [number, number]; // [width, height]
    format: string;
    file_size: number; // Bytes
    color_mode: string; // 'RGBA', 'RGB', 'L'
    has_alpha: boolean;
    dpi: number;
    
    // Theme info
    theme_variant?: string | null;
    theme_group?: string | null; // Links related theme variants
    
    // Animation info
    is_animated?: boolean;
    animation_type?: string | null;
    frame_count?: number | null;
    duration?: number | null; // Seconds
    
    // Usage tracking
    usage_count?: number;
    last_used?: string | null; // ISO datetime string
    
    // Validation
    validation_passed?: boolean;
    validation_warnings?: string[];
}

export interface GenerationResult {
    success: boolean;
    asset_id: string;
    template_name: string;
    output_paths: Record<string, string>; // format -> file path
    metadata: AssetMetadata | null;
    generation_time: number; // Seconds
    error?: string | null;
    warnings?: string[];
}

export interface ValidationResult {
    passed: boolean;
    checks: Record<string, boolean>; // Check name -> pass/fail
    errors: string[];
    warnings: string[];
    metrics: Record<string, any>; // Quality metrics
}

export interface ProgressInfo {
    batch_id: string;
    total: number;
    completed: number;
    failed: number;
    current_asset?: string | null;
    percent_complete: number;
    estimated_time_remaining?: number | null; // Seconds
    errors?: Array<[string, string]>; // [asset_name, error_message]
}

// ============================================================================
// RPC Response Types
// ============================================================================

export interface RPCResponse<T> {
    success: boolean;
    data: T | null;
    error?: {
        message: string;
        type: string;
        traceback: string;
    } | null;
}

export interface BatchGenerateResult {
    batch_id: string;
    status: string;
    total: number;
    completed: number;
    successful: number;
    failed: number;
    message: string;
}

export interface ApprovePreviewResult {
    approved: number;
    moved_to_library: number;
    library_asset_ids: string[];
}

export interface LibraryIndex {
    version: string;
    generated: string; // ISO datetime string
    total_assets: number;
    categories: Record<string, {
        count: number;
        subcategories: string[];
        resolutions?: number[];
    }>;
    assets: Array<{
        id: string;
        path: string;
        metadata_path: string;
        thumbnail?: string;
    }>;
    theme_groups: Record<string, string[]>;
}

export interface GeneratorInfo {
    generator_type: string;
    class_name: string;
    module_name: string;
    file_path: string;
}

export interface PreviewStatus {
    preview_id: string;
    total_assets: number;
    pending: number;
    approved: number;
    rejected: number;
    timestamp: string; // ISO datetime string
    gallery_path: string;
}

export interface TemplateListItem {
    name: string;
    description: string;
    generator_type: string;
    category: string;
    tags: string[];
    dimensions: { width: number; height: number };
    output_formats: string[];
    theme_variants?: string[] | null;
    has_animation: boolean;
}

export interface AssetSearchResult {
    name: string;
    description: string;
    category: string;
    tags: string[];
    dimensions: [number, number];
    format: string;
    file_size: number;
    theme_variant?: string | null;
    is_animated: boolean;
    usage_count: number;
}

export interface Statistics {
    engine: Record<string, any>;
    library: Record<string, any>;
    generators: number;
}

// ============================================================================
// Custom Icon Names (for lucide-react coexistence)
// ============================================================================

/**
 * Custom icon names generated by UI Forge.
 * These are separate from lucide-react icons and live in the UI Forge library.
 * 
 * Usage:
 *   import { CustomIcon } from '@/components/CustomIcon';
 *   <CustomIcon name="sculpt-clay" size={24} />
 */
export type CustomIconName = string; // Will be populated as icons are generated

/**
 * Helper type for icon references that can be either lucide or custom
 */
export type IconReference = 
    | { type: 'lucide'; name: string }
    | { type: 'custom'; name: CustomIconName };
