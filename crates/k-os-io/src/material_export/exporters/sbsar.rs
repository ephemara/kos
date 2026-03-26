// SBSAR (Substance Archive) Exporter
// Packages all PBR maps and material parameters into a Substance Archive format

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Cursor, Write};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use crate::autopbr::{
    export::{
        ExportFormat, ExportOptions, ExportResult, ExportStats, ExporterCapabilities,
        MaterialExporter, TextureFormat,
    },
    Material,
};

/// SBSAR Exporter - Packages materials into Substance Archive format
///
/// The SBSAR format is a ZIP archive containing:
/// - manifest.json: Material metadata and parameter definitions
/// - textures/: Directory with all PBR map textures
/// - parameters.json: Material parameter values
/// - layers.json: Layer stack configuration (if applicable)
/// - animation.json: Animation data (if applicable)
pub struct SBSARExporter {
    /// Compression level (0-9, where 9 is maximum compression)
    compression_level: u32,
}

impl SBSARExporter {
    /// Create a new SBSAR exporter with default compression
    pub fn new() -> Self {
        Self {
            compression_level: 6, // Balanced compression
        }
    }

    /// Create a new SBSAR exporter with custom compression level
    pub fn with_compression(compression_level: u32) -> Self {
        Self {
            compression_level: compression_level.min(9),
        }
    }

    /// Package material into SBSAR archive
    fn package_archive(&self, material: &Material, options: &ExportOptions) -> Result<Vec<u8>> {
        let mut buffer = Cursor::new(Vec::new());
        let mut zip = ZipWriter::new(&mut buffer);

        // Configure compression
        let file_options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .compression_level(Some(self.compression_level as i64));

        // 1. Write manifest.json
        let manifest = self.create_manifest(material, options)?;
        zip.start_file("manifest.json", file_options)?;
        zip.write_all(serde_json::to_string_pretty(&manifest)?.as_bytes())?;

        // 2. Write parameters.json
        let parameters = self.extract_parameters(material)?;
        zip.start_file("parameters.json", file_options)?;
        zip.write_all(serde_json::to_string_pretty(&parameters)?.as_bytes())?;

        // 3. Write layers.json (if material has layers)
        if !material.layers.is_empty() {
            let layers_data = self.serialize_layers(material)?;
            zip.start_file("layers.json", file_options)?;
            zip.write_all(serde_json::to_string_pretty(&layers_data)?.as_bytes())?;
        }

        // 4. Write animation.json (if material has animation)
        if let Some(ref animation) = material.animation {
            zip.start_file("animation.json", file_options)?;
            zip.write_all(serde_json::to_string_pretty(animation)?.as_bytes())?;
        }

        // 5. Write texture maps
        self.write_texture_maps(&mut zip, material, options, file_options)?;

        // 6. Write metadata
        let metadata_json = serde_json::to_string_pretty(&material.metadata)?;
        zip.start_file("metadata.json", file_options)?;
        zip.write_all(metadata_json.as_bytes())?;

        // Finalize archive
        zip.finish()?;

        Ok(buffer.into_inner())
    }

    /// Create SBSAR manifest with material metadata
    fn create_manifest(
        &self,
        material: &Material,
        _options: &ExportOptions,
    ) -> Result<SBSARManifest> {
        Ok(SBSARManifest {
            format_version: "1.0.0".to_string(),
            material_id: material.id.to_string(),
            material_name: material.metadata.name.clone(),
            description: material.metadata.description.clone(),
            author: material.metadata.author.clone(),
            category: format!("{:?}", material.metadata.category),
            tags: material.metadata.tags.clone(),
            version: material.metadata.version,
            created_at: material.metadata.created_at.to_rfc3339(),
            modified_at: material.metadata.modified_at.to_rfc3339(),
            layer_count: material.layers.len(),
            has_animation: material.animation.is_some(),
            texture_maps: self.list_texture_maps(material),
        })
    }

