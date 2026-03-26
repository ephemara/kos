//! OBJ format exporter

use crate::asset::{Asset, AssetData};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetExporter;
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// OBJ format exporter
#[derive(Clone)]
pub struct ObjExporter;

impl ObjExporter {
    pub fn new() -> Self {
        Self
    }
}

impl AssetExporter for ObjExporter {
    fn supported_formats(&self) -> Vec<&str> {
        vec!["obj"]
    }

    fn export(&self, asset: &Asset, path: &Path) -> Result<()> {
        let mesh_data = match &asset.data {
            AssetData::Mesh(mesh) => mesh,
            AssetData::Scene(scene) => {
                // Export first mesh from scene
                scene.meshes.first().ok_or_else(|| {
                    AssetError::InvalidAsset("Scene has no meshes to export".to_string())
                })?
            }
            _ => {
                return Err(AssetError::InvalidAsset(
                    "Asset is not a mesh or scene".to_string(),
                ))
            }
        };

        let mut file = File::create(path)?;

        // Write header
        writeln!(file, "# Exported by K_OS Asset Pipeline")?;
        writeln!(file, "# Source: {}", asset.source_path.display())?;
        writeln!(file)?;

        // Write vertices
        for i in (0..mesh_data.positions.len()).step_by(3) {
            writeln!(
                file,
                "v {} {} {}",
                mesh_data.positions[i],
                mesh_data.positions[i + 1],
                mesh_data.positions[i + 2]
            )?;
        }

        // Write UVs
        if let Some(uvs) = &mesh_data.uvs {
            for i in (0..uvs.len()).step_by(2) {
                writeln!(file, "vt {} {}", uvs[i], uvs[i + 1])?;
            }
        }

        // Write normals
        if let Some(normals) = &mesh_data.normals {
            for i in (0..normals.len()).step_by(3) {
                writeln!(
                    file,
                    "vn {} {} {}",
                    normals[i],
                    normals[i + 1],
                    normals[i + 2]
                )?;
            }
        }

        // Write faces
        if let Some(indices) = &mesh_data.indices {
            let has_uvs = mesh_data.uvs.is_some();
            let has_normals = mesh_data.normals.is_some();

            for i in (0..indices.len()).step_by(3) {
                let v1 = indices[i] + 1; // OBJ indices are 1-based
                let v2 = indices[i + 1] + 1;
                let v3 = indices[i + 2] + 1;

                match (has_uvs, has_normals) {
                    (true, true) => {
                        writeln!(
                            file,
                            "f {}/{}/{} {}/{}/{} {}/{}/{}",
                            v1, v1, v1, v2, v2, v2, v3, v3, v3
                        )?;
                    }
                    (true, false) => {
                        writeln!(file, "f {}/{} {}/{} {}/{}", v1, v1, v2, v2, v3, v3)?;
                    }
                    (false, true) => {
                        writeln!(file, "f {}//{} {}//{} {}//{}", v1, v1, v2, v2, v3, v3)?;
                    }
                    (false, false) => {
                        writeln!(file, "f {} {} {}", v1, v2, v3)?;
                    }
                }
            }
        }

        Ok(())
    }

    fn name(&self) -> &str {
        "ObjExporter"
    }
}

impl Default for ObjExporter {
    fn default() -> Self {
        Self::new()
    }
}
