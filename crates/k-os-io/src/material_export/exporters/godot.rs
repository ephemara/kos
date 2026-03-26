// Godot Engine Material Exporter
// Generates .tres material resource files compatible with Godot's StandardMaterial3D

use anyhow::Result;
use std::collections::HashMap;

use crate::autopbr::export::{
    ExportFormat, ExportOptions, ExportResult, ExportStats, ExporterCapabilities, MaterialExporter,
    TextureFormat,
};
use crate::autopbr::Material;

/// Godot Engine material exporter
///
/// Generates .tres material resource files compatible with Godot 4.x StandardMaterial3D.
/// Godot uses a text-based resource format for materials.
///
/// # Texture Mapping
/// - Albedo → albedo_texture
/// - Normal → normal_texture
/// - Roughness → roughness_texture
/// - Metallic → metallic_texture
/// - AO → ao_texture
/// - Height → heightmap_texture
/// - Emissive → emission_texture
///
/// # Requirements
/// Validates: Requirements 10.1, 10.7
pub struct GodotExporter;

impl GodotExporter {
    /// Create a new Godot exporter
    pub fn new() -> Self {
        Self
    }

    /// Generate Godot .tres resource format
    ///
    /// Godot uses a custom text format for resources that looks like INI/TOML
    /// but with specific Godot-specific syntax.
    fn generate_tres_content(
        &self,
        material: &Material,
        _texture_count: usize,
        has_normal: bool,
        has_roughness: bool,
        has_metallic: bool,
        has_ao: bool,
        has_height: bool,
        has_emissive: bool,
    ) -> String {
        let mut content = String::new();

        // Header
        content.push_str("[gd_resource type=\"StandardMaterial3D\" format=3]\n\n");

        // Resource section
        content.push_str("[resource]\n");
        content.push_str(&format!("resource_name = \"{}\"\n", material.metadata.name));

        // Transparency settings
        content.push_str("transparency = 0\n"); // TRANSPARENCY_DISABLED
        content.push_str("cull_mode = 0\n"); // CULL_BACK
        content.push_str("shading_mode = 1\n"); // SHADING_MODE_PER_PIXEL

        // Albedo
        if material
            .layers
            .first()
            .and_then(|l| l.maps.albedo.as_ref())
            .is_some()
        {
            content.push_str(&format!(
                "albedo_texture = ExtResource(\"res://materials/textures/{}_albedo.png\")\n",
                material.metadata.name
            ));
        }
        content.push_str("albedo_color = Color(1, 1, 1, 1)\n");

        // Metallic
        if has_metallic {
            content.push_str(&format!(
                "metallic_texture = ExtResource(\"res://materials/textures/{}_metallic.png\")\n",
                material.metadata.name
            ));
            content.push_str("metallic = 1.0\n");
        } else {
            content.push_str("metallic = 0.0\n");
        }
        content.push_str("metallic_specular = 0.5\n");

        // Roughness
        if has_roughness {
            content.push_str(&format!(
                "roughness_texture = ExtResource(\"res://materials/textures/{}_roughness.png\")\n",
                material.metadata.name
            ));
            content.push_str("roughness = 1.0\n");
        } else {
            content.push_str("roughness = 0.5\n");
        }

        // Normal map
        if has_normal {
            content.push_str(&format!(
                "normal_texture = ExtResource(\"res://materials/textures/{}_normal.png\")\n",
                material.metadata.name
            ));
            content.push_str("normal_scale = 1.0\n");
            content.push_str("normal_enabled = true\n");
        }

        // Ambient Occlusion
        if has_ao {
            content.push_str(&format!(
                "ao_texture = ExtResource(\"res://materials/textures/{}_ao.png\")\n",
                material.metadata.name
            ));
            content.push_str("ao_enabled = true\n");
            content.push_str("ao_light_affect = 0.0\n");
        }

        // Height/Parallax
        if has_height {
            content.push_str(&format!(
                "heightmap_texture = ExtResource(\"res://materials/textures/{}_height.png\")\n",
                material.metadata.name
            ));
            content.push_str("heightmap_enabled = true\n");
            content.push_str("heightmap_scale = 0.05\n");
            content.push_str("heightmap_deep_parallax = false\n");
        }

        // Emissive
        if has_emissive {
            content.push_str(&format!(
                "emission_texture = ExtResource(\"res://materials/textures/{}_emissive.png\")\n",
                material.metadata.name
            ));
            content.push_str("emission_enabled = true\n");
            content.push_str("emission = Color(1, 1, 1, 1)\n");
            content.push_str("emission_energy_multiplier = 1.0\n");
        }

        // Additional properties
        content.push_str("uv1_scale = Vector3(1, 1, 1)\n");
        content.push_str("uv1_offset = Vector3(0, 0, 0)\n");
        content.push_str("uv1_triplanar = false\n");

        content
    }
}

