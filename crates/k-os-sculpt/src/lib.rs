//! K_OS Sculpt Domain
//!
//! This crate is the ownership boundary for sculpting-specific logic.
//! During migration it exposes a curated sculpt surface and keeps any
//! remaining engine dependency explicit at the GPU helper boundary.

#[cfg(not(target_arch = "wasm32"))]
pub mod brush_dynamics;
#[cfg(not(target_arch = "wasm32"))]
pub mod brush_stroke;
pub mod brushes;
#[cfg(not(target_arch = "wasm32"))]
pub mod mask;
pub mod sculpt;
pub mod tangents;

pub use sculpt::{
    apply_brush, apply_brush_spirv, benchmark_sculpt, dispose_sculpt_mesh, get_sculpt_positions,
    init_sculpt_mesh, init_sculpt_mesh_binary, update_sculpt_positions, BrushResult, MeshTopology,
    SculptMeshHandle, SpatialGrid,
};
pub use tangents::{compute_tangents, compute_tangents_sparse};

pub mod viewport {
    pub use super::SculptMeshHandle;

    pub fn get_sculpt_viewport_payload(
        handle: SculptMeshHandle,
    ) -> Result<k_os_eval::mesh_pipeline::ViewportBufferPayload, String> {
        super::sculpt::get_sculpt_viewport_payload(handle)
    }
}

pub mod commands {
    pub use super::viewport::get_sculpt_viewport_payload;
    pub use super::{
        apply_brush, apply_brush_spirv, benchmark_sculpt, dispose_sculpt_mesh,
        get_sculpt_positions, init_sculpt_mesh, init_sculpt_mesh_binary, update_sculpt_positions,
    };
}

pub mod gpu {
    pub use k_os_gpu_pipeline::brush;
    pub use k_os_gpu_pipeline::normals;
    pub use k_os_gpu_pipeline::sculpt;
}
