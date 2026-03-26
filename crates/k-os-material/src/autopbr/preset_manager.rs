// Animation Preset Manager
// Loads, validates, and manages animation presets from JSON files with hot-reloading support

use notify::{Event, EventKind, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use super::animation::AnimationData;

/// Animation preset with metadata for library organization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationPreset {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(flatten)]
    pub animation_data: AnimationData,
}

/// Preset manager handles loading, validation, and hot-reloading of animation presets
pub struct PresetManager {
    presets: Arc<RwLock<HashMap<String, AnimationPreset>>>,
    preset_dir: PathBuf,
    _watcher: Option<Box<dyn Watcher + Send>>,
}

impl PresetManager {
    /// Create a new preset manager with the given preset directory
    ///
    /// Loads all presets from the directory on creation.
    /// Sets up file watcher for hot-reloading if enabled.
    ///
    /// # Arguments
    /// * `preset_dir` - Directory containing preset JSON files
    /// * `enable_hot_reload` - Whether to enable file watching for hot-reloading
    ///
    /// # Requirements
    /// Validates: Requirements 18.1, 18.2, 18.5
    pub fn new(preset_dir: PathBuf, enable_hot_reload: bool) -> anyhow::Result<Self> {
        let presets = Arc::new(RwLock::new(HashMap::new()));

        let mut manager = Self {
            presets: presets.clone(),
            preset_dir: preset_dir.clone(),
            _watcher: None,
        };

        // Load all presets from directory
        manager.load_all_presets()?;

        // Set up file watcher for hot-reloading
        if enable_hot_reload {
            manager.setup_watcher()?;
        }

        Ok(manager)
    }

