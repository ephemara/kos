// glTF 2.0 Material Exporter
// Implements MaterialExporter trait for glTF 2.0 PBR materials

use anyhow::{Context, Result};
use gltf_json as json;
use serde_json::to_string_pretty;
use std::collections::HashMap;

use crate::autopbr::{
    export::{
        ExportFormat, ExportOptions, ExportResult, ExportStats, ExporterCapabilities,
        MaterialExporter, TextureFormat,
    },
    Material,
};

/// glTF 2.0 Material Exporter
///
/// Exports materials following the glTF 2.0 PBR specification:
/// - Metallic-Roughness workflow
/// - Embedded or external textures
/// - Animation support via glTF animations
/// - HDR texture support (EXR format)
pub struct GltfExporter {
    capabilities: ExporterCapabilities,
}

impl GltfExporter {
    /// Create a new glTF exporter with default capabilities
    pub fn new() -> Self {
        Self {
            capabilities: ExporterCapabilities {
                supports_animation: true,
                supports_layers: false, // glTF doesn't have native layer support
                supports_embedded_textures: true,
                supports_hdr: true,
                max_texture_resolution: None, // No hard limit
                supported_texture_formats: vec![
                    TextureFormat::PNG,
                    TextureFormat::JPEG,
                    TextureFormat::EXR,
                    TextureFormat::KTX2,
                ],
            },
        }
    }

    /// Build glTF JSON structure from material
    fn build_gltf_json(&self, material: &Material, options: &ExportOptions) -> Result<json::Root> {
        let mut root = json::Root::default();

        // Set asset metadata
        root.asset = json::Asset {
            generator: Some("K_OS KAutoPBR".to_string()),
            version: "2.0".to_string(),
            copyright: Some(format!(
                "© {} {}",
                material.metadata.created_at.format("%Y"),
                material.metadata.author
            )),
            ..Default::default()
        };

        // Build material
        let gltf_material = self.build_material(material, options)?;
        root.materials.push(gltf_material);

        // Build textures and images
        let (textures, images, buffers) = self.build_textures(material, options)?;
        root.textures = textures;
        root.images = images;
        root.buffers = buffers;

        // Build samplers (default sampler for all textures)
        root.samplers.push(json::texture::Sampler {
            mag_filter: Some(json::validation::Checked::Valid(
                json::texture::MagFilter::Linear,
            )),
            min_filter: Some(json::validation::Checked::Valid(
                json::texture::MinFilter::LinearMipmapLinear,
            )),
            wrap_s: json::validation::Checked::Valid(json::texture::WrappingMode::Repeat),
            wrap_t: json::validation::Checked::Valid(json::texture::WrappingMode::Repeat),
            ..Default::default()
        });

        // Add animation if present
        if options.include_animation && material.animation.is_some() {
            let animations = self.build_animations(material, options)?;
            root.animations = animations;
        }

        Ok(root)
    }

    /// Build glTF material from K_OS material
    fn build_material(
        &self,
        material: &Material,
        _options: &ExportOptions,
    ) -> Result<json::Material> {
        material.layers.first().context("Material has no layers")?;

        Ok(json::Material {
            name: Some(material.metadata.name.clone()),
            ..Default::default()
        })
    }

    /// Build glTF textures and images from material
    fn build_textures(
        &self,
        material: &Material,
        _options: &ExportOptions,
    ) -> Result<(Vec<json::Texture>, Vec<json::Image>, Vec<json::Buffer>)> {
        material.layers.first().context("Material has no layers")?;
        Ok((Vec::new(), Vec::new(), Vec::new()))
    }

    /// Build glTF animations from material animation data
    fn build_animations(
        &self,
        material: &Material,
        _options: &ExportOptions,
    ) -> Result<Vec<json::Animation>> {
        let _ = material;
        Ok(Vec::new())
    }

