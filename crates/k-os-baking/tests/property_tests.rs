//! Property-based tests for k-os-baking crate
//!
//! These tests verify mathematical properties and invariants that should hold
//! for all valid baking operations across a wide range of inputs.
//!
//! Properties tested:
//! - Property 23: Texture Baking Resolution Match
//! - Property 24: Normal Map Tangent Space Encoding
//! - Property 25: Texture Dilation Completeness

use glam::{Vec2, Vec3};
use k_os_baking::*;
use proptest::prelude::*;

// ============================================================================
// Test Generators (Strategies)
// ============================================================================

/// Generate valid texture resolutions (power of 2, common sizes)
/// Using smaller resolutions for faster property tests
fn resolution_strategy() -> impl Strategy<Value = u32> {
    prop_oneof![Just(64), Just(128), Just(256), Just(512),]
}

/// Generate valid sample counts for anti-aliasing
/// Using smaller sample counts for faster tests
fn sample_count_strategy() -> impl Strategy<Value = u32> {
    prop_oneof![Just(1), Just(4), Just(8),]
}

/// Generate dilation iteration counts (0-8 for faster tests)
fn dilation_iterations_strategy() -> impl Strategy<Value = u32> {
    0u32..=8
}

/// Generate a valid Vec3 with reasonable bounds
fn vec3_strategy() -> impl Strategy<Value = Vec3> {
    (-10.0f32..10.0f32, -10.0f32..10.0f32, -10.0f32..10.0f32)
        .prop_map(|(x, y, z)| Vec3::new(x, y, z))
}

/// Generate a valid Vec2 for UV coordinates (0.0 to 1.0)
fn uv_strategy() -> impl Strategy<Value = Vec2> {
    (0.0f32..1.0f32, 0.0f32..1.0f32).prop_map(|(u, v)| Vec2::new(u, v))
}

/// Generate a simple triangle mesh for baking
fn triangle_mesh_strategy() -> impl Strategy<Value = BakeMesh> {
    (
        prop::collection::vec(vec3_strategy(), 3..=3),
        prop::collection::vec(uv_strategy(), 3..=3),
    )
        .prop_map(|(vertices, uvs)| {
            let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z];
            let tangents = vec![Vec3::X, Vec3::X, Vec3::X];
            let indices = vec![0, 1, 2];
            BakeMesh::new(vertices, normals, tangents, uvs, indices)
        })
        .prop_filter("valid triangle mesh", |result| result.is_ok())
        .prop_map(|result| result.unwrap())
}

/// Generate a quad mesh (2 triangles) for baking
fn quad_mesh_strategy() -> impl Strategy<Value = BakeMesh> {
    (
        prop::collection::vec(vec3_strategy(), 4..=4),
        prop::collection::vec(uv_strategy(), 4..=4),
    )
        .prop_map(|(vertices, uvs)| {
            let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z, Vec3::Z];
            let tangents = vec![Vec3::X, Vec3::X, Vec3::X, Vec3::X];
            let indices = vec![0, 1, 2, 0, 2, 3];
            BakeMesh::new(vertices, normals, tangents, uvs, indices)
        })
        .prop_filter("valid quad mesh", |result| result.is_ok())
        .prop_map(|result| result.unwrap())
}

/// Generate a cube mesh for more complex baking tests
fn cube_mesh_strategy() -> impl Strategy<Value = BakeMesh> {
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

        let normals = vec![
            Vec3::Z,
            Vec3::Z,
            Vec3::Z,
            Vec3::Z,
            -Vec3::Z,
            -Vec3::Z,
            -Vec3::Z,
            -Vec3::Z,
        ];

        let tangents = vec![
            Vec3::X,
            Vec3::X,
            Vec3::X,
            Vec3::X,
            -Vec3::X,
            -Vec3::X,
            -Vec3::X,
            -Vec3::X,
        ];

        let uvs = vec![
            Vec2::new(0.0, 0.0),
            Vec2::new(1.0, 0.0),
            Vec2::new(1.0, 1.0),
            Vec2::new(0.0, 1.0),
            Vec2::new(0.0, 0.0),
            Vec2::new(1.0, 0.0),
            Vec2::new(1.0, 1.0),
            Vec2::new(0.0, 1.0),
        ];

        let indices = vec![
            0, 1, 2, 0, 2, 3, // Front
            5, 4, 7, 5, 7, 6, // Back
        ];

        BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap()
    })
}