    /// Extract material parameters for SBSAR
    fn extract_parameters(&self, material: &Material) -> Result<SBSARParameters> {
        // Extract parameters from the first layer (base material)
        // In a full implementation, this would extract all adjustable parameters
        let base_layer = material
            .layers
            .first()
            .context("Material must have at least one layer")?;

        Ok(SBSARParameters {
            opacity: base_layer.opacity,
            blend_mode: format!("{:?}", base_layer.blend_mode),
            visible: base_layer.visible,
            locked: base_layer.locked,
            // Add more parameters as needed
            custom_params: std::collections::HashMap::new(),
        })
    }

    /// Serialize layer stack configuration
    fn serialize_layers(&self, material: &Material) -> Result<Vec<SBSARLayer>> {
        material
            .layers
            .iter()
            .map(|layer| {
                Ok(SBSARLayer {
                    id: layer.id.to_string(),
                    name: layer.name.clone(),
                    opacity: layer.opacity,
                    blend_mode: format!("{:?}", layer.blend_mode),
                    visible: layer.visible,
                    locked: layer.locked,
                    has_mask: layer.mask.is_some(),
                    map_references: self.get_layer_map_references(layer),
                })
            })
            .collect()
    }

    /// Get texture map references for a layer
    fn get_layer_map_references(&self, layer: &crate::autopbr::Layer) -> Vec<String> {
        let mut refs = Vec::new();

        if layer.maps.albedo.is_some() {
            refs.push("textures/albedo.png".to_string());
        }
        if layer.maps.normal.is_some() {
            refs.push("textures/normal.png".to_string());
        }
        if layer.maps.roughness.is_some() {
            refs.push("textures/roughness.png".to_string());
        }
        if layer.maps.metallic.is_some() {
            refs.push("textures/metallic.png".to_string());
        }
        if layer.maps.ao.is_some() {
            refs.push("textures/ao.png".to_string());
        }
        if layer.maps.height.is_some() {
            refs.push("textures/height.png".to_string());
        }
        if layer.maps.emissive.is_some() {
            refs.push("textures/emissive.png".to_string());
        }

        refs
    }

    /// List all texture maps in the material
    fn list_texture_maps(&self, material: &Material) -> Vec<String> {
        let mut maps = Vec::new();

        for layer in &material.layers {
            if layer.maps.albedo.is_some() && !maps.contains(&"albedo".to_string()) {
                maps.push("albedo".to_string());
            }
            if layer.maps.normal.is_some() && !maps.contains(&"normal".to_string()) {
                maps.push("normal".to_string());
            }
            if layer.maps.roughness.is_some() && !maps.contains(&"roughness".to_string()) {
                maps.push("roughness".to_string());
            }
            if layer.maps.metallic.is_some() && !maps.contains(&"metallic".to_string()) {
                maps.push("metallic".to_string());
            }
            if layer.maps.ao.is_some() && !maps.contains(&"ao".to_string()) {
                maps.push("ao".to_string());
            }
            if layer.maps.height.is_some() && !maps.contains(&"height".to_string()) {
                maps.push("height".to_string());
            }
            if layer.maps.emissive.is_some() && !maps.contains(&"emissive".to_string()) {
                maps.push("emissive".to_string());
            }
        }

        maps
    }

