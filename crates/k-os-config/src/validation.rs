//! Configuration Validation
//!
//! JSON Schema validation for configuration files.

use super::types::*;
use super::loader::ConfigError;
use schemars::schema_for;
use std::path::Path;

/// Validate configuration against JSON schema
pub fn validate_config(json_str: &str, config_type: ConfigType) -> Result<(), ConfigError> {
    // Parse JSON
    let value: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| ConfigError::ValidationError {
            error: format!("Invalid JSON: {} at line {}, column {}", e, e.line(), e.column()),
        })?;
    
    // Get schema for config type
    let schema = match config_type {
        ConfigType::Brushes => schema_for!(Vec<BrushConfig>),
        ConfigType::Tools => schema_for!(Vec<ToolConfig>),
        ConfigType::ExportFormats => schema_for!(Vec<ExportFormatConfig>),
        ConfigType::ViewportPresets => schema_for!(Vec<ViewportPresetConfig>),
        ConfigType::GreeblePatterns => schema_for!(Vec<GreeblePatternConfig>),
    };
    
    // Validate against schema
    let validator = jsonschema::validator_for(&serde_json::to_value(&schema).unwrap())
        .map_err(|e| ConfigError::ValidationError {
            error: format!("Invalid schema: {}", e),
        })?;
    
    // Check if valid
    if validator.is_valid(&value) {
        Ok(())
    } else {
        Err(ConfigError::ValidationError {
            error: "Configuration does not match schema".to_string(),
        })
    }
}

/// Validate a configuration file
pub fn validate_config_file(path: &Path, config_type: ConfigType) -> Result<(), ConfigError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| ConfigError::IoError {
            path: path.to_path_buf(),
            error: e.to_string(),
        })?;
    
    validate_config(&content, config_type)
}

/// Configuration type for validation
#[derive(Debug, Clone, Copy)]
pub enum ConfigType {
    Brushes,
    Tools,
    ExportFormats,
    ViewportPresets,
    GreeblePatterns,
}

impl ConfigType {
    pub fn from_filename(filename: &str) -> Option<Self> {
        match filename {
            "brushes.json" => Some(Self::Brushes),
            "tools.json" => Some(Self::Tools),
            "export_formats.json" => Some(Self::ExportFormats),
            "viewport_presets.json" => Some(Self::ViewportPresets),
            "greeble_patterns.json" => Some(Self::GreeblePatterns),
            _ => None,
        }
    }
}

/// Generate JSON schema for a config type
pub fn generate_schema(config_type: ConfigType) -> String {
    let schema = match config_type {
        ConfigType::Brushes => schema_for!(Vec<BrushConfig>),
        ConfigType::Tools => schema_for!(Vec<ToolConfig>),
        ConfigType::ExportFormats => schema_for!(Vec<ExportFormatConfig>),
        ConfigType::ViewportPresets => schema_for!(Vec<ViewportPresetConfig>),
        ConfigType::GreeblePatterns => schema_for!(Vec<GreeblePatternConfig>),
    };
    
    serde_json::to_string_pretty(&schema).unwrap()
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

#[cfg_attr(all(not(target_arch = "wasm32"), feature = "tauri-commands"), tauri::command)]
pub fn validate_config_json(json: String, config_type: String) -> Result<String, String> {
    let config_type = match config_type.as_str() {
        "brushes" => ConfigType::Brushes,
        "tools" => ConfigType::Tools,
        "export_formats" => ConfigType::ExportFormats,
        "viewport_presets" => ConfigType::ViewportPresets,
        "greeble_patterns" => ConfigType::GreeblePatterns,
        _ => return Err(format!("Unknown config type: {}", config_type)),
    };
    
    validate_config(&json, config_type)
        .map(|_| "Configuration is valid".to_string())
        .map_err(|e| format!("{}", e))
}

#[cfg_attr(all(not(target_arch = "wasm32"), feature = "tauri-commands"), tauri::command)]
pub fn get_config_schema(config_type: String) -> Result<String, String> {
    let config_type = match config_type.as_str() {
        "brushes" => ConfigType::Brushes,
        "tools" => ConfigType::Tools,
        "export_formats" => ConfigType::ExportFormats,
        "viewport_presets" => ConfigType::ViewportPresets,
        "greeble_patterns" => ConfigType::GreeblePatterns,
        _ => return Err(format!("Unknown config type: {}", config_type)),
    };
    
    Ok(generate_schema(config_type))
}
