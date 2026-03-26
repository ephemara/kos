//! Kernel Registry
//!
//! Extensible registry for GPU kernel families.
//! Makes it easy to add new brush kernel types.

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::collections::HashMap;

use super::asset::BrushKernel;

/// Global kernel registry
pub static KERNEL_REGISTRY: Lazy<RwLock<KernelRegistry>> = Lazy::new(|| {
    let mut registry = KernelRegistry::new();
    registry.register_defaults();
    RwLock::new(registry)
});

/// Information about a registered kernel
#[derive(Debug, Clone)]
pub struct KernelInfo {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Category (Sculpt, Sim, Paint)
    pub category: String,
    /// Description
    pub description: String,
    /// WGSL shader name
    pub shader: String,
    /// Required texture slots
    pub texture_slots: Vec<String>,
    /// Extra parameter definitions
    pub extra_params: Vec<ExtraParamDef>,
}

/// Definition of an extra parameter
#[derive(Debug, Clone)]
pub struct ExtraParamDef {
    pub name: String,
    pub display_name: String,
    pub default: f32,
    pub min: f32,
    pub max: f32,
}

/// Registry of all available kernel families
pub struct KernelRegistry {
    kernels: HashMap<String, KernelInfo>,
}

impl KernelRegistry {
    pub fn new() -> Self {
        Self {
            kernels: HashMap::new(),
        }
    }

    /// Register the default kernel families
    fn register_defaults(&mut self) {
        // === SCULPT KERNELS ===
        self.register(KernelInfo {
            id: "stamp".into(),
            name: "Stamp".into(),
            category: "Sculpt".into(),
            description: "Additive displacement (Clay, Inflate, Standard)".into(),
            shader: "sculpt_stamp".into(),
            texture_slots: vec!["alpha".into()],
            extra_params: vec![ExtraParamDef {
                name: "plane_offset".into(),
                display_name: "Plane Offset".into(),
                default: 0.0,
                min: -1.0,
                max: 1.0,
            }],
        });

        self.register(KernelInfo {
            id: "smooth".into(),
            name: "Smooth".into(),
            category: "Sculpt".into(),
            description: "Diffusion/relaxation".into(),
            shader: "sculpt_smooth".into(),
            texture_slots: vec![],
            extra_params: vec![ExtraParamDef {
                name: "iterations".into(),
                display_name: "Iterations".into(),
                default: 1.0,
                min: 1.0,
                max: 10.0,
            }],
        });

        self.register(KernelInfo {
            id: "pinch".into(),
            name: "Pinch".into(),
            category: "Sculpt".into(),
            description: "Directional displacement (Pinch, Crease)".into(),
            shader: "sculpt_pinch".into(),
            texture_slots: vec![],
            extra_params: vec![ExtraParamDef {
                name: "magnify".into(),
                display_name: "Magnify".into(),
                default: 0.0,
                min: -1.0,
                max: 1.0,
            }],
        });

        self.register(KernelInfo {
            id: "grab".into(),
            name: "Grab".into(),
            category: "Sculpt".into(),
            description: "Vertex grab/move".into(),
            shader: "sculpt_grab".into(),
            texture_slots: vec![],
            extra_params: vec![],
        });

        self.register(KernelInfo {
            id: "flatten".into(),
            name: "Flatten".into(),
            category: "Sculpt".into(),
            description: "Planar operations (Flatten, Scrape)".into(),
            shader: "sculpt_flatten".into(),
            texture_slots: vec![],
            extra_params: vec![ExtraParamDef {
                name: "contrast".into(),
                display_name: "Contrast".into(),
                default: 0.5,
                min: 0.0,
                max: 1.0,
            }],
        });

        // === SIM KERNELS ===
        self.register(KernelInfo {
            id: "sim_cloth".into(),
            name: "Cloth".into(),
            category: "Sim".into(),
            description: "Cloth simulation brush".into(),
            shader: "sim_cloth".into(),
            texture_slots: vec![],
            extra_params: vec![
                ExtraParamDef {
                    name: "stiffness".into(),
                    display_name: "Stiffness".into(),
                    default: 0.5,
                    min: 0.0,
                    max: 1.0,
                },
                ExtraParamDef {
                    name: "damping".into(),
                    display_name: "Damping".into(),
                    default: 0.8,
                    min: 0.0,
                    max: 1.0,
                },
                ExtraParamDef {
                    name: "gravity".into(),
                    display_name: "Gravity".into(),
                    default: -9.8,
                    min: -20.0,
                    max: 0.0,
                },
            ],
        });

        self.register(KernelInfo {
            id: "sim_gravity".into(),
            name: "Gravity".into(),
            category: "Sim".into(),
            description: "Gravity/drape effect".into(),
            shader: "sim_gravity".into(),
            texture_slots: vec![],
            extra_params: vec![ExtraParamDef {
                name: "mass".into(),
                display_name: "Mass".into(),
                default: 1.0,
                min: 0.1,
                max: 10.0,
            }],
        });

        // === PAINT KERNELS ===
        self.register(KernelInfo {
            id: "paint_color".into(),
            name: "Color".into(),
            category: "Paint".into(),
            description: "Vertex color painting".into(),
            shader: "paint_color".into(),
            texture_slots: vec!["alpha".into()],
            extra_params: vec![],
        });

        self.register(KernelInfo {
            id: "paint_mask".into(),
            name: "Mask".into(),
            category: "Paint".into(),
            description: "Mask painting".into(),
            shader: "paint_mask".into(),
            texture_slots: vec!["alpha".into()],
            extra_params: vec![],
        });

        // === PHYSICS KERNELS ===
        self.register(KernelInfo {
            id: "physics".into(),
            name: "Physics".into(),
            category: "Sculpt".into(),
            description: "Physics-based effects (Attractor, Magnet, Elastic, Turbulence, Gravity)"
                .into(),
            shader: "sculpt_physics".into(),
            texture_slots: vec!["alpha".into()],
            extra_params: vec![
                ExtraParamDef {
                    name: "power".into(),
                    display_name: "Power".into(),
                    default: 1.0,
                    min: 0.1,
                    max: 5.0,
                },
                ExtraParamDef {
                    name: "stiffness".into(),
                    display_name: "Stiffness".into(),
                    default: 1.0,
                    min: 0.0,
                    max: 5.0,
                },
                ExtraParamDef {
                    name: "damping".into(),
                    display_name: "Damping".into(),
                    default: 0.3,
                    min: 0.0,
                    max: 1.0,
                },
            ],
        });
    }

