//! Texture tooling ownership for K_OS material workflows.

pub mod noise_brush;
pub mod pbr_generator;
pub mod procedural;

pub use noise_brush::{
    apply_noise_displacement, generate_noise_texture, sample_noise_point, NoiseDisplacementResult,
    NoiseParams,
};
pub use pbr_generator::{generate_normal_map, generate_pbr_maps, PbrMapSet, PbrParams};
pub use procedural::{
    blend_textures, generate_procedural_texture, generate_voronoi_texture, ProceduralParams,
    ProceduralResult, VoronoiParams,
};
