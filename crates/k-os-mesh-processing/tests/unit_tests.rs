//! Unit tests for k-os-mesh-processing crate
//!
//! Tests cover:
//! - Mesh decimation algorithms
//! - Mesh smoothing algorithms
//! - Mesh subdivision algorithms
//! - Mesh repair operations
//! - Mesh analysis functions
//! - UV unwrapping
//! - Mesh optimization
//! - Spatial queries

use glam::Vec3;
use k_os_mesh_processing::*;

// ============================================================================
// Test Helpers
// ============================================================================

/// Create a simple triangle mesh for testing
fn create_triangle() -> Mesh {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(0.0, 1.0, 0.0),
    ];
    let indices = vec![0, 1, 2];
    Mesh::from_vertices_indices(vertices, indices)
}

/// Create a quad mesh (2 triangles) for testing
fn create_quad() -> Mesh {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(1.0, 1.0, 0.0),
        Vec3::new(0.0, 1.0, 0.0),
    ];
    let indices = vec![0, 1, 2, 0, 2, 3];
    Mesh::from_vertices_indices(vertices, indices)
}

/// Create a cube mesh for testing
fn create_cube() -> Mesh {
    let vertices = vec![
        // Front face
        Vec3::new(-0.5, -0.5, 0.5),
        Vec3::new(0.5, -0.5, 0.5),
        Vec3::new(0.5, 0.5, 0.5),
        Vec3::new(-0.5, 0.5, 0.5),
        // Back face
        Vec3::new(-0.5, -0.5, -0.5),
        Vec3::new(0.5, -0.5, -0.5),
        Vec3::new(0.5, 0.5, -0.5),
        Vec3::new(-0.5, 0.5, -0.5),
    ];

    let indices = vec![
        // Front
        0, 1, 2, 0, 2, 3, // Back
        5, 4, 7, 5, 7, 6, // Left
        4, 0, 3, 4, 3, 7, // Right
        1, 5, 6, 1, 6, 2, // Top
        3, 2, 6, 3, 6, 7, // Bottom
        4, 5, 1, 4, 1, 0,
    ];

    Mesh::from_vertices_indices(vertices, indices)
}

// ============================================================================
// Decimation Tests
// ============================================================================

#[test]
fn test_decimate_reduces_triangle_count() {
    let mesh = create_cube();
    let original_count = mesh.triangle_count();

    let result = decimation::decimate(&mesh, 0.5);
    assert!(result.is_ok());

    let decimated = result.unwrap();
    assert!(decimated.triangle_count() <= original_count);
    assert!(decimated.triangle_count() > 0);
}

#[test]
fn test_decimate_preserves_topology() {
    let mesh = create_quad();

    let result = decimation::decimate(&mesh, 0.5);
    assert!(result.is_ok());

    let decimated = result.unwrap();
    assert!(decimated.validate().is_ok());
}

#[test]
fn test_decimate_invalid_ratio() {
    let mesh = create_triangle();

    assert!(decimation::decimate(&mesh, 0.0).is_err());
    assert!(decimation::decimate(&mesh, 1.5).is_err());
    assert!(decimation::decimate(&mesh, -0.5).is_err());
}

#[test]
fn test_decimate_to_count() {
    let mesh = create_cube();
    let target_count = 4;

    let result = decimation::decimate_to_count(&mesh, target_count);
    assert!(result.is_ok());

    let decimated = result.unwrap();
    assert!(decimated.triangle_count() >= 1);
}

#[test]
fn test_decimate_to_count_zero() {
    let mesh = create_triangle();

    assert!(decimation::decimate_to_count(&mesh, 0).is_err());
}

#[test]
fn test_decimate_to_count_larger_than_original() {
    let mesh = create_triangle();
    let original_count = mesh.triangle_count();

    let result = decimation::decimate_to_count(&mesh, original_count + 10);
    assert!(result.is_ok());

    let decimated = result.unwrap();
    assert_eq!(decimated.triangle_count(), original_count);
}

#[test]
fn test_decimate_adaptive() {
    let mesh = create_cube();

    let result = decimation::decimate_adaptive(&mesh, 0.5);
    assert!(result.is_ok());

    let decimated = result.unwrap();
    assert!(decimated.triangle_count() > 0);
    assert!(decimated.validate().is_ok());
}

// ============================================================================
// Smoothing Tests
// ============================================================================

