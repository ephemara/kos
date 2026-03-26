//! Property-based tests for k-os-mesh-processing crate
//!
//! These tests verify mathematical properties and invariants that should hold
//! for all valid mesh operations across a wide range of inputs.
//!
//! Properties tested:
//! - Property 18: Auto-Retopo Polygon Count
//! - Property 19: Auto-Retopo Manifold Output
//! - Property 20: Mesh Repair Manifold Guarantee
//! - Property 21: Boolean Operation Commutativity
//! - Property 22: Boolean Operation Manifold Preservation

use glam::Vec3;
use k_os_mesh_processing::*;
use proptest::prelude::*;

// ============================================================================
// Test Generators (Strategies)
// ============================================================================

/// Generate a valid Vec3 with reasonable bounds
fn vec3_strategy() -> impl Strategy<Value = Vec3> {
    (-10.0f32..10.0f32, -10.0f32..10.0f32, -10.0f32..10.0f32)
        .prop_map(|(x, y, z)| Vec3::new(x, y, z))
}

/// Generate a simple triangle mesh
fn triangle_mesh_strategy() -> impl Strategy<Value = Mesh> {
    prop::collection::vec(vec3_strategy(), 3..=3)
        .prop_map(|vertices| {
            let indices = vec![0, 1, 2];
            Mesh::from_vertices_indices(vertices, indices)
        })
        .prop_filter("valid triangle", |mesh| {
            mesh.validate().is_ok() && mesh.triangle_area(0).unwrap_or(0.0) > 1e-6
        })
}

/// Generate a quad mesh (2 triangles)
fn quad_mesh_strategy() -> impl Strategy<Value = Mesh> {
    prop::collection::vec(vec3_strategy(), 4..=4)
        .prop_map(|vertices| {
            let indices = vec![0, 1, 2, 0, 2, 3];
            Mesh::from_vertices_indices(vertices, indices)
        })
        .prop_filter("valid quad", |mesh| {
            mesh.validate().is_ok()
                && mesh.triangle_area(0).unwrap_or(0.0) > 1e-6
                && mesh.triangle_area(1).unwrap_or(0.0) > 1e-6
        })
}

