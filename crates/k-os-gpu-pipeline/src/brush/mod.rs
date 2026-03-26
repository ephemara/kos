//! Shared GPU alpha and brush infrastructure.

#[cfg(not(target_arch = "wasm32"))]
pub mod alpha_pool;
#[cfg(not(target_arch = "wasm32"))]
pub mod procedural;

#[cfg(not(target_arch = "wasm32"))]
pub use alpha_pool::{
    AlphaHandle, AlphaInfo, AlphaSource, AlphaTexture, AlphaTexturePool, ALPHA_POOL,
};
#[cfg(not(target_arch = "wasm32"))]
pub use procedural::{
    generate_procedural, generate_procedural_alpha, ProceduralParams, ProceduralType,
};