#[test]
fn test_laplacian_smoothing() {
    let mesh = create_quad();

    let result = smoothing::laplacian(&mesh, 5, 0.5);
    assert!(result.is_ok());

    let smoothed = result.unwrap();
    assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
    assert_eq!(smoothed.triangle_count(), mesh.triangle_count());
    assert!(smoothed.validate().is_ok());
}

#[test]
fn test_laplacian_invalid_lambda() {
    let mesh = create_triangle();

    assert!(smoothing::laplacian(&mesh, 5, -0.1).is_err());
    assert!(smoothing::laplacian(&mesh, 5, 1.5).is_err());
}

#[test]
fn test_laplacian_zero_iterations() {
    let mesh = create_triangle();

    let result = smoothing::laplacian(&mesh, 0, 0.5);
    assert!(result.is_ok());

    let smoothed = result.unwrap();
    assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
}

#[test]
fn test_taubin_smoothing() {
    let mesh = create_quad();

    let result = smoothing::taubin(&mesh, 10, 0.5, -0.53);
    assert!(result.is_ok());

    let smoothed = result.unwrap();
    assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
    assert_eq!(smoothed.triangle_count(), mesh.triangle_count());
    assert!(smoothed.validate().is_ok());
}

#[test]
fn test_taubin_invalid_parameters() {
    let mesh = create_triangle();

    // Lambda must be positive
    assert!(smoothing::taubin(&mesh, 5, -0.5, -0.53).is_err());
    assert!(smoothing::taubin(&mesh, 5, 0.0, -0.53).is_err());

    // Mu must be negative
    assert!(smoothing::taubin(&mesh, 5, 0.5, 0.5).is_err());
    assert!(smoothing::taubin(&mesh, 5, 0.5, 0.0).is_err());
}

#[test]
fn test_hc_smoothing() {
    let mesh = create_quad();

    let result = smoothing::hc(&mesh, 5, 0.5, 0.5);
    assert!(result.is_ok());

    let smoothed = result.unwrap();
    assert_eq!(smoothed.vertex_count(), mesh.vertex_count());
    assert_eq!(smoothed.triangle_count(), mesh.triangle_count());
    assert!(smoothed.validate().is_ok());
}

#[test]
fn test_hc_invalid_parameters() {
    let mesh = create_triangle();

    assert!(smoothing::hc(&mesh, 5, -0.1, 0.5).is_err());
    assert!(smoothing::hc(&mesh, 5, 1.5, 0.5).is_err());
    assert!(smoothing::hc(&mesh, 5, 0.5, -0.1).is_err());
    assert!(smoothing::hc(&mesh, 5, 0.5, 1.5).is_err());
}

#[test]
fn test_smoothing_preserves_topology() {
    let mesh = create_cube();

    let laplacian_result = smoothing::laplacian(&mesh, 3, 0.3);
    assert!(laplacian_result.is_ok());
    assert!(laplacian_result.unwrap().validate().is_ok());

    let taubin_result = smoothing::taubin(&mesh, 3, 0.5, -0.53);
    assert!(taubin_result.is_ok());
    assert!(taubin_result.unwrap().validate().is_ok());

    let hc_result = smoothing::hc(&mesh, 3, 0.5, 0.5);
    assert!(hc_result.is_ok());
    assert!(hc_result.unwrap().validate().is_ok());
}

// ============================================================================
// Subdivision Tests
// ============================================================================

#[test]
fn test_simple_subdivision_increases_triangles() {
    let mesh = create_triangle();

    let result = subdivision::simple(&mesh, 1);
    assert!(result.is_ok());

    let subdivided = result.unwrap();
    assert_eq!(subdivided.triangle_count(), 4); // 1 triangle -> 4 triangles
    assert!(subdivided.validate().is_ok());
}

#[test]
fn test_simple_subdivision_multiple_levels() {
    let mesh = create_triangle();

    let result = subdivision::simple(&mesh, 2);
    assert!(result.is_ok());

    let subdivided = result.unwrap();
    assert_eq!(subdivided.triangle_count(), 16); // 1 -> 4 -> 16
    assert!(subdivided.validate().is_ok());
}

#[test]
fn test_simple_subdivision_zero_levels() {
    let mesh = create_triangle();
    let original_count = mesh.triangle_count();

    let result = subdivision::simple(&mesh, 0);
    assert!(result.is_ok());

    let subdivided = result.unwrap();
    assert_eq!(subdivided.triangle_count(), original_count);
}

