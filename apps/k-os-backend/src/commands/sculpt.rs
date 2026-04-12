//! Thin Tauri adapters for sculpt commands.

use k_os_sculpt::{self as sculpt, viewport};

#[tauri::command]
pub fn init_sculpt_mesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
) -> Result<sculpt::SculptMeshHandle, String> {
    sculpt::init_sculpt_mesh(positions, indices)
}

#[tauri::command]
pub fn init_sculpt_mesh_binary(
    positions_bytes: Vec<u8>,
    indices_bytes: Vec<u8>,
) -> Result<sculpt::SculptMeshHandle, String> {
    sculpt::init_sculpt_mesh_binary(positions_bytes, indices_bytes)
}

#[tauri::command]
pub fn apply_brush(
    handle: sculpt::SculptMeshHandle,
    point: [f32; 3],
    normal: [f32; 3],
    tool: String,
    radius: f32,
    intensity: f32,
    symmetry: Option<String>,
    use_gpu: Option<bool>,
    alpha_handle: Option<u64>,
    delta: Option<[f32; 3]>,
) -> Result<sculpt::BrushResult, String> {
    sculpt::apply_brush(
        handle,
        point,
        normal,
        tool,
        radius,
        intensity,
        symmetry,
        use_gpu,
        alpha_handle,
        delta,
    )
}

#[tauri::command]
pub fn apply_brush_spirv(
    handle: sculpt::SculptMeshHandle,
    point: [f32; 3],
    normal: [f32; 3],
    shader_name: String,
    radius: f32,
    intensity: f32,
    alpha_handle: Option<u64>,
) -> Result<sculpt::BrushResult, String> {
    sculpt::apply_brush_spirv(
        handle,
        point,
        normal,
        shader_name,
        radius,
        intensity,
        alpha_handle,
    )
}

#[tauri::command]
pub fn update_sculpt_positions(
    handle: sculpt::SculptMeshHandle,
    positions: Vec<f32>,
) -> Result<(), String> {
    sculpt::update_sculpt_positions(handle, positions)
}

#[tauri::command]
pub fn get_sculpt_positions(handle: sculpt::SculptMeshHandle) -> Result<Vec<f32>, String> {
    sculpt::get_sculpt_positions(handle)
}

#[tauri::command]
pub fn get_sculpt_viewport_payload(
    handle: sculpt::SculptMeshHandle,
) -> Result<k_os_eval::mesh_pipeline::ViewportBufferPayload, String> {
    viewport::get_sculpt_viewport_payload(handle)
}

#[tauri::command]
pub fn dispose_sculpt_mesh(handle: sculpt::SculptMeshHandle) -> Result<(), String> {
    sculpt::dispose_sculpt_mesh(handle)
}

#[tauri::command]
pub fn benchmark_sculpt(vertex_count: usize, radius: f32) -> Result<String, String> {
    sculpt::benchmark_sculpt(vertex_count, radius)
}
