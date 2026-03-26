//! Mesh smoothing algorithms

use crate::{Mesh, MeshError, Result};
use log::info;
use std::collections::HashMap;

/// Laplacian smoothing
///
/// Simple averaging of neighbor positions. May cause mesh shrinkage.
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `iterations` - Number of smoothing iterations
/// * `lambda` - Smoothing factor (0.0 to 1.0)
pub fn laplacian(mesh: &Mesh, iterations: usize, lambda: f32) -> Result<Mesh> {
    mesh.validate()?;

    if lambda < 0.0 || lambda > 1.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Lambda must be between 0.0 and 1.0, got {}",
            lambda
        )));
    }

    info!(
        "Laplacian smoothing: {} iterations, lambda {}",
        iterations, lambda
    );

    let mut result = mesh.clone();
    let adjacency = build_adjacency(&result);

    for iter in 0..iterations {
        let mut new_vertices = result.vertices.clone();

        for (vertex_idx, neighbors) in &adjacency {
            if neighbors.is_empty() {
                continue;
            }

            // Compute average of neighbors
            let mut sum = glam::Vec3::ZERO;
            for &neighbor_idx in neighbors {
                sum += result.vertices[neighbor_idx];
            }
            let avg = sum / neighbors.len() as f32;

            // Blend with current position
            new_vertices[*vertex_idx] =
                result.vertices[*vertex_idx] * (1.0 - lambda) + avg * lambda;
        }

        result.vertices = new_vertices;

        if (iter + 1) % 10 == 0 {
            info!("Completed iteration {}/{}", iter + 1, iterations);
        }
    }

    // Recompute normals
    result.compute_normals();

    Ok(result)
}

/// Taubin smoothing
///
/// Two-step smoothing (inflate/deflate) that prevents shrinkage.
/// Better shape preservation than Laplacian.
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `iterations` - Number of smoothing iterations
/// * `lambda` - Positive smoothing factor (typically 0.5)
/// * `mu` - Negative smoothing factor (typically -0.53)
pub fn taubin(mesh: &Mesh, iterations: usize, lambda: f32, mu: f32) -> Result<Mesh> {
    mesh.validate()?;

    if lambda <= 0.0 || lambda > 1.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Lambda must be between 0.0 and 1.0, got {}",
            lambda
        )));
    }

    if mu >= 0.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Mu must be negative, got {}",
            mu
        )));
    }

    info!(
        "Taubin smoothing: {} iterations, lambda {}, mu {}",
        iterations, lambda, mu
    );

    let mut result = mesh.clone();
    let adjacency = build_adjacency(&result);

    for iter in 0..iterations {
        // Step 1: Inflate (positive lambda)
        result = smooth_step(&result, &adjacency, lambda);

        // Step 2: Deflate (negative mu)
        result = smooth_step(&result, &adjacency, mu);

        if (iter + 1) % 10 == 0 {
            info!("Completed iteration {}/{}", iter + 1, iterations);
        }
    }

    // Recompute normals
    result.compute_normals();

    Ok(result)
}

/// HC (Humphrey's Classes) smoothing
///
/// High-quality smoothing with better feature preservation.
///
/// # Arguments
/// * `mesh` - Input mesh
/// * `iterations` - Number of smoothing iterations
/// * `alpha` - Smoothing factor (0.0 to 1.0)
/// * `beta` - Feature preservation factor (0.0 to 1.0)
pub fn hc(mesh: &Mesh, iterations: usize, alpha: f32, beta: f32) -> Result<Mesh> {
    mesh.validate()?;

    if alpha < 0.0 || alpha > 1.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Alpha must be between 0.0 and 1.0, got {}",
            alpha
        )));
    }

    if beta < 0.0 || beta > 1.0 {
        return Err(MeshError::InvalidParameter(format!(
            "Beta must be between 0.0 and 1.0, got {}",
            beta
        )));
    }

    info!(
        "HC smoothing: {} iterations, alpha {}, beta {}",
        iterations, alpha, beta
    );

    let mut result = mesh.clone();
    let adjacency = build_adjacency(&result);
    let original_vertices = result.vertices.clone();

    for iter in 0..iterations {
        // Compute Laplacian
        let mut laplacian = vec![glam::Vec3::ZERO; result.vertices.len()];
        for (vertex_idx, neighbors) in &adjacency {
            if neighbors.is_empty() {
                continue;
            }

            let mut sum = glam::Vec3::ZERO;
            for &neighbor_idx in neighbors {
                sum += result.vertices[neighbor_idx];
            }
            let avg = sum / neighbors.len() as f32;
            laplacian[*vertex_idx] = avg - result.vertices[*vertex_idx];
        }

        // Apply smoothing
        let mut new_vertices = result.vertices.clone();
        for i in 0..result.vertices.len() {
            new_vertices[i] = result.vertices[i] + laplacian[i] * alpha;
        }

        // Apply feature preservation
        for i in 0..result.vertices.len() {
            let diff = original_vertices[i] - new_vertices[i];
            new_vertices[i] += diff * beta;
        }

        result.vertices = new_vertices;

        if (iter + 1) % 10 == 0 {
            info!("Completed iteration {}/{}", iter + 1, iterations);
        }
    }

    // Recompute normals
    result.compute_normals();

    Ok(result)
}