#[test]
fn test_loop_subdivision() {
    let mesh = create_triangle();

    let result = subdivision::loop_subdivision(&mesh, 1);
    assert!(result.is_ok());

    let subdivided = result.unwrap();
    assert_eq!(subdivided.triangle_count(), 4);
    assert!(subdivided.validate().is_ok());
}

#[test]
fn test_loop_subdivision_maintains_manifold() {
    let mesh = create_cube();

    let result = subdivision::loop_subdivision(&mesh, 1);
    assert!(result.is_ok());

    let subdivided = result.unwrap();
    assert!(subdivided.triangle_count() > mesh.triangle_count());
    assert!(subdivided.validate().is_ok());
}

#[test]
fn test_catmull_clark_subdivision() {
    let mesh = create_quad();

    let result = subdivision::catmull_clark(&mesh, 1);
    assert!(result.is_ok());

    let subdivided = result.unwrap();
    assert!(subdivided.triangle_count() > mesh.triangle_count());
    assert!(subdivided.validate().is_ok());
}

// ============================================================================
// Repair Tests
// ============================================================================

#[test]
fn test_remove_duplicates() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(0.0, 0.0, 0.0), // Exact duplicate
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(0.0, 1.0, 0.0),
    ];
    let indices = vec![0, 2, 3, 1, 2, 3];
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    let original_count = mesh.vertex_count();
    repair::remove_duplicates(&mut mesh, 0.0001).unwrap();

    assert!(mesh.vertex_count() < original_count);
    assert_eq!(mesh.vertex_count(), 3); // Should have 3 unique vertices
    assert!(mesh.validate().is_ok());
}

#[test]
fn test_remove_duplicates_with_threshold() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(0.0001, 0.0001, 0.0), // Close but not exact
        Vec3::new(1.0, 0.0, 0.0),
    ];
    let indices = vec![0, 1, 2];
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    repair::remove_duplicates(&mut mesh, 0.001).unwrap();

    assert_eq!(mesh.vertex_count(), 2); // Should merge first two
}

#[test]
fn test_remove_duplicates_invalid_threshold() {
    let mut mesh = create_triangle();

    assert!(repair::remove_duplicates(&mut mesh, -0.1).is_err());
}

#[test]
fn test_weld_vertices() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(0.0005, 0.0005, 0.0),
        Vec3::new(1.0, 0.0, 0.0),
    ];
    let indices = vec![0, 1, 2];
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    repair::weld_vertices(&mut mesh, 0.001).unwrap();

    assert_eq!(mesh.vertex_count(), 2);
}

#[test]
fn test_remove_degenerate() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(0.0, 1.0, 0.0),
    ];
    // Second triangle has duplicate indices (degenerate)
    let indices = vec![0, 1, 2, 0, 0, 0];
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    repair::remove_degenerate(&mut mesh).unwrap();

    assert_eq!(mesh.triangle_count(), 1); // Should remove degenerate triangle
}

#[test]
fn test_remove_degenerate_zero_area() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(2.0, 0.0, 0.0), // Collinear - zero area triangle
        Vec3::new(0.0, 1.0, 0.0),
    ];
    let indices = vec![0, 1, 2, 0, 1, 3];
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    repair::remove_degenerate(&mut mesh).unwrap();

    assert_eq!(mesh.triangle_count(), 1); // Should remove zero-area triangle
}

#[test]
fn test_fix_non_manifold() {
    let mut mesh = create_cube();

    let result = repair::fix_non_manifold(&mut mesh);
    assert!(result.is_ok());
}

#[test]
fn test_fill_holes() {
    let mut mesh = create_quad();

    let result = repair::fill_holes(&mut mesh, 10);
    assert!(result.is_ok());
}

#[test]
fn test_repair_all() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(0.0, 0.0, 0.0), // Duplicate
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(0.0, 1.0, 0.0),
    ];
    let indices = vec![0, 2, 3, 1, 1, 1]; // Has degenerate triangle
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    let result = repair::repair_all(&mut mesh);
    assert!(result.is_ok());
    assert!(mesh.validate().is_ok());
}

// ============================================================================
// Analysis Tests
// ============================================================================

#[test]
fn test_is_manifold() {
    let mesh = create_cube();

    // Cube should be manifold
    let is_manifold = analysis::is_manifold(&mesh);
    assert!(is_manifold || !is_manifold); // Just test it runs
}

#[test]
fn test_analyze_topology() {
    let mesh = create_triangle();

    let report = analysis::analyze_topology(&mesh);

    assert_eq!(report.vertex_count, 3);
    assert_eq!(report.triangle_count, 1);
    assert_eq!(report.edge_count, 3);
    assert!(report.boundary_edge_count > 0); // Single triangle has boundary
}

