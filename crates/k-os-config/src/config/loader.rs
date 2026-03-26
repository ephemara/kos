//! Configuration Loader
//!
//! Loads configuration with inheritance:
//! 1. Embedded defaults (in binary)
//! 2. User preferences (~/.kos/config/)
//! 3. Project overrides (project/.kos/config/)
//!
//! Also supports preset import/export for sharing configurations.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use super::registry::ConfigRegistry;
use super::types::*;

/// Configuration loader with inheritance support
pub struct ConfigLoader {
    user_config_dir: PathBuf,
    project_config_dir: Option<PathBuf>,
}

/// Configuration category for selective import/export
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum ConfigCategory {
    Brushes,
    Tools,
    ExportFormats,
    ViewportPresets,
    GreeblePatterns,
}

#[derive(serde::Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub brush_count: usize,
    pub tool_count: usize,
    pub export_format_count: usize,
    pub viewport_preset_count: usize,
    pub greeble_pattern_count: usize,
}

impl ConfigLoader {
    /// Create a new config loader
    pub fn new() -> Self {
        let user_config_dir = dirs::home_dir()
            .map(|home| home.join(".kos").join("config"))
            .unwrap_or_else(|| PathBuf::from(".kos/config"));

        Self {
            user_config_dir,
            project_config_dir: None,
        }
    }

    /// Set the project config directory
    pub fn with_project_dir(mut self, project_dir: PathBuf) -> Self {
        self.project_config_dir = Some(project_dir.join(".kos").join("config"));
        self
    }

    /// Load configuration with full inheritance chain
    pub fn load(&self) -> Result<ConfigRegistry, ConfigError> {
        // Start with embedded defaults
        let mut registry = ConfigRegistry::with_defaults();

        log::info!("[ConfigLoader] Loading configuration with inheritance");
        log::info!("[ConfigLoader] 1. Embedded defaults loaded");

        // Load user preferences (if exists)
        if self.user_config_dir.exists() {
            log::info!(
                "[ConfigLoader] 2. Loading user preferences from: {:?}",
                self.user_config_dir
            );
            let user_config = self.load_from_directory(&self.user_config_dir)?;
            registry.merge(user_config);
        } else {
            log::info!("[ConfigLoader] 2. No user preferences found (using defaults)");
        }

        // Load project overrides (if exists)
        if let Some(ref project_dir) = self.project_config_dir {
            if project_dir.exists() {
                log::info!(
                    "[ConfigLoader] 3. Loading project overrides from: {:?}",
                    project_dir
                );
                let project_config = self.load_from_directory(project_dir)?;
                registry.merge(project_config);
            } else {
                log::info!("[ConfigLoader] 3. No project overrides found");
            }
        }

        Ok(registry)
    }

    /// Load configuration from a directory
    fn load_from_directory(&self, dir: &Path) -> Result<RootConfig, ConfigError> {
        let mut config = RootConfig::default();

        // Load brushes.json
        if let Some(brushes) = self.load_json_file::<Vec<BrushConfig>>(dir, "brushes.json")? {
            config.brushes = brushes;
        }

        // Load tools.json
        if let Some(tools) = self.load_json_file::<Vec<ToolConfig>>(dir, "tools.json")? {
            config.tools = tools;
        }

        // Load export_formats.json
        if let Some(formats) =
            self.load_json_file::<Vec<ExportFormatConfig>>(dir, "export_formats.json")?
        {
            config.export_formats = formats;
        }

        // Load viewport_presets.json
        if let Some(presets) =
            self.load_json_file::<Vec<ViewportPresetConfig>>(dir, "viewport_presets.json")?
        {
            config.viewport_presets = presets;
        }

        // Load greeble_patterns.json
        if let Some(patterns) =
            self.load_json_file::<Vec<GreeblePatternConfig>>(dir, "greeble_patterns.json")?
        {
            config.greeble_patterns = patterns;
        }

        Ok(config)
    }

