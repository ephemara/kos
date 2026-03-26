//! Thin Tauri adapters for atlas and unwrap commands.

use k_os_mesh::{
    classify_mesh as classify_mesh_impl, unwrap_and_optimize as unwrap_and_optimize_impl,
    unwrap_mesh_xatlas as unwrap_mesh_xatlas_impl, AtlasResult, ClassificationResult,
    UnwrapOptimizeResult,
};

#[tauri::command]
pub fn unwrap_mesh_xatlas(positions: Vec<f32>, indices: Vec<u32>) -> Result<AtlasResult, String> {
    unwrap_mesh_xatlas_impl(positions, indices)
}

#[tauri::command]
pub fn classify_mesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
) -> Result<ClassificationResult, String> {
    classify_mesh_impl(positions, indices)
}

#[tauri::command]
pub fn unwrap_and_optimize(
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
) -> Result<UnwrapOptimizeResult, String> {
    unwrap_and_optimize_impl(positions, normals, indices)
}
