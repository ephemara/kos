//! K_OS Backend - High-Performance Rust Engine
//!
//! This is the Tauri v2 backend for K_OS, providing Rust-accelerated
//! implementations of compute-heavy operations.

// ===========================================================================
// FUTURE-USE CODE ALLOWANCES
// ===========================================================================
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(unused_mut)]
#![allow(unused_parens)]
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod baking; // Texture baking operations
mod commands; // Feature-specific command handlers
mod kain_commands; // KAIN language compiler bridge
mod mocap; // Zen mocap command surface
mod mocap_bridge; // Shared K_OS <-> ZenMocap interop event bus
mod python_bridge; // Python sidecar - AI/ML operations
mod viewport_host; // Native viewport host adapter

use tauri::Emitter; // Required for event emission in Tauri v2
use tauri::Manager; // Required for get_webview_window

use k_os_brushes as brushes;
use k_os_external as external;
use k_os_gpu_pipeline::gpu;
use k_os_gpu_pipeline::{atlas as gpu_atlas, pipelines as gpu_pipelines, svt as gpu_svt};
use k_os_material::autopbr::MaterialSystem;
use k_os_sculpt::{brush_dynamics, brush_stroke, mask};
use k_os_sim::{cfd, fluid, physics, quantum};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::Mutex;

// ============================================================================
// ENGINE MODE STATE
// ============================================================================

lazy_static! {
    static ref ENGINE_MODE: Mutex<String> = Mutex::new("LAUNCHER".to_string());
}

/// Set the engine mode (called from React KMain)
#[tauri::command]
fn set_engine_mode(mode: String) -> Result<String, String> {
    log::info!("[K_OS] Setting engine mode: {}", mode);
    let mut current = ENGINE_MODE.lock().map_err(|e| e.to_string())?;
    *current = mode.clone();
    Ok(format!("MODE ACTIVE: {}", mode))
}

/// Get current engine status
#[tauri::command]
fn get_engine_status() -> String {
    let mode = ENGINE_MODE.lock().unwrap_or_else(|e| e.into_inner());
    format!("K_OS ENGINE V2: {} | RUST_BACKEND_ACTIVE", *mode)
}

// =============================================================================
// WINDOW MANAGEMENT
// =============================================================================

/// Set window always-on-top state dynamically
async fn set_window_always_on_top(
    window: tauri::Window,
    always_on_top: bool,
) -> Result<(), String> {
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())
}

/// Focus the main Tauri window
async fn focus_main_window(window: tauri::Window) -> Result<(), String> {
    window.set_focus().map_err(|e| e.to_string())
}

/// Minimize the main window
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Unminimize/restore the main window
async fn unminimize_window(window: tauri::Window) -> Result<(), String> {
    window.unminimize().map_err(|e| e.to_string())
}

/// Toggle maximize state
async fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

/// Get current window position and size
async fn get_window_bounds(window: tauri::Window) -> Result<serde_json::Value, String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "x": pos.x,
        "y": pos.y,
        "width": size.width,
        "height": size.height
    }))
}

/// Set window position
async fn set_window_position(window: tauri::Window, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

/// Set window size
async fn set_window_size(window: tauri::Window, width: u32, height: u32) -> Result<(), String> {
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())
}

/// Save binary data to a temp file and return the path
fn save_temp_glb(data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    // Move UP one level to avoid triggering the watcher in src-tauri
    let assets_dir = cwd.parent().unwrap_or(&cwd).join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    let file_path = assets_dir.join("k_sculpt_sync.glb");
    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok("k_sculpt_sync.glb".to_string())
}

fn save_kernel_artifact_glb(id: String, data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let assets_dir = cwd.parent().unwrap_or(&cwd).join("assets");

    let kernel_dir = assets_dir.join("Imports").join("kernel");
    if !kernel_dir.exists() {
        std::fs::create_dir_all(&kernel_dir).map_err(|e| e.to_string())?;
    }

    let safe_id = id.replace('/', "_").replace('\\', "_");
    let file_name = format!("{}.glb", safe_id);
    let file_path = kernel_dir.join(&file_name);

    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(format!("Imports/kernel/{}", file_name))
}

