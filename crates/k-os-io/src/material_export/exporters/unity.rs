// Unity Material Exporter
// Generates .mat material files compatible with Unity's Standard Shader

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::autopbr::export::{
    ExportFormat, ExportOptions, ExportResult, ExportStats, ExporterCapabilities, MaterialExporter,
    TextureFormat,
};
use crate::autopbr::Material;

/// Unity material exporter
///
/// Generates .mat material files compatible with Unity's Standard Shader (PBR).
/// Unity uses YAML-based .mat files that reference texture assets.
///
/// # Texture Mapping
/// - Albedo → _MainTex (with _Color tint)
/// - Normal → _BumpMap
/// - Roughness → _Glossiness (inverted: smoothness = 1 - roughness)
/// - Metallic → _Metallic
/// - AO → _OcclusionMap
/// - Height → _ParallaxMap
/// - Emissive → _EmissionMap (with _EmissionColor)
///
/// # Requirements
/// Validates: Requirements 10.1, 10.6
pub struct UnityExporter;

impl UnityExporter {
    /// Create a new Unity exporter
    pub fn new() -> Self {
        Self
    }
}

impl Default for UnityExporter {
    fn default() -> Self {
        Self::new()
    }
}

/// Unity material data structure
#[derive(Debug, Serialize, Deserialize)]
struct UnityMaterialData {
    /// Object metadata
    #[serde(rename = "m_ObjectHideFlags")]
    object_hide_flags: u32,

    /// Corresponding source object
    #[serde(rename = "m_CorrespondingSourceObject")]
    corresponding_source_object: UnityObjectReference,

    /// Prefab instance
    #[serde(rename = "m_PrefabInstance")]
    prefab_instance: UnityObjectReference,

    /// Prefab asset
    #[serde(rename = "m_PrefabAsset")]
    prefab_asset: UnityObjectReference,

    /// Material name
    #[serde(rename = "m_Name")]
    name: String,

    /// Shader reference
    #[serde(rename = "m_Shader")]
    shader: UnityShaderReference,

    /// Shader keywords
    #[serde(rename = "m_ShaderKeywords")]
    shader_keywords: String,

    /// Lighting flags
    #[serde(rename = "m_LightmapFlags")]
    lightmap_flags: u32,

    /// Enable instancing
    #[serde(rename = "m_EnableInstancingVariants")]
    enable_instancing_variants: bool,

    /// Double sided GI
    #[serde(rename = "m_DoubleSidedGI")]
    double_sided_gi: bool,

    /// Custom render queue
    #[serde(rename = "m_CustomRenderQueue")]
    custom_render_queue: i32,

    /// Saved properties
    #[serde(rename = "m_SavedProperties")]
    saved_properties: UnitySavedProperties,
}

/// Unity object reference (fileID and guid)
#[derive(Debug, Serialize, Deserialize)]
struct UnityObjectReference {
    #[serde(rename = "fileID")]
    file_id: u64,

    #[serde(rename = "guid")]
    guid: String,

    #[serde(rename = "type")]
    ref_type: u32,
}

impl Default for UnityObjectReference {
    fn default() -> Self {
        Self {
            file_id: 0,
            guid: String::new(),
            ref_type: 0,
        }
    }
}

/// Unity shader reference
#[derive(Debug, Serialize, Deserialize)]
struct UnityShaderReference {
    #[serde(rename = "fileID")]
    file_id: u64,

    #[serde(rename = "guid")]
    guid: String,

    #[serde(rename = "type")]
    ref_type: u32,
}

/// Unity saved properties (textures, floats, colors)
#[derive(Debug, Serialize, Deserialize)]
struct UnitySavedProperties {
    #[serde(rename = "serializedVersion")]
    serialized_version: u32,

    #[serde(rename = "m_TexEnvs")]
    tex_envs: Vec<UnityTexEnv>,

    #[serde(rename = "m_Floats")]
    floats: Vec<UnityFloat>,