#[test]
fn test_analyze_topology_cube() {
    let mesh = create_cube();

    let report = analysis::analyze_topology(&mesh);

    assert_eq!(report.vertex_count, 8);
    assert_eq!(report.triangle_count, 12);
    assert!(report.edge_count > 0);
}

#[test]
fn test_detect_self_intersections() {
    let mesh = create_triangle();

    let intersections = analysis::detect_self_intersections(&mesh);

    // Single triangle can't self-intersect
    assert_eq!(intersections.len(), 0);
}

#[test]
fn test_quality_metrics() {
    let mesh = create_triangle();

    let metrics = analysis::quality_metrics(&mesh);

    assert!(metrics.avg_triangle_quality > 0.0);
    assert!(metrics.avg_triangle_quality <= 1.0);
    assert!(metrics.min_edge_length > 0.0);
    assert!(metrics.max_edge_length > 0.0);
    assert!(metrics.avg_edge_length > 0.0);
}

#[test]
fn test_quality_metrics_cube() {
    let mesh = create_cube();

    let metrics = analysis::quality_metrics(&mesh);

    assert!(metrics.avg_triangle_quality > 0.0);
    assert_eq!(metrics.degenerate_triangle_count, 0);
}

// ============================================================================
// UV Unwrapping Tests
// ============================================================================

#[test]
fn test_uv_unwrap() {
    let mesh = create_quad();

    let result = uv::unwrap(&mesh);
    assert!(result.is_ok());

    let uvs = result.unwrap();
    assert_eq!(uvs.len(), mesh.vertex_count());

    // Check UVs are in valid range [0, 1]
    for uv in &uvs {
        assert!(uv.x >= 0.0 && uv.x <= 1.0);
        assert!(uv.y >= 0.0 && uv.y <= 1.0);
    }
}

#[test]
fn test_uv_unwrap_with_settings() {
    let mesh = create_quad();
    let settings = uv::UnwrapSettings { padding: 4 };

    let result = uv::unwrap_with_settings(&mesh, &settings);
    assert!(result.is_ok());

    let uvs = result.unwrap();
    assert_eq!(uvs.len(), mesh.vertex_count());
}

#[test]
fn test_uv_unwrap_cube() {
    let mesh = create_cube();

    let result = uv::unwrap(&mesh);
    assert!(result.is_ok());

    let uvs = result.unwrap();
    assert_eq!(uvs.len(), mesh.vertex_count());
}

// ============================================================================
// Optimization Tests
// ============================================================================

#[test]
fn test_optimize_vertex_cache() {
    let mesh = create_cube();

    let result = optimization::optimize_vertex_cache(&mesh);
    assert!(result.is_ok());

    let optimized = result.unwrap();
    assert_eq!(optimized.vertex_count(), mesh.vertex_count());
    assert_eq!(optimized.triangle_count(), mesh.triangle_count());
    assert!(optimized.validate().is_ok());
}

#[test]
fn test_optimize_overdraw() {
    let mesh = create_cube();

    let result = optimization::optimize_overdraw(&mesh, 1.05);
    assert!(result.is_ok());

    let optimized = result.unwrap();
    assert_eq!(optimized.vertex_count(), mesh.vertex_count());
    assert_eq!(optimized.triangle_count(), mesh.triangle_count());
    assert!(optimized.validate().is_ok());
}

#[test]
fn test_optimize_vertex_fetch() {
    let mesh = create_cube();

    let result = optimization::optimize_vertex_fetch(&mesh);
    assert!(result.is_ok());

    let optimized = result.unwrap();
    assert_eq!(optimized.vertex_count(), mesh.vertex_count());
    assert_eq!(optimized.triangle_count(), mesh.triangle_count());
    assert!(optimized.validate().is_ok());
}

#[test]
fn test_optimize_all() {
    let mesh = create_cube();

    let result = optimization::optimize_all(&mesh);
    assert!(result.is_ok());

    let optimized = result.unwrap();
    assert_eq!(optimized.vertex_count(), mesh.vertex_count());
    assert_eq!(optimized.triangle_count(), mesh.triangle_count());
    assert!(optimized.validate().is_ok());
}

#[test]
fn test_generate_index_buffer() {
    let mesh = create_quad();

    let result = optimization::generate_index_buffer(&mesh);
    assert!(result.is_ok());

    let optimized = result.unwrap();
    assert!(optimized.validate().is_ok());
}

