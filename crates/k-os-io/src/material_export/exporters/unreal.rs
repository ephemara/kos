// Unreal Engine Material Exporter
// Generates .uasset material files compatible with Unreal Engine's PBR workflow

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::autopbr::export::{
    ExportFormat, ExportOptions, ExportResult, ExportStats, ExporterCapabilities, MaterialExporter,
    TextureFormat,
};
use crate::autopbr::Material;

/// Unreal Engine material exporter
///
/// Generates .uasset material files compatible with Unreal Engine 5.x.
/// Supports Unreal's PBR workflow with proper texture references and material parameters.
///
/// # Texture Mapping
/// - Albedo → BaseColor
/// - Normal → Normal
/// - Roughness → Roughness
/// - Metallic → Metallic
/// - AO → AmbientOcclusion
/// - Height → Displacement (via tessellation)
/// - Emissive → EmissiveColor
///
/// # Requirements
/// Validates: Requirements 10.1, 10.5
pub struct UnrealExporter;

impl UnrealExporter {
    /// Create a new Unreal Engine exporter
    pub fn new() -> Self {
        Self
    }
}

impl Default for UnrealExporter {
    fn default() -> Self {
        Self::new()
    }
}

/// Unreal Engine material asset structure
///
/// This represents the JSON structure that will be serialized to .uasset format.
/// Unreal uses a custom binary format, but we generate a JSON representation
/// that can be imported via Unreal's Python API or converted to .uasset.
#[derive(Debug, Serialize, Deserialize)]
struct UnrealMaterialAsset {
    /// Asset type identifier
    #[serde(rename = "Type")]
    asset_type: String,

    /// Material name
    #[serde(rename = "Name")]
    name: String,

    /// Material parent class (usually Material)
    #[serde(rename = "Parent")]
    parent: String,

    /// Material properties
    #[serde(rename = "Properties")]
    properties: UnrealMaterialProperties,

    /// Texture parameters
    #[serde(rename = "TextureParameters")]
    texture_parameters: HashMap<String, UnrealTextureParameter>,

    /// Scalar parameters
    #[serde(rename = "ScalarParameters")]
    scalar_parameters: HashMap<String, f32>,

    /// Vector parameters
    #[serde(rename = "VectorParameters")]
    vector_parameters: HashMap<String, UnrealVector>,
}

/// Unreal material properties
#[derive(Debug, Serialize, Deserialize)]
struct UnrealMaterialProperties {
    /// Shading model (usually DefaultLit for PBR)
    #[serde(rename = "ShadingModel")]
    shading_model: String,

    /// Blend mode (Opaque, Masked, Translucent)
    #[serde(rename = "BlendMode")]
    blend_mode: String,

    /// Whether to use two-sided rendering
    #[serde(rename = "TwoSided")]
    two_sided: bool,

    /// Whether material uses tessellation
    #[serde(rename = "D3D11TessellationMode")]
    tessellation_mode: String,
}

/// Unreal texture parameter
#[derive(Debug, Serialize, Deserialize)]
struct UnrealTextureParameter {
    /// Texture asset path
    #[serde(rename = "Value")]
    value: String,

    /// Texture type (Texture2D, TextureCube, etc.)
    #[serde(rename = "Type")]
    texture_type: String,
}

/// Unreal 4D vector (RGBA or XYZW)
#[derive(Debug, Serialize, Deserialize)]
struct UnrealVector {
    #[serde(rename = "R")]
    r: f32,
    #[serde(rename = "G")]
    g: f32,
    #[serde(rename = "B")]
    b: f32,
    #[serde(rename = "A")]
    a: f32,
}

impl MaterialExporter for UnrealExporter {
    fn format(&self) -> ExportFormat {
        ExportFormat::Unreal
    }

