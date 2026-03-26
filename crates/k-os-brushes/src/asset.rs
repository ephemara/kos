//! Brush Asset Definition
//!
//! A brush is a data asset (JSON) that defines how a sculpting/painting tool behaves.
//! The asset references a kernel family and provides parameters.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A complete brush asset - serializable to .kbrush JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KBrushAsset {
    // === Identity ===
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Category path (e.g., "Sculpt/Clay")
    pub category: String,
    /// Tags for search
    #[serde(default)]
    pub tags: Vec<String>,
    /// Base64-encoded icon (auto-generated from stroke preview)
    #[serde(default)]
    pub icon: Option<String>,

    // === Kernel ===
    /// Which GPU kernel family to use
    pub kernel: BrushKernel,

    // === Core Parameters ===
    pub params: BrushParams,

    // === Textures ===
    #[serde(default)]
    pub textures: BrushTextures,

    // === Curves ===
    /// Pressure → Strength curve
    #[serde(default)]
    pub pressure_strength: Option<String>, // Reference to curve asset
    /// Speed → Radius curve  
    #[serde(default)]
    pub speed_radius: Option<String>,
    /// Tilt → Rotation curve
    #[serde(default)]
    pub tilt_rotation: Option<String>,
}

impl Default for KBrushAsset {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "New Brush".into(),
            category: "Sculpt/Custom".into(),
            tags: vec![],
            icon: None,
            kernel: BrushKernel::Stamp,
            params: BrushParams::default(),
            textures: BrushTextures::default(),
            pressure_strength: None,
            speed_radius: None,
            tilt_rotation: None,
        }
    }
}

/// GPU kernel families - each maps to a specific WGSL compute shader
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BrushKernel {
    // === Sculpt Kernels ===
    /// Stamp/additive displacement (Clay, Inflate, Standard, Blob)
    Stamp,
    /// Diffusion/relaxation (Smooth, Relax, Polish)
    Smooth,
    /// Directional displacement (Pinch, Crease, Dam Standard)
    Pinch,
    /// Vertex grab/move (Grab, Snake Hook, Move, Twist)
    Grab,
    /// Planar operations (Flatten, Scrape, Fill, Trim)
    Flatten,
    /// Physics-based effects (Attractor, Magnet, Elastic, Turbulence, Gravity)
    Physics,

    // === Simulation Kernels ===
    /// Cloth simulation brush
    SimCloth,
    /// Gravity/drape simulation
    SimGravity,
    /// Inflate with collision
    SimInflate,

    // === Paint Kernels ===
    /// Vertex color painting
    PaintColor,
    /// Mask painting
    PaintMask,

    // === Experimental Kernels ===
    /// Crystal growth patterns (procedural)
    CrystalGrowth,
    /// Bismuth-style crystalline structures
    CrystalBismuth,
    /// Voronoi shatter/fracture patterns
    VoronoiShatter,

    // === Extensibility ===
    /// Custom kernel by name (for plugins)
    Custom(String),
}

impl BrushKernel {
    /// Get the WGSL shader name for this kernel
    pub fn shader_name(&self) -> &str {
        match self {
            Self::Stamp => "sculpt_stamp",
            Self::Smooth => "sculpt_smooth",
            Self::Pinch => "sculpt_pinch",
            Self::Grab => "sculpt_grab",
            Self::Flatten => "sculpt_flatten",
            Self::Physics => "sculpt_physics",
            Self::SimCloth => "sim_cloth",
            Self::SimGravity => "sim_gravity",
            Self::SimInflate => "sim_inflate",
            Self::PaintColor => "paint_color",
            Self::PaintMask => "paint_mask",
            Self::CrystalGrowth => "sculpt_crystal",
            Self::CrystalBismuth => "sculpt_crystal",
            Self::VoronoiShatter => "sculpt_voronoi",
            Self::Custom(name) => name,
        }
    }