    /// Register a kernel family
    pub fn register(&mut self, info: KernelInfo) {
        log::debug!("[KernelRegistry] Registered kernel: {}", info.id);
        self.kernels.insert(info.id.clone(), info);
    }

    /// Get kernel info by ID
    pub fn get(&self, id: &str) -> Option<&KernelInfo> {
        self.kernels.get(id)
    }

    /// Get kernel info for a BrushKernel enum
    pub fn get_for_kernel(&self, kernel: &BrushKernel) -> Option<&KernelInfo> {
        match kernel {
            BrushKernel::Stamp => self.get("stamp"),
            BrushKernel::Smooth => self.get("smooth"),
            BrushKernel::Pinch => self.get("pinch"),
            BrushKernel::Grab => self.get("grab"),
            BrushKernel::Flatten => self.get("flatten"),
            BrushKernel::Physics => self.get("physics"),
            BrushKernel::SimCloth => self.get("sim_cloth"),
            BrushKernel::SimGravity => self.get("sim_gravity"),
            BrushKernel::SimInflate => self.get("sim_inflate"),
            BrushKernel::PaintColor => self.get("paint_color"),
            BrushKernel::PaintMask => self.get("paint_mask"),
            // Experimental kernels (fall back to stamp shader for now)
            BrushKernel::CrystalGrowth => self.get("stamp"),
            BrushKernel::CrystalBismuth => self.get("stamp"),
            BrushKernel::VoronoiShatter => self.get("stamp"),
            BrushKernel::Custom(name) => self.get(name),
        }
    }

    /// List all kernels
    pub fn list(&self) -> Vec<&KernelInfo> {
        self.kernels.values().collect()
    }

    /// List kernels by category
    pub fn list_by_category(&self, category: &str) -> Vec<&KernelInfo> {
        self.kernels
            .values()
            .filter(|k| k.category == category)
            .collect()
    }
}

impl Default for KernelRegistry {
    fn default() -> Self {
        let mut registry = Self::new();
        registry.register_defaults();
        registry
    }
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// List all registered kernels
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn list_kernels() -> Vec<KernelInfoDto> {
    KERNEL_REGISTRY
        .read()
        .list()
        .into_iter()
        .map(|k| KernelInfoDto {
            id: k.id.clone(),
            name: k.name.clone(),
            category: k.category.clone(),
            description: k.description.clone(),
        })
        .collect()
}

/// DTO for kernel info (simpler for frontend)
#[derive(serde::Serialize)]
pub struct KernelInfoDto {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
}
