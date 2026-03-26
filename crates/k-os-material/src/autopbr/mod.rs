// Material System Core Module
// Manages material data, processing, and state for KAutoPBR

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use uuid::Uuid;

use crate::gpu::GpuComputeDevice;

pub mod animation;
pub mod asset_manager;
pub mod export;
pub mod layer;
pub mod parser;
pub mod pbr_maps;
pub mod preset_manager;

#[cfg(test)]
mod proptest_serialization;

pub use export::{
    ExportFormat, ExportOptions, ExportResult, ExportStats, ExporterCapabilities, MaterialExporter,
    TextureFormat, TextureResolution,
};
mod proptest_uuid;

pub use animation::{AnimationData, AnimationEngine};
pub use asset_manager::{AssetManager, SearchResult};
pub use layer::{BlendMode, Layer, LayerStack, Mask, PBRMaps};
pub use preset_manager::{AnimationPreset, PresetManager};

/// Core material system managing all material operations
pub struct MaterialSystem {
    materials: HashMap<Uuid, Material>,
    _gpu_compute: Arc<GpuComputeDevice>,
    asset_manager: AssetManager,
    animation_engine: AnimationEngine,
    preset_manager: PresetManager,
}

/// Complete material definition with layers, animation, and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub id: Uuid,
    pub metadata: MaterialMetadata,
    pub layers: Vec<Layer>,
    pub animation: Option<AnimationData>,
    pub variants: Vec<Uuid>,
    pub base_material: Option<Uuid>,
}

/// Material metadata for organization and search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialMetadata {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub author: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub version: u32,
    pub category: MaterialCategory,
}

/// Material category for filtering and organization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MaterialCategory {
    Metal,
    Wood,
    Stone,
    Fabric,
    Plastic,
    Organic,
    SciFi,
    Fantasy,
}

impl Material {
    /// Serialize material to pretty-printed JSON string
    ///
    /// Returns a human-readable JSON string with proper indentation.
    /// Includes all fields: layers, animation, metadata, variants.
    pub fn serialize(&self) -> anyhow::Result<String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| anyhow::anyhow!("Failed to serialize material: {}", e))
    }

    /// Serialize material to compact JSON string
    ///
    /// Returns a compact JSON string without extra whitespace.
    /// Useful for network transmission or storage optimization.
    pub fn serialize_compact(&self) -> anyhow::Result<String> {
        serde_json::to_string(self)
            .map_err(|e| anyhow::anyhow!("Failed to serialize material: {}", e))
    }

    /// Deserialize material from JSON string with schema validation
    ///
    /// Validates the JSON against the material schema before parsing.
    /// Returns descriptive errors with line/column numbers on failure.
    pub fn deserialize(json: &str) -> anyhow::Result<Self> {
        // First, validate against schema
        Self::validate_json(json)?;

        // Then parse
        serde_json::from_str(json).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse material JSON at {}:{}: {}",
                e.line(),
                e.column(),
                e
            )
        })
    }

    /// Validate JSON string against material schema
    ///
    /// Returns descriptive errors if validation fails.
    fn validate_json(json: &str) -> anyhow::Result<()> {
        use once_cell::sync::Lazy;

        // Load schema once and cache it
        static VALIDATOR: Lazy<jsonschema::Validator> = Lazy::new(|| {
            let schema_str =
                include_str!("../../../../config/autopbr/schemas/material.schema.json");
            let schema_value: serde_json::Value =
                serde_json::from_str(schema_str).expect("Material schema is invalid JSON");
            jsonschema::validator_for(&schema_value).expect("Material schema failed to compile")
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
                "Material JSON schema validation failed:\n{}",
                error_messages.join("\n")
            ));
        }

        Ok(())
    }
}

impl MaterialSystem {
    /// Create a new material system with GPU compute support
    pub fn new(gpu_compute: Arc<GpuComputeDevice>) -> Self {
        Self::with_library_path(gpu_compute, None)
    }

