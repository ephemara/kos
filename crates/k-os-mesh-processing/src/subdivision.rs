//! Mesh subdivision algorithms

use crate::{Mesh, Result};
use glam::Vec3;
use log::info;
use std::collections::HashMap;

/// Simple midpoint subdivision
///
/// Subdivides each triangle into 4 triangles by adding midpoint vertices.
/// No smoothing applied.
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `levels` - Number of subdivision levels
pub fn simple(mesh: &Mesh, levels: usize) -> Result<Mesh> {
    mesh.validate()?;

    if levels == 0 {
        return Ok(mesh.clone());
    }

    info!("Simple subdivision: {} levels", levels);

    let mut result = mesh.clone();

    for level in 0..levels {
        result = subdivide_once(&result)?;
        info!(
            "Level {}/{}: {} vertices, {} triangles",
            level + 1,
            levels,
            result.vertex_count(),
            result.triangle_count()
        );
    }

    result.compute_normals();
    Ok(result)
}

/// Loop subdivision for triangle meshes
///
/// Smooth subdivision scheme for triangle meshes.
///
/// # Arguments
/// * `mesh` - Input mesh (must be triangulated)
/// * `levels` - Number of subdivision levels
pub fn loop_subdivision(mesh: &Mesh, levels: usize) -> Result<Mesh> {
    mesh.validate()?;

    if levels == 0 {
        return Ok(mesh.clone());
    }

    info!("Loop subdivision: {} levels", levels);

    let mut result = mesh.clone();

    for level in 0..levels {
        result = loop_subdivide_once(&result)?;
        info!(
            "Level {}/{}: {} vertices, {} triangles",
            level + 1,
            levels,
            result.vertex_count(),
            result.triangle_count()
        );
    }

    result.compute_normals();
    Ok(result)
}

/// Catmull-Clark subdivision for quad meshes
///
/// Smooth subdivision scheme for quad meshes.
/// Note: This is a simplified implementation that works on triangle meshes
/// by treating pairs of triangles as quads.
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `levels` - Number of subdivision levels
pub fn catmull_clark(mesh: &Mesh, levels: usize) -> Result<Mesh> {
    mesh.validate()?;

    if levels == 0 {
        return Ok(mesh.clone());
    }

    info!("Catmull-Clark subdivision: {} levels", levels);

    // For now, use Loop subdivision as a placeholder
    // Full Catmull-Clark requires quad mesh support
    loop_subdivision(mesh, levels)
}

/// Subdivide mesh once (simple midpoint)
fn subdivide_once(mesh: &Mesh) -> Result<Mesh> {
    let mut new_vertices = mesh.vertices.clone();
    let mut new_indices = Vec::new();
    let mut edge_midpoints: HashMap<(u32, u32), u32> = HashMap::new();

    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base];
        let i1 = mesh.indices[base + 1];
        let i2 = mesh.indices[base + 2];

        // Get or create midpoint vertices
        let m01 = get_or_create_midpoint(
            &mut new_vertices,
            &mut edge_midpoints,
            i0,
            i1,
            &mesh.vertices,
        );
        let m12 = get_or_create_midpoint(
            &mut new_vertices,
            &mut edge_midpoints,
            i1,
            i2,
            &mesh.vertices,
        );
        let m20 = get_or_create_midpoint(
            &mut new_vertices,
            &mut edge_midpoints,
            i2,
            i0,
            &mesh.vertices,
        );

        // Create 4 new triangles
        new_indices.extend_from_slice(&[i0, m01, m20]);
        new_indices.extend_from_slice(&[i1, m12, m01]);
        new_indices.extend_from_slice(&[i2, m20, m12]);
        new_indices.extend_from_slice(&[m01, m12, m20]);
    }

    Ok(Mesh::from_vertices_indices(new_vertices, new_indices))
}

