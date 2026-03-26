//! K_OS Mesh Domain
//!
//! This crate is the ownership boundary for mesh operations.

#[cfg(feature = "atlas")]
pub mod atlas;
pub mod optimize;
pub mod primitive_gen;

#[cfg(feature = "atlas")]
pub use atlas::{
    classify_mesh, unwrap_and_optimize, unwrap_mesh_xatlas, AtlasResult, ClassificationResult,
    UnwrapOptimizeResult,
};
pub use optimize::{
    generate_lod_chain, optimize_mesh, simplify_mesh, OptimizeMeshResult, SimplifyResult,
};
pub use primitive_gen::{
    generate_arch, generate_beam, generate_body, generate_capsule, generate_cone, generate_disc,
    generate_head, generate_icosphere, generate_limb, generate_pillar, generate_plane,
    generate_platform, generate_pyramid, generate_quad_cube, generate_quad_cylinder,
    generate_quad_sphere, generate_ring, generate_torus, generate_tube, generate_uv_sphere,
    generate_wall, spawn_primitive, PrimitiveParams, PrimitiveResult,
};
