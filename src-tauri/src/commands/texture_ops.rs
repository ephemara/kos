//! Thin Tauri adapters for texture, paint, and procedural commands.

use k_os_material::paint_ops::CanvasData;
pub use k_os_material::texture_ops::{
    NoiseDisplacementResult, NoiseParams, PbrMapSet, PbrParams, ProceduralParams, ProceduralResult,
    VoronoiParams,
};

#[tauri::command]
pub fn apply_noise_displacement(
    positions: Vec<f32>,
    normals: Vec<f32>,
    params: NoiseParams,
) -> Result<NoiseDisplacementResult, String> {
    k_os_material::texture_ops::apply_noise_displacement(positions, normals, params)
}

#[tauri::command]
pub fn sample_noise_point(x: f32, y: f32, z: f32, params: NoiseParams) -> f64 {
    k_os_material::texture_ops::sample_noise_point(x, y, z, params)
}

#[tauri::command]
pub fn generate_noise_texture(
    width: u32,
    height: u32,
    params: NoiseParams,
) -> Result<Vec<f32>, String> {
    k_os_material::texture_ops::generate_noise_texture(width, height, params)
}

#[tauri::command]
pub fn generate_pbr_maps(image_base64: String, params: PbrParams) -> Result<PbrMapSet, String> {
    k_os_material::texture_ops::generate_pbr_maps(image_base64, params)
}

#[tauri::command]
pub fn generate_normal_map(image_base64: String, strength: f32) -> Result<String, String> {
    k_os_material::texture_ops::generate_normal_map(image_base64, strength)
}

#[tauri::command]
pub fn generate_procedural_texture(params: ProceduralParams) -> Result<ProceduralResult, String> {
    k_os_material::texture_ops::generate_procedural_texture(params)
}

#[tauri::command]
pub fn generate_voronoi_texture(params: VoronoiParams) -> Result<ProceduralResult, String> {
    k_os_material::texture_ops::generate_voronoi_texture(params)
}

#[tauri::command]
pub fn blend_textures(
    base_image: String,
    overlay_image: String,
    blend_mode: String,
    opacity: f32,
) -> Result<String, String> {
    k_os_material::texture_ops::blend_textures(base_image, overlay_image, blend_mode, opacity)
}

#[tauri::command]
pub fn gpu_paint_init(width: u32, height: u32) -> Result<u64, String> {
    k_os_material::paint_ops::gpu_paint_init(width, height)
}

#[tauri::command]
pub fn gpu_paint_stroke(
    handle: u64,
    from_x: f32,
    from_y: f32,
    to_x: f32,
    to_y: f32,
    pressure: f32,
    color: String,
    size: f32,
    opacity: f32,
    blend_mode: String,
) -> Result<(), String> {
    k_os_material::paint_ops::gpu_paint_stroke(
        handle, from_x, from_y, to_x, to_y, pressure, color, size, opacity, blend_mode,
    )
}

#[tauri::command]
pub fn gpu_paint_end_stroke(handle: u64) -> Result<(), String> {
    k_os_material::paint_ops::gpu_paint_end_stroke(handle)
}

#[tauri::command]
pub fn gpu_paint_get_canvas(handle: u64) -> Result<CanvasData, String> {
    k_os_material::paint_ops::gpu_paint_get_canvas(handle)
}

#[tauri::command]
pub fn gpu_paint_clear(handle: u64, color: String) -> Result<(), String> {
    k_os_material::paint_ops::gpu_paint_clear(handle, color)
}

#[tauri::command]
pub fn gpu_paint_undo(handle: u64) -> Result<bool, String> {
    k_os_material::paint_ops::gpu_paint_undo(handle)
}

#[tauri::command]
pub fn gpu_paint_dispose(handle: u64) -> Result<(), String> {
    k_os_material::paint_ops::gpu_paint_dispose(handle)
}
