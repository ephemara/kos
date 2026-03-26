//! OBJ format importer

use crate::asset::{Asset, AssetData, AssetType, MeshData};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetImporter;
use std::path::Path;

/// OBJ format importer
#[derive(Clone)]
pub struct ObjImporter;

impl ObjImporter {
    pub fn new() -> Self {
        Self
    }
}

impl AssetImporter for ObjImporter {
    fn supported_extensions(&self) -> Vec<&str> {
        vec!["obj"]
    }

    fn import(&self, path: &Path) -> Result<Asset> {
        let (models, _materials) = tobj::load_obj(
            path,
            &tobj::LoadOptions {
                triangulate: true,
                single_index: true,
                ..Default::default()
            },
        )
        .map_err(|e| AssetError::ImportFailed {
            path: path.to_path_buf(),
            source: anyhow::anyhow!("OBJ import error: {}", e),
        })?;

        if models.is_empty() {
            return Err(AssetError::InvalidAsset(
                "No models in OBJ file".to_string(),
            ));
        }

        // For now, import first model
        // TODO: Support multiple models as submeshes or separate assets
        let model = &models[0];
        let mesh = &model.mesh;

        let positions = mesh.positions.clone();
        let normals = if !mesh.normals.is_empty() {
            Some(mesh.normals.clone())
        } else {
            None
        };
        let uvs = if !mesh.texcoords.is_empty() {
            Some(mesh.texcoords.clone())
        } else {
            None
        };
        let indices = if !mesh.indices.is_empty() {
            Some(mesh.indices.clone())
        } else {
            None
        };

        let mesh_data = MeshData {
            positions,
            normals,
            tangents: None,
            uvs,
            colors: None,
            indices,
            submeshes: vec![(0, mesh.indices.len() as u32, None)],
        };

        let mut asset = Asset::new(
            String::new(), // Will be set by pipeline
            AssetType::Mesh,
            path.to_path_buf(),
            AssetData::Mesh(mesh_data),
        );

        // Add metadata
        asset.add_metadata("format".to_string(), "obj".to_string());
        asset.add_metadata(
            "vertex_count".to_string(),
            (mesh.positions.len() / 3).to_string(),
        );
        asset.add_metadata(
            "triangle_count".to_string(),
            (mesh.indices.len() / 3).to_string(),
        );
        asset.add_metadata("model_name".to_string(), model.name.clone());

        Ok(asset)
    }

    fn name(&self) -> &str {
        "ObjImporter"
    }
}

impl Default for ObjImporter {
    fn default() -> Self {
        Self::new()
    }
}
