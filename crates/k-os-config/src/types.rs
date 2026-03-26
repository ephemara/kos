//! Configuration Data Structures
//!
//! All configuration types with serde Serialize/Deserialize and JSON Schema support.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;
use std::collections::HashMap;

// ============================================================================
// BRUSH CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct BrushConfig {
    /// Unique identifier
    pub id: String,
    
    /// Display name
    pub name: String,
    
    /// Category (sculpt, paint, mask, smooth)
    pub category: BrushCategory,
    
    /// Default brush size in world units
    #[serde(default = "default_brush_size")]
    pub default_size: f32,
    
    /// Default brush strength (0.0 to 1.0)
    #[serde(default = "default_brush_strength")]
    pub default_strength: f32,
    
    /// Whether this brush supports pressure sensitivity
    #[serde(default)]
    pub supports_pressure: bool,
    
    /// GPU shader name (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gpu_shader: Option<String>,
    
    /// Icon identifier
    pub icon: String,
    
    /// Additional parameters
    #[serde(default)]
    pub parameters: HashMap<String, BrushParameter>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum BrushCategory {
    Sculpt,
    Paint,
    Mask,
    Smooth,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum BrushParameter {
    Float {
        default: f32,
        min: f32,
        max: f32,
    },
    Int {
        default: i32,
        min: i32,
        max: i32,
    },
    Bool {
        default: bool,
    },
    Color {
        default: [f32; 4],
    },
}

fn default_brush_size() -> f32 { 0.1 }
fn default_brush_strength() -> f32 { 0.5 }

// ============================================================================
// TOOL CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ToolConfig {
    pub id: String,
    pub name: String,
    pub category: String,
    pub icon: String,
    pub shortcut: Option<String>,
    #[serde(default)]
    pub parameters: HashMap<String, BrushParameter>,
}

// ============================================================================
// EXPORT FORMAT CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExportFormatConfig {
    /// Unique identifier
    pub id: String,
    
    /// Display name
    pub name: String,
    
    /// File extensions (e.g., ["gltf", "glb"])
    pub extensions: Vec<String>,
    
    /// Supports mesh export
    #[serde(default)]
    pub supports_meshes: bool,
    
    /// Supports texture export
    #[serde(default)]
    pub supports_textures: bool,
    
    /// Supports material export
    #[serde(default)]
    pub supports_materials: bool,
    
    /// Export options
    #[serde(default)]
    pub options: Vec<ExportOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExportOption {
    pub id: String,
    pub label: String,
    #[serde(flatten)]
    pub value_type: ExportOptionType,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ExportOptionType {
    Bool { default: bool },
    Int { default: i32, min: i32, max: i32 },
    Float { default: f32, min: f32, max: f32 },
    Enum { default: String, values: Vec<String> },
}

// ============================================================================
// VIEWPORT PRESET CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewportPresetConfig {
    pub id: String,
    pub name: String,
    
    /// Grid size in world units
    #[serde(default = "default_grid_size")]
    pub grid_size: f32,
    
    /// Number of grid divisions
    #[serde(default = "default_grid_divisions")]
    pub grid_divisions: u32,
    
    /// Default camera distance from origin
    #[serde(default = "default_camera_distance")]
    pub camera_distance: f32,
    
    /// Camera field of view in degrees
    #[serde(default = "default_camera_fov")]
    pub camera_fov: f32,
    
    /// Lighting configuration
    #[serde(default)]
    pub lighting: LightingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct LightingConfig {
    /// Ambient light intensity (0.0 to 1.0)
    #[serde(default = "default_ambient")]
    pub ambient: f32,
    
    /// Directional light configuration
    #[serde(default)]
    pub directional: DirectionalLight,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct DirectionalLight {
    #[serde(default = "default_light_intensity")]
    pub intensity: f32,
    #[serde(default = "default_light_direction")]
    pub direction: [f32; 3],
}

fn default_light_intensity() -> f32 { 1.0 }
fn default_light_direction() -> [f32; 3] { [0.5, -1.0, 0.5] }

fn default_grid_size() -> f32 { 10.0 }
fn default_grid_divisions() -> u32 { 10 }
fn default_camera_distance() -> f32 { 5.0 }
fn default_camera_fov() -> f32 { 60.0 }
fn default_ambient() -> f32 { 0.3 }

impl Default for LightingConfig {
    fn default() -> Self {
        Self {
            ambient: 0.3,
            directional: DirectionalLight {
                intensity: 1.0,
                direction: [0.5, -1.0, 0.5],
            },
        }
    }
}

// ============================================================================
// SHADING MODE CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShadingModeConfig {
    /// Unique identifier
    pub id: String,
    
    /// Display name
    pub name: String,
    
    /// App this shading mode applies to (e.g., "ktecton", "ksculpt")
    pub app: String,
    
    /// Shader mode index (for compatibility with existing shaders)
    pub mode_index: u32,
    
    /// Icon identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    
    /// Description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

// ============================================================================
// GREEBLE PATTERN CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct GreeblePatternConfig {
    pub id: String,
    pub name: String,
    pub category: String,
    pub primitives: Vec<GreeblePrimitive>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct GreeblePrimitive {
    #[serde(rename = "type")]
    pub primitive_type: PrimitiveType,
    
    /// Probability of this primitive appearing (0.0 to 1.0)
    pub probability: f32,
    
    /// Scale range
    pub scale_range: ScaleRange,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum PrimitiveType {
    Box,
    Cylinder,
    Sphere,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ScaleRange {
    pub min: [f32; 3],
    pub max: [f32; 3],
}

// ============================================================================
// ROOT CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootConfig {
    #[serde(default)]
    pub brushes: Vec<BrushConfig>,
    
    #[serde(default)]
    pub tools: Vec<ToolConfig>,
    
    #[serde(default)]
    pub export_formats: Vec<ExportFormatConfig>,
    
    #[serde(default)]
    pub viewport_presets: Vec<ViewportPresetConfig>,
    
    #[serde(default)]
    pub greeble_patterns: Vec<GreeblePatternConfig>,
    
    #[serde(default)]
    pub shading_modes: Vec<ShadingModeConfig>,
}

impl Default for RootConfig {
    fn default() -> Self {
        Self {
            brushes: Vec::new(),
            tools: Vec::new(),
            export_formats: Vec::new(),
            viewport_presets: Vec::new(),
            greeble_patterns: Vec::new(),
            shading_modes: Vec::new(),
        }
    }
}
