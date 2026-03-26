//! GPU-Accelerated UV Atlas Module
//!
//! High-performance UV unwrapping for 1M+ poly meshes using WGPU compute.
//!
//! Components:
//! - `GpuAtlasProjector` - Fast box/planar/cylindrical projections on GPU
//! - `GpuAtlasPacker` - MaxRects bin packing for UV islands
//! - `GpuAtlasRelaxer` - Spring-based UV optimization

#[cfg(not(target_arch = "wasm32"))]
mod commands;
#[cfg(not(target_arch = "wasm32"))]
mod packer;
#[cfg(not(target_arch = "wasm32"))]
mod projector;

#[cfg(not(target_arch = "wasm32"))]
pub use commands::*;
#[cfg(not(target_arch = "wasm32"))]
pub use packer::{detect_islands, pack_islands_gpu, GpuAtlasPacker, Island};
#[cfg(not(target_arch = "wasm32"))]
pub use projector::GpuAtlasProjector;