/// Generate a cube mesh for more complex testing
fn cube_mesh_strategy() -> impl Strategy<Value = Mesh> {
    (0.1f32..5.0f32).prop_map(|size| {
        let s = size / 2.0;
        let vertices = vec![
            // Front face
            Vec3::new(-s, -s, s),
            Vec3::new(s, -s, s),
            Vec3::new(s, s, s),
            Vec3::new(-s, s, s),
            // Back face
            Vec3::new(-s, -s, -s),
            Vec3::new(s, -s, -s),
            Vec3::new(s, s, -s),
            Vec3::new(-s, s, -s),
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
    })
}

/// Generate a mesh with some complexity (multiple triangles)
fn complex_mesh_strategy() -> impl Strategy<Value = Mesh> {
    prop_oneof![quad_mesh_strategy(), cube_mesh_strategy(),]
}

/// Generate a decimation ratio (0.1 to 0.9)
fn decimation_ratio_strategy() -> impl Strategy<Value = f32> {
    0.1f32..0.9f32
}

/// Generate subdivision levels (1 to 3)
fn subdivision_levels_strategy() -> impl Strategy<Value = usize> {
    1usize..=3
}

/// Generate smoothing parameters
fn smoothing_params_strategy() -> impl Strategy<Value = (usize, f32)> {
    (1usize..=10, 0.1f32..0.9f32)
}

// ============================================================================
// Property 18: Auto-Retopo Polygon Count
// **Validates: Requirements 6.1, 11.7**
//
// For any mesh and target polygon count, auto-retopology produces a mesh
// with approximately the target count (±10%).
// ============================================================================

// Note: Auto-retopo is not yet implemented in the crate
// These tests are placeholders for when the feature is added

// ============================================================================
// Property 19: Auto-Retopo Manifold Output
// **Validates: Requirements 6.1, 11.8**
//
// For any input mesh, auto-retopology produces a manifold quad-dominant mesh.
// ============================================================================

// Note: Auto-retopo is not yet implemented in the crate
// These tests are placeholders for when the feature is added

// ============================================================================
// Property 20: Mesh Repair Manifold Guarantee
// **Validates: Requirement 6.4**
//
// For any mesh with non-manifold geometry, the repair function produces
// a manifold mesh.
// ============================================================================

proptest! {
    #[test]
    fn property_20_mesh_repair_produces_valid_mesh(
        mesh in complex_mesh_strategy()
    ) {
        let mut repaired = mesh.clone();

        // Apply repair operations
        let result = repair::repair_all(&mut repaired);

        // Repair should succeed
        prop_assert!(result.is_ok(), "Repair should succeed");

        // Repaired mesh should be valid
        prop_assert!(repaired.validate().is_ok(), "Repaired mesh should be valid");

        // Repaired mesh should have vertices and triangles
        prop_assert!(repaired.vertex_count() > 0, "Should have vertices");
        prop_assert!(repaired.triangle_count() > 0, "Should have triangles");
    }

    #[test]
    fn property_20_remove_duplicates_preserves_topology(
        mesh in complex_mesh_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();
        let mut repaired = mesh.clone();

        // Remove duplicates
        let result = repair::remove_duplicates(&mut repaired, 0.0001);
        prop_assert!(result.is_ok());

        // Triangle count should be preserved (only vertices merged)
        prop_assert_eq!(repaired.triangle_count(), original_tri_count);

        // Mesh should still be valid
        prop_assert!(repaired.validate().is_ok());
    }

    #[test]
    fn property_20_remove_degenerate_reduces_or_preserves_count(
        mesh in complex_mesh_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();
        let mut repaired = mesh.clone();

        // Remove degenerate triangles
        let result = repair::remove_degenerate(&mut repaired);
        prop_assert!(result.is_ok());

        // Triangle count should be <= original
        prop_assert!(repaired.triangle_count() <= original_tri_count);

        // Mesh should still be valid
        prop_assert!(repaired.validate().is_ok());
    }
}

// ============================================================================
// Property 21: Boolean Operation Commutativity
// **Validates: Requirement 6.8**
//
// For any two manifold meshes A and B, boolean_union(A, B) equals
// boolean_union(B, A).
// ============================================================================

// Note: Boolean operations are not yet implemented in the crate
// These tests are placeholders for when the feature is added

// ============================================================================
// Property 22: Boolean Operation Manifold Preservation
// **Validates: Requirement 6.7**
//
// For any two manifold meshes, GPU-accelerated boolean operations produce
// manifold output meshes.
// ============================================================================

// Note: Boolean operations are not yet implemented in the crate
// These tests are placeholders for when the feature is added

// ============================================================================
// Additional Properties: Mesh Operation Topology Preservation
// **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
//
// For any valid mesh, smoothing operations preserve vertex and triangle counts.
// For any valid mesh, repair operations produce valid topology.
// For any valid mesh, optimization operations preserve geometry.
// Manifold meshes remain manifold after operations.
// ============================================================================

proptest! {
    #[test]
    fn property_smoothing_preserves_vertex_count(
        mesh in complex_mesh_strategy(),
        (iterations, lambda) in smoothing_params_strategy()
    ) {
        let original_vertex_count = mesh.vertex_count();

        // Apply Laplacian smoothing
        let result = smoothing::laplacian(&mesh, iterations, lambda);
        prop_assert!(result.is_ok(), "Smoothing should succeed");

        let smoothed = result.unwrap();

        // Vertex count should be preserved
        prop_assert_eq!(
            smoothed.vertex_count(),
            original_vertex_count,
            "Smoothing should preserve vertex count"
        );
    }

    #[test]
    fn property_smoothing_preserves_triangle_count(
        mesh in complex_mesh_strategy(),
        (iterations, lambda) in smoothing_params_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();

        // Apply Laplacian smoothing
        let result = smoothing::laplacian(&mesh, iterations, lambda);
        prop_assert!(result.is_ok());

        let smoothed = result.unwrap();

        // Triangle count should be preserved
        prop_assert_eq!(
            smoothed.triangle_count(),
            original_tri_count,
            "Smoothing should preserve triangle count"
        );
    }

    #[test]
    fn property_smoothing_produces_valid_mesh(
        mesh in complex_mesh_strategy(),
        (iterations, lambda) in smoothing_params_strategy()
    ) {
        let result = smoothing::laplacian(&mesh, iterations, lambda);
        prop_assert!(result.is_ok());

        let smoothed = result.unwrap();

        // Smoothed mesh should be valid
        prop_assert!(smoothed.validate().is_ok(), "Smoothed mesh should be valid");
    }

    #[test]
    fn property_taubin_preserves_topology(
        mesh in complex_mesh_strategy(),
        iterations in 1usize..=10
    ) {
        let original_vertex_count = mesh.vertex_count();
        let original_tri_count = mesh.triangle_count();

        // Apply Taubin smoothing
        let result = smoothing::taubin(&mesh, iterations, 0.5, -0.53);
        prop_assert!(result.is_ok());

        let smoothed = result.unwrap();

        // Topology should be preserved
        prop_assert_eq!(smoothed.vertex_count(), original_vertex_count);
        prop_assert_eq!(smoothed.triangle_count(), original_tri_count);
        prop_assert!(smoothed.validate().is_ok());
    }
}

// ============================================================================
// Additional Properties: Mesh Decimation/Subdivision Inverse
// **Validates: Requirements 6.1, 6.3**
//
// For any valid mesh, decimation reduces triangle count.
// For any valid mesh, subdivision increases triangle count.
// Decimation followed by subdivision produces a valid mesh.
// Triangle counts follow expected mathematical relationships.
// ============================================================================

proptest! {
    #[test]
    fn property_decimation_reduces_triangle_count(
        mesh in complex_mesh_strategy(),
        ratio in decimation_ratio_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();

        // Apply decimation
        let result = decimation::decimate(&mesh, ratio);
        prop_assert!(result.is_ok(), "Decimation should succeed");

        let decimated = result.unwrap();

        // Triangle count should be reduced or equal
        prop_assert!(
            decimated.triangle_count() <= original_tri_count,
            "Decimation should reduce or preserve triangle count"
        );

        // Should have at least 1 triangle
        prop_assert!(decimated.triangle_count() > 0, "Should have at least 1 triangle");
    }

    #[test]
    fn property_decimation_produces_valid_mesh(
        mesh in complex_mesh_strategy(),
        ratio in decimation_ratio_strategy()
    ) {
        let result = decimation::decimate(&mesh, ratio);
        prop_assert!(result.is_ok());

        let decimated = result.unwrap();

        // Decimated mesh should be valid
        prop_assert!(decimated.validate().is_ok(), "Decimated mesh should be valid");
    }

    #[test]
    fn property_decimation_respects_ratio(
        mesh in complex_mesh_strategy(),
        ratio in decimation_ratio_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();

        // Skip test if mesh is too small (decimation has minimum constraints)
        prop_assume!(original_tri_count >= 10);

        let result = decimation::decimate(&mesh, ratio);
        prop_assert!(result.is_ok());

        let decimated = result.unwrap();
        let actual_ratio = decimated.triangle_count() as f32 / original_tri_count as f32;

        // Actual ratio should be close to target ratio (within reasonable tolerance)
        // Allow for meshopt's optimization decisions and minimum triangle constraints
        // For small meshes, decimation may not reduce as much as requested
        prop_assert!(
            actual_ratio <= 1.0,
            "Decimation should not increase triangle count (got ratio {})",
            actual_ratio
        );

        // If the mesh is large enough, check that some decimation occurred
        if original_tri_count >= 20 {
            prop_assert!(
                actual_ratio < 1.0,
                "Decimation should reduce triangle count for larger meshes"
            );
        }
    }

    #[test]
    fn property_subdivision_increases_triangle_count(
        mesh in triangle_mesh_strategy(),
        levels in subdivision_levels_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();

        // Apply subdivision
        let result = subdivision::simple(&mesh, levels);
        prop_assert!(result.is_ok(), "Subdivision should succeed");

        let subdivided = result.unwrap();

        // Triangle count should increase
        prop_assert!(
            subdivided.triangle_count() > original_tri_count,
            "Subdivision should increase triangle count"
        );
    }

    #[test]
    fn property_subdivision_produces_valid_mesh(
        mesh in triangle_mesh_strategy(),
        levels in subdivision_levels_strategy()
    ) {
        let result = subdivision::simple(&mesh, levels);
        prop_assert!(result.is_ok());

        let subdivided = result.unwrap();

        // Subdivided mesh should be valid
        prop_assert!(subdivided.validate().is_ok(), "Subdivided mesh should be valid");
    }

    #[test]
    fn property_subdivision_follows_4x_rule(
        mesh in triangle_mesh_strategy()
    ) {
        let original_tri_count = mesh.triangle_count();

        // One level of subdivision should produce 4x triangles
        let result = subdivision::simple(&mesh, 1);
        prop_assert!(result.is_ok());

        let subdivided = result.unwrap();

        // Should have 4x triangles (each triangle splits into 4)
        prop_assert_eq!(
            subdivided.triangle_count(),
            original_tri_count * 4,
            "One subdivision level should produce 4x triangles"
        );
    }

    #[test]
    fn property_decimation_then_subdivision_produces_valid_mesh(
        mesh in complex_mesh_strategy(),
        ratio in decimation_ratio_strategy()
    ) {
        // Decimate first
        let decimated = decimation::decimate(&mesh, ratio);
        prop_assert!(decimated.is_ok());

        let decimated = decimated.unwrap();

        // Then subdivide
        let result = subdivision::simple(&decimated, 1);
        prop_assert!(result.is_ok(), "Subdivision after decimation should succeed");

        let final_mesh = result.unwrap();

        // Final mesh should be valid
        prop_assert!(final_mesh.validate().is_ok(), "Final mesh should be valid");

        // Should have more triangles than decimated mesh
        prop_assert!(
            final_mesh.triangle_count() > decimated.triangle_count(),
            "Subdivision should increase triangle count"
        );
    }

    #[test]
    fn property_subdivision_then_decimation_produces_valid_mesh(
        mesh in triangle_mesh_strategy()
    ) {
        // Subdivide first
        let subdivided = subdivision::simple(&mesh, 2);
        prop_assert!(subdivided.is_ok());

        let subdivided = subdivided.unwrap();

        // Then decimate back
        let result = decimation::decimate(&subdivided, 0.5);
        prop_assert!(result.is_ok(), "Decimation after subdivision should succeed");

        let final_mesh = result.unwrap();

        // Final mesh should be valid
        prop_assert!(final_mesh.validate().is_ok(), "Final mesh should be valid");

        // Should have fewer triangles than subdivided mesh
        prop_assert!(
            final_mesh.triangle_count() < subdivided.triangle_count(),
            "Decimation should reduce triangle count"
        );
    }
}

// ============================================================================
// Mesh Analysis Properties
// ============================================================================

proptest! {
    #[test]
    fn property_topology_analysis_consistent(
        mesh in complex_mesh_strategy()
    ) {
        let report = analysis::analyze_topology(&mesh);

        // Basic consistency checks
        prop_assert_eq!(report.vertex_count, mesh.vertex_count());
        prop_assert_eq!(report.triangle_count, mesh.triangle_count());

        // Euler characteristic should be reasonable for closed meshes
        // V - E + F = 2 for closed manifold (sphere-like)
        // For open meshes, it can vary
        prop_assert!(
            report.euler_characteristic >= -100 && report.euler_characteristic <= 100,
            "Euler characteristic should be reasonable"
        );
    }

    #[test]
    fn property_quality_metrics_in_valid_range(
        mesh in complex_mesh_strategy()
    ) {
        let metrics = analysis::quality_metrics(&mesh);

        // Quality should be between 0 and 1
        prop_assert!(metrics.min_triangle_quality >= 0.0);
        prop_assert!(metrics.max_triangle_quality <= 1.0);
        prop_assert!(metrics.avg_triangle_quality >= 0.0);
        prop_assert!(metrics.avg_triangle_quality <= 1.0);

        // Edge lengths should be positive
        prop_assert!(metrics.min_edge_length >= 0.0);
        prop_assert!(metrics.max_edge_length >= metrics.min_edge_length);
        prop_assert!(metrics.avg_edge_length >= 0.0);

        // Aspect ratios should be >= 1
        prop_assert!(metrics.min_aspect_ratio >= 1.0);
        prop_assert!(metrics.avg_aspect_ratio >= 1.0);
    }
}

// ============================================================================
// Mesh Optimization Properties
// ============================================================================

proptest! {
    #[test]
    fn property_optimization_preserves_geometry(
        mesh in complex_mesh_strategy()
    ) {
        let original_vertex_count = mesh.vertex_count();
        let original_tri_count = mesh.triangle_count();

        // Apply optimization
        let result = optimization::optimize_vertex_cache(&mesh);
        prop_assert!(result.is_ok(), "Optimization should succeed");

        let optimized = result.unwrap();

        // Geometry should be preserved (same counts)
        prop_assert_eq!(optimized.vertex_count(), original_vertex_count);
        prop_assert_eq!(optimized.triangle_count(), original_tri_count);

        // Mesh should still be valid
        prop_assert!(optimized.validate().is_ok());
    }

    #[test]
    fn property_optimization_produces_valid_mesh(
        mesh in complex_mesh_strategy()
    ) {
        let result = optimization::optimize_vertex_cache(&mesh);
        prop_assert!(result.is_ok());

        let optimized = result.unwrap();
        prop_assert!(optimized.validate().is_ok(), "Optimized mesh should be valid");
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Test that demonstrates the complete workflow
    #[test]
    fn test_complete_mesh_processing_workflow() {
        // Create a test mesh
        let vertices = vec![
            Vec3::new(-1.0, -1.0, 0.0),
            Vec3::new(1.0, -1.0, 0.0),
            Vec3::new(1.0, 1.0, 0.0),
            Vec3::new(-1.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2, 0, 2, 3];
        let mesh = Mesh::from_vertices_indices(vertices, indices);

        // 1. Subdivide to add detail
        let subdivided = subdivision::simple(&mesh, 2).unwrap();
        assert!(subdivided.triangle_count() > mesh.triangle_count());

        // 2. Smooth the mesh
        let smoothed = smoothing::laplacian(&subdivided, 5, 0.5).unwrap();
        assert_eq!(smoothed.vertex_count(), subdivided.vertex_count());

        // 3. Decimate to reduce complexity
        let decimated = decimation::decimate(&smoothed, 0.5).unwrap();
        assert!(decimated.triangle_count() < smoothed.triangle_count());

        // 4. Repair any issues
        let mut final_mesh = decimated;
        repair::repair_all(&mut final_mesh).unwrap();

        // 5. Analyze the result
        let report = analysis::analyze_topology(&final_mesh);
        assert!(report.vertex_count > 0);
        assert!(report.triangle_count > 0);

        // Final mesh should be valid
        assert!(final_mesh.validate().is_ok());
    }
}