    /// Get the default entry point for this kernel
    pub fn default_entry_point(&self) -> &str {
        match self {
            Self::Stamp => "stamp_main",
            Self::Smooth => "smooth_main",
            Self::Pinch => "pinch_main",
            Self::Grab => "grab_main",
            Self::Flatten => "flatten_main",
            Self::Physics => "physics_attractor",
            Self::SimCloth => "sim_cloth_main",
            Self::SimGravity => "sim_gravity_main",
            Self::SimInflate => "sim_inflate_main",
            Self::PaintColor => "paint_color_main",
            Self::PaintMask => "paint_mask_main",
            Self::CrystalGrowth => "crystal_growth_main",
            Self::CrystalBismuth => "crystal_bismuth_main",
            Self::VoronoiShatter => "voronoi_shatter_main",
            Self::Custom(_) => "main",
        }
    }
}

/// Core brush parameters - shared across all kernel families
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrushParams {
    // === Geometry ===
    /// Brush radius in world units
    pub radius: f32,
    /// Brush strength (0.0 - 1.0+)
    pub strength: f32,
    /// Hardness/falloff sharpness (0.0 = soft, 1.0 = hard edge)
    pub hardness: f32,

    // === Stroke ===
    /// Spacing between stamps (as fraction of radius)
    pub spacing: f32,
    /// Lazy mouse distance
    #[serde(default)]
    pub lazy_radius: f32,

    // === Mode Flags ===
    /// Add or subtract mode
    #[serde(default)]
    pub subtract: bool,
    /// Lock to initial normal
    #[serde(default)]
    pub front_faces_only: bool,
    /// Accumulate on same spot
    #[serde(default)]
    pub accumulate: bool,

    // === Jitter/Randomization ===
    #[serde(default)]
    pub jitter_position: f32,
    #[serde(default)]
    pub jitter_rotation: f32,
    #[serde(default)]
    pub jitter_strength: f32,

    // === Kernel-Specific ===
    /// Extra params for specific kernels (flexible)
    #[serde(default)]
    pub extras: HashMap<String, f32>,
}

impl Default for BrushParams {
    fn default() -> Self {
        Self {
            radius: 0.1,
            strength: 0.5,
            hardness: 0.5,
            spacing: 0.1,
            lazy_radius: 0.0,
            subtract: false,
            front_faces_only: true,
            accumulate: false,
            jitter_position: 0.0,
            jitter_rotation: 0.0,
            jitter_strength: 0.0,
            extras: HashMap::new(),
        }
    }
}

/// Texture references for the brush
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BrushTextures {
    /// Alpha/stamp texture (path or handle)
    #[serde(default)]
    pub alpha: Option<String>,
    /// Noise texture for modulation
    #[serde(default)]
    pub noise: Option<String>,
    /// Pattern/stencil texture
    #[serde(default)]
    pub pattern: Option<String>,
}

// ============================================================================
// PRESET HELPERS
// ============================================================================

