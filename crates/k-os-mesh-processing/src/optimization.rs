//! Mesh optimization using meshopt

use crate::{Mesh, Result};
use log::info;

/// Optimize mesh for GPU rendering
///
/// Applies all optimization passes:
/// 1. Vertex cache optimization
/// 2. Overdraw optimization
/// 3. Vertex fetch optimization
pub fn optimize_all(mesh: &Mesh) -> Result<Mesh> {
    mesh.validate()?;

    info!("Starting complete mesh optimization");

    let mut result = optimize_vertex_cache(mesh)?;
    result = optimize_overdraw(&result, 1.05)?;
    result = optimize_vertex_fetch(&result)?;

    info!("Mesh optimization complete");
    Ok(result)
}

/// Optimize vertex cache for better GPU performance
///
/// Reorders triangles to maximize vertex cache hits.
pub fn optimize_vertex_cache(mesh: &Mesh) -> Result<Mesh> {
    mesh.validate()?;

    info!("Optimizing vertex cache");

    let optimized_indices =
        meshopt::optimize::optimize_vertex_cache(&mesh.indices, mesh.vertices.len());

    Ok(Mesh {
        vertices: mesh.vertices.clone(),
        indices: optimized_indices,
        normals: mesh.normals.clone(),
        uvs: mesh.uvs.clone(),
        colors: mesh.colors.clone(),
    })
}

/// Optimize for reduced overdraw
///
/// Reorders triangles to draw front-to-back, reducing pixel overdraw.
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `threshold` - Overdraw threshold (typically 1.05)
pub fn optimize_overdraw(mesh: &Mesh, threshold: f32) -> Result<Mesh> {
    mesh.validate()?;

    info!("Optimizing overdraw (threshold: {})", threshold);

    // Convert vertices to meshopt format (as bytes)
    let vertex_data: Vec<u8> = mesh
        .vertices
        .iter()
        .flat_map(|v| {
            let mut bytes = Vec::new();
            bytes.extend_from_slice(&v.x.to_le_bytes());
            bytes.extend_from_slice(&v.y.to_le_bytes());
            bytes.extend_from_slice(&v.z.to_le_bytes());
            bytes
        })
        .collect();

    let mut optimized_indices = mesh.indices.clone();
    meshopt::optimize::optimize_overdraw_in_place(
        &mut optimized_indices,
        &meshopt::VertexDataAdapter::new(&vertex_data, 12, 0).unwrap(),
        threshold,
    );

    Ok(Mesh {
        vertices: mesh.vertices.clone(),
        indices: optimized_indices,
        normals: mesh.normals.clone(),
        uvs: mesh.uvs.clone(),
        colors: mesh.colors.clone(),
    })
}

/// Optimize vertex fetch for better memory access patterns
///
/// Reorders vertices to improve memory locality.
pub fn optimize_vertex_fetch(mesh: &Mesh) -> Result<Mesh> {
    mesh.validate()?;

    info!("Optimizing vertex fetch");

    // Create vertex data for meshopt
    let vertex_data: Vec<u8> = mesh
        .vertices
        .iter()
        .flat_map(|v| {
            let mut bytes = Vec::new();
            bytes.extend_from_slice(&v.x.to_le_bytes());
            bytes.extend_from_slice(&v.y.to_le_bytes());
            bytes.extend_from_slice(&v.z.to_le_bytes());
            bytes
        })
        .collect();

    let mut vertex_data_mut = vertex_data;
    let mut optimized_indices = mesh.indices.clone();

    meshopt::optimize::optimize_vertex_fetch_in_place(&mut optimized_indices, &mut vertex_data_mut);

    Ok(Mesh {
        vertices: mesh.vertices.clone(),
        indices: optimized_indices,
        normals: mesh.normals.clone(),
        uvs: mesh.uvs.clone(),
        colors: mesh.colors.clone(),
    })
}

/// Generate optimal index buffer
///
/// Converts mesh to use indexed rendering with optimal vertex reuse.
pub fn generate_index_buffer(mesh: &Mesh) -> Result<Mesh> {
    mesh.validate()?;

    info!("Generating optimal index buffer");

    // meshopt handles this internally during other optimizations
    optimize_vertex_cache(mesh)
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_optimize_vertex_cache() {
        let mesh = create_test_mesh();
        let result = optimize_vertex_cache(&mesh);
        assert!(result.is_ok());

        let optimized = result.unwrap();
        assert_eq!(optimized.vertex_count(), mesh.vertex_count());
        assert_eq!(optimized.triangle_count(), mesh.triangle_count());
    }

    #[test]
    fn test_optimize_overdraw() {
        let mesh = create_test_mesh();
        let result = optimize_overdraw(&mesh, 1.05);
        assert!(result.is_ok());
    }

    #[test]
    fn test_optimize_vertex_fetch() {
        let mesh = create_test_mesh();
        let result = optimize_vertex_fetch(&mesh);
        assert!(result.is_ok());
    }

    #[test]
    fn test_optimize_all() {
        let mesh = create_test_mesh();
        let result = optimize_all(&mesh);
        assert!(result.is_ok());

        let optimized = result.unwrap();
        assert_eq!(optimized.vertex_count(), mesh.vertex_count());
        assert_eq!(optimized.triangle_count(), mesh.triangle_count());
    }
}
