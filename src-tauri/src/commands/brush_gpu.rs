//! Thin Tauri adapters for shared GPU brush infrastructure.

use std::collections::HashMap;

#[tauri::command]
pub fn load_alpha_from_file(
    path: String,
    name: Option<String>,
) -> Result<k_os_gpu_pipeline::AlphaInfo, String> {
    k_os_gpu_pipeline::brush::alpha_pool::load_alpha_from_file(path, name)
}

#[tauri::command]
pub fn load_alpha_from_base64(
    data: String,
    name: String,
) -> Result<k_os_gpu_pipeline::AlphaInfo, String> {
    k_os_gpu_pipeline::brush::alpha_pool::load_alpha_from_base64(data, name)
}

#[tauri::command]
pub fn list_alphas() -> Vec<k_os_gpu_pipeline::AlphaInfo> {
    k_os_gpu_pipeline::brush::alpha_pool::list_alphas()
}

#[tauri::command]
pub fn dispose_alpha(handle: k_os_gpu_pipeline::AlphaHandle) -> bool {
    k_os_gpu_pipeline::brush::alpha_pool::dispose_alpha(handle)
}

#[tauri::command]
pub fn get_alpha_info(
    handle: k_os_gpu_pipeline::AlphaHandle,
) -> Option<k_os_gpu_pipeline::AlphaInfo> {
    k_os_gpu_pipeline::brush::alpha_pool::get_alpha_info(handle)
}

#[tauri::command]
pub fn generate_procedural_alpha(
    proc_type: String,
    size: u32,
    params: Option<HashMap<String, f32>>,
) -> Result<k_os_gpu_pipeline::AlphaInfo, String> {
    k_os_gpu_pipeline::brush::procedural::generate_procedural_alpha(proc_type, size, params)
}