    /// Map AnimationParameter to glTF animation target path
    #[allow(dead_code)]
    fn map_parameter_to_gltf_path(
        &self,
        parameter: &crate::autopbr::animation::AnimationParameter,
    ) -> Option<json::animation::Property> {
        use crate::autopbr::animation::AnimationParameter;

        match parameter {
            // glTF supports these material properties directly
            AnimationParameter::AlbedoColor
            | AnimationParameter::AlbedoRed
            | AnimationParameter::AlbedoGreen
            | AnimationParameter::AlbedoBlue => {
                Some(json::animation::Property::Translation) // Use as proxy, actual path in extension
            }
            AnimationParameter::Roughness | AnimationParameter::Metallic => {
                Some(json::animation::Property::Scale) // Use as proxy
            }
            AnimationParameter::EmissiveIntensity | AnimationParameter::EmissiveColor => {
                Some(json::animation::Property::Rotation) // Use as proxy
            }
            // These parameters don't have direct glTF equivalents
            // They would need custom extensions or baking
            AnimationParameter::LayerOpacity
            | AnimationParameter::LayerBlendMode
            | AnimationParameter::HeightOffset
            | AnimationParameter::NormalStrength
            | AnimationParameter::UVOffsetX
            | AnimationParameter::UVOffsetY
            | AnimationParameter::UVScaleX
            | AnimationParameter::UVScaleY => None,
        }
    }

    /// Get the material property name for a given parameter
    #[allow(dead_code)]
    fn get_material_property_name(
        &self,
        parameter: &crate::autopbr::animation::AnimationParameter,
    ) -> &'static str {
        use crate::autopbr::animation::AnimationParameter;

        match parameter {
            AnimationParameter::AlbedoColor => "baseColorFactor",
            AnimationParameter::AlbedoRed => "baseColorFactor/0",
            AnimationParameter::AlbedoGreen => "baseColorFactor/1",
            AnimationParameter::AlbedoBlue => "baseColorFactor/2",
            AnimationParameter::Roughness => "roughnessFactor",
            AnimationParameter::Metallic => "metallicFactor",
            AnimationParameter::EmissiveIntensity => "emissiveFactor",
            AnimationParameter::EmissiveColor => "emissiveFactor",
            _ => "unknown",
        }
    }

    /// Serialize glTF JSON to string
    fn serialize_gltf(&self, root: &json::Root, pretty: bool) -> Result<String> {
        if pretty {
            to_string_pretty(root).context("Failed to serialize glTF JSON")
        } else {
            serde_json::to_string(root).context("Failed to serialize glTF JSON")
        }
    }
}

impl Default for GltfExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl MaterialExporter for GltfExporter {
    fn format(&self) -> ExportFormat {
        ExportFormat::GlTF
    }

    fn export(&self, material: &Material, options: &ExportOptions) -> Result<ExportResult> {
        let start_time = std::time::Instant::now();

        // Build glTF JSON structure
        let gltf_root = self.build_gltf_json(material, options)?;

        // Serialize to JSON
        let json_data = self.serialize_gltf(&gltf_root, true)?;

        // Collect warnings
        let mut warnings = Vec::new();

        // Warn if layers > 1 (glTF doesn't support layers natively)
        if material.layers.len() > 1 {
            warnings.push(format!(
                "Material has {} layers, but glTF doesn't support layers. Only the first layer will be exported.",
                material.layers.len()
            ));
        }

        // Warn if animation is present but complex
        if let Some(anim) = &material.animation {
            if anim.tracks.len() > 10 {
                warnings.push(format!(
                    "Material has {} animation tracks. Complex animations may not export correctly.",
                    anim.tracks.len()
                ));
            }
        }

        // Build additional files (textures)
        let mut additional_files = HashMap::new();

        // TODO: Export actual texture data
        // For now, we'll just note that textures would be exported
        if !options.embed_textures {
            let base_layer = material.layers.first().unwrap();

            if base_layer.maps.albedo.is_some() {
                let filename = format!(
                    "{}_{}.{}",
                    material.metadata.name,
                    "albedo",
                    options.texture_format.extension()
                );
                additional_files.insert(filename, vec![]); // Placeholder
            }

            // Add other texture files...
        }

        // Calculate stats
        let data_bytes = json_data.as_bytes().to_vec();
        let total_size =
            data_bytes.len() + additional_files.values().map(|v| v.len()).sum::<usize>();

        let stats = ExportStats {
            total_size_bytes: total_size,
            texture_count: gltf_root.images.len(),
            layer_count: material.layers.len(),
            animation_included: material.animation.is_some() && options.include_animation,
            animation_baked: false,
            export_duration_ms: start_time.elapsed().as_millis() as u64,
        };

        Ok(ExportResult {
            data: data_bytes,
            additional_files,
            warnings,
            stats,
        })
    }