    /// Create a new material system with a custom library path
    pub fn with_library_path(
        gpu_compute: Arc<GpuComputeDevice>,
        library_path: Option<PathBuf>,
    ) -> Self {
        let library_root = library_path.unwrap_or_else(|| {
            // Default to user's documents directory + K_OS/Materials
            dirs::document_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("K_OS")
                .join("Materials")
        });

        let asset_manager =
            AssetManager::new(library_root).expect("Failed to create asset manager");
        let animation_engine = AnimationEngine::new(gpu_compute.clone());

        // Load animation presets from config directory
        let preset_dir = PathBuf::from("config/autopbr/animation_presets");
        let preset_manager = PresetManager::new(preset_dir, true).unwrap_or_else(|e| {
            log::warn!("Failed to load animation presets: {}", e);
            // Create empty preset manager if loading fails
            PresetManager::new(PathBuf::from("nonexistent"), false)
                .expect("Failed to create fallback preset manager")
        });

        Self {
            materials: HashMap::new(),
            _gpu_compute: gpu_compute,
            asset_manager,
            animation_engine,
            preset_manager,
        }
    }

    /// Get the asset manager
    pub fn asset_manager(&self) -> &AssetManager {
        &self.asset_manager
    }

    /// Get a reference to a material by ID
    pub fn get_material(&self, id: &Uuid) -> Option<&Material> {
        self.materials.get(id)
    }

    /// Get all materials
    pub fn materials(&self) -> &HashMap<Uuid, Material> {
        &self.materials
    }

    /// Create a new material with given metadata
    pub fn create_material(&mut self, metadata: MaterialMetadata) -> anyhow::Result<Uuid> {
        let id = Uuid::new_v4();
        let material = Material {
            id,
            metadata,
            layers: Vec::new(),
            animation: None,
            variants: Vec::new(),
            base_material: None,
        };

        self.materials.insert(id, material);
        Ok(id)
    }

    /// Load a material from a JSON file
    pub fn load_material(&mut self, path: &Path) -> anyhow::Result<Uuid> {
        let material = parser::load_material(path)?;
        let id = material.id;
        self.materials.insert(id, material);
        Ok(id)
    }