    /// Load a JSON file if it exists
    fn load_json_file<T: serde::de::DeserializeOwned>(
        &self,
        dir: &Path,
        filename: &str,
    ) -> Result<Option<T>, ConfigError> {
        let path = dir.join(filename);

        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path).map_err(|e| ConfigError::IoError {
            path: path.clone(),
            error: e.to_string(),
        })?;

        let value: T = serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
            path: path.clone(),
            error: e.to_string(),
            line: e.line(),
            column: e.column(),
        })?;

        log::debug!("[ConfigLoader] Loaded: {:?}", path);
        Ok(Some(value))
    }

    /// Save configuration to user preferences
    pub fn save_user_config(&self, config: &RootConfig) -> Result<(), ConfigError> {
        // Create directory if it doesn't exist
        fs::create_dir_all(&self.user_config_dir).map_err(|e| ConfigError::IoError {
            path: self.user_config_dir.clone(),
            error: e.to_string(),
        })?;

        // Save each configuration file
        if !config.brushes.is_empty() {
            self.save_json_file(&self.user_config_dir, "brushes.json", &config.brushes)?;
        }

        if !config.tools.is_empty() {
            self.save_json_file(&self.user_config_dir, "tools.json", &config.tools)?;
        }

        if !config.export_formats.is_empty() {
            self.save_json_file(
                &self.user_config_dir,
                "export_formats.json",
                &config.export_formats,
            )?;
        }

        if !config.viewport_presets.is_empty() {
            self.save_json_file(
                &self.user_config_dir,
                "viewport_presets.json",
                &config.viewport_presets,
            )?;
        }

        if !config.greeble_patterns.is_empty() {
            self.save_json_file(
                &self.user_config_dir,
                "greeble_patterns.json",
                &config.greeble_patterns,
            )?;
        }

        log::info!(
            "[ConfigLoader] Saved user configuration to: {:?}",
            self.user_config_dir
        );
        Ok(())
    }

    // ========================================================================
    // PRESET IMPORT/EXPORT
    // ========================================================================

    /// Export configuration preset to a file
    pub fn export_preset(&self, config: &RootConfig, path: &Path) -> Result<(), ConfigError> {
        // Validate configuration before export
        self.validate_config(config)?;

        // Serialize to pretty JSON
        let content =
            serde_json::to_string_pretty(config).map_err(|e| ConfigError::SerializeError {
                error: e.to_string(),
            })?;

        // Write to file
        let mut file = fs::File::create(path).map_err(|e| ConfigError::IoError {
            path: path.to_path_buf(),
            error: e.to_string(),
        })?;

        file.write_all(content.as_bytes())
            .map_err(|e| ConfigError::IoError {
                path: path.to_path_buf(),
                error: e.to_string(),
            })?;

        log::info!("[ConfigLoader] Exported preset to: {:?}", path);
        Ok(())
    }

    /// Import configuration preset from a file
    pub fn import_preset(&self, path: &Path) -> Result<RootConfig, ConfigError> {
        // Read file
        let content = fs::read_to_string(path).map_err(|e| ConfigError::IoError {
            path: path.to_path_buf(),
            error: e.to_string(),
        })?;

        // Parse JSON
        let config: RootConfig =
            serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
                path: path.to_path_buf(),
                error: e.to_string(),
                line: e.line(),
                column: e.column(),
            })?;

        // Validate configuration
        self.validate_config(&config)?;

        log::info!("[ConfigLoader] Imported preset from: {:?}", path);
        Ok(config)
    }

    /// Validate configuration structure and values
    fn validate_config(&self, config: &RootConfig) -> Result<(), ConfigError> {
        // Validate brushes
        for brush in &config.brushes {
            if brush.id.is_empty() {
                return Err(ConfigError::ValidationError {
                    error: "Brush ID cannot be empty".to_string(),
                });
            }
            if brush.name.is_empty() {
                return Err(ConfigError::ValidationError {
                    error: format!("Brush '{}' has empty name", brush.id),
                });
            }
            if brush.default_size <= 0.0 {
                return Err(ConfigError::ValidationError {
                    error: format!(
                        "Brush '{}' has invalid size: {}",
                        brush.id, brush.default_size
                    ),
                });
            }
            if !(0.0..=1.0).contains(&brush.default_strength) {
                return Err(ConfigError::ValidationError {
                    error: format!(
                        "Brush '{}' has invalid strength: {} (must be 0.0-1.0)",
                        brush.id, brush.default_strength
                    ),
                });
            }
        }

        // Validate export formats
        for format in &config.export_formats {
            if format.id.is_empty() {
                return Err(ConfigError::ValidationError {
                    error: "Export format ID cannot be empty".to_string(),
                });
            }
            if format.extensions.is_empty() {
                return Err(ConfigError::ValidationError {
                    error: format!("Export format '{}' has no extensions", format.id),
                });
            }
        }

        // Validate viewport presets
        for preset in &config.viewport_presets {
            if preset.id.is_empty() {
                return Err(ConfigError::ValidationError {
                    error: "Viewport preset ID cannot be empty".to_string(),
                });
            }
            if preset.grid_size <= 0.0 {
                return Err(ConfigError::ValidationError {
                    error: format!(
                        "Viewport preset '{}' has invalid grid size: {}",
                        preset.id, preset.grid_size
                    ),
                });
            }
            if preset.camera_fov <= 0.0 || preset.camera_fov >= 180.0 {
                return Err(ConfigError::ValidationError {
                    error: format!(
                        "Viewport preset '{}' has invalid FOV: {} (must be 0-180)",
                        preset.id, preset.camera_fov
                    ),
                });
            }
        }

        // Validate greeble patterns
        for pattern in &config.greeble_patterns {
            if pattern.id.is_empty() {
                return Err(ConfigError::ValidationError {
                    error: "Greeble pattern ID cannot be empty".to_string(),
                });
            }
            for primitive in &pattern.primitives {
                if !(0.0..=1.0).contains(&primitive.probability) {
                    return Err(ConfigError::ValidationError {
                        error: format!(
                            "Greeble pattern '{}' has invalid probability: {}",
                            pattern.id, primitive.probability
                        ),
                    });
                }
            }
        }

        Ok(())
    }

    /// Export specific configuration category to a file
    pub fn export_category(
        &self,
        category: ConfigCategory,
        path: &Path,
    ) -> Result<(), ConfigError> {
        let registry = super::registry::GLOBAL_CONFIG.read();

        let content = match category {
            ConfigCategory::Brushes => {
                let brushes: Vec<_> = registry.list_brushes().into_iter().cloned().collect();
                serde_json::to_string_pretty(&brushes)
            }
            ConfigCategory::Tools => {
                let tools: Vec<_> = registry.list_tools().into_iter().cloned().collect();
                serde_json::to_string_pretty(&tools)
            }
            ConfigCategory::ExportFormats => {
                let formats: Vec<_> = registry
                    .list_export_formats()
                    .into_iter()
                    .cloned()
                    .collect();
                serde_json::to_string_pretty(&formats)
            }
            ConfigCategory::ViewportPresets => {
                let presets: Vec<_> = registry
                    .list_viewport_presets()
                    .into_iter()
                    .cloned()
                    .collect();
                serde_json::to_string_pretty(&presets)
            }
            ConfigCategory::GreeblePatterns => {
                let patterns: Vec<_> = registry
                    .list_greeble_patterns()
                    .into_iter()
                    .cloned()
                    .collect();
                serde_json::to_string_pretty(&patterns)
            }
        }
        .map_err(|e| ConfigError::SerializeError {
            error: e.to_string(),
        })?;

        fs::write(path, content).map_err(|e| ConfigError::IoError {
            path: path.to_path_buf(),
            error: e.to_string(),
        })?;

        log::info!("[ConfigLoader] Exported {:?} to: {:?}", category, path);
        Ok(())
    }

    /// Import specific configuration category from a file
    pub fn import_category(
        &self,
        category: ConfigCategory,
        path: &Path,
    ) -> Result<(), ConfigError> {
        let content = fs::read_to_string(path).map_err(|e| ConfigError::IoError {
            path: path.to_path_buf(),
            error: e.to_string(),
        })?;

        let mut registry = super::registry::GLOBAL_CONFIG.write();

        match category {
            ConfigCategory::Brushes => {
                let brushes: Vec<BrushConfig> =
                    serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
                        path: path.to_path_buf(),
                        error: e.to_string(),
                        line: e.line(),
                        column: e.column(),
                    })?;
                for brush in brushes {
                    registry.register_brush(brush);
                }
            }
            ConfigCategory::Tools => {
                let tools: Vec<ToolConfig> =
                    serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
                        path: path.to_path_buf(),
                        error: e.to_string(),
                        line: e.line(),
                        column: e.column(),
                    })?;
                for tool in tools {
                    registry.register_tool(tool);
                }
            }
            ConfigCategory::ExportFormats => {
                let formats: Vec<ExportFormatConfig> =
                    serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
                        path: path.to_path_buf(),
                        error: e.to_string(),
                        line: e.line(),
                        column: e.column(),
                    })?;
                for format in formats {
                    registry.register_export_format(format);
                }
            }
            ConfigCategory::ViewportPresets => {
                let presets: Vec<ViewportPresetConfig> =
                    serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
                        path: path.to_path_buf(),
                        error: e.to_string(),
                        line: e.line(),
                        column: e.column(),
                    })?;
                for preset in presets {
                    registry.register_viewport_preset(preset);
                }
            }
            ConfigCategory::GreeblePatterns => {
                let patterns: Vec<GreeblePatternConfig> =
                    serde_json::from_str(&content).map_err(|e| ConfigError::ParseError {
                        path: path.to_path_buf(),
                        error: e.to_string(),
                        line: e.line(),
                        column: e.column(),
                    })?;
                for pattern in patterns {
                    registry.register_greeble_pattern(pattern);
                }
            }
        }

        log::info!("[ConfigLoader] Imported {:?} from: {:?}", category, path);
        Ok(())
    }

    /// Save a JSON file
    fn save_json_file<T: serde::Serialize>(
        &self,
        dir: &Path,
        filename: &str,
        data: &T,
    ) -> Result<(), ConfigError> {
        let path = dir.join(filename);

        let content =
            serde_json::to_string_pretty(data).map_err(|e| ConfigError::SerializeError {
                error: e.to_string(),
            })?;

        fs::write(&path, content).map_err(|e| ConfigError::IoError {
            path: path.clone(),
            error: e.to_string(),
        })?;

        log::debug!("[ConfigLoader] Saved: {:?}", path);
        Ok(())
    }

    /// Get user config directory
    pub fn user_config_dir(&self) -> &Path {
        &self.user_config_dir
    }

    /// Get project config directory
    pub fn project_config_dir(&self) -> Option<&Path> {
        self.project_config_dir.as_deref()
    }
}