    /// Write texture maps to the archive
    fn write_texture_maps(
        &self,
        zip: &mut ZipWriter<&mut Cursor<Vec<u8>>>,
        material: &Material,
        options: &ExportOptions,
        file_options: SimpleFileOptions,
    ) -> Result<()> {
        // Create textures directory
        zip.add_directory("textures/", file_options)?;

        // For each layer, write its texture maps
        // In a real implementation, this would:
        // 1. Load texture data from GPU or disk
        // 2. Resize to target resolution if needed
        // 3. Convert to target format
        // 4. Write to archive

        // Placeholder: Write dummy texture data for demonstration
        for (idx, layer) in material.layers.iter().enumerate() {
            let layer_prefix = if material.layers.len() > 1 {
                format!("layer{}_", idx)
            } else {
                String::new()
            };

            // Write each map type if present
            if layer.maps.albedo.is_some() {
                let filename = format!(
                    "textures/{}albedo.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }

            if layer.maps.normal.is_some() {
                let filename = format!(
                    "textures/{}normal.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }

            if layer.maps.roughness.is_some() {
                let filename = format!(
                    "textures/{}roughness.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }

            if layer.maps.metallic.is_some() {
                let filename = format!(
                    "textures/{}metallic.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }

            if layer.maps.ao.is_some() {
                let filename = format!(
                    "textures/{}ao.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }

            if layer.maps.height.is_some() {
                let filename = format!(
                    "textures/{}height.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }

            if layer.maps.emissive.is_some() {
                let filename = format!(
                    "textures/{}emissive.{}",
                    layer_prefix,
                    options.texture_format.extension()
                );
                zip.start_file(&filename, file_options)?;
                zip.write_all(b"<placeholder texture data>")?;
            }
        }

        Ok(())
    }
}

impl Default for SBSARExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl MaterialExporter for SBSARExporter {
    fn format(&self) -> ExportFormat {
        ExportFormat::SBSAR
    }

    fn export(&self, material: &Material, options: &ExportOptions) -> Result<ExportResult> {
        let start_time = std::time::Instant::now();

        // Package material into SBSAR archive
        let data = self
            .package_archive(material, options)
            .context("Failed to package SBSAR archive")?;

        let export_time = start_time.elapsed();

        // Calculate statistics
        let texture_count = self.list_texture_maps(material).len();
        let file_size = data.len();

        Ok(ExportResult {
            data,
            additional_files: HashMap::new(),
            warnings: Vec::new(),
            stats: ExportStats {
                total_size_bytes: file_size,
                texture_count,
                layer_count: material.layers.len(),
                animation_included: false,
                animation_baked: false,
                export_duration_ms: export_time.as_millis() as u64,
            },
        })
    }

    fn validate(&self, material: &Material, _options: &ExportOptions) -> Result<()> {
        // Validate material has at least one layer
        if material.layers.is_empty() {
            anyhow::bail!("Material must have at least one layer for SBSAR export");
        }

        // Validate material has required metadata
        if material.metadata.name.is_empty() {
            anyhow::bail!("Material must have a name for SBSAR export");
        }

        Ok(())
    }

    fn capabilities(&self) -> ExporterCapabilities {
        ExporterCapabilities {
            supports_animation: false, // SBSAR doesn't natively support animation
            supports_layers: true,
            supports_embedded_textures: true,
            supports_hdr: true,
            max_texture_resolution: Some(16384),
            supported_texture_formats: vec![
                TextureFormat::PNG,
                TextureFormat::JPEG,
                TextureFormat::TGA,
                TextureFormat::EXR,
            ],
        }
    }
}

// ============================================================================
// SBSAR Data Structures
// ============================================================================

/// SBSAR manifest containing material metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SBSARManifest {
    format_version: String,
    material_id: String,
    material_name: String,
    description: String,
    author: String,
    category: String,
    tags: Vec<String>,
    version: u32,
    created_at: String,
    modified_at: String,
    layer_count: usize,
    has_animation: bool,
    texture_maps: Vec<String>,
}

/// SBSAR material parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SBSARParameters {
    opacity: f32,
    blend_mode: String,
    visible: bool,
    locked: bool,
    custom_params: std::collections::HashMap<String, serde_json::Value>,
}

/// SBSAR layer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SBSARLayer {
    id: String,
    name: String,
    opacity: f32,
    blend_mode: String,
    visible: bool,
    locked: bool,
    has_mask: bool,
    map_references: Vec<String>,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::autopbr::layer::TextureHandle;
    use crate::material::{BlendMode, Layer, MaterialCategory, MaterialMetadata, PBRMaps};
    use chrono::Utc;
    use uuid::Uuid;

    fn texture(path: &str) -> TextureHandle {
        TextureHandle {
            path: path.to_string(),
            width: 1024,
            height: 1024,
        }
    }

    fn create_test_material() -> Material {
        Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Test Material".to_string(),
                description: "Test material for SBSAR export".to_string(),
                tags: vec!["test".to_string(), "metal".to_string()],
                author: "Test Author".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            },
            layers: vec![Layer {
                id: Uuid::new_v4(),
                name: "Base Layer".to_string(),
                maps: PBRMaps {
                    albedo: Some(texture("albedo.png")),
                    normal: Some(texture("normal.png")),
                    roughness: Some(texture("roughness.png")),
                    metallic: Some(texture("metallic.png")),
                    ao: Some(texture("ao.png")),
                    height: Some(texture("height.png")),
                    emissive: None,
                },
                opacity: 1.0,
                blend_mode: BlendMode::Normal,
                mask: None,
                visible: true,
                locked: false,
            }],
            animation: None,
            variants: Vec::new(),
            base_material: None,
        }
    }

    #[test]
    fn test_sbsar_exporter_format() {
        let exporter = SBSARExporter::new();
        assert_eq!(exporter.format(), ExportFormat::SBSAR);
    }

    #[test]
    fn test_sbsar_exporter_capabilities() {
        let exporter = SBSARExporter::new();
        let caps = exporter.capabilities();

        assert!(!caps.supports_animation);
        assert!(caps.supports_layers);
        assert!(caps.supports_embedded_textures);
        assert_eq!(caps.max_texture_resolution, Some(16384));
    }

    #[test]
    fn test_sbsar_export_basic() {
        let exporter = SBSARExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.data.is_empty());
        assert!(export_result.stats.total_size_bytes > 0);
        assert_eq!(export_result.stats.texture_count, 6); // albedo, normal, roughness, metallic, ao, height
    }

    #[test]
    fn test_sbsar_validate_empty_layers() {
        let exporter = SBSARExporter::new();
        let mut material = create_test_material();
        material.layers.clear();

        let options = ExportOptions::default();
        let result = exporter.validate(&material, &options);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("at least one layer"));
    }

    #[test]
    fn test_sbsar_validate_empty_name() {
        let exporter = SBSARExporter::new();
        let mut material = create_test_material();
        material.metadata.name = String::new();

        let options = ExportOptions::default();
        let result = exporter.validate(&material, &options);

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("must have a name"));
    }

    #[test]
    fn test_sbsar_compression_levels() {
        let exporter_low = SBSARExporter::with_compression(1);
        let exporter_high = SBSARExporter::with_compression(9);

        assert_eq!(exporter_low.compression_level, 1);
        assert_eq!(exporter_high.compression_level, 9);

        // Test clamping
        let exporter_clamped = SBSARExporter::with_compression(15);
        assert_eq!(exporter_clamped.compression_level, 9);
    }

    #[test]
    fn test_sbsar_manifest_creation() {
        let exporter = SBSARExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let manifest = exporter.create_manifest(&material, &options);
        assert!(manifest.is_ok());

        let manifest = manifest.unwrap();
        assert_eq!(manifest.material_name, "Test Material");
        assert_eq!(manifest.layer_count, 1);
        assert!(!manifest.has_animation);
        assert_eq!(manifest.texture_maps.len(), 6);
    }

    #[test]
    fn test_sbsar_archive_structure() {
        let exporter = SBSARExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let data = result.unwrap().data;

        // Verify it's a valid ZIP archive by trying to read it
        let cursor = Cursor::new(data);
        let archive = zip::ZipArchive::new(cursor);
        assert!(archive.is_ok());

        let mut archive = archive.unwrap();

        // Check for required files
        assert!(archive.by_name("manifest.json").is_ok());
        assert!(archive.by_name("parameters.json").is_ok());
        assert!(archive.by_name("layers.json").is_ok());
        assert!(archive.by_name("metadata.json").is_ok());
    }

    #[test]
    fn test_sbsar_multi_layer_export() {
        let exporter = SBSARExporter::new();
        let mut material = create_test_material();

        // Add a second layer
        material.layers.push(Layer {
            id: Uuid::new_v4(),
            name: "Detail Layer".to_string(),
            maps: PBRMaps {
                albedo: Some(texture("detail_albedo.png")),
                normal: None,
                roughness: Some(texture("detail_roughness.png")),
                metallic: None,
                ao: None,
                height: None,
                emissive: None,
            },
            opacity: 0.5,
            blend_mode: BlendMode::Multiply,
            mask: None,
            visible: true,
            locked: false,
        });

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);

        assert!(result.is_ok());
        let export_result = result.unwrap();

        // Should have textures from both layers
        assert!(export_result.stats.total_size_bytes > 0);
    }
}