/// Loop subdivision (one level)
fn loop_subdivide_once(mesh: &Mesh) -> Result<Mesh> {
    // Build adjacency for smooth vertex positions
    let adjacency = build_adjacency(mesh);

    let mut new_vertices = mesh.vertices.clone();
    let mut new_indices = Vec::new();
    let mut edge_midpoints: HashMap<(u32, u32), u32> = HashMap::new();

    // Update existing vertex positions (Loop weights)
    for (vertex_idx, neighbors) in &adjacency {
        if neighbors.is_empty() {
            continue;
        }

        let n = neighbors.len() as f32;
        let beta = if n > 3.0 { 3.0 / (8.0 * n) } else { 3.0 / 16.0 };

        let mut sum = Vec3::ZERO;
        for &neighbor_idx in neighbors {
            sum += mesh.vertices[neighbor_idx];
        }

        new_vertices[*vertex_idx] = mesh.vertices[*vertex_idx] * (1.0 - n * beta) + sum * beta;
    }

    // Subdivide triangles
    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base];
        let i1 = mesh.indices[base + 1];
        let i2 = mesh.indices[base + 2];

        // Get or create edge midpoints
        let m01 = get_or_create_midpoint(
            &mut new_vertices,
            &mut edge_midpoints,
            i0,
            i1,
            &mesh.vertices,
        );
        let m12 = get_or_create_midpoint(
            &mut new_vertices,
            &mut edge_midpoints,
            i1,
            i2,
            &mesh.vertices,
        );
        let m20 = get_or_create_midpoint(
            &mut new_vertices,
            &mut edge_midpoints,
            i2,
            i0,
            &mesh.vertices,
        );

        // Create 4 new triangles
        new_indices.extend_from_slice(&[i0, m01, m20]);
        new_indices.extend_from_slice(&[i1, m12, m01]);
        new_indices.extend_from_slice(&[i2, m20, m12]);
        new_indices.extend_from_slice(&[m01, m12, m20]);
    }

    Ok(Mesh::from_vertices_indices(new_vertices, new_indices))
}

/// Get or create midpoint vertex for an edge
fn get_or_create_midpoint(
    vertices: &mut Vec<Vec3>,
    edge_map: &mut HashMap<(u32, u32), u32>,
    v0: u32,
    v1: u32,
    original_vertices: &[Vec3],
) -> u32 {
    let edge = if v0 < v1 { (v0, v1) } else { (v1, v0) };

    if let Some(&midpoint_idx) = edge_map.get(&edge) {
        return midpoint_idx;
    }

    let midpoint = (original_vertices[v0 as usize] + original_vertices[v1 as usize]) * 0.5;
    let new_idx = vertices.len() as u32;
    vertices.push(midpoint);
    edge_map.insert(edge, new_idx);
    new_idx
}

/// Build vertex adjacency
fn build_adjacency(mesh: &Mesh) -> HashMap<usize, Vec<usize>> {
    let mut adjacency: HashMap<usize, Vec<usize>> = HashMap::new();

    for i in 0..mesh.vertices.len() {
        adjacency.insert(i, Vec::new());
    }

    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base] as usize;
        let i1 = mesh.indices[base + 1] as usize;
        let i2 = mesh.indices[base + 2] as usize;

        add_edge(&mut adjacency, i0, i1);
        add_edge(&mut adjacency, i1, i2);
        add_edge(&mut adjacency, i2, i0);
    }

    adjacency
}

fn add_edge(adjacency: &mut HashMap<usize, Vec<usize>>, v0: usize, v1: usize) {
    if let Some(neighbors) = adjacency.get_mut(&v0) {
        if !neighbors.contains(&v1) {
            neighbors.push(v1);
        }
    }
    if let Some(neighbors) = adjacency.get_mut(&v1) {
        if !neighbors.contains(&v0) {
            neighbors.push(v0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_mesh() -> Mesh {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        Mesh::from_vertices_indices(vertices, indices)
    }

    #[test]
    fn test_simple_subdivision() {
        let mesh = create_test_mesh();
        let result = simple(&mesh, 1);
        assert!(result.is_ok());

        let subdivided = result.unwrap();
        assert_eq!(subdivided.triangle_count(), 4); // 1 triangle -> 4 triangles
    }

    #[test]
    fn test_loop_subdivision() {
        let mesh = create_test_mesh();
        let result = loop_subdivision(&mesh, 1);
        assert!(result.is_ok());

        let subdivided = result.unwrap();
        assert_eq!(subdivided.triangle_count(), 4);
    }

    #[test]
    fn test_multiple_levels() {
        let mesh = create_test_mesh();
        let result = simple(&mesh, 2);
        assert!(result.is_ok());

        let subdivided = result.unwrap();
        assert_eq!(subdivided.triangle_count(), 16); // 1 -> 4 -> 16
    }

    #[test]
    fn test_zero_levels() {
        let mesh = create_test_mesh();
        let result = simple(&mesh, 0);
        assert!(result.is_ok());

        let subdivided = result.unwrap();
        assert_eq!(subdivided.triangle_count(), mesh.triangle_count());
    }
}
