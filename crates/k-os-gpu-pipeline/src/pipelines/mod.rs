//! Compatibility-oriented GPU pipeline namespace.
//!
//! The canonical owners for sculpt, normals, and SPIR-V loading already live at
//! the crate root. This module preserves the old grouped discovery path while
//! the remaining pipeline domains finish migrating off `k-os-engine`.

pub mod dynamesh;
mod marching_cubes_tables;
pub mod pbr;
pub mod subdivide_cpu_reference;
pub mod subdivide_v2;

pub mod normals {
    pub use crate::normals::*;
}

pub mod sculpt {
    pub use crate::sculpt::*;
}

pub mod spirv_loader {
    pub use crate::spirv_loader::*;
}

pub use crate::normals::{GpuNormalBuffers, GpuNormalCompute, NormalParams};
pub use crate::sculpt::{
    BrushParams, GpuCandidates, GpuMeshBuffers, GpuSculptCompute, KernelFamily, SculptOp,
    SparsePositionReadback,
};
pub use crate::spirv_loader::{
    get_shader_count, get_shaders_by_family, SpirvShader, SPIRV_SHADERS,
};
pub use dynamesh::{
    gpu_dynamesh, gpu_dynamesh_benchmark, GpuDynameshEngine, GpuDynameshParams, GpuDynameshResult,
};
pub use pbr::{gpu_pbr_benchmark, gpu_pbr_generate, GpuPbrEngine, GpuPbrParams, GpuPbrResult};
pub use subdivide_cpu_reference::{cpu_subdivide_loop, CpuSubdivisionResult};
pub use subdivide_v2::{
    gpu_subdivide_v2, gpu_subdivide_v2_and_register, GpuSubdivideEngineV2, GpuSubdivideResult,
    SubdivisionTopology,
};