    /// Load all preset files from the preset directory
    ///
    /// Scans the directory for .json files and loads each one.
    /// Validates each preset against the schema before loading.
    /// Logs errors for invalid presets but continues loading others.
    ///
    /// # Requirements
    /// Validates: Requirements 18.1, 18.2, 18.6
    fn load_all_presets(&mut self) -> anyhow::Result<()> {
        if !self.preset_dir.exists() {
            log::warn!("Preset directory does not exist: {:?}", self.preset_dir);
            return Ok(());
        }

        let entries = std::fs::read_dir(&self.preset_dir)
            .map_err(|e| anyhow::anyhow!("Failed to read preset directory: {}", e))?;

        let mut loaded_count = 0;
        let mut error_count = 0;

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    log::warn!("Failed to read directory entry: {}", e);
                    continue;
                }
            };

            let path = entry.path();

            // Only process .json files
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }

            match self.load_preset_file(&path) {
                Ok(preset) => {
                    let preset_name = preset.name.clone();
                    self.presets
                        .write()
                        .unwrap()
                        .insert(preset_name.clone(), preset);
                    loaded_count += 1;
                    log::debug!("Loaded animation preset: {}", preset_name);
                }
                Err(e) => {
                    error_count += 1;
                    log::error!("Failed to load preset from {:?}: {}", path, e);
                }
            }
        }

        log::info!(
            "Loaded {} animation presets ({} errors)",
            loaded_count,
            error_count
        );
        Ok(())
    }

    /// Load a single preset file with schema validation
    ///
    /// Reads the JSON file, validates against schema, and deserializes.
    /// Returns descriptive errors if validation or parsing fails.
    ///
    /// # Requirements
    /// Validates: Requirements 14.7, 18.6, 18.7
    fn load_preset_file(&self, path: &Path) -> anyhow::Result<AnimationPreset> {
        let json = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("Failed to read preset file: {}", e))?;

        // Validate against schema
        Self::validate_preset_json(&json)?;

        // Parse preset
        let preset: AnimationPreset = serde_json::from_str(&json).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse preset JSON at {}:{}: {}",
                e.line(),
                e.column(),
                e
            )
        })?;

        Ok(preset)
    }

    /// Validate preset JSON against animation schema
    ///
    /// Uses jsonschema crate for validation.
    /// Returns descriptive errors with paths if validation fails.
    ///
    /// # Requirements
    /// Validates: Requirements 14.7, 18.6, 18.7
    fn validate_preset_json(json: &str) -> anyhow::Result<()> {
        // Load schema once and cache it
        static VALIDATOR: Lazy<jsonschema::Validator> = Lazy::new(|| {
            let schema_str =
                include_str!("../../../../config/autopbr/schemas/animation.schema.json");
            let schema_value: serde_json::Value =
                serde_json::from_str(schema_str).expect("Animation schema is invalid JSON");
            jsonschema::validator_for(&schema_value).expect("Animation schema failed to compile")
        });

        // Parse JSON to validate
        let instance: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| anyhow::anyhow!("Invalid JSON at {}:{}: {}", e.line(), e.column(), e))?;

        // Validate against schema - collect errors
        let errors: Vec<_> = VALIDATOR.iter_errors(&instance).collect();

        if !errors.is_empty() {
            let mut error_messages = Vec::new();
            for error in errors {
                let path = error.instance_path.to_string();
                let path_display = if path.is_empty() {
                    "root".to_string()
                } else {
                    path
                };
                error_messages.push(format!("  - At '{}': {}", path_display, error));
            }

            return Err(anyhow::anyhow!(
                "Animation preset schema validation failed:\n{}",
                error_messages.join("\n")
            ));
        }

        Ok(())
    }

    /// Set up file watcher for hot-reloading presets
    ///
    /// Watches the preset directory for changes and reloads presets automatically.
    /// Uses notify crate for cross-platform file watching.
    ///
    /// # Requirements
    /// Validates: Requirements 18.5
    fn setup_watcher(&mut self) -> anyhow::Result<()> {
        use notify::RecommendedWatcher;

        let presets = self.presets.clone();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        // Only reload on modify or create events
                        match event.kind {
                            EventKind::Modify(_) | EventKind::Create(_) => {
                                for path in event.paths {
                                    if path.extension().and_then(|s| s.to_str()) == Some("json") {
                                        log::info!("Preset file changed, reloading: {:?}", path);

                                        // Reload the specific preset
                                        match Self::load_preset_file_static(&path) {
                                            Ok(preset) => {
                                                let preset_name = preset.name.clone();
                                                presets
                                                    .write()
                                                    .unwrap()
                                                    .insert(preset_name.clone(), preset);
                                                log::info!("Hot-reloaded preset: {}", preset_name);
                                            }
                                            Err(e) => {
                                                log::error!(
                                                    "Failed to hot-reload preset from {:?}: {}",
                                                    path,
                                                    e
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(e) => log::error!("File watcher error: {}", e),
                }
            },
            notify::Config::default(),
        )
        .map_err(|e| anyhow::anyhow!("Failed to create file watcher: {}", e))?;

        watcher
            .watch(&self.preset_dir, RecursiveMode::NonRecursive)
            .map_err(|e| anyhow::anyhow!("Failed to watch preset directory: {}", e))?;

        self._watcher = Some(Box::new(watcher));
        log::info!("Hot-reloading enabled for animation presets");

        Ok(())
    }

    /// Static version of load_preset_file for use in watcher callback
    fn load_preset_file_static(path: &Path) -> anyhow::Result<AnimationPreset> {
        let json = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("Failed to read preset file: {}", e))?;

        Self::validate_preset_json(&json)?;

        let preset: AnimationPreset = serde_json::from_str(&json).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse preset JSON at {}:{}: {}",
                e.line(),
                e.column(),
                e
            )
        })?;

        Ok(preset)
    }

    /// Get a preset by name
    ///
    /// Returns None if preset not found.
    pub fn get_preset(&self, name: &str) -> Option<AnimationPreset> {
        self.presets.read().unwrap().get(name).cloned()
    }

    /// List all available preset names
    ///
    /// Returns a sorted list of preset names.
    pub fn list_presets(&self) -> Vec<String> {
        let mut names: Vec<String> = self.presets.read().unwrap().keys().cloned().collect();
        names.sort();
        names
    }

    /// List presets filtered by category
    ///
    /// Returns preset names matching the given category.
    pub fn list_presets_by_category(&self, category: &str) -> Vec<String> {
        let presets = self.presets.read().unwrap();
        let mut names: Vec<String> = presets
            .iter()
            .filter(|(_, preset)| {
                preset
                    .category
                    .as_ref()
                    .map(|c| c == category)
                    .unwrap_or(false)
            })
            .map(|(name, _)| name.clone())
            .collect();
        names.sort();
        names
    }

    /// Search presets by name or tags
    ///
    /// Returns preset names matching the query (case-insensitive).
    pub fn search_presets(&self, query: &str) -> Vec<String> {
        let query_lower = query.to_lowercase();
        let presets = self.presets.read().unwrap();

        let mut names: Vec<String> = presets
            .iter()
            .filter(|(name, preset)| {
                // Match against name
                if name.to_lowercase().contains(&query_lower) {
                    return true;
                }

                // Match against tags
                if let Some(tags) = &preset.tags {
                    if tags
                        .iter()
                        .any(|tag| tag.to_lowercase().contains(&query_lower))
                    {
                        return true;
                    }
                }

                false
            })
            .map(|(name, _)| name.clone())
            .collect();

        names.sort();
        names
    }

    /// Get all presets with their metadata
    ///
    /// Returns a HashMap of all presets.
    pub fn get_all_presets(&self) -> HashMap<String, AnimationPreset> {
        self.presets.read().unwrap().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_preset_json() -> String {
        r#"{
            "name": "Test Preset",
            "description": "A test animation preset",
            "category": "Effects",
            "tags": ["test", "example"],
            "author": "Test Author",
            "version": 1,
            "duration": 2.0,
            "loop_mode": "Loop",
            "tracks": [
                {
                    "parameter": "EmissiveIntensity",
                    "animation_type": {
                        "Keyframe": {
                            "keyframes": [
                                { "time": 0.0, "value": 0.2 },
                                { "time": 1.0, "value": 1.0 },
                                { "time": 2.0, "value": 0.2 }
                            ],
                            "interpolation": "Linear"
                        }
                    }
                }
            ]
        }"#
        .to_string()
    }

    #[test]
    fn test_preset_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = PresetManager::new(temp_dir.path().to_path_buf(), false);
        assert!(manager.is_ok());
    }

    #[test]
    fn test_load_preset_from_file() {
        let temp_dir = TempDir::new().unwrap();
        let preset_path = temp_dir.path().join("test_preset.json");
        fs::write(&preset_path, create_test_preset_json()).unwrap();

        let manager = PresetManager::new(temp_dir.path().to_path_buf(), false).unwrap();

        let preset = manager.get_preset("Test Preset");
        assert!(preset.is_some());

        let preset = preset.unwrap();
        assert_eq!(preset.name, "Test Preset");
        assert_eq!(preset.description, "A test animation preset");
        assert_eq!(preset.category, Some("Effects".to_string()));
        assert_eq!(preset.animation_data.duration, 2.0);
    }

    #[test]
    fn test_list_presets() {
        let temp_dir = TempDir::new().unwrap();
        let preset_path = temp_dir.path().join("test_preset.json");
        fs::write(&preset_path, create_test_preset_json()).unwrap();

        let manager = PresetManager::new(temp_dir.path().to_path_buf(), false).unwrap();

        let presets = manager.list_presets();
        assert_eq!(presets.len(), 1);
        assert_eq!(presets[0], "Test Preset");
    }

    #[test]
    fn test_search_presets() {
        let temp_dir = TempDir::new().unwrap();
        let preset_path = temp_dir.path().join("test_preset.json");
        fs::write(&preset_path, create_test_preset_json()).unwrap();

        let manager = PresetManager::new(temp_dir.path().to_path_buf(), false).unwrap();

        // Search by name
        let results = manager.search_presets("test");
        assert_eq!(results.len(), 1);

        // Search by tag
        let results = manager.search_presets("example");
        assert_eq!(results.len(), 1);

        // No match
        let results = manager.search_presets("nonexistent");
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_filter_by_category() {
        let temp_dir = TempDir::new().unwrap();
        let preset_path = temp_dir.path().join("test_preset.json");
        fs::write(&preset_path, create_test_preset_json()).unwrap();

        let manager = PresetManager::new(temp_dir.path().to_path_buf(), false).unwrap();

        let results = manager.list_presets_by_category("Effects");
        assert_eq!(results.len(), 1);

        let results = manager.list_presets_by_category("Metal");
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_invalid_preset_json() {
        let temp_dir = TempDir::new().unwrap();
        let preset_path = temp_dir.path().join("invalid.json");
        fs::write(&preset_path, "{ invalid json }").unwrap();

        // Should still create manager, but log error for invalid preset
        let manager = PresetManager::new(temp_dir.path().to_path_buf(), false);
        assert!(manager.is_ok());

        // Invalid preset should not be loaded
        let presets = manager.unwrap().list_presets();
        assert_eq!(presets.len(), 0);
    }

    #[test]
    fn test_schema_validation() {
        let invalid_json = r#"{
            "name": "Invalid",
            "description": "Missing required fields"
        }"#;

        let result = PresetManager::validate_preset_json(invalid_json);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("schema validation failed"));
    }
}