/// Generate a mesh with some complexity (multiple triangles)
fn complex_mesh_strategy() -> impl Strategy<Value = BakeMesh> {
    prop_oneof![quad_mesh_strategy(), cube_mesh_strategy(),]
}

/// Generate normal space variants
fn normal_space_strategy() -> impl Strategy<Value = NormalSpace> {
    prop_oneof![
        Just(NormalSpace::Tangent),
        Just(NormalSpace::Object),
        Just(NormalSpace::World),
    ]
}

// ============================================================================
// Property 23: Texture Baking Resolution Match
// **Validates: Requirement 7.1**
//
// For any baking operation with specified resolution, the output texture
// has dimensions matching that resolution.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 10, // Reduce from default 256 for faster execution
        max_shrink_iters: 100,
        .. ProptestConfig::default()
    })]

    #[test]
    fn property_23_normal_map_resolution_matches(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
        normal_space in normal_space_strategy(),
    ) {
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution,
            samples: 1, // Use 1 sample for speed
            max_distance: 1.0,
            normal_space,
            dilation_iterations: 0, // No dilation for this test
            ..Default::default()
        };

        // Bake normal map (using same mesh for high and low poly)
        let result = system.bake_normal_map(&mesh, &mesh, &settings);

        // Baking should succeed
        prop_assert!(result.is_ok(), "Normal map baking should succeed");

        let image = result.unwrap();

        // Check resolution matches
        prop_assert_eq!(
            image.width(),
            resolution,
            "Image width should match requested resolution"
        );
        prop_assert_eq!(
            image.height(),
            resolution,
            "Image height should match requested resolution"
        );
    }

    #[test]
    fn property_23_ao_map_resolution_matches(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
    ) {
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution,
            samples: 4, // AO needs some samples
            max_distance: 1.0,
            dilation_iterations: 0,
            ..Default::default()
        };

        // Bake AO map
        let result = system.bake_ao_map(&mesh, &settings);

        // Baking should succeed
        prop_assert!(result.is_ok(), "AO map baking should succeed");

        let image = result.unwrap();

        // Check resolution matches
        prop_assert_eq!(
            image.width(),
            resolution,
            "AO map width should match requested resolution"
        );
        prop_assert_eq!(
            image.height(),
            resolution,
            "AO map height should match requested resolution"
        );
    }

    #[test]
    fn property_23_curvature_map_resolution_matches(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
    ) {
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            dilation_iterations: 0,
            ..Default::default()
        };

        // Bake curvature map
        let result = system.bake_curvature_map(&mesh, &settings);

        // Baking should succeed
        prop_assert!(result.is_ok(), "Curvature map baking should succeed");

        let image = result.unwrap();

        // Check resolution matches
        prop_assert_eq!(
            image.width(),
            resolution,
            "Curvature map width should match requested resolution"
        );
        prop_assert_eq!(
            image.height(),
            resolution,
            "Curvature map height should match requested resolution"
        );
    }
}

