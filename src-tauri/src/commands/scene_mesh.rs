//! Thin Tauri adapters for shared scene mesh state commands.

use k_os_scene_runtime::mesh_state::SharedMeshInfo;

#[tauri::command]
pub fn register_shared_mesh_cmd(positions: Vec<f32>, indices: Vec<u32>) -> Result<u64, String> {
    k_os_scene_runtime::mesh_state::register_shared_mesh_cmd(positions, indices)
}

#[tauri::command]
pub fn dispose_shared_mesh_cmd(handle: u64) -> Result<(), String> {
    k_os_scene_runtime::mesh_state::dispose_shared_mesh_cmd(handle)
}

#[tauri::command]
pub fn get_shared_meshes_info() -> Result<Vec<SharedMeshInfo>, String> {
    k_os_scene_runtime::mesh_state::get_shared_meshes_info()
}
