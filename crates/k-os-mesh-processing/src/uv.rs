//! UV unwrapping

use crate::{Mesh, MeshError, Result};
use glam::Vec2;
use log::info;

/// UV unwrapping settings
#[derive(Debug, Clone)]
pub struct UnwrapSettings {
    /// Padding between charts in pixels
    pub padding: u32,
}

impl Default for UnwrapSettings {
    fn default() -> Self {
        Self { padding: 2 }
    }
}

/// Automatic UV unwrapping
///
/// Generates UV coordinates for the mesh using a simple planar projection.
/// For production use, integrate with xatlas or similar library.
///
/// # Arguments
/// * `mesh` - Input mesh
///
/// # Returns
/// Vector of UV coordinates (one per vertex)
pub fn unwrap(mesh: &Mesh) -> Result<Vec<Vec2>> {
    unwrap_with_settings(mesh, &UnwrapSettings::default())
}

/// UV unwrapping with custom settings
pub fn unwrap_with_settings(mesh: &Mesh, _settings: &UnwrapSettings) -> Result<Vec<Vec2>> {
    mesh.validate()?;

    info!("Starting UV unwrapping (simple planar projection)");

    // Simple planar projection onto XY plane
    // In production, use xatlas or similar for proper unwrapping
    let bounds = mesh.bounds();
    let size = bounds.size();

    if size.x < 1e-6 || size.y < 1e-6 {
        return Err(MeshError::UVUnwrapFailed(
            "Mesh has zero size in XY plane".to_string(),
        ));
    }

    let uvs: Vec<Vec2> = mesh
        .vertices
        .iter()
        .map(|v| {
            let u = (v.x - bounds.min.x) / size.x;
            let v = (v.y - bounds.min.y) / size.y;
            Vec2::new(u, v)
        })
        .collect();

    info!("UV unwrapping complete: {} UVs generated", uvs.len());

    Ok(uvs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Mesh;
    use glam::Vec3;

    fn create_test_mesh() -> Mesh {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(1.0, 1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2, 0, 2, 3];
        Mesh::from_vertices_indices(vertices, indices)
    }

    #[test]
    fn test_unwrap() {
        let mesh = create_test_mesh();
        let result = unwrap(&mesh);

        assert!(result.is_ok());
        let uvs = result.unwrap();
        assert_eq!(uvs.len(), mesh.vertex_count());

        // Check UVs are in [0, 1] range
        for uv in &uvs {
            assert!(uv.x >= 0.0 && uv.x <= 1.0);
            assert!(uv.y >= 0.0 && uv.y <= 1.0);
        }
    }

    #[test]
    fn test_unwrap_with_settings() {
        let mesh = create_test_mesh();
        let settings = UnwrapSettings { padding: 4 };

        let result = unwrap_with_settings(&mesh, &settings);
        assert!(result.is_ok());
    }
}