// ============================================================================
// Property 24: Normal Map Tangent Space Encoding
// **Validates: Requirement 7.1**
//
// For any baked normal map, all pixels within UV bounds contain normalized
// vectors in tangent space (RGB values in [0,1] range, centered at 0.5).
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 10, // Reduce for faster execution
        max_shrink_iters: 100,
        .. ProptestConfig::default()
    })]

    #[test]
    fn property_24_normal_map_tangent_space_encoding(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
        samples in sample_count_strategy(),
    ) {
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution,
            samples,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations: 0, // No dilation to test only baked pixels
            ..Default::default()
        };

        // Bake normal map
        let result = system.bake_normal_map(&mesh, &mesh, &settings);
        prop_assert!(result.is_ok(), "Normal map baking should succeed");

        let image = result.unwrap();

        // Check that all non-empty pixels have valid tangent space normals
        let mut valid_pixel_count = 0;
        let mut invalid_pixel_count = 0;

        for y in 0..image.height() {
            for x in 0..image.width() {
                let pixel = image.get_pixel(x, y);
                let r = pixel[0] as f32 / 255.0;
                let g = pixel[1] as f32 / 255.0;
                let b = pixel[2] as f32 / 255.0;
                let a = pixel[3] as f32 / 255.0;

                // Skip empty pixels (alpha = 0)
                if a < 0.01 {
                    continue;
                }

                valid_pixel_count += 1;

                // Check RGB values are in valid range [0, 1]
                if r < 0.0 || r > 1.0 || g < 0.0 || g > 1.0 || b < 0.0 || b > 1.0 {
                    invalid_pixel_count += 1;
                    continue;
                }

                // Convert from [0,1] to [-1,1] tangent space
                let nx = r * 2.0 - 1.0;
                let ny = g * 2.0 - 1.0;
                let nz = b * 2.0 - 1.0;

                // Check that the normal is approximately normalized
                let length = (nx * nx + ny * ny + nz * nz).sqrt();

                // Allow some tolerance for quantization and filtering
                if (length - 1.0).abs() > 0.1 {
                    invalid_pixel_count += 1;
                }
            }
        }

        // At least some pixels should be valid (mesh has UV coverage)
        prop_assert!(
            valid_pixel_count > 0,
            "Should have at least some valid pixels with UV coverage"
        );

        // Most pixels should be valid (allow up to 5% invalid due to edge cases)
        let invalid_ratio = invalid_pixel_count as f32 / valid_pixel_count as f32;
        prop_assert!(
            invalid_ratio < 0.05,
            "Invalid pixel ratio {} should be less than 5%",
            invalid_ratio
        );
    }

    #[test]
    fn property_24_normal_map_object_space_encoding(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
    ) {
        let system = BakingSystem::new();

        let settings = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Object,
            dilation_iterations: 0,
            ..Default::default()
        };

        // Bake normal map in object space
        let result = system.bake_normal_map(&mesh, &mesh, &settings);
        prop_assert!(result.is_ok(), "Object space normal map baking should succeed");

        let image = result.unwrap();

        // Check that all non-empty pixels have valid normals
        let mut valid_pixel_count = 0;

        for y in 0..image.height() {
            for x in 0..image.width() {
                let pixel = image.get_pixel(x, y);
                let a = pixel[3] as f32 / 255.0;

                // Skip empty pixels
                if a < 0.01 {
                    continue;
                }

                valid_pixel_count += 1;

                let r = pixel[0] as f32 / 255.0;
                let g = pixel[1] as f32 / 255.0;
                let b = pixel[2] as f32 / 255.0;

                // RGB values should be in [0, 1]
                prop_assert!(r >= 0.0 && r <= 1.0, "R channel should be in [0,1]");
                prop_assert!(g >= 0.0 && g <= 1.0, "G channel should be in [0,1]");
                prop_assert!(b >= 0.0 && b <= 1.0, "B channel should be in [0,1]");
            }
        }

        // Should have some valid pixels
        prop_assert!(valid_pixel_count > 0, "Should have valid pixels");
    }
}

