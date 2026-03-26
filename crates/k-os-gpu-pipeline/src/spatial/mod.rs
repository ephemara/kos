//! GPU Spatial Grid Module
//!
//! GPU-accelerated spatial indexing for Level 4 compute.
//! Enables O(1) radius queries entirely on GPU.

pub mod grid;

pub use grid::GpuSpatialGrid;