    #[serde(rename = "m_Colors")]
    colors: Vec<UnityColor>,
}

/// Unity texture environment
#[derive(Debug, Serialize, Deserialize)]
struct UnityTexEnv {
    #[serde(rename = "name")]
    name: String,

    #[serde(rename = "m_Texture")]
    texture: UnityObjectReference,

    #[serde(rename = "m_Scale")]
    scale: UnityVector2,

    #[serde(rename = "m_Offset")]
    offset: UnityVector2,
}

/// Unity float property
#[derive(Debug, Serialize, Deserialize)]
struct UnityFloat {
    #[serde(rename = "name")]
    name: String,

    #[serde(rename = "value")]
    value: f32,
}

/// Unity color property
#[derive(Debug, Serialize, Deserialize)]
struct UnityColor {
    #[serde(rename = "name")]
    name: String,

    #[serde(rename = "value")]
    value: UnityVector4,
}

/// Unity 2D vector
#[derive(Debug, Serialize, Deserialize)]
struct UnityVector2 {
    x: f32,
    y: f32,
}

/// Unity 4D vector (RGBA or XYZW)
#[derive(Debug, Serialize, Deserialize)]
struct UnityVector4 {
    r: f32,
    g: f32,
    b: f32,
    a: f32,
}

impl MaterialExporter for UnityExporter {
    fn format(&self) -> ExportFormat {
        ExportFormat::Unity
    }

