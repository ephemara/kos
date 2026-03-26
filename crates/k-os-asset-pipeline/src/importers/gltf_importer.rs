//! GLTF/GLB importer

use crate::asset::{Asset, AssetData, AssetType, MeshData, SceneData, SceneNode};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetImporter;
use std::path::Path;

/// GLTF/GLB format importer
#[derive(Clone)]
pub struct GltfImporter;

impl GltfImporter {
    pub fn new() -> Self {
        Self
    }

    fn import_mesh(&self, mesh: &gltf::Mesh, buffers: &[gltf::buffer::Data]) -> Result<MeshData> {
        let primitive = mesh
            .primitives()
            .next()
            .ok_or_else(|| AssetError::InvalidAsset("Mesh has no primitives".to_string()))?;

        // Extract positions
        let reader = primitive.reader(|buffer| Some(&buffers[buffer.index()]));

        let positions = reader
            .read_positions()
            .ok_or_else(|| AssetError::InvalidAsset("Mesh has no positions".to_string()))?
            .flat_map(|p| p.to_vec())
            .collect::<Vec<f32>>();

        // Extract normals
        let normals = reader
            .read_normals()
            .map(|iter| iter.flat_map(|n| n.to_vec()).collect::<Vec<f32>>());

        // Extract UVs
        let uvs = reader.read_tex_coords(0).map(|iter| {
            iter.into_f32()
                .flat_map(|uv| uv.to_vec())
                .collect::<Vec<f32>>()
        });

        // Extract indices
        let indices = reader
            .read_indices()
            .map(|iter| iter.into_u32().collect::<Vec<u32>>());

        // Extract tangents
        let tangents = reader
            .read_tangents()
            .map(|iter| iter.flat_map(|t| t.to_vec()).collect::<Vec<f32>>());

        // Extract colors
        let colors = reader.read_colors(0).map(|iter| {
            iter.into_rgba_f32()
                .flat_map(|c| c.to_vec())
                .collect::<Vec<f32>>()
        });

        let index_count = indices.as_ref().map(|i| i.len() as u32).unwrap_or(0);

        Ok(MeshData {
            positions,
            normals,
            tangents,
            uvs,
            colors,
            indices,
            submeshes: vec![(0, index_count, None)],
        })
    }

    fn import_node(&self, node: &gltf::Node, buffers: &[gltf::buffer::Data]) -> Result<SceneNode> {
        let transform = node.transform().matrix();
        let transform_flat: [f32; 16] = [
            transform[0][0],
            transform[0][1],
            transform[0][2],
            transform[0][3],
            transform[1][0],
            transform[1][1],
            transform[1][2],
            transform[1][3],
            transform[2][0],
            transform[2][1],
            transform[2][2],
            transform[2][3],
            transform[3][0],
            transform[3][1],
            transform[3][2],
            transform[3][3],
        ];

        let mesh_index = node.mesh().map(|m| m.index());

        let children = node
            .children()
            .map(|child| self.import_node(&child, buffers))
            .collect::<Result<Vec<_>>>()?;

        Ok(SceneNode {
            name: node.name().unwrap_or("Unnamed").to_string(),
            transform: transform_flat,
            mesh_index,
            children,
        })
    }
}

impl AssetImporter for GltfImporter {
    fn supported_extensions(&self) -> Vec<&str> {
        vec!["gltf", "glb"]
    }

    fn import(&self, path: &Path) -> Result<Asset> {
        let (document, buffers, _images) =
            gltf::import(path).map_err(|e| AssetError::ImportFailed {
                path: path.to_path_buf(),
                source: anyhow::anyhow!("GLTF import error: {}", e),
            })?;

        // Import first scene
        let scene = document
            .default_scene()
            .or_else(|| document.scenes().next())
            .ok_or_else(|| AssetError::InvalidAsset("No scenes in GLTF file".to_string()))?;

        // Import all meshes
        let meshes = document
            .meshes()
            .map(|mesh| self.import_mesh(&mesh, &buffers))
            .collect::<Result<Vec<_>>>()?;

        // Import scene nodes
        let nodes = scene
            .nodes()
            .map(|node| self.import_node(&node, &buffers))
            .collect::<Result<Vec<_>>>()?;

        let scene_data = SceneData {
            name: scene.name().unwrap_or("Scene").to_string(),
            nodes,
            meshes,
            materials: vec![], // TODO: Import materials
        };

        let mut asset = Asset::new(
            String::new(), // Will be set by pipeline
            AssetType::Scene,
            path.to_path_buf(),
            AssetData::Scene(scene_data),
        );

        // Add metadata
        asset.add_metadata("format".to_string(), "gltf".to_string());
        asset.add_metadata(
            "mesh_count".to_string(),
            document.meshes().len().to_string(),
        );
        asset.add_metadata("node_count".to_string(), scene.nodes().len().to_string());

        Ok(asset)
    }

    fn name(&self) -> &str {
        "GltfImporter"
    }
}

impl Default for GltfImporter {
    fn default() -> Self {
        Self::new()
    }
}