impl Default for GodotExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl MaterialExporter for GodotExporter {
    fn format(&self) -> ExportFormat {
        ExportFormat::Godot
    }

    fn export(&self, material: &Material, _options: &ExportOptions) -> Result<ExportResult> {
        let start_time = std::time::Instant::now();

        let mut texture_count = 0;
        let additional_files = HashMap::new();
        let mut warnings = Vec::new();

        // Get the first layer's maps (Godot StandardMaterial3D doesn't support layer stacks)
        if material.layers.is_empty() {
            return Err(anyhow::anyhow!("Material has no layers to export"));
        }

        if material.layers.len() > 1 {
            warnings.push(format!(
                "Material has {} layers, but Godot export only uses the first layer. Consider flattening layers before export.",
                material.layers.len()
            ));
        }

        let base_layer = &material.layers[0];
        let maps = &base_layer.maps;

        // Check which textures are present
        let has_albedo = maps.albedo.is_some();
        let has_normal = maps.normal.is_some();
        let has_roughness = maps.roughness.is_some();
        let has_metallic = maps.metallic.is_some();
        let has_ao = maps.ao.is_some();
        let has_height = maps.height.is_some();
        let has_emissive = maps.emissive.is_some();

        // Count textures
        if has_albedo {
            texture_count += 1;
        }
        if has_normal {
            texture_count += 1;
        }
        if has_roughness {
            texture_count += 1;
        }
        if has_metallic {
            texture_count += 1;
        }
        if has_ao {
            texture_count += 1;
        }
        if has_height {
            texture_count += 1;
        }
        if has_emissive {
            texture_count += 1;
        }

        // Generate .tres content
        let tres_content = self.generate_tres_content(
            material,
            texture_count,
            has_normal,
            has_roughness,
            has_metallic,
            has_ao,
            has_height,
            has_emissive,
        );

        // Check for animation data
        if material.animation.is_some() {
            warnings.push(
                "Material has animation data, but Godot export does not support animation. \
                Consider baking animation to texture sequences or using Godot's AnimationPlayer."
                    .to_string(),
            );
        }

        let duration = start_time.elapsed();

        let total_size_bytes = tres_content.len();
        Ok(ExportResult {
            data: tres_content.into_bytes(),
            additional_files,
            warnings,
            stats: ExportStats {
                total_size_bytes,
                texture_count,
                layer_count: 1, // Godot only uses first layer
                animation_included: false,
                animation_baked: false,
                export_duration_ms: duration.as_millis() as u64,
            },
        })
    }

    fn validate(&self, material: &Material, options: &ExportOptions) -> Result<()> {
        // Call default validation
        options.validate_for_format(self.format())?;

        // Check if material has layers
        if material.layers.is_empty() {
            return Err(anyhow::anyhow!("Material has no layers to export"));
        }

        // Check if first layer has at least one texture
        let base_layer = &material.layers[0];
        let maps = &base_layer.maps;

        if maps.albedo.is_none()
            && maps.normal.is_none()
            && maps.roughness.is_none()
            && maps.metallic.is_none()
            && maps.ao.is_none()
            && maps.height.is_none()
            && maps.emissive.is_none()
        {
            return Err(anyhow::anyhow!(
                "Material's first layer has no textures to export"
            ));
        }

        // Godot supports HDR textures with EXR
        if options.texture_format.supports_hdr() {
            log::info!(
                "Exporting HDR textures to Godot. Godot 4.x supports EXR textures for HDR rendering."
            );
        }

        Ok(())
    }