    fn export(&self, material: &Material, _options: &ExportOptions) -> Result<ExportResult> {
        let start_time = std::time::Instant::now();

        // Build texture environments from material layers
        let mut tex_envs = Vec::new();
        let mut floats = Vec::new();
        let mut colors = Vec::new();
        let mut texture_count = 0;
        let additional_files = HashMap::new();
        let mut warnings = Vec::new();

        // Get the first layer's maps (Unity Standard Shader doesn't support layer stacks)
        if material.layers.is_empty() {
            return Err(anyhow::anyhow!("Material has no layers to export"));
        }

        if material.layers.len() > 1 {
            warnings.push(format!(
                "Material has {} layers, but Unity export only uses the first layer. Consider flattening layers before export.",
                material.layers.len()
            ));
        }

        let base_layer = &material.layers[0];
        let maps = &base_layer.maps;

        // Map PBR textures to Unity Standard Shader properties
        if let Some(_albedo) = &maps.albedo {
            tex_envs.push(UnityTexEnv {
                name: "_MainTex".to_string(),
                texture: UnityObjectReference {
                    file_id: 0,
                    guid: format!("{}_albedo", material.metadata.name),
                    ref_type: 2,
                },
                scale: UnityVector2 { x: 1.0, y: 1.0 },
                offset: UnityVector2 { x: 0.0, y: 0.0 },
            });
            texture_count += 1;
        }

        if let Some(_normal) = &maps.normal {
            tex_envs.push(UnityTexEnv {
                name: "_BumpMap".to_string(),
                texture: UnityObjectReference {
                    file_id: 0,
                    guid: format!("{}_normal", material.metadata.name),
                    ref_type: 2,
                },
                scale: UnityVector2 { x: 1.0, y: 1.0 },
                offset: UnityVector2 { x: 0.0, y: 0.0 },
            });
            texture_count += 1;

            // Enable normal map
            floats.push(UnityFloat {
                name: "_BumpScale".to_string(),
                value: 1.0,
            });
        }

        if let Some(_metallic) = &maps.metallic {
            tex_envs.push(UnityTexEnv {
                name: "_MetallicGlossMap".to_string(),
                texture: UnityObjectReference {
                    file_id: 0,
                    guid: format!("{}_metallic", material.metadata.name),
                    ref_type: 2,
                },
                scale: UnityVector2 { x: 1.0, y: 1.0 },
                offset: UnityVector2 { x: 0.0, y: 0.0 },
            });
            texture_count += 1;
        }

        if let Some(_ao) = &maps.ao {
            tex_envs.push(UnityTexEnv {
                name: "_OcclusionMap".to_string(),
                texture: UnityObjectReference {
                    file_id: 0,
                    guid: format!("{}_ao", material.metadata.name),
                    ref_type: 2,
                },
                scale: UnityVector2 { x: 1.0, y: 1.0 },
                offset: UnityVector2 { x: 0.0, y: 0.0 },
            });
            texture_count += 1;

            floats.push(UnityFloat {
                name: "_OcclusionStrength".to_string(),
                value: 1.0,
            });
        }

        if let Some(_height) = &maps.height {
            tex_envs.push(UnityTexEnv {
                name: "_ParallaxMap".to_string(),
                texture: UnityObjectReference {
                    file_id: 0,
                    guid: format!("{}_height", material.metadata.name),
                    ref_type: 2,
                },
                scale: UnityVector2 { x: 1.0, y: 1.0 },
                offset: UnityVector2 { x: 0.0, y: 0.0 },
            });
            texture_count += 1;

            floats.push(UnityFloat {
                name: "_Parallax".to_string(),
                value: 0.02,
            });
        }

        if let Some(_emissive) = &maps.emissive {
            tex_envs.push(UnityTexEnv {
                name: "_EmissionMap".to_string(),
                texture: UnityObjectReference {
                    file_id: 0,
                    guid: format!("{}_emissive", material.metadata.name),
                    ref_type: 2,
                },
                scale: UnityVector2 { x: 1.0, y: 1.0 },
                offset: UnityVector2 { x: 0.0, y: 0.0 },
            });
            texture_count += 1;

            colors.push(UnityColor {
                name: "_EmissionColor".to_string(),
                value: UnityVector4 {
                    r: 1.0,
                    g: 1.0,
                    b: 1.0,
                    a: 1.0,
                },
            });
        }

        // Set up standard shader properties
        floats.push(UnityFloat {
            name: "_Mode".to_string(),
            value: 0.0, // Opaque
        });

        floats.push(UnityFloat {
            name: "_Metallic".to_string(),
            value: 1.0,
        });

        // Unity uses smoothness (inverse of roughness)
        floats.push(UnityFloat {
            name: "_Glossiness".to_string(),
            value: 0.5, // Default smoothness
        });

        floats.push(UnityFloat {
            name: "_GlossMapScale".to_string(),
            value: 1.0,
        });

        floats.push(UnityFloat {
            name: "_SmoothnessTextureChannel".to_string(),
            value: 0.0, // Metallic Alpha
        });

        floats.push(UnityFloat {
            name: "_SpecularHighlights".to_string(),
            value: 1.0,
        });

        floats.push(UnityFloat {
            name: "_GlossyReflections".to_string(),
            value: 1.0,
        });

        // Set up colors
        colors.push(UnityColor {
            name: "_Color".to_string(),
            value: UnityVector4 {
                r: 1.0,
                g: 1.0,
                b: 1.0,
                a: 1.0,
            },
        });

        // Build Unity material structure
        let unity_material = UnityMaterialData {
            object_hide_flags: 0,
            corresponding_source_object: UnityObjectReference::default(),
            prefab_instance: UnityObjectReference::default(),
            prefab_asset: UnityObjectReference::default(),
            name: material.metadata.name.clone(),
            shader: UnityShaderReference {
                file_id: 46,
                guid: "0000000000000000f000000000000000".to_string(),
                ref_type: 0,
            },
            shader_keywords: "_METALLICGLOSSMAP _NORMALMAP".to_string(),
            lightmap_flags: 4,
            enable_instancing_variants: false,
            double_sided_gi: false,
            custom_render_queue: -1,
            saved_properties: UnitySavedProperties {
                serialized_version: 3,
                tex_envs,
                floats,
                colors,
            },
        };

        // Serialize to YAML
        let yaml_data = serde_yaml::to_string(&unity_material)
            .map_err(|e| anyhow::anyhow!("Failed to serialize Unity material: {}", e))?;

        // Add Unity YAML header
        let full_yaml = format!(
            "%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!21 &2100000\n{}",
            yaml_data
        );

        // Check for animation data
        if material.animation.is_some() {
            warnings.push(
                "Material has animation data, but Unity export does not support animation. \
                Consider baking animation to texture sequences or using Unity's Animator."
                    .to_string(),
            );
        }

        let duration = start_time.elapsed();

        let total_size_bytes = full_yaml.len();
        Ok(ExportResult {
            data: full_yaml.into_bytes(),
            additional_files,
            warnings,
            stats: ExportStats {
                total_size_bytes,
                texture_count,
                layer_count: 1, // Unity only uses first layer
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

        // Unity Standard Shader doesn't support HDR textures well
        if options.texture_format.supports_hdr() {
            return Err(anyhow::anyhow!(
                "Unity Standard Shader does not support HDR textures. Use PNG or TGA format instead."
            ));
        }

        Ok(())
    }

    fn capabilities(&self) -> ExporterCapabilities {
        ExporterCapabilities {
            supports_animation: false,
            supports_layers: false, // Only uses first layer
            supports_embedded_textures: false,
            supports_hdr: false, // Unity Standard Shader limitation
            max_texture_resolution: Some(8192), // Unity max texture size
            supported_texture_formats: vec![
                TextureFormat::PNG,
                TextureFormat::TGA,
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
                description: "Test material for Unity export".to_string(),
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
    fn test_unity_exporter_format() {
        let exporter = UnityExporter::new();
        assert_eq!(exporter.format(), ExportFormat::Unity);
    }

    #[test]
    fn test_unity_exporter_capabilities() {
        let exporter = UnityExporter::new();
        let caps = exporter.capabilities();

        assert!(!caps.supports_animation);
        assert!(!caps.supports_layers);
        assert!(!caps.supports_embedded_textures);
        assert!(!caps.supports_hdr);
        assert_eq!(caps.max_texture_resolution, Some(8192));
        assert!(caps.supported_texture_formats.contains(&TextureFormat::PNG));
        assert!(!caps.supported_texture_formats.contains(&TextureFormat::EXR));
    }

    #[test]
    fn test_unity_exporter_validate_no_layers() {
        let exporter = UnityExporter::new();
        let mut material = create_test_material();
        material.layers.clear();

        let options = ExportOptions::default();
        let result = exporter.validate(&material, &options);

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no layers"));
    }

    #[test]
    fn test_unity_exporter_validate_hdr_rejection() {
        let exporter = UnityExporter::new();
        let material = create_test_material();
        let mut options = ExportOptions::default();
        options.texture_format = TextureFormat::EXR;

        let result = exporter.validate(&material, &options);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("does not support HDR"));
    }

    #[test]
    fn test_unity_exporter_validate_success() {
        let exporter = UnityExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.validate(&material, &options);
        assert!(result.is_ok());
    }

    #[test]
    fn test_unity_exporter_export_basic() {
        let exporter = UnityExporter::new();
        let material = create_test_material();
        let options = ExportOptions::default();

        let result = exporter.export(&material, &options);
        assert!(result.is_ok());

        let export_result = result.unwrap();
        assert!(!export_result.data.is_empty());
        assert_eq!(export_result.stats.layer_count, 1);

        // Verify YAML structure
        let yaml_str = String::from_utf8(export_result.data).unwrap();
        assert!(yaml_str.contains("%YAML 1.1"));
        assert!(yaml_str.contains("%TAG !u! tag:unity3d.com"));
        assert!(yaml_str.contains("TestMaterial"));
        assert!(yaml_str.contains("m_Shader"));
    }

    #[test]
    fn test_unity_exporter_export_with_multiple_layers_warning() {
        let exporter = UnityExporter::new();
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
