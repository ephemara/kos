//! Thin Tauri adapters for GPU raycast commands.

#[tauri::command]
pub fn gpu_raycast_init(
    positions: Vec<f32>,
    indices: Vec<u32>,
    uvs: Option<Vec<f32>>,
) -> Result<u64, String> {
    k_os_gpu_pipeline::gpu_raycast_init(positions, indices, uvs)
}

#[tauri::command]
pub fn gpu_raycast(
    handle: u64,
    origin: [f32; 3],
    direction: [f32; 3],
) -> Result<k_os_gpu_pipeline::RayHit, String> {
    k_os_gpu_pipeline::gpu_raycast(handle, origin, direction)
}

#[tauri::command]
pub fn gpu_raycast_dispose(handle: u64) -> Result<(), String> {
    k_os_gpu_pipeline::gpu_raycast_dispose(handle)
}