    fn capabilities(&self) -> ExporterCapabilities {
        ExporterCapabilities {
            supports_animation: false,
            supports_layers: false, // Only uses first layer
            supports_embedded_textures: false,
            supports_hdr: true,                  // Godot 4.x supports EXR
            max_texture_resolution: Some(16384), // Godot max texture size
            supported_texture_formats: vec![
                TextureFormat::PNG,
                TextureFormat::TGA,
                TextureFormat::EXR,
                TextureFormat::DDS,
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::material::{Layer, MaterialCategory, MaterialMetadata};
    use chrono::Utc;
    use uuid::Uuid;

    fn create_test_material() -> Material {
        let mut material = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "TestMaterial".to_string(),
                description: "Test material for Godot export".to_string(),
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

        // Add a layer
        let layer = Layer::new("Base Layer".to_string());
        material.layers.push(layer);

        material
    }

    #[test]
    fn test_godot_exporter_format() {
        let exporter = GodotExporter::new();
        assert_eq!(exporter.format(), ExportFormat::Godot);
    }

    #[test]
    fn test_godot_exporter_capabilities() {
        let exporter = GodotExporter::new();
        let caps = exporter.capabilities();

        assert!(!caps.supports_animation);
        assert!(!caps.supports_layers);
        assert!(!caps.supports_embedded_textures);
        assert!(caps.supports_hdr);
        assert_eq!(caps.max_texture_resolution, Some(16384));
        assert!(caps.supported_texture_formats.contains(&TextureFormat::PNG));
        assert!(caps.supported_texture_formats.contains(&TextureFormat::EXR));
    }

    #[test]
    fn test_godot_exporter_validate_no_layers() {
        let exporter = GodotExporter::new();
        let mut material = create_test_material();
        material.layers.clear();

        let options = ExportOptions::default();
        let result = exporter.validate(&material, &options);

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no layers"));
    }

    #[test]
    fn test_godot_exporter_validate_success() {
        let exporter = GodotExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.validate(&material, &options);
        assert!(result.is_ok());
    }

    #[test]
    fn test_godot_exporter_export_basic() {
        let exporter = GodotExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.data.is_empty());
        assert_eq!(export_result.stats.layer_count, 1);

        // Verify .tres structure
        let tres_str = String::from_utf8(export_result.data).unwrap();
        assert!(tres_str.contains("[gd_resource type=\"StandardMaterial3D\""));
        assert!(tres_str.contains("TestMaterial"));
        assert!(tres_str.contains("[resource]"));
        assert!(tres_str.contains("albedo_color"));
    }

    #[test]
    fn test_godot_exporter_export_with_multiple_layers_warning() {
        let exporter = GodotExporter::new();
        let mut material = create_test_material();

        // Add a second layer
        material.layers.push(Layer::new("Second Layer".to_string()));

        let options = ExportOptions::default();
        let result = exporter.export(&material, &options);

        assert!(result.is_ok());
        let export_result = result.unwrap();

        // Should have a warning about multiple layers
        assert!(!export_result.warnings.is_empty());
        assert!(export_result.warnings[0].contains("only uses the first layer"));
    }

    #[test]
    fn test_godot_exporter_tres_format() {
        let exporter = GodotExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        let tres_str = String::from_utf8(export_result.data).unwrap();

        // Verify Godot-specific properties
        assert!(tres_str.contains("transparency"));
        assert!(tres_str.contains("cull_mode"));
        assert!(tres_str.contains("shading_mode"));
        assert!(tres_str.contains("metallic"));
        assert!(tres_str.contains("roughness"));
        assert!(tres_str.contains("uv1_scale"));
    }
}