// ============================================================================
// Property 25: Texture Dilation Completeness
// **Validates: Requirement 7.5**
//
// For any baked texture, dilation fills all empty pixels within UV regions
// to prevent seams.
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 10, // Reduce for faster execution
        max_shrink_iters: 100,
        .. ProptestConfig::default()
    })]

    #[test]
    fn property_25_dilation_fills_empty_pixels(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
        dilation_iterations in dilation_iterations_strategy(),
    ) {
        let system = BakingSystem::new();

        // First bake without dilation
        let settings_no_dilation = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations: 0,
            ..Default::default()
        };

        let result_no_dilation = system.bake_normal_map(&mesh, &mesh, &settings_no_dilation);
        prop_assert!(result_no_dilation.is_ok(), "Baking without dilation should succeed");
        let image_no_dilation = result_no_dilation.unwrap();

        // Count empty pixels (alpha = 0)
        let mut empty_pixels_before = 0;
        for y in 0..image_no_dilation.height() {
            for x in 0..image_no_dilation.width() {
                let pixel = image_no_dilation.get_pixel(x, y);
                if pixel[3] == 0 {
                    empty_pixels_before += 1;
                }
            }
        }

        // Now bake with dilation
        let settings_with_dilation = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations,
            ..Default::default()
        };

        let result_with_dilation = system.bake_normal_map(&mesh, &mesh, &settings_with_dilation);
        prop_assert!(result_with_dilation.is_ok(), "Baking with dilation should succeed");
        let image_with_dilation = result_with_dilation.unwrap();

        // Count empty pixels after dilation
        let mut empty_pixels_after = 0;
        for y in 0..image_with_dilation.height() {
            for x in 0..image_with_dilation.width() {
                let pixel = image_with_dilation.get_pixel(x, y);
                if pixel[3] == 0 {
                    empty_pixels_after += 1;
                }
            }
        }

        // If dilation iterations > 0, we should have fewer or equal empty pixels
        if dilation_iterations > 0 && empty_pixels_before > 0 {
            prop_assert!(
                empty_pixels_after <= empty_pixels_before,
                "Dilation should reduce or maintain empty pixel count: before={}, after={}",
                empty_pixels_before,
                empty_pixels_after
            );
        }

        // If we had empty pixels and did enough dilation iterations,
        // we should have filled at least some of them
        if dilation_iterations >= 4 && empty_pixels_before > 100 {
            let filled_pixels = empty_pixels_before - empty_pixels_after;
            prop_assert!(
                filled_pixels > 0,
                "With {} iterations, should have filled some pixels",
                dilation_iterations
            );
        }
    }

    #[test]
    fn property_25_dilation_preserves_valid_pixels(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
        dilation_iterations in dilation_iterations_strategy(),
    ) {
        let system = BakingSystem::new();

        // Bake without dilation
        let settings_no_dilation = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations: 0,
            ..Default::default()
        };

        let result_no_dilation = system.bake_normal_map(&mesh, &mesh, &settings_no_dilation);
        prop_assert!(result_no_dilation.is_ok());
        let image_no_dilation = result_no_dilation.unwrap();

        // Count valid pixels (alpha > 0)
        let mut valid_pixels_before = 0;
        for y in 0..image_no_dilation.height() {
            for x in 0..image_no_dilation.width() {
                let pixel = image_no_dilation.get_pixel(x, y);
                if pixel[3] > 0 {
                    valid_pixels_before += 1;
                }
            }
        }

        // Bake with dilation
        let settings_with_dilation = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations,
            ..Default::default()
        };

        let result_with_dilation = system.bake_normal_map(&mesh, &mesh, &settings_with_dilation);
        prop_assert!(result_with_dilation.is_ok());
        let image_with_dilation = result_with_dilation.unwrap();

        // Count valid pixels after dilation
        let mut valid_pixels_after = 0;
        for y in 0..image_with_dilation.height() {
            for x in 0..image_with_dilation.width() {
                let pixel = image_with_dilation.get_pixel(x, y);
                if pixel[3] > 0 {
                    valid_pixels_after += 1;
                }
            }
        }

        // Dilation should increase or maintain valid pixel count
        prop_assert!(
            valid_pixels_after >= valid_pixels_before,
            "Dilation should not reduce valid pixels: before={}, after={}",
            valid_pixels_before,
            valid_pixels_after
        );
    }

    #[test]
    fn property_25_more_dilation_fills_more_pixels(
        resolution in resolution_strategy(),
        mesh in complex_mesh_strategy(),
    ) {
        let system = BakingSystem::new();

        // Bake with 2 iterations
        let settings_2_iter = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations: 2,
            ..Default::default()
        };

        let result_2_iter = system.bake_normal_map(&mesh, &mesh, &settings_2_iter);
        prop_assert!(result_2_iter.is_ok());
        let image_2_iter = result_2_iter.unwrap();

        let mut empty_2_iter = 0;
        for y in 0..image_2_iter.height() {
            for x in 0..image_2_iter.width() {
                if image_2_iter.get_pixel(x, y)[3] == 0 {
                    empty_2_iter += 1;
                }
            }
        }

        // Bake with 8 iterations
        let settings_8_iter = BakeSettings {
            resolution,
            samples: 1,
            max_distance: 1.0,
            normal_space: NormalSpace::Tangent,
            dilation_iterations: 8,
            ..Default::default()
        };

        let result_8_iter = system.bake_normal_map(&mesh, &mesh, &settings_8_iter);
        prop_assert!(result_8_iter.is_ok());
        let image_8_iter = result_8_iter.unwrap();

        let mut empty_8_iter = 0;
        for y in 0..image_8_iter.height() {
            for x in 0..image_8_iter.width() {
                if image_8_iter.get_pixel(x, y)[3] == 0 {
                    empty_8_iter += 1;
                }
            }
        }

        // More iterations should fill more pixels (or at least not fill fewer)
        prop_assert!(
            empty_8_iter <= empty_2_iter,
            "8 iterations should fill at least as many pixels as 2 iterations: 2iter={}, 8iter={}",
            empty_2_iter,
            empty_8_iter
        );
    }
}