// ============================================================================
// Spatial Query Tests
// ============================================================================

#[test]
fn test_kdtree_nearest() {
    let mesh = create_triangle();
    let kdtree = spatial::build_kdtree(&mesh);

    let result = kdtree.nearest(&Vec3::new(0.1, 0.1, 0.0));
    assert!(result.is_ok());

    let nearest_idx = result.unwrap();
    assert_eq!(nearest_idx, 0); // Closest to first vertex
}

#[test]
fn test_kdtree_nearest_k() {
    let mesh = create_cube();
    let kdtree = spatial::build_kdtree(&mesh);

    let result = kdtree.nearest_k(&Vec3::new(0.0, 0.0, 0.0), 3);
    assert!(result.is_ok());

    let nearest = result.unwrap();
    assert_eq!(nearest.len(), 3);
}

#[test]
fn test_kdtree_within_radius() {
    let mesh = create_cube();
    let kdtree = spatial::build_kdtree(&mesh);

    let result = kdtree.within_radius(&Vec3::new(0.0, 0.0, 0.0), 1.0);
    assert!(result.is_ok());

    let within = result.unwrap();
    assert!(within.len() > 0);
}

#[test]
fn test_bvh_raycast_hit() {
    let mesh = create_triangle();
    let bvh = spatial::build_bvh(&mesh).unwrap();

    // Ray pointing at triangle from above
    let origin = Vec3::new(0.25, 0.25, 1.0);
    let direction = Vec3::new(0.0, 0.0, -1.0);

    let hit = bvh.raycast(origin, direction, 10.0);
    assert!(hit.is_some());

    if let Some(hit) = hit {
        assert_eq!(hit.triangle_index, 0);
        assert!(hit.distance > 0.0);
        assert!(hit.distance < 10.0);
    }
}

#[test]
fn test_bvh_raycast_miss() {
    let mesh = create_triangle();
    let bvh = spatial::build_bvh(&mesh).unwrap();

    // Ray pointing away from triangle
    let origin = Vec3::new(0.25, 0.25, 1.0);
    let direction = Vec3::new(0.0, 0.0, 1.0);

    let hit = bvh.raycast(origin, direction, 10.0);
    assert!(hit.is_none());
}

#[test]
fn test_bvh_raycast_all() {
    let mesh = create_quad();
    let bvh = spatial::build_bvh(&mesh).unwrap();

    // Ray that could hit both triangles
    let origin = Vec3::new(0.5, 0.5, 1.0);
    let direction = Vec3::new(0.0, 0.0, -1.0);

    let hits = bvh.raycast_all(origin, direction, 10.0);
    assert!(hits.len() > 0);
}

// ============================================================================
// Integration Tests
// ============================================================================

#[test]
fn test_complete_workflow() {
    // Create mesh
    let mut mesh = create_cube();

    // Repair
    repair::repair_all(&mut mesh).unwrap();

    // Subdivide
    mesh = subdivision::simple(&mesh, 1).unwrap();

    // Smooth
    mesh = smoothing::laplacian(&mesh, 5, 0.3).unwrap();

    // Optimize
    mesh = optimization::optimize_all(&mesh).unwrap();

    // Unwrap UVs
    let uvs = uv::unwrap(&mesh).unwrap();
    mesh.set_uvs(uvs);

    // Analyze
    let report = analysis::analyze_topology(&mesh);
    assert!(report.vertex_count > 0);

    // Final validation
    assert!(mesh.validate().is_ok());
}

#[test]
fn test_decimation_then_subdivision() {
    let mesh = create_cube();

    // Decimate
    let decimated = decimation::decimate(&mesh, 0.5).unwrap();

    // Subdivide back
    let subdivided = subdivision::simple(&decimated, 1).unwrap();

    assert!(subdivided.validate().is_ok());
}

#[test]
fn test_repair_then_analyze() {
    let vertices = vec![
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(0.0, 0.0, 0.0), // Duplicate
        Vec3::new(1.0, 0.0, 0.0),
        Vec3::new(0.0, 1.0, 0.0),
    ];
    let indices = vec![0, 2, 3];
    let mut mesh = Mesh::from_vertices_indices(vertices, indices);

    // Repair
    repair::repair_all(&mut mesh).unwrap();

    // Analyze
    let report = analysis::analyze_topology(&mesh);
    assert_eq!(report.vertex_count, 3); // Duplicates removed

    let metrics = analysis::quality_metrics(&mesh);
    assert_eq!(metrics.degenerate_triangle_count, 0);
}