impl Default for ConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// ERROR TYPES
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("IO error reading {path:?}: {error}")]
    IoError { path: PathBuf, error: String },

    #[error("Parse error in {path:?} at line {line}, column {column}: {error}")]
    ParseError {
        path: PathBuf,
        error: String,
        line: usize,
        column: usize,
    },

    #[error("Validation error: {error}")]
    ValidationError { error: String },

    #[error("Serialize error: {error}")]
    SerializeError { error: String },
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn reload_config(project_dir: Option<String>) -> Result<String, String> {
    let loader = if let Some(dir) = project_dir {
        ConfigLoader::new().with_project_dir(PathBuf::from(dir))
    } else {
        ConfigLoader::new()
    };

    match loader.load() {
        Ok(registry) => {
            // Update global config
            *super::registry::GLOBAL_CONFIG.write() = registry;
            Ok("Configuration reloaded successfully".to_string())
        }
        Err(e) => Err(format!("Failed to reload configuration: {}", e)),
    }
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn save_user_config() -> Result<String, String> {
    let loader = ConfigLoader::new();
    let config = super::registry::GLOBAL_CONFIG.read().to_root_config();

    loader
        .save_user_config(&config)
        .map(|_| "User configuration saved successfully".to_string())
        .map_err(|e| format!("Failed to save user configuration: {}", e))
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn export_config_preset(path: String) -> Result<String, String> {
    let loader = ConfigLoader::new();
    let config = super::registry::GLOBAL_CONFIG.read().to_root_config();

    loader
        .export_preset(&config, Path::new(&path))
        .map(|_| format!("Configuration preset exported to: {}", path))
        .map_err(|e| format!("Failed to export preset: {}", e))
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn import_config_preset(path: String, merge: bool) -> Result<String, String> {
    let loader = ConfigLoader::new();

    let imported_config = loader
        .import_preset(Path::new(&path))
        .map_err(|e| format!("Failed to import preset: {}", e))?;

    let mut registry = super::registry::GLOBAL_CONFIG.write();

    if merge {
        // Merge with existing configuration
        registry.merge(imported_config);
        Ok(format!(
            "Configuration preset imported and merged from: {}",
            path
        ))
    } else {
        // Replace entire configuration
        *registry = ConfigRegistry::with_defaults();
        registry.merge(imported_config);
        Ok(format!(
            "Configuration preset imported (replaced) from: {}",
            path
        ))
    }
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn export_config_category(category: String, path: String) -> Result<String, String> {
    let loader = ConfigLoader::new();

    let cat = match category.as_str() {
        "brushes" => ConfigCategory::Brushes,
        "tools" => ConfigCategory::Tools,
        "export_formats" => ConfigCategory::ExportFormats,
        "viewport_presets" => ConfigCategory::ViewportPresets,
        "greeble_patterns" => ConfigCategory::GreeblePatterns,
        _ => return Err(format!("Unknown category: {}", category)),
    };

    loader
        .export_category(cat, Path::new(&path))
        .map(|_| format!("Category '{}' exported to: {}", category, path))
        .map_err(|e| format!("Failed to export category: {}", e))
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn import_config_category(category: String, path: String) -> Result<String, String> {
    let loader = ConfigLoader::new();

    let cat = match category.as_str() {
        "brushes" => ConfigCategory::Brushes,
        "tools" => ConfigCategory::Tools,
        "export_formats" => ConfigCategory::ExportFormats,
        "viewport_presets" => ConfigCategory::ViewportPresets,
        "greeble_patterns" => ConfigCategory::GreeblePatterns,
        _ => return Err(format!("Unknown category: {}", category)),
    };

    loader
        .import_category(cat, Path::new(&path))
        .map(|_| format!("Category '{}' imported from: {}", category, path))
        .map_err(|e| format!("Failed to import category: {}", e))
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn validate_config_file(path: String) -> Result<ValidationResult, String> {
    let loader = ConfigLoader::new();

    match loader.import_preset(Path::new(&path)) {
        Ok(config) => {
            let mut stats = ValidationResult {
                valid: true,
                errors: Vec::new(),
                warnings: Vec::new(),
                brush_count: config.brushes.len(),
                tool_count: config.tools.len(),
                export_format_count: config.export_formats.len(),
                viewport_preset_count: config.viewport_presets.len(),
                greeble_pattern_count: config.greeble_patterns.len(),
            };

            // Check for potential issues
            if config.brushes.is_empty()
                && config.tools.is_empty()
                && config.export_formats.is_empty()
                && config.viewport_presets.is_empty()
                && config.greeble_patterns.is_empty()
            {
                stats
                    .warnings
                    .push("Configuration file is empty".to_string());
            }

            Ok(stats)
        }
        Err(e) => Ok(ValidationResult {
            valid: false,
            errors: vec![e.to_string()],
            warnings: Vec::new(),
            brush_count: 0,
            tool_count: 0,
            export_format_count: 0,
            viewport_preset_count: 0,
            greeble_pattern_count: 0,
        }),
    }
}

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn get_config_paths() -> ConfigPaths {
    let loader = ConfigLoader::new();
    ConfigPaths {
        user_config_dir: loader.user_config_dir().to_string_lossy().to_string(),
        project_config_dir: loader
            .project_config_dir()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

#[derive(serde::Serialize)]
pub struct ConfigPaths {
    pub user_config_dir: String,
    pub project_config_dir: Option<String>,
}