/// Perform raycast from React (cursor position -> hit point)
/// Now uses GPU-accelerated BVH raycasting
#[tauri::command]
fn perform_raycast(
    mesh_handle: u64,
    origin: [f32; 3],
    direction: [f32; 3],
    _max_distance: f32, // Ignored by GPU raycast (uses infinite ray)
) -> Result<k_os_gpu_pipeline::RayHit, String> {
    k_os_gpu_pipeline::gpu_raycast(mesh_handle, origin, direction)
}

// ============================================================================
// RETOPOLOGY COMMANDS
// ============================================================================

/// Auto-retopology - Generate clean quad topology from high-poly mesh
///
/// # Arguments
/// * `vertices` - Vertex positions as flat array [x, y, z, x, y, z, ...]
/// * `indices` - Triangle indices
/// * `target_poly_count` - Target number of polygons
///
/// # Returns
/// Retopologized mesh with vertices and indices
#[tauri::command]
async fn auto_retopo(
    app: tauri::AppHandle,
    vertices: Vec<f32>,
    indices: Vec<u32>,
    target_poly_count: u32,
) -> Result<serde_json::Value, String> {
    use glam::Vec3;
    use k_os_mesh_processing::{retopology, Mesh};

    // Emit progress event
    let _ = app.emit(
        "retopo-progress",
        serde_json::json!({
            "stage": "starting",
            "progress": 0.0,
            "message": "Starting auto-retopology..."
        }),
    );

    // Convert flat vertex array to Vec3
    if vertices.len() % 3 != 0 {
        return Err("Vertex array length must be multiple of 3".to_string());
    }

    let vertex_positions: Vec<Vec3> = vertices
        .chunks(3)
        .map(|chunk| Vec3::new(chunk[0], chunk[1], chunk[2]))
        .collect();

    // Create mesh
    let mesh = Mesh::from_vertices_indices(vertex_positions, indices);

    // Emit progress
    let _ = app.emit(
        "retopo-progress",
        serde_json::json!({
            "stage": "processing",
            "progress": 0.2,
            "message": format!("Processing mesh with {} triangles...", mesh.triangle_count())
        }),
    );

    // Perform auto-retopo
    let retopo_mesh = retopology::auto_retopo(&mesh, target_poly_count)
        .map_err(|e| format!("Auto-retopo failed: {}", e))?;

    // Emit progress
    let _ = app.emit(
        "retopo-progress",
        serde_json::json!({
            "stage": "finalizing",
            "progress": 0.9,
            "message": format!("Generated {} triangles", retopo_mesh.triangle_count())
        }),
    );

    // Convert back to flat arrays
    let out_vertices: Vec<f32> = retopo_mesh
        .vertices
        .iter()
        .flat_map(|v| vec![v.x, v.y, v.z])
        .collect();

    let triangle_count = retopo_mesh.triangle_count();
    let vertex_count = retopo_mesh.vertex_count();
    let out_indices = retopo_mesh.indices;

    // Emit completion
    let _ = app.emit(
        "retopo-progress",
        serde_json::json!({
            "stage": "complete",
            "progress": 1.0,
            "message": "Auto-retopology complete!"
        }),
    );

    Ok(serde_json::json!({
        "vertices": out_vertices,
        "indices": out_indices,
        "triangleCount": triangle_count,
        "vertexCount": vertex_count,
    }))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KainToolchainRequest {
    enabled: bool,
    kain_root: String,
    asm_crate_dir: String,
    web_crate_dir: String,
    cli_bin: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KainCompileRequest {
    entry: String,
    source: Option<String>,
    targets: Vec<String>,
    toolchain: KainToolchainRequest,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KainCompileArtifact {
    target: String,
    output_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KainCompileResponse {
    status: String,
    artifacts: Vec<KainCompileArtifact>,
    command: String,
}

fn resolve_kain_cli(app: &tauri::AppHandle, request: &KainCompileRequest) -> String {
    use std::path::Path;

    let mut candidates: Vec<String> = Vec::new();

    if let Ok(env_path) = std::env::var("KAIN_BIN_PATH") {
        if !env_path.trim().is_empty() {
            candidates.push(env_path);
        }
    }

    if let Ok(resource_path) = app.path().resolve(
        "resources/bin/kain.exe",
        tauri::path::BaseDirectory::Resource,
    ) {
        candidates.push(resource_path.to_string_lossy().to_string());
    }

    if !request.toolchain.cli_bin.trim().is_empty() {
        candidates.push(request.toolchain.cli_bin.clone());
    }

    candidates.push("M:/code/target/release/kain.exe".to_string());
    candidates.push("M:/Code/target/release/kain.exe".to_string());
    candidates.push("M:/code/Kain/target/release/kain.exe".to_string());
    candidates.push("M:/Code/Kain/target/release/kain.exe".to_string());

    for candidate in candidates {
        if candidate.eq_ignore_ascii_case("kain") {
            return candidate;
        }
        if Path::new(&candidate).exists() {
            return candidate;
        }
    }

    "kain".to_string()
}

fn resolve_kain_workdir(
    app: &tauri::AppHandle,
    request: &KainCompileRequest,
) -> std::path::PathBuf {
    use std::path::PathBuf;

    let requested = PathBuf::from(&request.toolchain.kain_root);
    if requested.exists() {
        return requested;
    }

    let workspace_crate = std::env::current_dir()
        .ok()
        .map(|cwd| cwd.join("crates").join("k-os-kain"));
    if let Some(path) = workspace_crate {
        if path.exists() {
            return path;
        }
    }

    if let Ok(resource_kain_root) = app
        .path()
        .resolve("resources/kain", tauri::path::BaseDirectory::Resource)
    {
        if resource_kain_root.exists() {
            return resource_kain_root;
        }
    }

    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn resolve_kain_output_root(
    app: &tauri::AppHandle,
    request: &KainCompileRequest,
) -> std::path::PathBuf {
    use std::path::PathBuf;

    let web_crate = PathBuf::from(&request.toolchain.web_crate_dir);
    if web_crate.exists() {
        return web_crate.join("generated");
    }

    let workspace_output = std::env::current_dir()
        .ok()
        .map(|cwd| cwd.join("crates").join("k-os-kain").join("generated"));
    if let Some(path) = workspace_output {
        return path;
    }

    if let Ok(local_data) = app.path().app_local_data_dir() {
        return local_data.join("kain").join("generated");
    }

    std::env::temp_dir()
        .join("k_os")
        .join("kain")
        .join("generated")
}

fn clone_global_gpu_device() -> Arc<k_os_gpu_pipeline::device::GpuComputeDevice> {
    let gpu = k_os_gpu_pipeline::device::GpuComputeDevice::get_or_init_blocking()
        .expect("Failed to initialize GPU device");
    let gpu = gpu.lock();
    Arc::new(k_os_gpu_pipeline::device::GpuComputeDevice {
        device: gpu.device.clone(),
        queue: gpu.queue.clone(),
        adapter_info: gpu.adapter_info.clone(),
        force_sync: gpu.force_sync,
    })
}

fn seed_bundled_runtime_env(app: &tauri::AppHandle) {
    if std::env::var("KAIN_BIN_PATH")
        .map(|v| v.trim().is_empty())
        .unwrap_or(true)
    {
        if let Ok(path) = app.path().resolve(
            "resources/bin/kain.exe",
            tauri::path::BaseDirectory::Resource,
        ) {
            if path.exists() {
                std::env::set_var("KAIN_BIN_PATH", path);
            }
        }
    }

    if std::env::var("KAIN_WORKSPACE_ROOT")
        .map(|v| v.trim().is_empty())
        .unwrap_or(true)
    {
        if let Ok(path) = app.path().resolve(
            "resources/kain-workspace",
            tauri::path::BaseDirectory::Resource,
        ) {
            if path.exists() {
                std::env::set_var("KAIN_WORKSPACE_ROOT", path);
            }
        }
    }

    if std::env::var("KOS_PYTHON_SIDECAR")
        .map(|v| v.trim().is_empty())
        .unwrap_or(true)
    {
        for relative_path in [
            "resources/bin/kos_python/kos_python.exe",
            "resources/bin/kos_python.exe",
        ] {
            let Ok(path) = app
                .path()
                .resolve(relative_path, tauri::path::BaseDirectory::Resource)
            else {
                continue;
            };

            if path.exists() {
                std::env::set_var("KOS_PYTHON_SIDECAR", path);
                break;
            }
        }
    }

    if std::env::var("KOS_PYTHON_MAIN")
        .map(|v| v.trim().is_empty())
        .unwrap_or(true)
    {
        if let Ok(path) = app.path().resolve(
            "resources/runtime/python-source/main.py",
            tauri::path::BaseDirectory::Resource,
        ) {
            if path.exists() {
                std::env::set_var("KOS_PYTHON_MAIN", path);
            }
        }
    }
}

#[tauri::command]
fn kain_compile_multi_target(
    app: tauri::AppHandle,
    request: KainCompileRequest,
) -> Result<KainCompileResponse, String> {
    use std::process::Command;

    if !request.toolchain.enabled {
        return Err("Kain toolchain disabled".to_string());
    }

    if request.targets.is_empty() {
        return Err("No Kain compile targets were provided".to_string());
    }

    let output_root = resolve_kain_output_root(&app, &request);
    std::fs::create_dir_all(&output_root)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let kain_cli = resolve_kain_cli(&app, &request);
    let kain_workdir = resolve_kain_workdir(&app, &request);
    let mut artifacts: Vec<KainCompileArtifact> = Vec::new();
    let mut command_preview = String::new();

    for target in &request.targets {
        let ext = match target.as_str() {
            "kainscript" => "ks",
            "typescript" => "ts",
            "wasm" => "wasm",
            "usf" => "usf",
            "spirv" => "spv",
            "hlsl" => "hlsl",
            other => return Err(format!("Unsupported Kain target: {}", other)),
        };

        let output_path = output_root.join(format!("{}.{}", request.entry, ext));
        let mut cmd = Command::new(&kain_cli);
        cmd.current_dir(&kain_workdir);
        cmd.arg("compile")
            .arg(&request.entry)
            .arg("-t")
            .arg(target)
            .arg("-o")
            .arg(&output_path);

        if let Some(source) = &request.source {
            cmd.arg("--source").arg(source);
        } else {
            cmd.arg("--workspace").arg(&request.toolchain.asm_crate_dir);
        }

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to run Kain compiler for target '{}': {}", target, e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!(
                "Kain compile failed for target '{}': {}\n{}",
                target,
                stderr.trim(),
                stdout.trim()
            ));
        }

        command_preview = format!(
            "{} compile {} -t {} -o {}",
            kain_cli,
            request.entry,
            target,
            output_path.display()
        );
        artifacts.push(KainCompileArtifact {
            target: target.clone(),
            output_path: output_path.to_string_lossy().to_string(),
        });
    }

    Ok(KainCompileResponse {
        status: "compiled".to_string(),
        artifacts,
        command: command_preview,
    })
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

fn main() {
    env_logger::init();

    log::info!("🚀 K_OS Tauri starting...");

    tauri::Builder::default()
        .setup(|app| {
            seed_bundled_runtime_env(&app.handle());

            // ================================================================
            // GPU DOCTOR: Wire wgpu error handler → frontend kos-gpu-error event
            // ================================================================
            // Register a callback in the k-os-engine GPU device that converts
            // uncaptured wgpu errors into Tauri events for GpuDoctorListener.
            // This prevents fatal panics from validation errors during development.
            let handle = app.handle().clone();
            mocap_bridge::set_app_handle(handle.clone());
            k_os_gpu_pipeline::device::register_gpu_error_handler(move |message, category| {
                use tauri::Emitter;

                // Categorise for the frontend toast system
                let frontend_category = match category.as_str() {
                    "Validation" => "Validation",
                    "OutOfMemory" => "OutOfMemory",
                    _ => "Other",
                };

                // Simple non-cryptographic hash for dedup on the frontend
                let hash: u32 = message
                    .bytes()
                    .fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));

                let payload = serde_json::json!({
                    "error": message,
                    "category": frontend_category,
                    "context": format!("wgpu {} error", category),
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs_f64(),
                    "error_hash": hash,
                });

                if let Err(e) = handle.emit("kos-gpu-error", payload) {
                    log::warn!("[GPU Doctor] Failed to emit error event: {}", e);
                }
            });

            log::info!("[GPU Doctor] Error handler registered ✅");
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(python_bridge::PythonBridge::new()) // Python sidecar state
        .manage(baking::BakingState::new()) // Baking system state
        .manage({
            // Initialize MaterialSystem with GPU compute
            let gpu_compute = clone_global_gpu_device();
            let material_system = MaterialSystem::new(gpu_compute);
            commands::autopbr::MaterialSystemState::new(material_system)
        }) // KAutoPBR material system state
        .manage({
            // Initialize HDR capture system with GPU compute
            let gpu_compute = clone_global_gpu_device();
            commands::hdr::HDRState::new(gpu_compute)
        }) // HDR capture system state
        .invoke_handler(tauri::generate_handler![
            python_bridge::python_start,
            python_bridge::python_stop,
            python_bridge::python_call,
            python_bridge::python_run_script,
            // === ENGINE CONTROL ===
            set_engine_mode,
            get_engine_status,
            perform_raycast,
            commands::mesh_ops::spawn_primitive,
            auto_retopo,
            kain_compile_multi_target,
            // Window management commands
            mocap::window::set_window_always_on_top,
            mocap::window::focus_main_window,
            mocap::window::minimize_window,
            mocap::window::unminimize_window,
            mocap::window::toggle_maximize_window,
            mocap::window::get_window_bounds,
            mocap::window::set_window_position,
            mocap::window::set_window_size,
            mocap::window::center_window,
            mocap::window::set_window_resizable,
            mocap::file::save_temp_glb,
            mocap::file::save_kernel_artifact_glb,
            mocap::file::mocap_open_video_dialog,
            mocap::file::mocap_open_take_dialog,
            mocap::file::mocap_save_take_dialog,
            mocap::window::spawn_webcam_window,
            mocap::window::close_webcam_window,
            mocap::window::spawn_mocap_window,
            mocap::window::close_mocap_window,
            mocap::window::spawn_zen_window,
            mocap::window::spawn_legacy_window,
            mocap::window::close_legacy_window,
            // === KAUTOPBR MATERIAL SYSTEM ===
            commands::autopbr::create_material,
            commands::autopbr::load_material,
            commands::autopbr::save_material,
            commands::autopbr::delete_material,
            commands::autopbr::search_materials,
            commands::autopbr::get_material,
            commands::autopbr::filter_materials_by_category,
            commands::autopbr::list_materials,
            commands::autopbr::evaluate_animation,
            commands::autopbr::list_animation_presets,
            commands::autopbr::get_animation_preset,
            commands::autopbr::apply_animation_preset,
            commands::autopbr::search_animation_presets,
            commands::autopbr::list_animation_presets_by_category,
            commands::autopbr::list_animation_presets_by_category,
            // === AI/ML INTEGRATION ===
            commands::autopbr::ai_upscale_texture,
            commands::autopbr::ai_denoise_texture,
            commands::autopbr::ai_identify_material,
            commands::autopbr::ai_make_seamless,
            commands::autopbr::ai_correct_perspective,
            commands::autopbr::ai_remove_folds,
            // === HDR CAPTURE SYSTEM ===
            commands::hdr::hdr_merge_exposures,
            commands::hdr::hdr_tone_map,
            commands::hdr::hdr_add_light,
            commands::hdr::hdr_panorama_to_hdr,
            commands::hdr::hdr_save,
            commands::hdr::hdr_load,
            // === NATIVE VIEWPORT ===
            commands::viewport::viewport_create,
            commands::viewport::viewport_dispose,
            commands::viewport::viewport_attach_mesh,
            commands::viewport::viewport_detach_mesh,
            commands::viewport::viewport_set_camera,
            commands::viewport::viewport_request_redraw,
            commands::viewport::viewport_request_selection,
            commands::viewport::viewport_get_stats,
            commands::viewport::viewport_sync_sculpt_mesh,
            commands::viewport::viewport_sync_scene_mesh,
            commands::viewport::viewport_mark_mesh_dirty,
            commands::viewport::viewport_sync_primitive,
            commands::viewport::native_host_cursor,
            commands::viewport::native_host_camera_rotate,
            commands::viewport::native_host_camera_zoom,
            commands::viewport::native_host_brush,
            commands::viewport::native_host_snapshot,
            commands::gizmo::gizmo_session_create,
            commands::gizmo::gizmo_session_dispose,
            commands::gizmo::gizmo_session_update,
            commands::math::solve_cg,
            commands::math::sparse_multiply,
            commands::math::benchmark_cg,
            // === WORKSPACE REGISTRY ===
            commands::registry::registry_get_workspace_summary,
            commands::registry::registry_list_adapter_targets,
            commands::registry::registry_get_adapter_manifest,
            commands::registry::registry_get_integration_contract,
            commands::registry::registry_list_integration_contracts,
            commands::registry::registry_get_public_api_summary,
            // === SCULPTING ===
            commands::sculpt::init_sculpt_mesh,
            commands::sculpt::init_sculpt_mesh_binary,
            commands::sculpt::apply_brush,
            commands::sculpt::apply_brush_spirv,
            commands::sculpt::update_sculpt_positions,
            commands::sculpt::get_sculpt_positions,
            commands::sculpt::get_sculpt_viewport_payload,
            commands::sculpt::dispose_sculpt_mesh,
            commands::sculpt::benchmark_sculpt,
            // Professional brush stroke processing
            brush_stroke::process_stroke_segment,
            brush_stroke::stabilize_position,
            // === GPU RAYCAST ===
            commands::gpu_raycast::gpu_raycast_init,
            commands::gpu_raycast::gpu_raycast,
            commands::gpu_raycast::gpu_raycast_dispose,
            // === GPU SUBDIVISION ===
            gpu_pipelines::subdivide_v2::gpu_subdivide_v2,
            gpu::pipelines::subdivide_v2::gpu_subdivide_v2_and_register,
            // === MESH OPTIMIZATION ===
            commands::mesh_ops::optimize_mesh,
            commands::mesh_ops::simplify_mesh,
            commands::mesh_ops::generate_lod_chain,
            // === PROCEDURAL NOISE ===
            commands::texture_ops::apply_noise_displacement,
            commands::texture_ops::sample_noise_point,
            commands::texture_ops::generate_noise_texture,
            // === ATLAS ===
            commands::atlas::unwrap_mesh_xatlas,
            commands::atlas::classify_mesh,
            commands::atlas::unwrap_and_optimize,
            // === PHYSICS ENGINE ===
            physics::create_physics_world,
            physics::step_physics,
            physics::add_physics_body,
            physics::add_physics_mesh,
            physics::apply_black_hole_gravity,
            physics::dispose_physics_world,
            // === FLUID SIMULATION ===
            fluid::create_fluid_sim,
            fluid::spawn_fluid_at_uv,
            fluid::step_fluid_sim,
            fluid::get_velocity_grid,
            fluid::apply_fluid_force,
            fluid::apply_fluid_vortex,
            fluid::apply_fluid_black_hole,
            fluid::clear_fluid_sim,
            fluid::dispose_fluid_sim,
            // Legacy compatibility
            fluid::init_fluid_particles,
            fluid::add_fluid_particles,
            fluid::add_fluid_boundary,
            // === KQUANTUM PARTICLE PHYSICS ===
            quantum::quantum_create,
            quantum::quantum_step,
            quantum::quantum_add_attractor,
            // === TEXTURE BAKING ===
            baking::init_baking_system,
            baking::baking_has_gpu,
            baking::bake_normal_map,
            baking::bake_ao_map,
            baking::bake_curvature_map,
            baking::bake_thickness_map,
            baking::bake_position_map,
            baking::bake_id_map,
            baking::bake_batch,
            baking::generate_cage,
            baking::generate_cage_adaptive,
            baking::validate_cage,
            baking::calculate_recommended_extrusion,
            baking::export_map,
            baking::export_maps_batch,
            quantum::quantum_emit,
            quantum::quantum_set_audio,
            quantum::quantum_set_nbody,
            quantum::quantum_clear_attractors,
            quantum::quantum_dispose,
            quantum::quantum_particle_count,
            quantum::quantum_export_json,
            quantum::quantum_export_gltf,
            quantum::quantum_export_vat,
            // === CFD (Computational Fluid Dynamics) ===
            cfd::cfd_create,
            cfd::cfd_step,
            cfd::cfd_add_source,
            cfd::cfd_get_velocity_field,
            cfd::cfd_get_density_field,
            cfd::cfd_dispose,
            // === BRUSH DYNAMICS ===
            brush_dynamics::interpolate_brush_stroke,
            brush_dynamics::calculate_symmetry_uvs,
            brush_dynamics::batch_symmetry_uvs,
            brush_dynamics::get_velocity_grid_rgba,
            brush_dynamics::process_brush_stroke,
            // === PBR TEXTURE GENERATION ===
            commands::texture_ops::generate_pbr_maps,
            commands::texture_ops::generate_normal_map,
            // === SHARED MESH STATE ===
            commands::scene_mesh::register_shared_mesh_cmd,
            commands::scene_mesh::dispose_shared_mesh_cmd,
            commands::scene_mesh::get_shared_meshes_info,
            commands::scene_state::ingest_mocap_take_cmd,
            // === K-RIG ===
            commands::rigging::create_biped_skeleton,
            commands::rigging::generate_skeleton_from_markers,
            commands::rigging::fit_skeleton_to_mesh,
            commands::rigging::compute_skin_weights_geodesic,
            commands::rigging::compute_skin_weights_distance,
            commands::rigging::solve_ik_fabrik,
            commands::rigging::solve_ik_two_bone,
            commands::rigging::solve_ik_ccd,
            commands::rigging::update_skeleton_matrices,
            // === PROCEDURAL TEXTURES ===
            commands::texture_ops::generate_procedural_texture,
            commands::texture_ops::generate_voronoi_texture,
            commands::texture_ops::blend_textures,
            // === PYTHON SIDECAR ===
            python_bridge::python_start,
            python_bridge::python_stop,
            python_bridge::python_call,
            python_bridge::python_ping,
            python_bridge::python_list_functions,
            python_bridge::python_exec,
            python_bridge::python_run_script,
            python_bridge::python_reload_script,
            // === KAIN LANGUAGE RUNTIME ===
            kain_commands::kain_compile,
            kain_commands::kain_run,
            kain_commands::kain_build_file,
            kain_commands::kain_list_sources,
            kain_commands::kain_list_runtime_apps,
            kain_commands::kain_read_source,
            kain_commands::kain_write_source,
            // === SCATTER ===
            commands::scatter::poisson_disk_scatter,
            commands::scatter::poisson_disk_surface,
            commands::scatter::physics_drop_scatter,
            commands::scatter::voronoi_cell_scatter,
            commands::scatter::fibonacci_spiral_scatter,
            commands::scatter::sunflower_disk_scatter,
            commands::scatter::halton_scatter,
            commands::scatter::cluster_scatter,
            commands::scatter::organic_scatter,
            // === MASKING ===
            mask::paint_mask_cmd,
            mask::clear_mask_cmd,
            mask::invert_mask_cmd,
            mask::grow_mask_cmd,
            mask::shrink_mask_cmd,
            mask::blur_mask_cmd,
            mask::get_mask_cmd,
            // === GPU COMPUTE ===
            commands::gpu_benchmark::gpu_sculpt_benchmark,
            // === SVT PAINTING ===
            gpu_svt::commands::svt_init,
            gpu_svt::commands::svt_stroke,
            gpu_svt::commands::svt_read_tile,
            gpu_svt::commands::svt_export,
            gpu_svt::commands::svt_export_raw,
            gpu_svt::commands::svt_dispose,
            gpu_svt::commands::svt_stats,
            // === SVT PBR (Multi-Channel) ===
            gpu_svt::pbr_commands::svt_pbr_init,
            gpu_svt::pbr_commands::svt_pbr_stroke,
            gpu_svt::pbr_commands::svt_pbr_export_channel,
            gpu_svt::pbr_commands::svt_pbr_clear_channel,
            gpu_svt::pbr_commands::svt_pbr_clear_all,
            gpu_svt::pbr_commands::svt_pbr_stats,
            gpu_svt::pbr_commands::svt_pbr_dispose,
            // === GPU ATLAS ===
            gpu_atlas::gpu_atlas_init,
            gpu_atlas::gpu_atlas_project,
            gpu_atlas::gpu_atlas_dispose,
            gpu_atlas::gpu_atlas_project_oneshot,
            gpu_atlas::gpu_atlas_pack,
            // === GPU PAINT ===
            commands::texture_ops::gpu_paint_init,
            commands::texture_ops::gpu_paint_stroke,
            commands::texture_ops::gpu_paint_end_stroke,
            commands::texture_ops::gpu_paint_get_canvas,
            commands::texture_ops::gpu_paint_clear,
            commands::texture_ops::gpu_paint_undo,
            commands::texture_ops::gpu_paint_dispose,
            // === GPU DYNAMESH ===
            gpu_pipelines::dynamesh::gpu_dynamesh,
            gpu_pipelines::dynamesh::gpu_dynamesh_benchmark,
            // === GPU PBR ===
            gpu_pipelines::pbr::gpu_pbr_generate,
            gpu_pipelines::pbr::gpu_pbr_benchmark,
            // === GPU SUBDIVISION ===
            gpu_pipelines::subdivide_v2::gpu_subdivide_v2,
            gpu::pipelines::subdivide_v2::gpu_subdivide_v2_and_register,
            // === UNIVERSAL BRUSH/ALPHA SYSTEM ===
            commands::brush_gpu::load_alpha_from_file,
            commands::brush_gpu::load_alpha_from_base64,
            commands::brush_gpu::list_alphas,
            commands::brush_gpu::dispose_alpha,
            commands::brush_gpu::get_alpha_info,
            commands::brush_gpu::generate_procedural_alpha,
            // === BRUSH LIBRARY ===
            brushes::library::init_brush_library,
            brushes::library::list_brushes,
            brushes::library::get_brush,
            brushes::library::save_brush,
            brushes::library::delete_brush,
            brushes::registry::list_kernels,
            // === K_OS PATHS ===
            commands::io_paths::get_kos_user_root,
            commands::io_paths::get_kos_user_dir,
            commands::io_paths::list_kos_directory,
            commands::io_paths::read_file_base64,
            // === EXTERNAL TOOLS ===
            external::instant_meshes::instant_meshes_remesh,
            external::instant_meshes::instant_meshes_available,
            // === CONFIGURATION REGISTRY ===
            k_os_config::registry::list_config_brushes,
            k_os_config::registry::list_config_export_formats,
            k_os_config::registry::list_config_viewport_presets,
            k_os_config::registry::get_config_brush,
            k_os_config::registry::get_config_export_format,
            k_os_config::registry::get_config_viewport_preset,
            k_os_config::registry::list_config_shading_modes,
            k_os_config::registry::list_config_shading_modes_by_app,
            k_os_config::registry::get_config_shading_mode,
            // === FILE OPERATIONS ===
            k_os_io::file_ops::write_file,
            k_os_io::file_ops::read_file,
            k_os_io::file_ops::file_exists,
            k_os_io::file_ops::export_texture_exr,
            // === ZEN MOCAP ===
            mocap::mocap::mocap_enumerate_cameras,
            mocap::mocap::mocap_list_models,
            mocap::mocap::mocap_get_state,
            mocap::mocap::mocap_start_session,
            mocap::mocap::mocap_stop_session,
            mocap::mocap::mocap_set_paused,
            mocap::mocap::mocap_set_recording,
            mocap::mocap::mocap_update_ik,
            mocap::mocap::mocap_apply_timeline_runtime_requests,
            mocap::mocap::mocap_reset_timeline_runtime_state,
            mocap::mocap::mocap_set_timeline_runtime_active_take,
            mocap::mocap::mocap_get_timeline_runtime_diagnostics_policy,
            mocap::mocap::mocap_get_timeline_runtime_diagnostics,
            mocap::mocap::mocap_commit_timeline_runtime_to_take,
            mocap::mocap::mocap_commit_timeline_runtime_to_active_take,
            mocap::mocap::mocap_hydrate_timeline_runtime_from_take,
            mocap::mocap::mocap_list_takes,
            mocap::mocap::mocap_delete_take,
            mocap::mocap::mocap_rename_take,
            mocap::mocap::mocap_load_take,
            mocap::mocap::mocap_analyze_video,
            mocap::mocap::mocap_cancel_video_analysis,
            mocap::mocap::mocap_probe_video,
            mocap::mocap::mocap_prepare_video_preview,
            mocap::mocap::mocap_seed_bundled_models,
            mocap::mocap::mocap_check_models,
            mocap::mocap::mocap_download_model,
            mocap::mocap::mocap_get_gpu_info,
            mocap::window::spawn_webcam_window,
            mocap::window::close_webcam_window,
            mocap::window::spawn_mocap_window,
            mocap::window::close_mocap_window,
            mocap::window::spawn_zen_window,
            mocap::window::spawn_legacy_window,
            mocap::window::close_legacy_window,
            mocap::file::mocap_open_video_dialog,
            mocap::file::mocap_open_take_dialog,
            mocap::file::mocap_save_take_dialog,
            mocap_bridge::mocap_bridge_publish,
        ])
        .run(tauri::generate_context!())
        .expect("error while running K_OS");
}