    fn export(&self, material: &Material, _options: &ExportOptions) -> Result<ExportResult> {
        let start_time = std::time::Instant::now();

        // Build texture parameters from material layers
        let mut texture_parameters = HashMap::new();
        let mut texture_count = 0;
        let additional_files = HashMap::new();
        let mut warnings = Vec::new();

        // Get the first layer's maps (Unreal doesn't support layer stacks natively)
        if material.layers.is_empty() {
            return Err(anyhow::anyhow!("Material has no layers to export"));
        }

        if material.layers.len() > 1 {
            warnings.push(format!(
                "Material has {} layers, but Unreal export only uses the first layer. Consider flattening layers before export.",
                material.layers.len()
            ));
        }

        let base_layer = &material.layers[0];
        let maps = &base_layer.maps;

        // Map PBR textures to Unreal parameters
        if let Some(_albedo) = &maps.albedo {
            texture_parameters.insert(
                "BaseColor".to_string(),
                UnrealTextureParameter {
                    value: format!(
                        "/Game/Materials/Textures/{}_BaseColor",
                        material.metadata.name
                    ),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        if let Some(_normal) = &maps.normal {
            texture_parameters.insert(
                "Normal".to_string(),
                UnrealTextureParameter {
                    value: format!("/Game/Materials/Textures/{}_Normal", material.metadata.name),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        if let Some(_roughness) = &maps.roughness {
            texture_parameters.insert(
                "Roughness".to_string(),
                UnrealTextureParameter {
                    value: format!(
                        "/Game/Materials/Textures/{}_Roughness",
                        material.metadata.name
                    ),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        if let Some(_metallic) = &maps.metallic {
            texture_parameters.insert(
                "Metallic".to_string(),
                UnrealTextureParameter {
                    value: format!(
                        "/Game/Materials/Textures/{}_Metallic",
                        material.metadata.name
                    ),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        if let Some(_ao) = &maps.ao {
            texture_parameters.insert(
                "AmbientOcclusion".to_string(),
                UnrealTextureParameter {
                    value: format!("/Game/Materials/Textures/{}_AO", material.metadata.name),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        if let Some(_height) = &maps.height {
            texture_parameters.insert(
                "Displacement".to_string(),
                UnrealTextureParameter {
                    value: format!("/Game/Materials/Textures/{}_Height", material.metadata.name),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        if let Some(_emissive) = &maps.emissive {
            texture_parameters.insert(
                "EmissiveColor".to_string(),
                UnrealTextureParameter {
                    value: format!(
                        "/Game/Materials/Textures/{}_Emissive",
                        material.metadata.name
                    ),
                    texture_type: "Texture2D".to_string(),
                },
            );
            texture_count += 1;
        }

        // Set up scalar parameters
        let mut scalar_parameters = HashMap::new();
        scalar_parameters.insert("RoughnessMultiplier".to_string(), 1.0);
        scalar_parameters.insert("MetallicMultiplier".to_string(), 1.0);
        scalar_parameters.insert("NormalStrength".to_string(), 1.0);
        scalar_parameters.insert("DisplacementScale".to_string(), 0.1);
        scalar_parameters.insert("EmissiveIntensity".to_string(), 1.0);

        // Set up vector parameters
        let mut vector_parameters = HashMap::new();
        vector_parameters.insert(
            "BaseColorTint".to_string(),
            UnrealVector {
                r: 1.0,
                g: 1.0,
                b: 1.0,
                a: 1.0,
            },
        );

        // Determine tessellation mode based on height map presence
        let tessellation_mode = if maps.height.is_some() {
            "PNTriangles".to_string()
        } else {
            "NoTessellation".to_string()
        };

        // Build Unreal material asset
        let unreal_asset = UnrealMaterialAsset {
            asset_type: "Material".to_string(),
            name: material.metadata.name.clone(),
            parent: "/Engine/EngineMaterials/DefaultMaterial".to_string(),
            properties: UnrealMaterialProperties {
                shading_model: "MSM_DefaultLit".to_string(),
                blend_mode: "BLEND_Opaque".to_string(),
                two_sided: false,
                tessellation_mode,
            },
            texture_parameters,
            scalar_parameters,
            vector_parameters,
        };

        // Serialize to JSON
        let json_data = serde_json::to_string_pretty(&unreal_asset)
            .map_err(|e| anyhow::anyhow!("Failed to serialize Unreal material: {}", e))?;

        // Check for animation data
        if material.animation.is_some() {
            warnings.push(
                "Material has animation data, but Unreal export does not support animation. \
                Consider baking animation to texture sequences."
                    .to_string(),
            );
        }

        let duration = start_time.elapsed();

        let total_size_bytes = json_data.len();
        Ok(ExportResult {
            data: json_data.into_bytes(),
            additional_files,
            warnings,
            stats: ExportStats {
                total_size_bytes,
                texture_count,
                layer_count: 1, // Unreal only uses first layer
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

        // Warn about HDR textures (Unreal supports them but with caveats)
        if options.texture_format.supports_hdr() {
            log::warn!(
                "Exporting HDR textures to Unreal. Ensure Unreal project is configured for HDR rendering."
            );
        }

        Ok(())
    }

    fn capabilities(&self) -> ExporterCapabilities {
        ExporterCapabilities {
            supports_animation: false,
            supports_layers: false, // Only uses first layer
            supports_embedded_textures: false,
            supports_hdr: true,                  // Unreal supports HDR with EXR
            max_texture_resolution: Some(16384), // Unreal max texture size
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
                description: "Test material for Unreal export".to_string(),
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

        // Add a layer with some maps
        let mut layer = Layer::new("Base Layer".to_string());
        // Note: In real usage, these would have actual texture handles
        // For testing, we just need the layer structure
        material.layers.push(layer);

        material
    }

    #[test]
    fn test_unreal_exporter_format() {
        let exporter = UnrealExporter::new();
        assert_eq!(exporter.format(), ExportFormat::Unreal);
    }

    #[test]
    fn test_unreal_exporter_capabilities() {
        let exporter = UnrealExporter::new();
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
    fn test_unreal_exporter_validate_no_layers() {
        let exporter = UnrealExporter::new();
        let mut material = create_test_material();
        material.layers.clear();

        let options = ExportOptions::default();
        let result = exporter.validate(&material, &options);

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no layers"));
    }

    #[test]
    fn test_unreal_exporter_validate_success() {
        let exporter = UnrealExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.validate(&material, &options);
        assert!(result.is_ok());
    }

    #[test]
    fn test_unreal_exporter_export_basic() {
        let exporter = UnrealExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.data.is_empty());
        assert_eq!(export_result.stats.layer_count, 1);

        // Verify JSON structure
        let json_str = String::from_utf8(export_result.data).unwrap();
        assert!(json_str.contains("\"Type\":\"Material\""));
        assert!(json_str.contains("TestMaterial"));
        assert!(json_str.contains("ShadingModel"));
    }

    #[test]
    fn test_unreal_exporter_export_with_multiple_layers_warning() {
        let exporter = UnrealExporter::new();
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
}
