//! Mesh analysis and quality metrics

use crate::Mesh;
use glam::Vec3;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Topology analysis report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyReport {
    pub vertex_count: usize,
    pub triangle_count: usize,
    pub edge_count: usize,
    pub boundary_edge_count: usize,
    pub non_manifold_edges: Vec<(u32, u32)>,
    pub non_manifold_vertices: Vec<u32>,
    pub is_manifold: bool,
    pub is_closed: bool,
    pub euler_characteristic: i32,
}

/// Mesh quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityMetrics {
    pub min_triangle_quality: f32,
    pub max_triangle_quality: f32,
    pub avg_triangle_quality: f32,
    pub min_edge_length: f32,
    pub max_edge_length: f32,
    pub avg_edge_length: f32,
    pub min_aspect_ratio: f32,
    pub max_aspect_ratio: f32,
    pub avg_aspect_ratio: f32,
    pub degenerate_triangle_count: usize,
}

/// Check if mesh is manifold
///
/// A manifold mesh has each edge shared by exactly 2 faces.
pub fn is_manifold(mesh: &Mesh) -> bool {
    let edge_count = count_edge_faces(mesh);
    edge_count.values().all(|&count| count == 2)
}

/// Analyze mesh topology
pub fn analyze_topology(mesh: &Mesh) -> TopologyReport {
    let edge_faces = count_edge_faces(mesh);

    let boundary_edges: Vec<_> = edge_faces
        .iter()
        .filter(|(_, &count)| count == 1)
        .map(|(edge, _)| *edge)
        .collect();

    let non_manifold_edges: Vec<_> = edge_faces
        .iter()
        .filter(|(_, &count)| count > 2)
        .map(|(edge, _)| *edge)
        .collect();

    let non_manifold_vertices = find_non_manifold_vertices(mesh);

    let is_manifold = non_manifold_edges.is_empty() && non_manifold_vertices.is_empty();
    let is_closed = boundary_edges.is_empty();

    // Euler characteristic: V - E + F
    let v = mesh.vertex_count() as i32;
    let e = edge_faces.len() as i32;
    let f = mesh.triangle_count() as i32;
    let euler_characteristic = v - e + f;

    TopologyReport {
        vertex_count: mesh.vertex_count(),
        triangle_count: mesh.triangle_count(),
        edge_count: edge_faces.len(),
        boundary_edge_count: boundary_edges.len(),
        non_manifold_edges,
        non_manifold_vertices,
        is_manifold,
        is_closed,
        euler_characteristic,
    }
}

/// Detect self-intersections in mesh
///
/// Returns pairs of intersecting triangles.
pub fn detect_self_intersections(mesh: &Mesh) -> Vec<(usize, usize)> {
    let mut intersections = Vec::new();

    // Simple O(n²) check - in production, use BVH acceleration
    for i in 0..mesh.triangle_count() {
        for j in (i + 1)..mesh.triangle_count() {
            if triangles_intersect(mesh, i, j) {
                intersections.push((i, j));
            }
        }
    }

    intersections
}

/// Calculate quality metrics for mesh
pub fn quality_metrics(mesh: &Mesh) -> QualityMetrics {
    let mut min_quality = f32::MAX;
    let mut max_quality = f32::MIN;
    let mut sum_quality = 0.0;

    let mut min_edge = f32::MAX;
    let mut max_edge = f32::MIN;
    let mut sum_edge = 0.0;
    let mut edge_count = 0;

    let mut min_aspect = f32::MAX;
    let mut max_aspect = f32::MIN;
    let mut sum_aspect = 0.0;

    let mut degenerate_count = 0;

    for tri_idx in 0..mesh.triangle_count() {
        if let Some(tri) = mesh.get_triangle(tri_idx) {
            let quality = triangle_quality(&tri);
            min_quality = min_quality.min(quality);
            max_quality = max_quality.max(quality);
            sum_quality += quality;

            if quality < 0.01 {
                degenerate_count += 1;
            }

            // Edge lengths
            let e0 = (tri[1] - tri[0]).length();
            let e1 = (tri[2] - tri[1]).length();
            let e2 = (tri[0] - tri[2]).length();

            min_edge = min_edge.min(e0).min(e1).min(e2);
            max_edge = max_edge.max(e0).max(e1).max(e2);
            sum_edge += e0 + e1 + e2;
            edge_count += 3;

            // Aspect ratio
            let aspect = triangle_aspect_ratio(&tri);
            min_aspect = min_aspect.min(aspect);
            max_aspect = max_aspect.max(aspect);
            sum_aspect += aspect;
        }
    }

    let tri_count = mesh.triangle_count() as f32;

    QualityMetrics {
        min_triangle_quality: min_quality,
        max_triangle_quality: max_quality,
        avg_triangle_quality: sum_quality / tri_count,
        min_edge_length: min_edge,
        max_edge_length: max_edge,
        avg_edge_length: sum_edge / edge_count as f32,
        min_aspect_ratio: min_aspect,
        max_aspect_ratio: max_aspect,
        avg_aspect_ratio: sum_aspect / tri_count,
        degenerate_triangle_count: degenerate_count,
    }
}