impl KBrushAsset {
    /// Create a basic clay brush preset
    pub fn preset_clay() -> Self {
        Self {
            id: "preset_clay".into(),
            name: "Clay".into(),
            category: "Sculpt/Clay".into(),
            tags: vec!["sculpt".into(), "clay".into(), "buildup".into()],
            kernel: BrushKernel::Stamp,
            params: BrushParams {
                radius: 0.15,
                strength: 0.6,
                hardness: 0.3,
                spacing: 0.08,
                accumulate: true,
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a smooth brush preset
    pub fn preset_smooth() -> Self {
        Self {
            id: "preset_smooth".into(),
            name: "Smooth".into(),
            category: "Sculpt/Polish".into(),
            tags: vec!["sculpt".into(), "smooth".into(), "relax".into()],
            kernel: BrushKernel::Smooth,
            params: BrushParams {
                radius: 0.12,
                strength: 0.4,
                hardness: 0.2,
                spacing: 0.05,
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a pinch brush preset
    pub fn preset_pinch() -> Self {
        Self {
            id: "preset_pinch".into(),
            name: "Pinch".into(),
            category: "Sculpt/Crease".into(),
            tags: vec!["sculpt".into(), "pinch".into(), "crease".into()],
            kernel: BrushKernel::Pinch,
            params: BrushParams {
                radius: 0.08,
                strength: 0.5,
                hardness: 0.6,
                spacing: 0.06,
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a cloth simulation brush preset
    pub fn preset_cloth() -> Self {
        Self {
            id: "preset_cloth".into(),
            name: "Cloth".into(),
            category: "Sim/Cloth".into(),
            tags: vec!["sim".into(), "cloth".into(), "fabric".into()],
            kernel: BrushKernel::SimCloth,
            params: BrushParams {
                radius: 0.2,
                strength: 0.3,
                hardness: 0.4,
                spacing: 0.1,
                extras: [("stiffness".into(), 0.5), ("damping".into(), 0.8)]
                    .into_iter()
                    .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a grab brush preset
    pub fn preset_grab() -> Self {
        Self {
            id: "preset_grab".into(),
            name: "Grab".into(),
            category: "Sculpt/Grab".into(),
            tags: vec!["sculpt".into(), "grab".into(), "move".into()],
            kernel: BrushKernel::Grab,
            params: BrushParams {
                radius: 0.2,
                strength: 1.0, // Full strength for 1:1 movement
                hardness: 0.3,
                spacing: 0.02, // Tight spacing for smooth grab
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a snake hook brush preset
    pub fn preset_snake_hook() -> Self {
        Self {
            id: "preset_snake_hook".into(),
            name: "Snake Hook".into(),
            category: "Sculpt/Grab".into(),
            tags: vec![
                "sculpt".into(),
                "snake".into(),
                "hook".into(),
                "trail".into(),
            ],
            kernel: BrushKernel::Grab,
            params: BrushParams {
                radius: 0.15,
                strength: 0.8,
                hardness: 0.2, // Soft falloff for trailing effect
                spacing: 0.02,
                extras: [
                    ("entry_point".into(), 1.0),   // 1 = grab_snake_hook
                    ("snake_falloff".into(), 0.7), // Mix of linear and exponential
                ]
                .into_iter()
                .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create an attractor brush preset
    pub fn preset_attractor() -> Self {
        Self {
            id: "preset_attractor".into(),
            name: "Attractor".into(),
            category: "Sculpt/Physics".into(),
            tags: vec![
                "sculpt".into(),
                "physics".into(),
                "attractor".into(),
                "magnet".into(),
            ],
            kernel: BrushKernel::Physics,
            params: BrushParams {
                radius: 0.25,
                strength: 0.4,
                hardness: 0.5,
                spacing: 0.05,
                extras: [
                    ("entry_point".into(), 0.0), // physics_attractor
                    ("power".into(), 1.5),       // Falloff power
                ]
                .into_iter()
                .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create an elastic brush preset
    pub fn preset_elastic() -> Self {
        Self {
            id: "preset_elastic".into(),
            name: "Elastic".into(),
            category: "Sculpt/Physics".into(),
            tags: vec![
                "sculpt".into(),
                "physics".into(),
                "elastic".into(),
                "spring".into(),
            ],
            kernel: BrushKernel::Physics,
            params: BrushParams {
                radius: 0.18,
                strength: 0.5,
                hardness: 0.2, // Soft for elastic feel
                spacing: 0.04,
                extras: [
                    ("entry_point".into(), 2.0), // physics_elastic
                    ("stiffness".into(), 2.0),
                    ("damping".into(), 0.3),
                ]
                .into_iter()
                .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a turbulence brush preset
    pub fn preset_turbulence() -> Self {
        Self {
            id: "preset_turbulence".into(),
            name: "Turbulence".into(),
            category: "Sculpt/Physics".into(),
            tags: vec![
                "sculpt".into(),
                "physics".into(),
                "turbulence".into(),
                "noise".into(),
            ],
            kernel: BrushKernel::Physics,
            params: BrushParams {
                radius: 0.2,
                strength: 0.3,
                hardness: 0.4,
                spacing: 0.08,
                extras: [
                    ("entry_point".into(), 4.0), // physics_turbulence
                    ("noise_scale".into(), 5.0),
                    ("noise_intensity".into(), 0.5),
                ]
                .into_iter()
                .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    /// Create a twist brush preset
    pub fn preset_twist() -> Self {
        Self {
            id: "preset_twist".into(),
            name: "Twist".into(),
            category: "Sculpt/Grab".into(),
            tags: vec!["sculpt".into(), "twist".into(), "rotate".into()],
            kernel: BrushKernel::Grab,
            params: BrushParams {
                radius: 0.2,
                strength: 0.5,
                hardness: 0.4,
                spacing: 0.03,
                extras: [
                    ("entry_point".into(), 3.0), // grab_twist
                    ("twist_angle".into(), 0.1), // Radians per dab
                ]
                .into_iter()
                .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }
}