    /// Save a material to a JSON file
    pub fn save_material(&self, id: Uuid, path: &Path) -> anyhow::Result<()> {
        let material = self
            .materials
            .get(&id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", id))?;
        parser::save_material(material, path)
    }

    /// Save a material to the library using the asset manager's recommended path
    pub fn save_material_to_library(&self, id: Uuid) -> anyhow::Result<PathBuf> {
        let material = self
            .materials
            .get(&id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", id))?;
        let path = self.asset_manager.get_material_path(material);
        parser::save_material(material, &path)?;
        Ok(path)
    }

    /// Delete a material from the system
    pub fn delete_material(&mut self, id: Uuid) -> anyhow::Result<()> {
        self.materials
            .remove(&id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", id))?;
        Ok(())
    }

    /// Add a layer to a material
    pub fn add_layer(&mut self, material_id: Uuid, layer: Layer) -> anyhow::Result<()> {
        let material = self
            .materials
            .get_mut(&material_id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", material_id))?;
        material.layers.push(layer);
        Ok(())
    }

    /// Remove a layer from a material
    pub fn remove_layer(&mut self, material_id: Uuid, layer_index: usize) -> anyhow::Result<()> {
        let material = self
            .materials
            .get_mut(&material_id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", material_id))?;

        if layer_index >= material.layers.len() {
            return Err(anyhow::anyhow!(
                "Layer index out of bounds: {}",
                layer_index
            ));
        }

        material.layers.remove(layer_index);
        Ok(())
    }

    /// Reorder layers in a material
    pub fn reorder_layers(
        &mut self,
        material_id: Uuid,
        from: usize,
        to: usize,
    ) -> anyhow::Result<()> {
        let material = self
            .materials
            .get_mut(&material_id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", material_id))?;

        if from >= material.layers.len() || to >= material.layers.len() {
            return Err(anyhow::anyhow!("Layer index out of bounds"));
        }

        let layer = material.layers.remove(from);
        material.layers.insert(to, layer);
        Ok(())
    }

    /// Search materials by query string with fuzzy matching
    /// Returns material IDs sorted by relevance (best matches first)
    pub fn search_materials(&self, query: &str) -> Vec<Uuid> {
        self.asset_manager
            .search(query, &self.materials)
            .into_iter()
            .map(|result| result.material_id)
            .collect()
    }

    /// Search materials with detailed scoring information
    pub fn search_materials_scored(&self, query: &str) -> Vec<asset_manager::SearchResult> {
        self.asset_manager.search(query, &self.materials)
    }

    /// Filter materials by category
    pub fn filter_materials(&self, category: MaterialCategory) -> Vec<Uuid> {
        self.asset_manager
            .filter_by_category(&self.materials, category)
    }

    /// Search materials with both fuzzy matching and category filtering
    pub fn search_with_category(
        &self,
        query: &str,
        category: Option<MaterialCategory>,
    ) -> Vec<Uuid> {
        self.asset_manager
            .search_with_category(query, &self.materials, category)
            .into_iter()
            .map(|result| result.material_id)
            .collect()
    }

    /// Evaluate animation at a given time
    ///
    /// Returns a HashMap mapping AnimationParameter to its value at the given time.
    /// This method delegates to the AnimationEngine's evaluate_keyframe method.
    ///
    /// # Arguments
    /// * `material_id` - UUID of the material
    /// * `time` - Time in seconds to evaluate animation at
    ///
    /// # Returns
    /// HashMap mapping each animated parameter to its value at the given time
    ///
    /// # Requirements
    /// Validates: Requirements 5.5, 5.7
    pub fn evaluate_animation(
        &self,
        material_id: &Uuid,
        time: f32,
    ) -> anyhow::Result<HashMap<animation::AnimationParameter, f32>> {
        let material = self
            .materials
            .get(material_id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", material_id))?;

        let animation_data = material
            .animation
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Material has no animation data"))?;

        let result = self
            .animation_engine
            .evaluate_keyframe(animation_data, time);
        Ok(result)
    }

    /// Apply an animation preset to a material
    ///
    /// Loads the preset by name and applies its animation data to the material.
    /// Replaces any existing animation on the material.
    ///
    /// # Arguments
    /// * `material_id` - UUID of the material to apply preset to
    /// * `preset_name` - Name of the preset to apply
    ///
    /// # Requirements
    /// Validates: Requirements 14.2, 14.4, 14.7
    pub fn apply_preset(&mut self, material_id: Uuid, preset_name: &str) -> anyhow::Result<()> {
        let preset = self
            .preset_manager
            .get_preset(preset_name)
            .ok_or_else(|| anyhow::anyhow!("Preset not found: {}", preset_name))?;

        let material = self
            .materials
            .get_mut(&material_id)
            .ok_or_else(|| anyhow::anyhow!("Material not found: {}", material_id))?;

        material.animation = Some(preset.animation_data);
        Ok(())
    }

    /// List all available animation presets
    ///
    /// Returns a sorted list of preset names.
    ///
    /// # Requirements
    /// Validates: Requirements 14.2, 18.2
    pub fn list_animation_presets(&self) -> Vec<String> {
        self.preset_manager.list_presets()
    }

    /// Get an animation preset by name
    ///
    /// Returns the preset with all metadata and animation data.
    ///
    /// # Requirements
    /// Validates: Requirements 14.2, 14.8
    pub fn get_animation_preset(&self, name: &str) -> Option<AnimationPreset> {
        self.preset_manager.get_preset(name)
    }

    /// Search animation presets by name or tags
    ///
    /// Returns preset names matching the query (case-insensitive).
    ///
    /// # Requirements
    /// Validates: Requirements 14.9
    pub fn search_animation_presets(&self, query: &str) -> Vec<String> {
        self.preset_manager.search_presets(query)
    }

    /// List animation presets filtered by category
    ///
    /// Returns preset names matching the given category.
    ///
    /// # Requirements
    /// Validates: Requirements 14.3, 14.9
    pub fn list_animation_presets_by_category(&self, category: &str) -> Vec<String> {
        self.preset_manager.list_presets_by_category(category)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_category_serialization() {
        let category = MaterialCategory::Metal;
        let json = serde_json::to_string(&category).unwrap();
        let deserialized: MaterialCategory = serde_json::from_str(&json).unwrap();
        assert_eq!(category, deserialized);
    }

    #[test]
    fn test_material_serialize_pretty() {
        let material = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Test Material".to_string(),
                description: "A test material".to_string(),
                tags: vec!["test".to_string(), "metal".to_string()],
                author: "Test Author".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        };

        let json = material.serialize().unwrap();

        // Verify it's pretty-printed (contains newlines and indentation)
        assert!(json.contains('\n'));
        assert!(json.contains("  "));

        // Verify all fields are present
        assert!(json.contains("\"id\""));
        assert!(json.contains("\"metadata\""));
        assert!(json.contains("\"name\""));
        assert!(json.contains("Test Material"));
        assert!(json.contains("\"layers\""));
        assert!(json.contains("\"animation\""));
        assert!(json.contains("\"variants\""));
    }

    #[test]
    fn test_material_serialize_compact() {
        let material = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Test Material".to_string(),
                description: "A test material".to_string(),
                tags: vec!["test".to_string()],
                author: "Test Author".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        };

        let json = material.serialize_compact().unwrap();

        // Verify it's compact (minimal whitespace)
        // Should not have pretty-print indentation
        let pretty_json = material.serialize().unwrap();
        assert!(json.len() < pretty_json.len());

        // Verify all fields are still present
        assert!(json.contains("\"id\""));
        assert!(json.contains("\"metadata\""));
        assert!(json.contains("\"name\""));
    }

    #[test]
    fn test_material_deserialize() {
        let id = Uuid::new_v4();
        let json = format!(
            r#"{{
            "id": "{}",
            "metadata": {{
                "name": "Test Material",
                "description": "A test material",
                "tags": ["test", "metal"],
                "author": "Test Author",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            }},
            "layers": [],
            "animation": null,
            "variants": [],
            "base_material": null
        }}"#,
            id
        );

        let material = Material::deserialize(&json).unwrap();

        assert_eq!(material.id, id);
        assert_eq!(material.metadata.name, "Test Material");
        assert_eq!(material.metadata.description, "A test material");
        assert_eq!(material.metadata.tags, vec!["test", "metal"]);
        assert_eq!(material.metadata.author, "Test Author");
        assert_eq!(material.metadata.version, 1);
        assert_eq!(material.metadata.category, MaterialCategory::Metal);
        assert!(material.layers.is_empty());
        assert!(material.animation.is_none());
        assert!(material.variants.is_empty());
        assert!(material.base_material.is_none());
    }

    #[test]
    fn test_material_roundtrip_pretty() {
        let original = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Roundtrip Test".to_string(),
                description: "Testing serialization roundtrip".to_string(),
                tags: vec!["test".to_string(), "roundtrip".to_string()],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 42,
                category: MaterialCategory::Stone,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        };

        // Serialize then deserialize
        let json = original.serialize().unwrap();
        let deserialized = Material::deserialize(&json).unwrap();

        // Verify equivalence
        assert_eq!(original.id, deserialized.id);
        assert_eq!(original.metadata.name, deserialized.metadata.name);
        assert_eq!(
            original.metadata.description,
            deserialized.metadata.description
        );
        assert_eq!(original.metadata.tags, deserialized.metadata.tags);
        assert_eq!(original.metadata.author, deserialized.metadata.author);
        assert_eq!(original.metadata.version, deserialized.metadata.version);
        assert_eq!(original.metadata.category, deserialized.metadata.category);
    }

    #[test]
    fn test_material_roundtrip_compact() {
        let original = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Compact Test".to_string(),
                description: "Testing compact serialization".to_string(),
                tags: vec!["compact".to_string()],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Fabric,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        };

        // Serialize compact then deserialize
        let json = original.serialize_compact().unwrap();
        let deserialized = Material::deserialize(&json).unwrap();

        // Verify equivalence
        assert_eq!(original.id, deserialized.id);
        assert_eq!(original.metadata.name, deserialized.metadata.name);
        assert_eq!(original.metadata.category, deserialized.metadata.category);
    }

    #[test]
    fn test_material_deserialize_error_reporting() {
        let invalid_json = r#"{
            "id": "not-a-uuid",
            "metadata": {
                "name": "Test"
            }
        }"#;

        let result = Material::deserialize(invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Verify error message contains validation failure information
        assert!(error_msg.contains("validation failed") || error_msg.contains("at"));
    }

    #[test]
    fn test_material_schema_validation_missing_required_field() {
        // Missing required "layers" field
        let invalid_json = r#"{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "metadata": {
                "name": "Test Material",
                "description": "Test",
                "tags": [],
                "author": "Test",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            }
        }"#;

        let result = Material::deserialize(invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Should mention schema validation failure
        assert!(error_msg.contains("validation failed"));
        assert!(error_msg.contains("layers") || error_msg.contains("required"));
    }

    #[test]
    fn test_material_schema_validation_invalid_uuid() {
        let invalid_json = r#"{
            "id": "not-a-valid-uuid",
            "metadata": {
                "name": "Test Material",
                "description": "Test",
                "tags": [],
                "author": "Test",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            },
            "layers": [],
            "animation": null,
            "variants": [],
            "base_material": null
        }"#;

        let result = Material::deserialize(invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Error should indicate the UUID field/path is invalid, whether that comes from schema
        // validation or the deserializer itself.
        assert!(
            error_msg.contains("validation failed")
                || error_msg.contains("UUID")
                || error_msg.contains("uuid")
        );
        assert!(
            error_msg.contains("id") || error_msg.contains("uuid") || error_msg.contains("format")
        );
    }

    #[test]
    fn test_material_schema_validation_invalid_category() {
        let invalid_json = r#"{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "metadata": {
                "name": "Test Material",
                "description": "Test",
                "tags": [],
                "author": "Test",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "InvalidCategory"
            },
            "layers": [],
            "animation": null,
            "variants": [],
            "base_material": null
        }"#;

