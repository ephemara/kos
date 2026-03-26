//! State Definitions
//!
//! All shared state structs between Bevy and React.
//! Adding a field here automatically makes it available in TypeScript.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

// =============================================================================
// SCULPT STATE
// =============================================================================

/// Complete sculpt tool state - synced between Bevy and React
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct SculptState {
    /// Currently active brush ID
    pub active_brush: String,
    /// Brush radius in world units
    pub radius: f32,
    /// Brush intensity/strength (0.0 - 1.0)
    pub intensity: f32,
    /// Add mode (true) or subtract mode (false)
    pub is_add: bool,
    /// Symmetry settings
    pub symmetry: SymmetryState,
    /// Current mesh stats
    pub mesh_stats: MeshStats,
    /// Performance info
    pub fps: f32,
}

/// Symmetry axes state
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct SymmetryState {
    pub x: bool,
    pub y: bool,
    pub z: bool,
}

/// Mesh statistics
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct MeshStats {
    pub vertex_count: u32,
    pub face_count: u32,
    pub undo_stack_size: u32,
}

// =============================================================================
// BRUSH LIBRARY
// =============================================================================

/// A brush asset definition
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct BrushAsset {
    pub id: String,
    pub name: String,
    pub category: String,
    pub kernel: String,
    /// Optional icon path
    pub icon: Option<String>,
}

/// The complete brush library
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct BrushLibrary {
    pub brushes: Vec<BrushAsset>,
}

// =============================================================================
// VIEWPORT STATE
// =============================================================================

/// Active tool mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default, PartialEq, Eq)]
#[ts(export, export_to = "bindings/")]
pub enum ActiveTool {
    #[default]
    Viewport,
    Sculpt,
    Paint,
    Retopo,
}

impl ActiveTool {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "sculpt" => Self::Sculpt,
            "paint" => Self::Paint,
            "retopo" => Self::Retopo,
            _ => Self::Viewport,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Viewport => "viewport",
            Self::Sculpt => "sculpt",
            Self::Paint => "paint",
            Self::Retopo => "retopo",
        }
    }
}

/// Overall viewport state
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct ViewportState {
    pub active_tool: ActiveTool,
    pub camera_position: [f32; 3],
    pub camera_target: [f32; 3],
}

// =============================================================================
// LAYER SYSTEM
// =============================================================================

/// A single layer/object in the scene
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct LayerInfo {
    /// Bevy Entity ID (as u32)
    pub entity_id: u32,
    /// Display name
    pub name: String,
    /// Object type
    pub object_type: ObjectType,
    /// Is visible
    pub visible: bool,
    /// Is locked
    pub locked: bool,
    /// Is selected
    pub selected: bool,
}

/// Type of object in the layer
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default, PartialEq, Eq)]
#[ts(export, export_to = "bindings/")]
pub enum ObjectType {
    #[default]
    Mesh,
    Light,
    Camera,
    Empty,
    Group,
}

/// Complete layer hierarchy
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct LayerHierarchy {
    pub layers: Vec<LayerInfo>,
    /// Primary selected entity
    pub primary_selection: Option<u32>,
}

// =============================================================================
// MASTER STATE (The "God Object")
// =============================================================================

/// The complete application state - synced every frame or on change
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub struct KosState {
    pub viewport: ViewportState,
    pub sculpt: SculptState,
    pub layers: LayerHierarchy,
    pub brush_library: BrushLibrary,
    /// Frame number for delta tracking
    pub frame: u64,
}

// =============================================================================
// TELEMETRY (Log Streaming)
// =============================================================================

/// Log severity level
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq, PartialOrd, Ord)]
#[ts(export, export_to = "bindings/")]
pub enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
}

impl Default for LogLevel {
    fn default() -> Self {
        Self::Info
    }
}

impl LogLevel {
    pub fn from_tracing(level: &str) -> Self {
        match level.to_uppercase().as_str() {
            "TRACE" => Self::Trace,
            "DEBUG" => Self::Debug,
            "INFO" => Self::Info,
            "WARN" | "WARNING" => Self::Warn,
            "ERROR" => Self::Error,
            _ => Self::Info,
        }
    }
}

/// A single log entry
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct LogEntry {
    /// Severity level
    pub level: LogLevel,
    /// Log target (e.g., "kos_engine::gpu::atlas")
    pub target: String,
    /// Log message content
    pub message: String,
    /// Seconds since app start
    pub timestamp: f64,
    /// Optional frame number for correlation
    pub frame: Option<u64>,
}

// =============================================================================
// GPU DOCTOR (Error Interception)
// =============================================================================

/// Categories of GPU errors for smarter handling
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq, Hash)]
#[ts(export, export_to = "bindings/")]
pub enum GpuErrorCategory {
    /// Shader compilation or linking error
    Shader,
    /// Buffer operation error (out of bounds, etc)
    Buffer,
    /// Texture or sampler error
    Texture,
    /// Pipeline creation error
    Pipeline,
    /// Validation layer error
    Validation,
    /// Out of memory
    OutOfMemory,
    /// Device lost (usually unrecoverable)
    DeviceLost,
    /// Unknown/other error
    Other,
}

impl Default for GpuErrorCategory {
    fn default() -> Self {
        Self::Other
    }
}

impl GpuErrorCategory {
    /// Categorize an error from its message text
    pub fn from_error_text(text: &str) -> Self {
        let lower = text.to_lowercase();
        
        if lower.contains("shader") || lower.contains("wgsl") || lower.contains("spir") 
            || lower.contains("compile") || lower.contains("entry point") {
            Self::Shader
        } else if lower.contains("buffer") || lower.contains("offset") || lower.contains("size") {
            Self::Buffer
        } else if lower.contains("texture") || lower.contains("sampler") || lower.contains("image") {
            Self::Texture
        } else if lower.contains("pipeline") || lower.contains("layout") {
            Self::Pipeline
        } else if lower.contains("validation") {
            Self::Validation
        } else if lower.contains("out of memory") || lower.contains("oom") {
            Self::OutOfMemory
        } else if lower.contains("device lost") || lower.contains("device removed") {
            Self::DeviceLost
        } else {
            Self::Other
        }
    }
    
    /// Is this error category likely recoverable?
    pub fn is_recoverable(&self) -> bool {
        match self {
            Self::Shader | Self::Buffer | Self::Texture 
            | Self::Pipeline | Self::Validation => true,
            Self::OutOfMemory | Self::DeviceLost | Self::Other => false,
        }
    }
}

// =============================================================================
// DEBUG VISUALIZATION
// =============================================================================

/// Debug visualization mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default, PartialEq, Eq)]
#[ts(export, export_to = "bindings/")]
pub enum DebugMode {
    /// Normal rendering
    #[default]
    None,
    /// Color vertices by normal direction (R=X, G=Y, B=Z)
    Normals,
    /// Highlight vertices with zero/corrupt normals (magenta)
    ZeroNormals,
    /// Show wireframe overlay
    Wireframe,
    /// Show all debug overlays
    All,
}

/// Individual debug overlay types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "bindings/")]
pub enum DebugOverlay {
    /// Normal visualization
    Normals,
    /// Zero normal detector
    ZeroNormals,
    /// Wireframe overlay
    Wireframe,
    /// Bounding boxes
    BoundingBoxes,
}