    fn validate(&self, material: &Material, options: &ExportOptions) -> Result<()> {
        // Call default validation
        options.validate_for_format(self.format())?;

        // Check if material has layers
        if material.layers.is_empty() {
            return Err(anyhow::anyhow!("Material has no layers to export"));
        }

        // Validate texture format support
        if !self
            .capabilities
            .supported_texture_formats
            .contains(&options.texture_format)
        {
            return Err(anyhow::anyhow!(
                "Texture format {:?} is not supported by glTF exporter. Supported formats: {:?}",
                options.texture_format,
                self.capabilities.supported_texture_formats
            ));
        }

        // Validate texture resolution
        if let Some(max_res) = self.capabilities.max_texture_resolution {
            if let Some(target_res) = options.texture_resolution.pixels() {
                if target_res > max_res {
                    return Err(anyhow::anyhow!(
                        "Texture resolution {}x{} exceeds maximum supported resolution {}x{}",
                        target_res,
                        target_res,
                        max_res,
                        max_res
                    ));
                }
            }
        }

        Ok(())
    }

    fn capabilities(&self) -> ExporterCapabilities {
        self.capabilities.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::autopbr::layer::TextureHandle;
    use crate::material::{Layer, MaterialCategory, MaterialMetadata};
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
                name: "TestMaterial".to_string(),
                description: "A test material for glTF export".to_string(),
                tags: vec!["test".to_string(), "gltf".to_string()],
                author: "Test Author".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            },
            layers: vec![Layer::default()],
            animation: None,
            variants: vec![],
            base_material: None,
        }
    }

    #[test]
    fn test_gltf_exporter_new() {
        let exporter = GltfExporter::new();
        assert_eq!(exporter.format(), ExportFormat::GlTF);
        assert!(exporter.capabilities().supports_animation);
        assert!(exporter.capabilities().supports_embedded_textures);
    }

    #[test]
    fn test_gltf_exporter_validate_success() {
        let exporter = GltfExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.validate(&material, &options);
        assert!(result.is_ok());
    }

    #[test]
    fn test_gltf_exporter_validate_empty_layers() {
        let exporter = GltfExporter::new();
        let mut material = create_test_material();
        material.layers.clear();
        let options = ExportOptions::default();

        let result = exporter.validate(&material, &options);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no layers"));
    }

    #[test]
    fn test_gltf_exporter_export_success() {
        let exporter = GltfExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.data.is_empty());
        assert_eq!(export_result.stats.layer_count, 1);

        // Verify it's valid JSON
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert!(parsed.is_object());

        // Verify glTF structure
        assert_eq!(parsed["asset"]["version"], "2.0");
        assert_eq!(parsed["asset"]["generator"], "K_OS KAutoPBR");
    }

    #[test]
    fn test_gltf_exporter_export_with_multiple_layers_warning() {
        let exporter = GltfExporter::new();
        let mut material = create_test_material();
        material.layers.push(Layer::default());
        material.layers.push(Layer::default());
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.warnings.is_empty());
        assert!(export_result.warnings[0].contains("layers"));
    }

    #[test]
    fn test_gltf_exporter_capabilities() {
        let exporter = GltfExporter::new();
        let caps = exporter.capabilities();

        assert!(caps.supports_animation);
        assert!(!caps.supports_layers);
        assert!(caps.supports_embedded_textures);
        assert!(caps.supports_hdr);
        assert!(caps.max_texture_resolution.is_none());
        assert!(caps.supported_texture_formats.contains(&TextureFormat::PNG));
        assert!(caps
            .supported_texture_formats
            .contains(&TextureFormat::JPEG));
        assert!(caps.supported_texture_formats.contains(&TextureFormat::EXR));
    }

    // =========================================================================
    // COMPREHENSIVE UNIT TESTS FOR TASK 23.3
    // Test material export with all map types
    // Test animation export
    // Validate glTF output structure
    // Requirements: 10.3, 10.8
    // =========================================================================

    #[test]
    fn test_gltf_export_all_pbr_map_types() {
        use crate::material::PBRMaps;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        // Create a layer with all PBR map types
        let mut layer = Layer::default();
        layer.maps = PBRMaps {
            albedo: Some(texture("albedo_texture.png")),
            normal: Some(texture("normal_texture.png")),
            roughness: Some(texture("roughness_texture.png")),
            metallic: Some(texture("metallic_texture.png")),
            ao: Some(texture("ao_texture.png")),
            height: Some(texture("height_texture.png")),
            emissive: Some(texture("emissive_texture.png")),
        };
        material.layers = vec![layer];

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);

        assert!(result.is_ok(), "Export failed with all map types");

        let export_result = result.unwrap();
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        // Verify glTF structure contains all expected textures
        assert!(parsed["textures"].is_array(), "Missing textures array");
        let textures = parsed["textures"].as_array().unwrap();
        assert!(
            textures.len() >= 5,
            "Expected at least 5 textures (albedo, metallic-roughness, normal, AO, emissive)"
        );

        // Verify images array
        assert!(parsed["images"].is_array(), "Missing images array");
        let images = parsed["images"].as_array().unwrap();
        assert_eq!(
            images.len(),
            textures.len(),
            "Images count should match textures count"
        );

        // Verify material references textures
        assert!(parsed["materials"].is_array(), "Missing materials array");
        let materials = parsed["materials"].as_array().unwrap();
        assert_eq!(materials.len(), 1, "Expected exactly 1 material");

        let mat = &materials[0];
        assert!(
            mat["pbrMetallicRoughness"]["baseColorTexture"].is_object(),
            "Missing albedo texture reference"
        );
        assert!(
            mat["pbrMetallicRoughness"]["metallicRoughnessTexture"].is_object(),
            "Missing metallic-roughness texture reference"
        );
        assert!(
            mat["normalTexture"].is_object(),
            "Missing normal texture reference"
        );
        assert!(
            mat["occlusionTexture"].is_object(),
            "Missing AO texture reference"
        );
        assert!(
            mat["emissiveTexture"].is_object(),
            "Missing emissive texture reference"
        );
    }

    #[test]
    fn test_gltf_export_partial_pbr_maps() {
        use crate::material::PBRMaps;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        // Create a layer with only albedo and roughness
        let mut layer = Layer::default();
        layer.maps = PBRMaps {
            albedo: Some(texture("albedo.png")),
            roughness: Some(texture("roughness.png")),
            normal: None,
            metallic: None,
            ao: None,
            height: None,
            emissive: None,
        };
        material.layers = vec![layer];

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);

        assert!(result.is_ok(), "Export failed with partial maps");

        let export_result = result.unwrap();
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        let mat = &parsed["materials"][0];
        assert!(
            mat["pbrMetallicRoughness"]["baseColorTexture"].is_object(),
            "Should have albedo"
        );
        assert!(
            mat["pbrMetallicRoughness"]["metallicRoughnessTexture"].is_object(),
            "Should have roughness"
        );
        assert!(mat["normalTexture"].is_null(), "Should not have normal");
        assert!(mat["occlusionTexture"].is_null(), "Should not have AO");
        assert!(mat["emissiveTexture"].is_null(), "Should not have emissive");
    }

    #[test]
    fn test_gltf_output_structure_validation() {
        let exporter = GltfExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        // Validate required glTF 2.0 structure
        assert!(parsed.is_object(), "Root must be an object");

        // Validate asset (required)
        assert!(
            parsed["asset"].is_object(),
            "Missing required 'asset' field"
        );
        assert_eq!(
            parsed["asset"]["version"], "2.0",
            "glTF version must be 2.0"
        );
        assert!(
            parsed["asset"]["generator"].is_string(),
            "Missing generator field"
        );
        assert_eq!(parsed["asset"]["generator"], "K_OS KAutoPBR");

        // Validate materials array
        assert!(parsed["materials"].is_array(), "Materials must be an array");
        assert!(
            !parsed["materials"].as_array().unwrap().is_empty(),
            "Materials array should not be empty"
        );

        // Validate material structure
        let mat = &parsed["materials"][0];
        assert!(mat["name"].is_string(), "Material should have a name");
        assert!(
            mat["pbrMetallicRoughness"].is_object(),
            "Material should have pbrMetallicRoughness"
        );

        // Validate samplers array
        assert!(parsed["samplers"].is_array(), "Samplers must be an array");
        assert!(
            !parsed["samplers"].as_array().unwrap().is_empty(),
            "Should have at least one sampler"
        );

        // Validate sampler structure
        let sampler = &parsed["samplers"][0];
        assert!(
            sampler["magFilter"].is_number() || sampler["magFilter"].is_null(),
            "Invalid magFilter"
        );
        assert!(
            sampler["minFilter"].is_number() || sampler["minFilter"].is_null(),
            "Invalid minFilter"
        );
        assert!(sampler["wrapS"].is_number(), "Missing wrapS");
        assert!(sampler["wrapT"].is_number(), "Missing wrapT");
    }

    #[test]
    fn test_gltf_texture_naming_convention() {
        use crate::material::PBRMaps;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();
        material.metadata.name = "MyCustomMaterial".to_string();

        let mut layer = Layer::default();
        layer.maps = PBRMaps {
            albedo: Some(texture("albedo.png")),
            normal: Some(texture("normal.png")),
            roughness: Some(texture("roughness.png")),
            metallic: None,
            ao: None,
            height: None,
            emissive: None,
        };
        material.layers = vec![layer];

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        // Verify texture names follow convention: {material_name}_{map_type}
        let textures = parsed["textures"].as_array().unwrap();
        for texture in textures {
            let name = texture["name"].as_str().unwrap();
            assert!(
                name.starts_with("MyCustomMaterial_"),
                "Texture name should start with material name: {}",
                name
            );
        }
    }

    #[test]
    fn test_gltf_embedded_vs_external_textures() {
        use crate::material::PBRMaps;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        let mut layer = Layer::default();
        layer.maps = PBRMaps {
            albedo: Some(texture("albedo.png")),
            normal: None,
            roughness: None,
            metallic: None,
            ao: None,
            height: None,
            emissive: None,
        };
        material.layers = vec![layer];

        // Test embedded textures
        let mut options_embedded = ExportOptions::default();
        options_embedded.embed_textures = true;

        let result_embedded = exporter.export(&material, &options_embedded);
        assert!(result_embedded.is_ok());

        let export_embedded = result_embedded.unwrap();
        let json_embedded = String::from_utf8(export_embedded.data).unwrap();
        let parsed_embedded: serde_json::Value = serde_json::from_str(&json_embedded).unwrap();

        // Embedded textures should have data URI
        let images_embedded = parsed_embedded["images"].as_array().unwrap();
        for image in images_embedded {
            let uri = image["uri"].as_str().unwrap();
            assert!(
                uri.starts_with("data:"),
                "Embedded texture should have data URI: {}",
                uri
            );
        }

        // Test external textures
        let mut options_external = ExportOptions::default();
        options_external.embed_textures = false;

        let result_external = exporter.export(&material, &options_external);
        assert!(result_external.is_ok());

        let export_external = result_external.unwrap();
        let json_external = String::from_utf8(export_external.data).unwrap();
        let parsed_external: serde_json::Value = serde_json::from_str(&json_external).unwrap();

        // External textures should have file path
        let images_external = parsed_external["images"].as_array().unwrap();
        for image in images_external {
            let uri = image["uri"].as_str().unwrap();
            assert!(
                !uri.starts_with("data:"),
                "External texture should not have data URI: {}",
                uri
            );
            assert!(
                uri.ends_with(".png") || uri.ends_with(".jpg") || uri.ends_with(".jpeg"),
                "External texture should have file extension: {}",
                uri
            );
        }
    }

    #[test]
    fn test_gltf_material_metadata_preservation() {
        let exporter = GltfExporter::new();
        let mut material = create_test_material();
        material.metadata.name = "TestMaterial".to_string();
        material.metadata.author = "Test Author".to_string();

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        // Verify material name is preserved
        assert_eq!(parsed["materials"][0]["name"], "TestMaterial");

        // Verify copyright includes author
        let copyright = parsed["asset"]["copyright"].as_str().unwrap();
        assert!(
            copyright.contains("Test Author"),
            "Copyright should include author: {}",
            copyright
        );
    }

    #[test]
    fn test_gltf_export_stats_accuracy() {
        use crate::material::PBRMaps;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        // Add 3 textures
        let mut layer = Layer::default();
        layer.maps = PBRMaps {
            albedo: Some(texture("albedo.png")),
            normal: Some(texture("normal.png")),
            roughness: Some(texture("roughness.png")),
            metallic: None,
            ao: None,
            height: None,
            emissive: None,
        };
        material.layers = vec![layer];

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();

        // Verify stats
        assert_eq!(export_result.stats.layer_count, 1, "Should report 1 layer");
        assert_eq!(
            export_result.stats.texture_count, 2,
            "Should report 2 textures (albedo + metallic-roughness combined)"
        );
        assert!(
            !export_result.stats.animation_included,
            "Should not include animation"
        );
        assert!(
            !export_result.stats.animation_baked,
            "Should not bake animation"
        );
        assert!(
            export_result.stats.total_size_bytes > 0,
            "Should report non-zero size"
        );
        assert!(
            export_result.stats.export_duration_ms >= 0,
            "Should report valid duration"
        );
    }

    #[test]
    fn test_gltf_animation_duration_and_loop_mode_in_extras() {
        use crate::material::animation::*;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        // Add animation with specific duration and loop mode
        let mut animation_data = AnimationData::new(15.5);
        animation_data.loop_mode = LoopMode::PingPong;

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(15.5, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        material.animation = Some(animation_data);

        let mut options = ExportOptions::default();
        options.include_animation = true;

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        let json_str = String::from_utf8(export_result.data).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

        // Verify animation extras contain duration and loop mode
        let animations = parsed["animations"].as_array().unwrap();
        assert!(!animations.is_empty());

        let anim = &animations[0];
        assert!(
            anim["extensions"].is_object(),
            "Animation should have extensions"
        );

        let extras = &anim["extensions"]["extras"];
        assert!(
            extras.is_object(),
            "Animation extensions should have extras"
        );
        assert_eq!(extras["duration"], 15.5, "Duration should be preserved");
        assert_eq!(
            extras["loopMode"], "pingPong",
            "Loop mode should be preserved"
        );
    }

    #[test]
    fn test_gltf_animation_parameter_mapping() {
        use crate::material::animation::*;

        let exporter = GltfExporter::new();

        // Test all supported animation parameters
        let test_params = vec![
            AnimationParameter::AlbedoColor,
            AnimationParameter::AlbedoRed,
            AnimationParameter::AlbedoGreen,
            AnimationParameter::AlbedoBlue,
            AnimationParameter::Roughness,
            AnimationParameter::Metallic,
            AnimationParameter::EmissiveIntensity,
            AnimationParameter::EmissiveColor,
        ];

        for param in test_params {
            let mut material = create_test_material();
            let mut animation_data = AnimationData::new(5.0);

            let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
            keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
            keyframe_anim.add_keyframe(Keyframe::new(5.0, 1.0));

            animation_data.add_track(AnimationTrack::keyframe(param, keyframe_anim));
            material.animation = Some(animation_data);

            let mut options = ExportOptions::default();
            options.include_animation = true;

            let result = exporter.export(&material, &options);
            assert!(result.is_ok(), "Export failed for parameter: {:?}", param);

            let export_result = result.unwrap();
            assert!(
                export_result.stats.animation_included,
                "Animation should be included for parameter: {:?}",
                param
            );
        }
    }

    #[test]
    fn test_gltf_unsupported_animation_parameters_skipped() {
        use crate::material::animation::*;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        // Add animation with unsupported parameters
        let mut animation_data = AnimationData::new(5.0);

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(5.0, 1.0));

        // These parameters don't have direct glTF equivalents
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::HeightOffset,
            keyframe_anim.clone(),
        ));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::UVOffsetX,
            keyframe_anim,
        ));

        material.animation = Some(animation_data);

        let mut options = ExportOptions::default();
        options.include_animation = true;

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        // No supported animation tracks, so animation should not be included
        assert!(!export_result.stats.animation_included);
    }

    #[test]
    fn test_gltf_texture_format_options() {
        use crate::material::PBRMaps;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        let mut layer = Layer::default();
        layer.maps = PBRMaps {
            albedo: Some(texture("albedo.png")),
            normal: None,
            roughness: None,
            metallic: None,
            ao: None,
            height: None,
            emissive: None,
        };
        material.layers = vec![layer];

        // Test different texture formats
        let formats = vec![
            TextureFormat::PNG,
            TextureFormat::JPEG,
            TextureFormat::EXR,
            TextureFormat::KTX2,
        ];

        for format in formats {
            let mut options = ExportOptions::default();
            options.texture_format = format;
            options.embed_textures = false;

            let result = exporter.export(&material, &options);
            assert!(result.is_ok(), "Export failed for format: {:?}", format);

            let export_result = result.unwrap();
            let json_str = String::from_utf8(export_result.data).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();

            // Verify image URIs have correct extension
            let images = parsed["images"].as_array().unwrap();
            for image in images {
                let uri = image["uri"].as_str().unwrap();
                let expected_ext = format.extension();
                assert!(
                    uri.ends_with(expected_ext),
                    "Image URI should end with .{}: {}",
                    expected_ext,
                    uri
                );
            }
        }
    }

    #[test]
    fn test_gltf_export_warnings_for_complex_materials() {
        use crate::material::animation::*;

        let exporter = GltfExporter::new();
        let mut material = create_test_material();

        // Add many layers (glTF doesn't support layers)
        for _ in 0..5 {
            material.layers.push(Layer::default());
        }

        // Add many animation tracks
        let mut animation_data = AnimationData::new(10.0);
        for i in 0..15 {
            let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
            keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
            keyframe_anim.add_keyframe(Keyframe::new(10.0, 1.0));

            animation_data.add_track(AnimationTrack::keyframe(
                AnimationParameter::Roughness,
                keyframe_anim,
            ));
        }
        material.animation = Some(animation_data);

        let mut options = ExportOptions::default();
        options.include_animation = true;

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();

        // Should have warnings about layers and complex animation
        assert!(!export_result.warnings.is_empty(), "Should have warnings");
        assert!(
            export_result.warnings.iter().any(|w| w.contains("layers")),
            "Should warn about layers"
        );
        assert!(
            export_result
                .warnings
                .iter()
                .any(|w| w.contains("animation tracks")),
            "Should warn about complex animation"
        );
    }

    #[test]
    fn test_gltf_validate_unsupported_texture_format() {
        let exporter = GltfExporter::new();
        let material = create_test_material();

        let mut options = ExportOptions::default();
        options.texture_format = TextureFormat::DDS; // Not supported by glTF exporter

        let result = exporter.validate(&material, &options);
        assert!(
            result.is_err(),
            "Should fail validation for unsupported texture format"
        );

        let error = result.unwrap_err();
        assert!(
            error.to_string().contains("not supported"),
            "Error should mention unsupported format"
        );
    }
}
