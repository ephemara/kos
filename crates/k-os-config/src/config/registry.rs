//! Configuration Registry
//!
//! Central registry for all configuration with inheritance support.

use super::types::*;
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::collections::HashMap;

/// Global configuration registry
pub static GLOBAL_CONFIG: Lazy<RwLock<ConfigRegistry>> = Lazy::new(|| {
    let registry = ConfigRegistry::with_defaults();
    RwLock::new(registry)
});

/// Configuration Registry with inheritance support
#[derive(Debug, Clone)]
pub struct ConfigRegistry {
    /// Brush configurations
    brushes: HashMap<String, BrushConfig>,

    /// Tool configurations
    tools: HashMap<String, ToolConfig>,

    /// Export format configurations
    export_formats: HashMap<String, ExportFormatConfig>,

    /// Viewport preset configurations
    viewport_presets: HashMap<String, ViewportPresetConfig>,

    /// Greeble pattern configurations
    greeble_patterns: HashMap<String, GreeblePatternConfig>,

    /// Shading mode configurations
    shading_modes: HashMap<String, ShadingModeConfig>,
}

impl ConfigRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self {
            brushes: HashMap::new(),
            tools: HashMap::new(),
            export_formats: HashMap::new(),
            viewport_presets: HashMap::new(),
            greeble_patterns: HashMap::new(),
            shading_modes: HashMap::new(),
        }
    }

    /// Create registry with embedded defaults
    pub fn with_defaults() -> Self {
        let mut registry = Self::new();
        registry.load_embedded_defaults();
        registry
    }

    /// Load embedded default configurations
    fn load_embedded_defaults(&mut self) {
        // ========================================================================
        // SCULPTING BRUSHES (KSculpt)
        // ========================================================================

        // Standard sculpting brushes
        self.register_brush(BrushConfig {
            id: "clay".into(),
            name: "Clay".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.1,
            default_strength: 0.5,
            supports_pressure: true,
            gpu_shader: Some("sculpt_clay".into()),
            icon: "circle".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "draw".into(),
            name: "Draw".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.08,
            default_strength: 0.6,
            supports_pressure: true,
            gpu_shader: Some("sculpt_draw".into()),
            icon: "pen-tool".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "move".into(),
            name: "Move".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.15,
            default_strength: 0.8,
            supports_pressure: false,
            gpu_shader: Some("sculpt_move".into()),
            icon: "move".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "smooth".into(),
            name: "Smooth".into(),
            category: BrushCategory::Smooth,
            default_size: 0.12,
            default_strength: 0.4,
            supports_pressure: true,
            gpu_shader: Some("sculpt_smooth".into()),
            icon: "activity".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "flatten".into(),
            name: "Flatten".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.1,
            default_strength: 0.5,
            supports_pressure: true,
            gpu_shader: Some("sculpt_flatten".into()),
            icon: "square".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "inflate".into(),
            name: "Inflate".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.12,
            default_strength: 0.5,
            supports_pressure: true,
            gpu_shader: Some("sculpt_inflate".into()),
            icon: "maximize".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "pinch".into(),
            name: "Pinch".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.1,
            default_strength: 0.6,
            supports_pressure: true,
            gpu_shader: Some("sculpt_pinch".into()),
            icon: "minimize-2".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "grab".into(),
            name: "Grab".into(),
            category: BrushCategory::Sculpt,
            default_size: 0.2,
            default_strength: 1.0,
            supports_pressure: false,
            gpu_shader: Some("sculpt_grab".into()),
            icon: "hand".into(),
            parameters: HashMap::new(),
        });

        self.register_brush(BrushConfig {
            id: "mask".into(),
            name: "Mask".into(),
            category: BrushCategory::Mask,
            default_size: 0.1,
            default_strength: 1.0,
            supports_pressure: true,
            gpu_shader: Some("sculpt_mask".into()),
            icon: "scan-line".into(),
            parameters: HashMap::new(),
        });

        // ========================================================================
        // PAINTING BRUSHES (KPainter, KGraphos)
        // ========================================================================

        self.register_brush(BrushConfig {
            id: "paint_standard".into(),
            name: "Standard".into(),
            category: BrushCategory::Paint,
            default_size: 50.0,
            default_strength: 1.0,
            supports_pressure: true,
            gpu_shader: None,
            icon: "brush".into(),
            parameters: {
                let mut params = HashMap::new();
                params.insert(
                    "hardness".into(),
                    BrushParameter::Float {
                        default: 0.5,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "flow".into(),
                    BrushParameter::Float {
                        default: 1.0,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "opacity".into(),
                    BrushParameter::Float {
                        default: 1.0,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params
            },
        });

        self.register_brush(BrushConfig {
            id: "paint_ink".into(),
            name: "Ink".into(),
            category: BrushCategory::Paint,
            default_size: 50.0,
            default_strength: 1.0,
            supports_pressure: true,
            gpu_shader: None,
            icon: "pen-tool".into(),
            parameters: {
                let mut params = HashMap::new();
                params.insert(
                    "hardness".into(),
                    BrushParameter::Float {
                        default: 1.0,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "flow".into(),
                    BrushParameter::Float {
                        default: 1.0,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "opacity".into(),
                    BrushParameter::Float {
                        default: 1.0,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params
            },
        });

        self.register_brush(BrushConfig {
            id: "paint_soft".into(),
            name: "Soft".into(),
            category: BrushCategory::Paint,
            default_size: 50.0,
            default_strength: 0.8,
            supports_pressure: true,
            gpu_shader: None,
            icon: "brush".into(),
            parameters: {
                let mut params = HashMap::new();
                params.insert(
                    "hardness".into(),
                    BrushParameter::Float {
                        default: 0.0,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "flow".into(),
                    BrushParameter::Float {
                        default: 0.5,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "opacity".into(),
                    BrushParameter::Float {
                        default: 0.8,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params
            },
        });

        self.register_brush(BrushConfig {
            id: "paint_airbrush".into(),
            name: "Airbrush".into(),
            category: BrushCategory::Paint,
            default_size: 80.0,
            default_strength: 0.6,
            supports_pressure: true,
            gpu_shader: None,
            icon: "spray-can".into(),
            parameters: {
                let mut params = HashMap::new();
                params.insert(
                    "hardness".into(),
                    BrushParameter::Float {
                        default: 0.2,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "flow".into(),
                    BrushParameter::Float {
                        default: 0.3,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "opacity".into(),
                    BrushParameter::Float {
                        default: 0.5,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params
            },
        });

        self.register_brush(BrushConfig {
            id: "paint_smudge".into(),
            name: "Smudge".into(),
            category: BrushCategory::Paint,
            default_size: 50.0,
            default_strength: 0.7,
            supports_pressure: true,
            gpu_shader: None,
            icon: "move".into(),
            parameters: {
                let mut params = HashMap::new();
                params.insert(
                    "hardness".into(),
                    BrushParameter::Float {
                        default: 0.5,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params.insert(
                    "flow".into(),
                    BrushParameter::Float {
                        default: 0.8,
                        min: 0.0,
                        max: 1.0,
                    },
                );
                params
            },
        });

        // Default export formats
        self.register_export_format(ExportFormatConfig {
            id: "gltf".into(),
            name: "GLTF".into(),
            extensions: vec!["gltf".into()],
            supports_meshes: true,
            supports_textures: true,
            supports_materials: true,
            options: vec![ExportOption {
                id: "embed_textures".into(),
                label: "Embed Textures".into(),
                value_type: ExportOptionType::Bool { default: true },
            }],
        });

        self.register_export_format(ExportFormatConfig {
            id: "glb".into(),
            name: "GLB (Binary)".into(),
            extensions: vec!["glb".into()],
            supports_meshes: true,
            supports_textures: true,
            supports_materials: true,
            options: vec![],
        });

        self.register_export_format(ExportFormatConfig {
            id: "obj".into(),
            name: "Wavefront OBJ".into(),
            extensions: vec!["obj".into()],
            supports_meshes: true,
            supports_textures: false,
            supports_materials: true,
            options: vec![],
        });

        // Default viewport presets
        self.register_viewport_preset(ViewportPresetConfig {
            id: "modeling".into(),
            name: "Modeling".into(),
            grid_size: 10.0,
            grid_divisions: 10,
            camera_distance: 5.0,
            camera_fov: 60.0,
            lighting: LightingConfig::default(),
        });

        self.register_viewport_preset(ViewportPresetConfig {
            id: "sculpting".into(),
            name: "Sculpting".into(),
            grid_size: 5.0,
            grid_divisions: 5,
            camera_distance: 3.0,
            camera_fov: 50.0,
            lighting: LightingConfig {
                ambient: 0.4,
                directional: DirectionalLight {
                    intensity: 1.2,
                    direction: [0.3, -1.0, 0.3],
                },
            },
        });

        log::info!(
            "[ConfigRegistry] Loaded {} default brushes",
            self.brushes.len()
        );
        log::info!(
            "[ConfigRegistry] Loaded {} default export formats",
            self.export_formats.len()
        );
        log::info!(
            "[ConfigRegistry] Loaded {} default viewport presets",
            self.viewport_presets.len()
        );

        // Default shading modes for KTecton
        self.register_shading_mode(ShadingModeConfig {
            id: "ktecton_standard".into(),
            name: "Standard Shaded".into(),
            app: "ktecton".into(),
            mode_index: 0,
            icon: Some("eye".into()),
            description: Some("Dark Matter - Standard shaded view with highlights on peaks".into()),
        });

        self.register_shading_mode(ShadingModeConfig {
            id: "ktecton_neon".into(),
            name: "Neon Wireframe".into(),
            app: "ktecton".into(),
            mode_index: 1,
            icon: Some("grid".into()),
            description: Some("Neon Cyberpunk - Grid effect with neon wireframe".into()),
        });

        self.register_shading_mode(ShadingModeConfig {
            id: "ktecton_heatmap".into(),
            name: "Height Heatmap".into(),
            app: "ktecton".into(),
            mode_index: 2,
            icon: Some("activity".into()),
            description: Some("Slope Heatmap - Visualize terrain slope with color gradient".into()),
        });

        self.register_shading_mode(ShadingModeConfig {
            id: "ktecton_contours".into(),
            name: "Topographic Contours".into(),
            app: "ktecton".into(),
            mode_index: 3,
            icon: Some("layers".into()),
            description: Some("Contour Lines - Topographic contour visualization".into()),
        });

        log::info!(
            "[ConfigRegistry] Loaded {} default shading modes",
            self.shading_modes.len()
        );
    }

    // ========================================================================
    // BRUSH REGISTRY
    // ========================================================================

    pub fn register_brush(&mut self, config: BrushConfig) {
        log::debug!("[ConfigRegistry] Registered brush: {}", config.id);
        self.brushes.insert(config.id.clone(), config);
    }

    pub fn get_brush(&self, id: &str) -> Option<&BrushConfig> {
        self.brushes.get(id)
    }

    pub fn list_brushes(&self) -> Vec<&BrushConfig> {
        self.brushes.values().collect()
    }

    pub fn list_brushes_by_category(&self, category: BrushCategory) -> Vec<&BrushConfig> {
        self.brushes
            .values()
            .filter(|b| matches!(b.category, cat if cat as u8 == category as u8))
            .collect()
    }

    // ========================================================================
    // TOOL REGISTRY
    // ========================================================================

    pub fn register_tool(&mut self, config: ToolConfig) {
        log::debug!("[ConfigRegistry] Registered tool: {}", config.id);
        self.tools.insert(config.id.clone(), config);
    }

    pub fn get_tool(&self, id: &str) -> Option<&ToolConfig> {
        self.tools.get(id)
    }

    pub fn list_tools(&self) -> Vec<&ToolConfig> {
        self.tools.values().collect()
    }

    // ========================================================================
    // EXPORT FORMAT REGISTRY
    // ========================================================================

    pub fn register_export_format(&mut self, config: ExportFormatConfig) {
        log::debug!("[ConfigRegistry] Registered export format: {}", config.id);
        self.export_formats.insert(config.id.clone(), config);
    }

    pub fn get_export_format(&self, id: &str) -> Option<&ExportFormatConfig> {
        self.export_formats.get(id)
    }

    pub fn list_export_formats(&self) -> Vec<&ExportFormatConfig> {
        self.export_formats.values().collect()
    }

    pub fn get_export_format_by_extension(&self, ext: &str) -> Option<&ExportFormatConfig> {
        self.export_formats
            .values()
            .find(|f| f.extensions.iter().any(|e| e == ext))
    }

    // ========================================================================
    // VIEWPORT PRESET REGISTRY
    // ========================================================================

    pub fn register_viewport_preset(&mut self, config: ViewportPresetConfig) {
        log::debug!("[ConfigRegistry] Registered viewport preset: {}", config.id);
        self.viewport_presets.insert(config.id.clone(), config);
    }

    pub fn get_viewport_preset(&self, id: &str) -> Option<&ViewportPresetConfig> {
        self.viewport_presets.get(id)
    }

    pub fn list_viewport_presets(&self) -> Vec<&ViewportPresetConfig> {
        self.viewport_presets.values().collect()
    }

    // ========================================================================
    // GREEBLE PATTERN REGISTRY
    // ========================================================================

    pub fn register_greeble_pattern(&mut self, config: GreeblePatternConfig) {
        log::debug!("[ConfigRegistry] Registered greeble pattern: {}", config.id);
        self.greeble_patterns.insert(config.id.clone(), config);
    }

    pub fn get_greeble_pattern(&self, id: &str) -> Option<&GreeblePatternConfig> {
        self.greeble_patterns.get(id)
    }

    pub fn list_greeble_patterns(&self) -> Vec<&GreeblePatternConfig> {
        self.greeble_patterns.values().collect()
    }

    pub fn list_greeble_patterns_by_category(&self, category: &str) -> Vec<&GreeblePatternConfig> {
        self.greeble_patterns
            .values()
            .filter(|p| p.category == category)
            .collect()
    }

    // ========================================================================
    // SHADING MODE REGISTRY
    // ========================================================================

    pub fn register_shading_mode(&mut self, config: ShadingModeConfig) {
        log::debug!("[ConfigRegistry] Registered shading mode: {}", config.id);
        self.shading_modes.insert(config.id.clone(), config);
    }

    pub fn get_shading_mode(&self, id: &str) -> Option<&ShadingModeConfig> {
        self.shading_modes.get(id)
    }

    pub fn list_shading_modes(&self) -> Vec<&ShadingModeConfig> {
        self.shading_modes.values().collect()
    }

    pub fn list_shading_modes_by_app(&self, app: &str) -> Vec<&ShadingModeConfig> {
        self.shading_modes
            .values()
            .filter(|m| m.app == app)
            .collect()
    }

    // ========================================================================
    // BULK OPERATIONS
    // ========================================================================

    /// Merge another configuration into this one (for inheritance)
    pub fn merge(&mut self, other: RootConfig) {
        for brush in other.brushes {
            self.register_brush(brush);
        }
        for tool in other.tools {
            self.register_tool(tool);
        }
        for format in other.export_formats {
            self.register_export_format(format);
        }
        for preset in other.viewport_presets {
            self.register_viewport_preset(preset);
        }
        for pattern in other.greeble_patterns {
            self.register_greeble_pattern(pattern);
        }
        for mode in other.shading_modes {
            self.register_shading_mode(mode);
        }
    }

    /// Export current configuration as RootConfig
    pub fn to_root_config(&self) -> RootConfig {
        RootConfig {
            brushes: self.brushes.values().cloned().collect(),
            tools: self.tools.values().cloned().collect(),
            export_formats: self.export_formats.values().cloned().collect(),
            viewport_presets: self.viewport_presets.values().cloned().collect(),
            greeble_patterns: self.greeble_patterns.values().cloned().collect(),
            shading_modes: self.shading_modes.values().cloned().collect(),
        }
    }
}

impl Default for ConfigRegistry {
    fn default() -> Self {
        Self::with_defaults()
    }
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn list_config_brushes() -> Vec<BrushConfig> {
    GLOBAL_CONFIG
        .read()
        .list_brushes()
        .into_iter()
        .cloned()
        .collect()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn list_config_export_formats() -> Vec<ExportFormatConfig> {
    GLOBAL_CONFIG
        .read()
        .list_export_formats()
        .into_iter()
        .cloned()
        .collect()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn list_config_viewport_presets() -> Vec<ViewportPresetConfig> {
    GLOBAL_CONFIG
        .read()
        .list_viewport_presets()
        .into_iter()
        .cloned()
        .collect()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn get_config_brush(id: String) -> Option<BrushConfig> {
    GLOBAL_CONFIG.read().get_brush(&id).cloned()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn get_config_export_format(id: String) -> Option<ExportFormatConfig> {
    GLOBAL_CONFIG.read().get_export_format(&id).cloned()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn get_config_viewport_preset(id: String) -> Option<ViewportPresetConfig> {
    GLOBAL_CONFIG.read().get_viewport_preset(&id).cloned()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn list_config_shading_modes() -> Vec<ShadingModeConfig> {
    GLOBAL_CONFIG
        .read()
        .list_shading_modes()
        .into_iter()
        .cloned()
        .collect()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn list_config_shading_modes_by_app(app: String) -> Vec<ShadingModeConfig> {
    GLOBAL_CONFIG
        .read()
        .list_shading_modes_by_app(&app)
        .into_iter()
        .cloned()
        .collect()
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn get_config_shading_mode(id: String) -> Option<ShadingModeConfig> {
    GLOBAL_CONFIG.read().get_shading_mode(&id).cloned()
}