/// Single smoothing step (helper for Taubin)
fn smooth_step(mesh: &Mesh, adjacency: &HashMap<usize, Vec<usize>>, factor: f32) -> Mesh {
    let mut result = mesh.clone();
    let mut new_vertices = result.vertices.clone();

    for (vertex_idx, neighbors) in adjacency {
        if neighbors.is_empty() {
            continue;
        }

        let mut sum = glam::Vec3::ZERO;
        for &neighbor_idx in neighbors {
            sum += result.vertices[neighbor_idx];
        }
        let avg = sum / neighbors.len() as f32;

        new_vertices[*vertex_idx] = result.vertices[*vertex_idx] * (1.0 - factor) + avg * factor;
    }

    result.vertices = new_vertices;
    result
}

/// Build vertex adjacency map
fn build_adjacency(mesh: &Mesh) -> HashMap<usize, Vec<usize>> {
    let mut adjacency: HashMap<usize, Vec<usize>> = HashMap::new();

    // Initialize all vertices
    for i in 0..mesh.vertices.len() {
        adjacency.insert(i, Vec::new());
    }

    // Build adjacency from triangles
    for tri_idx in 0..mesh.triangle_count() {
        let base = tri_idx * 3;
        let i0 = mesh.indices[base] as usize;
        let i1 = mesh.indices[base + 1] as usize;
        let i2 = mesh.indices[base + 2] as usize;

        // Add edges (bidirectional)
        add_edge(&mut adjacency, i0, i1);
        add_edge(&mut adjacency, i1, i2);
        add_edge(&mut adjacency, i2, i0);
    }

    adjacency
}

/// Add bidirectional edge to adjacency map
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
    fn test_laplacian_smoothing() {
        let mesh = create_test_mesh();
        let result = laplacian(&mesh, 5, 0.5);
        assert!(result.is_ok());

        let smoothed = result.unwrap();
        assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
        assert_eq!(smoothed.triangle_count(), mesh.triangle_count());
    }

    #[test]
    fn test_taubin_smoothing() {
        let mesh = create_test_mesh();
        let result = taubin(&mesh, 10, 0.5, -0.53);
        assert!(result.is_ok());

        let smoothed = result.unwrap();
        assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
    }

    #[test]
    fn test_hc_smoothing() {
        let mesh = create_test_mesh();
        let result = hc(&mesh, 5, 0.5, 0.5);
        assert!(result.is_ok());

        let smoothed = result.unwrap();
        assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
    }

    #[test]
    fn test_build_adjacency() {
        let mesh = create_test_mesh();
        let adjacency = build_adjacency(&mesh);

        assert_eq!(adjacency.len(), 4);
        assert!(adjacency[&0].contains(&1));
        assert!(adjacency[&0].contains(&3));
        assert!(adjacency[&1].contains(&0));
        assert!(adjacency[&1].contains(&2));
    }

    #[test]
    fn test_invalid_parameters() {
        let mesh = create_test_mesh();
        assert!(laplacian(&mesh, 5, 1.5).is_err());
        assert!(taubin(&mesh, 5, 0.5, 0.5).is_err()); // mu must be negative
        assert!(hc(&mesh, 5, 1.5, 0.5).is_err());
    }
}
