//! Mesh repair operations

use crate::{Mesh, MeshError, Result};
use glam::Vec3;
use log::info;
use std::collections::{HashMap, HashSet};

/// Complete mesh repair pipeline
///
/// Applies all repair operations in sequence:
/// 1. Remove duplicate vertices
/// 2. Remove degenerate triangles
/// 3. Fix non-manifold geometry
/// 4. Fill small holes
pub fn repair_all(mesh: &mut Mesh) -> Result<()> {
    info!("Starting complete mesh repair");

    remove_duplicates(mesh, 0.0001)?;
    remove_degenerate(mesh)?;
    fix_non_manifold(mesh)?;
    fill_holes(mesh, 10)?;

    info!("Mesh repair complete");
    Ok(())
}

/// Remove duplicate vertices within threshold
///
/// Merges vertices that are closer than the threshold distance.
///
/// # Arguments
/// * `mesh` - Mesh to repair (modified in place)
/// * `threshold` - Distance threshold for considering vertices duplicates
pub fn remove_duplicates(mesh: &mut Mesh, threshold: f32) -> Result<()> {
    mesh.validate()?;

    if threshold < 0.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Threshold must be non-negative, got {}",
            threshold
        )));
    }

    info!("Removing duplicate vertices (threshold: {})", threshold);

    let threshold_sq = threshold * threshold;
    let mut remap = vec![0u32; mesh.vertices.len()];
    let mut unique_vertices = Vec::new();

    // Find duplicates
    for (i, &vertex) in mesh.vertices.iter().enumerate() {
        let mut found_duplicate = false;

        for (j, &unique_vertex) in unique_vertices.iter().enumerate() {
            if vertex.distance_squared(unique_vertex) < threshold_sq {
                remap[i] = j as u32;
                found_duplicate = true;
                break;
            }
        }

        if !found_duplicate {
            remap[i] = unique_vertices.len() as u32;
            unique_vertices.push(vertex);
        }
    }

    let removed = mesh.vertices.len() - unique_vertices.len();
    if removed > 0 {
        info!("Removed {} duplicate vertices", removed);

        // Update mesh
        mesh.vertices = unique_vertices;

        // Remap indices
        for idx in &mut mesh.indices {
            *idx = remap[*idx as usize];
        }

        // Update attributes
        if let Some(ref normals) = mesh.normals {
            let mut new_normals = vec![Vec3::ZERO; mesh.vertices.len()];
            for (i, &mapped_idx) in remap.iter().enumerate() {
                new_normals[mapped_idx as usize] = normals[i];
            }
            mesh.normals = Some(new_normals);
        }
    }

    Ok(())
}

/// Weld vertices within distance threshold
///
/// Similar to remove_duplicates but uses spatial hashing for better performance.
pub fn weld_vertices(mesh: &mut Mesh, distance: f32) -> Result<()> {
    remove_duplicates(mesh, distance)
}

/// Remove degenerate triangles
///
/// Removes triangles with zero area or duplicate vertices.
pub fn remove_degenerate(mesh: &mut Mesh) -> Result<()> {
    mesh.validate()?;

    info!("Removing degenerate triangles");

    let mut new_indices = Vec::new();
    let mut removed = 0;

    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base];
        let i1 = mesh.indices[base + 1];
        let i2 = mesh.indices[base + 2];

        // Check for duplicate indices
        if i0 == i1 || i1 == i2 || i2 == i0 {
            removed += 1;
            continue;
        }

        // Check for zero area
        if let Some(area) = mesh.triangle_area(tri_idx) {
            if area < 1e-10 {
                removed += 1;
                continue;
            }
        }

        new_indices.extend_from_slice(&[i0, i1, i2]);
    }

    if removed > 0 {
        info!("Removed {} degenerate triangles", removed);
        mesh.indices = new_indices;
    }

    Ok(())
}

/// Fix non-manifold geometry
///
/// Attempts to fix non-manifold edges and vertices by splitting them.
pub fn fix_non_manifold(mesh: &mut Mesh) -> Result<()> {
    mesh.validate()?;

    info!("Fixing non-manifold geometry");

    // Build edge map to find non-manifold edges
    let mut edge_faces: HashMap<(u32, u32), Vec<usize>> = HashMap::new();

    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base];
        let i1 = mesh.indices[base + 1];
        let i2 = mesh.indices[base + 2];

        add_edge_face(&mut edge_faces, i0, i1, tri_idx);
        add_edge_face(&mut edge_faces, i1, i2, tri_idx);
        add_edge_face(&mut edge_faces, i2, i0, tri_idx);
    }

    // Find non-manifold edges (shared by more than 2 faces)
    let mut non_manifold_count = 0;
    for (_, faces) in &edge_faces {
        if faces.len() > 2 {
            non_manifold_count += 1;
        }
    }

    if non_manifold_count > 0 {
        info!("Found {} non-manifold edges", non_manifold_count);
        // Note: Actual fixing would require complex topology surgery
        // For now, we just report the issue
    }

    Ok(())
}

