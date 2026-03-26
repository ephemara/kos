//! Asset validation processor

use crate::asset::{Asset, AssetData, AssetType};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetProcessor;

/// Processor that validates asset data integrity
#[derive(Clone)]
pub struct ValidationProcessor;

impl ValidationProcessor {
    pub fn new() -> Self {
        Self
    }

    fn validate_mesh(&self, asset: &Asset) -> Result<()> {
        if let AssetData::Mesh(mesh) = &asset.data {
            // Check positions exist and are valid
            if mesh.positions.is_empty() {
                return Err(AssetError::InvalidAsset(
                    "Mesh has no vertex positions".to_string(),
                ));
            }

            if mesh.positions.len() % 3 != 0 {
                return Err(AssetError::InvalidAsset(
                    "Mesh positions length is not a multiple of 3".to_string(),
                ));
            }

            let vertex_count = mesh.positions.len() / 3;

            // Validate normals if present
            if let Some(normals) = &mesh.normals {
                if normals.len() != mesh.positions.len() {
                    return Err(AssetError::InvalidAsset(
                        "Mesh normals count doesn't match vertex count".to_string(),
                    ));
                }
            }

            // Validate UVs if present
            if let Some(uvs) = &mesh.uvs {
                if uvs.len() % 2 != 0 {
                    return Err(AssetError::InvalidAsset(
                        "Mesh UVs length is not a multiple of 2".to_string(),
                    ));
                }
                if uvs.len() / 2 != vertex_count {
                    return Err(AssetError::InvalidAsset(
                        "Mesh UV count doesn't match vertex count".to_string(),
                    ));
                }
            }

            // Validate tangents if present
            if let Some(tangents) = &mesh.tangents {
                if tangents.len() % 4 != 0 {
                    return Err(AssetError::InvalidAsset(
                        "Mesh tangents length is not a multiple of 4".to_string(),
                    ));
                }
                if tangents.len() / 4 != vertex_count {
                    return Err(AssetError::InvalidAsset(
                        "Mesh tangent count doesn't match vertex count".to_string(),
                    ));
                }
            }

            // Validate colors if present
            if let Some(colors) = &mesh.colors {
                if colors.len() % 4 != 0 {
                    return Err(AssetError::InvalidAsset(
                        "Mesh colors length is not a multiple of 4".to_string(),
                    ));
                }
                if colors.len() / 4 != vertex_count {
                    return Err(AssetError::InvalidAsset(
                        "Mesh color count doesn't match vertex count".to_string(),
                    ));
                }
            }

            // Validate indices if present
            if let Some(indices) = &mesh.indices {
                if indices.len() % 3 != 0 {
                    return Err(AssetError::InvalidAsset(
                        "Mesh indices length is not a multiple of 3".to_string(),
                    ));
                }

                // Check all indices are within bounds
                let max_index = *indices.iter().max().unwrap_or(&0);
                if max_index >= vertex_count as u32 {
                    return Err(AssetError::InvalidAsset(format!(
                        "Mesh index {} is out of bounds (vertex count: {})",
                        max_index, vertex_count
                    )));
                }
            }

            log::debug!(
                "Mesh validation passed: {} vertices, {} triangles",
                vertex_count,
                mesh.indices.as_ref().map(|i| i.len() / 3).unwrap_or(0)
            );
        }

        Ok(())
    }

    fn validate_texture(&self, asset: &Asset) -> Result<()> {
        if let AssetData::Texture(texture) = &asset.data {
            if texture.width == 0 || texture.height == 0 {
                return Err(AssetError::InvalidAsset(
                    "Texture has zero width or height".to_string(),
                ));
            }

            // Check data size matches dimensions
            let expected_size = (texture.width * texture.height * 4) as usize; // RGBA8
            if texture.data.len() != expected_size {
                return Err(AssetError::InvalidAsset(format!(
                    "Texture data size mismatch: expected {}, got {}",
                    expected_size,
                    texture.data.len()
                )));
            }

            log::debug!(
                "Texture validation passed: {}x{}",
                texture.width,
                texture.height
            );
        }

        Ok(())
    }

    fn validate_scene(&self, asset: &Asset) -> Result<()> {
        if let AssetData::Scene(scene) = &asset.data {
            if scene.nodes.is_empty() {
                log::warn!("Scene has no nodes");
            }

            // Validate all meshes in the scene
            for (i, mesh) in scene.meshes.iter().enumerate() {
                if mesh.positions.is_empty() {
                    return Err(AssetError::InvalidAsset(format!(
                        "Scene mesh {} has no vertex positions",
                        i
                    )));
                }
            }

            log::debug!(
                "Scene validation passed: {} nodes, {} meshes",
                scene.nodes.len(),
                scene.meshes.len()
            );
        }

        Ok(())
    }
}

impl AssetProcessor for ValidationProcessor {
    fn process(&self, asset: &mut Asset) -> Result<()> {
        match asset.asset_type {
            AssetType::Mesh => self.validate_mesh(asset),
            AssetType::Texture => self.validate_texture(asset),
            AssetType::Scene => self.validate_scene(asset),
            _ => Ok(()),
        }
    }

    fn name(&self) -> &str {
        "ValidationProcessor"
    }

    fn should_process(&self, _asset: &Asset) -> bool {
        true // Always validate
    }
}

impl Default for ValidationProcessor {
    fn default() -> Self {
        Self::new()
    }
}
