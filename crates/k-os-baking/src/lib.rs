//! K_OS Texture Baking System
//!
//! GPU-accelerated texture baking for transferring surface details from high-poly
//! to low-poly meshes. Supports multiple map types including normal maps, ambient
//! occlusion, curvature, thickness, position, and material ID maps.
//!
//! # Features
//!
//! - **GPU Ray Tracing**: Hardware-accelerated ray tracing for fast baking
//! - **BVH Acceleration**: Efficient ray-mesh intersection using BVH
//! - **Multiple Map Types**: Normal, AO, curvature, thickness, position, ID
//! - **Cage-Based Baking**: Control ray direction and distance with cage meshes
//! - **Texture Dilation**: Prevent seams by filling empty pixels
//! - **Multi-Sampling**: Anti-aliasing for high-quality results
//! - **Parallel Processing**: Multi-threaded CPU fallback
//!
//! # Example
//!
//! ```no_run
//! use k_os_baking::{BakingSystem, BakeSettings, BakeMesh, NormalSpace};
//! use glam::{Vec2, Vec3};
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! // Create baking system with GPU acceleration
//! let system = BakingSystem::new_with_gpu().await?;
//!
//! // Create meshes
//! let high_poly = BakeMesh::new(
//!     vec![Vec3::ZERO, Vec3::X, Vec3::Y],
//!     vec![Vec3::Z, Vec3::Z, Vec3::Z],
//!     vec![Vec3::X, Vec3::X, Vec3::X],
//!     vec![Vec2::ZERO, Vec2::X, Vec2::Y],
//!     vec![0, 1, 2],
//! )?;
//!
//! let low_poly = high_poly.clone();
//!
//! // Configure bake settings
//! let settings = BakeSettings {
//!     resolution: 2048,
//!     samples: 16,
//!     max_distance: 1.0,
//!     normal_space: NormalSpace::Tangent,
//!     dilation_iterations: 8,
//!     ..Default::default()
//! };
//!
//! // Bake normal map
//! let normal_map = system.bake_normal_map(&high_poly, &low_poly, &settings)?;
//!
//! // Save to file
//! normal_map.save("normal_map.png")?;
//! # Ok(())
//! # }
//! ```
//!
//! # Performance
//!
//! The baking system is designed for high performance:
//! - GPU ray tracing for maximum throughput
//! - BVH construction using Surface Area Heuristic (SAH)
//! - Parallel CPU processing with Rayon
//! - Efficient memory management
//!
//! Target performance: 4K normal map in <5 seconds on modern GPUs.
//!
//! # Map Types
//!
//! ## Normal Maps
//!
//! Transfer surface normals from high-poly to low-poly mesh. Supports three
//! output spaces:
//! - **Tangent Space**: Most common for game assets (default)
//! - **Object Space**: Useful for static objects
//! - **World Space**: Rarely used, for specific effects
//!
//! ## Ambient Occlusion
//!
//! Compute surface occlusion by casting rays in a hemisphere around each point.
//! Darker areas indicate more occlusion.
//!
//! ## Curvature
//!
//! Measure surface curvature. Useful for procedural weathering and edge detection.
//!
//! ## Thickness
//!
//! Measure the thickness of the mesh by casting rays through the surface.
//! Useful for subsurface scattering effects.
//!
//! ## Position
//!
//! Store world-space position in RGB channels. Useful for advanced effects.
//!
//! ## Material ID
//!
//! Encode material IDs as colors. Useful for multi-material workflows.

pub mod baking;
pub mod bvh;
pub mod cage;
pub mod dilation;
pub mod error;
pub mod map_types;
pub mod ray_tracing;

pub use baking::{
    calculate_recommended_extrusion, generate_cage, generate_cage_adaptive, validate_cage,
    BakeSettings, BakingSystem,
};
pub use bvh::{Aabb, Bvh, RayHit, Triangle};
pub use cage::CageMesh;
pub use error::{BakingError, Result};
pub use map_types::{AoBaker, BakeMesh, CurvatureBaker, MapType, NormalMapBaker, NormalSpace};
pub use ray_tracing::{CpuRayTracer, GpuRayTracer};

#[cfg(test)]
mod tests {
    use super::*;
    use glam::{Vec2, Vec3};

    #[test]
    fn test_library_exports() {
        // Test that all main types are accessible
        let _system = BakingSystem::new();
        let _settings = BakeSettings::default();

        let vertices = vec![Vec3::ZERO, Vec3::X, Vec3::Y];
        let normals = vec![Vec3::Z, Vec3::Z, Vec3::Z];
        let tangents = vec![Vec3::X, Vec3::X, Vec3::X];
        let uvs = vec![Vec2::ZERO, Vec2::X, Vec2::Y];
        let indices = vec![0, 1, 2];

        let _mesh = BakeMesh::new(vertices, normals, tangents, uvs, indices).unwrap();
    }

    #[test]
    fn test_normal_space_enum() {
        let _tangent = NormalSpace::Tangent;
        let _object = NormalSpace::Object;
        let _world = NormalSpace::World;
    }

    #[test]
    fn test_map_type_enum() {
        let _normal = MapType::Normal(NormalSpace::Tangent);
        let _ao = MapType::AmbientOcclusion;
        let _curvature = MapType::Curvature;
        let _thickness = MapType::Thickness;
        let _position = MapType::Position;
        let _id = MapType::MaterialId;
    }
}