        let result = Material::deserialize(invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Should mention enum/category validation issue
        assert!(error_msg.contains("validation failed"));
        assert!(error_msg.contains("category") || error_msg.contains("enum"));
    }

    #[test]
    fn test_material_schema_validation_opacity_out_of_range() {
        let invalid_json = r#"{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "metadata": {
                "name": "Test Material",
                "description": "Test",
                "tags": [],
                "author": "Test",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            },
            "layers": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "name": "Layer 1",
                    "maps": {},
                    "opacity": 1.5,
                    "blend_mode": "Normal",
                    "mask": null,
                    "visible": true,
                    "locked": false
                }
            ],
            "animation": null,
            "variants": [],
            "base_material": null
        }"#;

        let result = Material::deserialize(invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Should mention opacity range validation issue
        assert!(error_msg.contains("validation failed"));
        assert!(error_msg.contains("opacity") || error_msg.contains("maximum"));
    }

    #[test]
    fn test_material_schema_validation_too_many_layers() {
        // Create JSON with 65 layers (exceeds max of 64)
        let mut layers_json = String::new();
        for i in 0..65 {
            if i > 0 {
                layers_json.push_str(",\n");
            }
            layers_json.push_str(&format!(
                r#"{{
                "id": "550e8400-e29b-41d4-a716-44665544{:04}",
                "name": "Layer {}",
                "maps": {{}},
                "opacity": 1.0,
                "blend_mode": "Normal",
                "mask": null,
                "visible": true,
                "locked": false
            }}"#,
                i, i
            ));
        }

        let invalid_json = format!(
            r#"{{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "metadata": {{
                "name": "Test Material",
                "description": "Test",
                "tags": [],
                "author": "Test",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            }},
            "layers": [
                {}
            ],
            "animation": null,
            "variants": [],
            "base_material": null
        }}"#,
            layers_json
        );

        let result = Material::deserialize(&invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Should mention max items validation issue
        assert!(error_msg.contains("validation failed"));
        assert!(
            error_msg.contains("layers")
                || error_msg.contains("maxItems")
                || error_msg.contains("maximum")
        );
    }

    #[test]
    fn test_material_schema_validation_invalid_blend_mode() {
        let invalid_json = r#"{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "metadata": {
                "name": "Test Material",
                "description": "Test",
                "tags": [],
                "author": "Test",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            },
            "layers": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "name": "Layer 1",
                    "maps": {},
                    "opacity": 1.0,
                    "blend_mode": "InvalidBlendMode",
                    "mask": null,
                    "visible": true,
                    "locked": false
                }
            ],
            "animation": null,
            "variants": [],
            "base_material": null
        }"#;

        let result = Material::deserialize(invalid_json);
        assert!(result.is_err());

        let error = result.unwrap_err();
        let error_msg = error.to_string();

        // Should mention blend_mode enum validation issue
        assert!(error_msg.contains("validation failed"));
        assert!(error_msg.contains("blend_mode") || error_msg.contains("enum"));
    }

    #[test]
    fn test_material_schema_validation_valid_material() {
        // This should pass validation
        let valid_json = r#"{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "metadata": {
                "name": "Test Material",
                "description": "A valid test material",
                "tags": ["test", "metal"],
                "author": "Test Author",
                "created_at": "2024-01-01T00:00:00Z",
                "modified_at": "2024-01-01T00:00:00Z",
                "version": 1,
                "category": "Metal"
            },
            "layers": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "name": "Base Layer",
                    "maps": {
                        "albedo": {
                            "path": "/textures/albedo.png",
                            "width": 2048,
                            "height": 2048
                        }
                    },
                    "opacity": 0.8,
                    "blend_mode": "Multiply",
                    "mask": null,
                    "visible": true,
                    "locked": false
                }
            ],
            "animation": null,
            "variants": [],
            "base_material": null
        }"#;

        let result = Material::deserialize(valid_json);
        assert!(
            result.is_ok(),
            "Valid material should pass validation: {:?}",
            result.err()
        );

        let material = result.unwrap();
        assert_eq!(material.metadata.name, "Test Material");
        assert_eq!(material.layers.len(), 1);
        assert_eq!(material.layers[0].opacity, 0.8);
    }

    #[test]
    fn test_material_with_layers_serialization() {
        use crate::material::layer::{BlendMode, Layer};

        let mut material = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Layered Material".to_string(),
                description: "Material with layers".to_string(),
                tags: vec![],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Wood,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        };

        // Add a layer
        let mut layer = Layer::new("Base Layer".to_string());
        layer.opacity = 0.8;
        layer.blend_mode = BlendMode::Multiply;
        material.layers.push(layer);

        // Serialize and deserialize
        let json = material.serialize().unwrap();
        let deserialized = Material::deserialize(&json).unwrap();

        // Verify layer was preserved
        assert_eq!(deserialized.layers.len(), 1);
        assert_eq!(deserialized.layers[0].name, "Base Layer");
        assert_eq!(deserialized.layers[0].opacity, 0.8);
        assert_eq!(deserialized.layers[0].blend_mode, BlendMode::Multiply);
    }

    #[test]
    fn test_material_with_animation_serialization() {
        use crate::material::animation::{AnimationData, LoopMode};

        let material = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Animated Material".to_string(),
                description: "Material with animation".to_string(),
                tags: vec![],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::SciFi,
            },
            layers: vec![],
            animation: Some(AnimationData {
                duration: 5.0,
                loop_mode: LoopMode::Loop,
                tracks: vec![],
            }),
            variants: vec![],
            base_material: None,
        };

        // Serialize and deserialize
        let json = material.serialize().unwrap();
        let deserialized = Material::deserialize(&json).unwrap();

        // Verify animation was preserved
        assert!(deserialized.animation.is_some());
        let anim = deserialized.animation.unwrap();
        assert_eq!(anim.duration, 5.0);
        assert_eq!(anim.loop_mode, LoopMode::Loop);
    }

    #[test]
    fn test_material_with_variants_serialization() {
        let variant_id1 = Uuid::new_v4();
        let variant_id2 = Uuid::new_v4();
        let base_id = Uuid::new_v4();

        let material = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Material with Variants".to_string(),
                description: "Material with variant references".to_string(),
                tags: vec![],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Plastic,
            },
            layers: vec![],
            animation: None,
            variants: vec![variant_id1, variant_id2],
            base_material: Some(base_id),
        };

        // Serialize and deserialize
        let json = material.serialize().unwrap();
        let deserialized = Material::deserialize(&json).unwrap();

        // Verify variants and base material were preserved
        assert_eq!(deserialized.variants.len(), 2);
        assert_eq!(deserialized.variants[0], variant_id1);
        assert_eq!(deserialized.variants[1], variant_id2);
        assert_eq!(deserialized.base_material, Some(base_id));
    }

    // ========== MaterialSystem CRUD Tests ==========

    #[test]
    fn test_material_system_create_material() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let metadata = MaterialMetadata {
            name: "Test Material".to_string(),
            description: "A test material".to_string(),
            tags: vec!["test".to_string()],
            author: "Tester".to_string(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            version: 1,
            category: MaterialCategory::Metal,
        };

        let id = system.create_material(metadata.clone()).unwrap();

        // Verify UUID is valid
        assert_ne!(id, Uuid::nil());

        // Verify material exists in system
        assert!(system.materials.contains_key(&id));

        // Verify material has correct metadata
        let material = system.materials.get(&id).unwrap();
        assert_eq!(material.id, id);
        assert_eq!(material.metadata.name, "Test Material");
        assert_eq!(material.metadata.category, MaterialCategory::Metal);
        assert!(material.layers.is_empty());
        assert!(material.animation.is_none());
    }

    #[test]
    fn test_material_system_uuid_uniqueness() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let mut ids = std::collections::HashSet::new();

        // Create 100 materials and verify all UUIDs are unique
        for i in 0..100 {
            let metadata = MaterialMetadata {
                name: format!("Material {}", i),
                description: "Test".to_string(),
                tags: vec![],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            };

            let id = system.create_material(metadata).unwrap();

            // Verify UUID is not nil
            assert_ne!(id, Uuid::nil());

            // Verify UUID is unique
            assert!(!ids.contains(&id), "Duplicate UUID generated: {}", id);
            ids.insert(id);
        }

        // Verify we have exactly 100 unique UUIDs
        assert_eq!(ids.len(), 100);
        assert_eq!(system.materials.len(), 100);
    }

    #[test]
    fn test_material_system_delete_material() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let metadata = MaterialMetadata {
            name: "To Delete".to_string(),
            description: "Will be deleted".to_string(),
            tags: vec![],
            author: "Tester".to_string(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            version: 1,
            category: MaterialCategory::Wood,
        };

        let id = system.create_material(metadata).unwrap();
        assert!(system.materials.contains_key(&id));

        // Delete the material
        system.delete_material(id).unwrap();

        // Verify material is gone
        assert!(!system.materials.contains_key(&id));
    }

    #[test]
    fn test_material_system_delete_nonexistent_material() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let fake_id = Uuid::new_v4();
        let result = system.delete_material(fake_id);

        // Should return error for nonexistent material
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    #[test]
    fn test_material_system_save_and_load_material() {
        use tempfile::TempDir;

        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute.clone());

        let metadata = MaterialMetadata {
            name: "Save Test".to_string(),
            description: "Testing save/load".to_string(),
            tags: vec!["save".to_string(), "load".to_string()],
            author: "Tester".to_string(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            version: 1,
            category: MaterialCategory::Stone,
        };

        let id = system.create_material(metadata.clone()).unwrap();

        // Save to temporary file
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_material.json");
        system.save_material(id, &file_path).unwrap();

        // Verify file exists
        assert!(file_path.exists());

        // Create new system and load material
        let mut system2 = MaterialSystem::new(gpu_compute);
        let loaded_id = system2.load_material(&file_path).unwrap();

        // Verify loaded material has same ID and metadata
        assert_eq!(loaded_id, id);
        let loaded_material = system2.materials.get(&loaded_id).unwrap();
        assert_eq!(loaded_material.metadata.name, "Save Test");
        assert_eq!(loaded_material.metadata.category, MaterialCategory::Stone);
        assert_eq!(loaded_material.metadata.tags, vec!["save", "load"]);
    }

    #[test]
    fn test_material_system_add_layer() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let metadata = MaterialMetadata {
            name: "Layer Test".to_string(),
            description: "Testing layers".to_string(),
            tags: vec![],
            author: "Tester".to_string(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            version: 1,
            category: MaterialCategory::Metal,
        };

        let id = system.create_material(metadata).unwrap();

        // Add a layer
        let layer = Layer {
            id: Uuid::new_v4(),
            name: "Base Layer".to_string(),
            maps: PBRMaps::default(),
            opacity: 1.0,
            blend_mode: BlendMode::Normal,
            mask: None,
            visible: true,
            locked: false,
        };

        system.add_layer(id, layer.clone()).unwrap();

        // Verify layer was added
        let material = system.materials.get(&id).unwrap();
        assert_eq!(material.layers.len(), 1);
        assert_eq!(material.layers[0].name, "Base Layer");
        assert_eq!(material.layers[0].opacity, 1.0);
    }

    #[test]
    fn test_material_system_remove_layer() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let metadata = MaterialMetadata {
            name: "Layer Remove Test".to_string(),
            description: "Testing layer removal".to_string(),
            tags: vec![],
            author: "Tester".to_string(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            version: 1,
            category: MaterialCategory::Metal,
        };

        let id = system.create_material(metadata).unwrap();

        // Add two layers
        let layer1 = Layer {
            id: Uuid::new_v4(),
            name: "Layer 1".to_string(),
            maps: PBRMaps::default(),
            opacity: 1.0,
            blend_mode: BlendMode::Normal,
            mask: None,
            visible: true,
            locked: false,
        };

        let layer2 = Layer {
            id: Uuid::new_v4(),
            name: "Layer 2".to_string(),
            maps: PBRMaps::default(),
            opacity: 0.5,
            blend_mode: BlendMode::Multiply,
            mask: None,
            visible: true,
            locked: false,
        };

        system.add_layer(id, layer1).unwrap();
        system.add_layer(id, layer2).unwrap();

        // Verify we have 2 layers
        assert_eq!(system.materials.get(&id).unwrap().layers.len(), 2);

        // Remove first layer
        system.remove_layer(id, 0).unwrap();

        // Verify we have 1 layer and it's the second one
        let material = system.materials.get(&id).unwrap();
        assert_eq!(material.layers.len(), 1);
        assert_eq!(material.layers[0].name, "Layer 2");
    }

    #[test]
    fn test_material_system_reorder_layers() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        let metadata = MaterialMetadata {
            name: "Layer Reorder Test".to_string(),
            description: "Testing layer reordering".to_string(),
            tags: vec![],
            author: "Tester".to_string(),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            version: 1,
            category: MaterialCategory::Metal,
        };

        let id = system.create_material(metadata).unwrap();

        // Add three layers
        for i in 0..3 {
            let layer = Layer {
                id: Uuid::new_v4(),
                name: format!("Layer {}", i),
                maps: PBRMaps::default(),
                opacity: 1.0,
                blend_mode: BlendMode::Normal,
                mask: None,
                visible: true,
                locked: false,
            };
            system.add_layer(id, layer).unwrap();
        }

        // Verify initial order
        let material = system.materials.get(&id).unwrap();
        assert_eq!(material.layers[0].name, "Layer 0");
        assert_eq!(material.layers[1].name, "Layer 1");
        assert_eq!(material.layers[2].name, "Layer 2");

        // Reorder: move layer 0 to position 2
        system.reorder_layers(id, 0, 2).unwrap();

        // Verify new order
        let material = system.materials.get(&id).unwrap();
        assert_eq!(material.layers[0].name, "Layer 1");
        assert_eq!(material.layers[1].name, "Layer 2");
        assert_eq!(material.layers[2].name, "Layer 0");
    }

    #[test]
    fn test_material_system_filter_by_category() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let mut system = MaterialSystem::new(gpu_compute);

        // Create materials with different categories
        let categories = vec![
            MaterialCategory::Metal,
            MaterialCategory::Wood,
            MaterialCategory::Metal,
            MaterialCategory::Stone,
            MaterialCategory::Metal,
        ];

        for (i, category) in categories.iter().enumerate() {
            let metadata = MaterialMetadata {
                name: format!("Material {}", i),
                description: "Test".to_string(),
                tags: vec![],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: *category,
            };
            system.create_material(metadata).unwrap();
        }

        // Filter by Metal category
        let metal_materials = system.filter_materials(MaterialCategory::Metal);
        assert_eq!(metal_materials.len(), 3);

        // Filter by Wood category
        let wood_materials = system.filter_materials(MaterialCategory::Wood);
        assert_eq!(wood_materials.len(), 1);

        // Filter by Stone category
        let stone_materials = system.filter_materials(MaterialCategory::Stone);
        assert_eq!(stone_materials.len(), 1);

        // Filter by Fabric category (none exist)
        let fabric_materials = system.filter_materials(MaterialCategory::Fabric);
        assert_eq!(fabric_materials.len(), 0);
    }
}