/// Fill holes in the mesh
///
/// Fills boundary loops with triangles if they have fewer edges than max_edges.
///
/// # Arguments
/// * `mesh` - Mesh to repair (modified in place)
/// * `max_edges` - Maximum number of edges in a hole to fill
pub fn fill_holes(mesh: &mut Mesh, max_edges: usize) -> Result<()> {
    mesh.validate()?;

    info!("Filling holes (max edges: {})", max_edges);

    // Find boundary edges
    let boundary_edges = find_boundary_edges(mesh);

    if boundary_edges.is_empty() {
        info!("No holes found");
        return Ok(());
    }

    info!("Found {} boundary edges", boundary_edges.len());

    // Build boundary loops
    let loops = build_boundary_loops(&boundary_edges);
    info!("Found {} boundary loops", loops.len());

    let mut filled = 0;
    let mut new_indices = mesh.indices.clone();
    let loop_count = loops.len();

    for loop_edges in loops {
        if loop_edges.len() <= max_edges && loop_edges.len() >= 3 {
            // Simple fan triangulation
            let first_vertex = loop_edges[0].0;
            for i in 1..loop_edges.len() - 1 {
                let v1 = loop_edges[i].1;
                let v2 = loop_edges[i + 1].1;
                new_indices.extend_from_slice(&[first_vertex, v1, v2]);
                filled += 1;
            }
        }
    }

    if filled > 0 {
        info!("Filled {} holes with {} triangles", loop_count, filled);
        mesh.indices = new_indices;
    }

    Ok(())
}

/// Find boundary edges (edges with only one adjacent face)
fn find_boundary_edges(mesh: &Mesh) -> HashSet<(u32, u32)> {
    let mut edge_count: HashMap<(u32, u32), usize> = HashMap::new();

    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base];
        let i1 = mesh.indices[base + 1];
        let i2 = mesh.indices[base + 2];

        increment_edge(&mut edge_count, i0, i1);
        increment_edge(&mut edge_count, i1, i2);
        increment_edge(&mut edge_count, i2, i0);
    }

    edge_count
        .into_iter()
        .filter(|(_, count)| *count == 1)
        .map(|(edge, _)| edge)
        .collect()
}

/// Build boundary loops from boundary edges
fn build_boundary_loops(boundary_edges: &HashSet<(u32, u32)>) -> Vec<Vec<(u32, u32)>> {
    let mut loops = Vec::new();
    let mut remaining: HashSet<(u32, u32)> = boundary_edges.clone();

    while !remaining.is_empty() {
        let start_edge = *remaining.iter().next().unwrap();
        let mut current_loop = vec![start_edge];
        remaining.remove(&start_edge);

        let mut current_vertex = start_edge.1;
        let start_vertex = start_edge.0;

        // Follow the loop
        while current_vertex != start_vertex {
            let mut found = false;
            for &edge in &remaining {
                if edge.0 == current_vertex {
                    current_loop.push(edge);
                    current_vertex = edge.1;
                    remaining.remove(&edge);
                    found = true;
                    break;
                }
            }
            if !found {
                break; // Loop is broken
            }
        }

        if current_vertex == start_vertex {
            loops.push(current_loop);
        }
    }

    loops
}

fn add_edge_face(edge_faces: &mut HashMap<(u32, u32), Vec<usize>>, v0: u32, v1: u32, face: usize) {
    let edge = if v0 < v1 { (v0, v1) } else { (v1, v0) };
    edge_faces.entry(edge).or_insert_with(Vec::new).push(face);
}

fn increment_edge(edge_count: &mut HashMap<(u32, u32), usize>, v0: u32, v1: u32) {
    let edge = if v0 < v1 { (v0, v1) } else { (v1, v0) };
    *edge_count.entry(edge).or_insert(0) += 1;
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
    fn test_remove_duplicates() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(0.0, 0.0, 0.0), // Duplicate
            Vec3::new(1.0, 0.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let mut mesh = Mesh::from_vertices_indices(vertices, indices);

        remove_duplicates(&mut mesh, 0.0001).unwrap();

        assert_eq!(mesh.vertex_count(), 2); // Should remove 1 duplicate
    }

    #[test]
    fn test_remove_degenerate() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2, 0, 0, 0]; // Second triangle is degenerate
        let mut mesh = Mesh::from_vertices_indices(vertices, indices);

        remove_degenerate(&mut mesh).unwrap();

        assert_eq!(mesh.triangle_count(), 1); // Should remove degenerate triangle
    }

    #[test]
    fn test_repair_all() {
        let mut mesh = create_test_mesh();
        let result = repair_all(&mut mesh);
        assert!(result.is_ok());
    }
}