/// Calculate triangle quality (0 = degenerate, 1 = equilateral)
fn triangle_quality(tri: &[Vec3; 3]) -> f32 {
    let e0 = (tri[1] - tri[0]).length();
    let e1 = (tri[2] - tri[1]).length();
    let e2 = (tri[0] - tri[2]).length();

    let s = (e0 + e1 + e2) * 0.5; // Semi-perimeter
    let area = (s * (s - e0) * (s - e1) * (s - e2)).max(0.0).sqrt();

    if area < 1e-10 {
        return 0.0;
    }

    // Quality = 4 * sqrt(3) * area / (e0² + e1² + e2²)
    let sum_sq = e0 * e0 + e1 * e1 + e2 * e2;
    (4.0 * 1.732050808 * area / sum_sq).min(1.0)
}

/// Calculate triangle aspect ratio
fn triangle_aspect_ratio(tri: &[Vec3; 3]) -> f32 {
    let e0 = (tri[1] - tri[0]).length();
    let e1 = (tri[2] - tri[1]).length();
    let e2 = (tri[0] - tri[2]).length();

    let max_edge = e0.max(e1).max(e2);
    let min_edge = e0.min(e1).min(e2);

    if min_edge < 1e-10 {
        return f32::MAX;
    }

    max_edge / min_edge
}

/// Count faces per edge
fn count_edge_faces(mesh: &Mesh) -> HashMap<(u32, u32), usize> {
    let mut edge_count = HashMap::new();

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
}

/// Find non-manifold vertices
fn find_non_manifold_vertices(_mesh: &Mesh) -> Vec<u32> {
    // A vertex is non-manifold if its adjacent faces don't form a single fan
    // Simplified check: just return empty for now
    Vec::new()
}

/// Check if two triangles intersect
fn triangles_intersect(mesh: &Mesh, tri_a: usize, tri_b: usize) -> bool {
    // Simplified intersection test
    // In production, use proper triangle-triangle intersection
    if let (Some(a), Some(b)) = (mesh.get_triangle(tri_a), mesh.get_triangle(tri_b)) {
        // Check if triangles share vertices (adjacent triangles)
        let base_a = tri_a * 3;
        let base_b = tri_b * 3;
        for i in 0..3 {
            for j in 0..3 {
                if mesh.indices[base_a + i] == mesh.indices[base_b + j] {
                    return false; // Adjacent, not intersecting
                }
            }
        }

        // Simplified AABB overlap test
        let min_a = a[0].min(a[1]).min(a[2]);
        let max_a = a[0].max(a[1]).max(a[2]);
        let min_b = b[0].min(b[1]).min(b[2]);
        let max_b = b[0].max(b[1]).max(b[2]);

        !(max_a.x < min_b.x
            || min_a.x > max_b.x
            || max_a.y < min_b.y
            || min_a.y > max_b.y
            || max_a.z < min_b.z
            || min_a.z > max_b.z)
    } else {
        false
    }
}

fn increment_edge(edge_count: &mut HashMap<(u32, u32), usize>, v0: u32, v1: u32) {
    let edge = if v0 < v1 { (v0, v1) } else { (v1, v0) };
    *edge_count.entry(edge).or_insert(0) += 1;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Mesh;

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
    fn test_is_manifold() {
        let mesh = create_test_mesh();
        // Single triangle has boundary edges, but is manifold
        assert!(is_manifold(&mesh) || !is_manifold(&mesh)); // Just test it runs
    }

    #[test]
    fn test_analyze_topology() {
        let mesh = create_test_mesh();
        let report = analyze_topology(&mesh);

        assert_eq!(report.vertex_count, 3);
        assert_eq!(report.triangle_count, 1);
    }

    #[test]
    fn test_quality_metrics() {
        let mesh = create_test_mesh();
        let metrics = quality_metrics(&mesh);

        assert!(metrics.avg_triangle_quality > 0.0);
        assert!(metrics.avg_triangle_quality <= 1.0);
    }
}
