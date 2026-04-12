use crate::viewport_contract::{
    CameraState, FrameStats, RendererMode, SelectionResult, ShadingMode, ViewportConfig,
};
use crate::viewport_host;
use k_os_eval::mesh_pipeline::ViewportBufferPayload;
use k_os_renderer::{
    spawn_headless_service_with_source, BridgeError, CameraState as RendererCameraState,
    EvaluatedMeshSource, FrameStats as RendererFrameStats, RenderMeshHandle, RendererError,
    RendererMode as RendererViewportMode, RendererService,
    SelectionResult as RendererSelectionResult, ShadingMode as RendererShadingMode,
    ViewportConfig as RendererViewportConfig, ViewportHandle,
};
use k_os_scene::MeshHandle;
use k_os_sculpt::viewport::{get_sculpt_viewport_payload, SculptMeshHandle};
use serde_json::to_vec;
use std::sync::OnceLock;
use tauri::Manager;

#[derive(Default)]
struct SceneRuntimeMeshSource;

impl EvaluatedMeshSource for SceneRuntimeMeshSource {
    fn viewport_payload(&self, mesh: MeshHandle) -> Result<ViewportBufferPayload, BridgeError> {
        k_os_scene_runtime::mesh_state::evaluate_viewport_payload(mesh).map_err(|reason| {
            BridgeError::PayloadUnavailable {
                mesh: mesh.raw(),
                reason,
            }
        })
    }
}

fn renderer_service() -> &'static RendererService {
    static SERVICE: OnceLock<RendererService> = OnceLock::new();
    SERVICE.get_or_init(|| {
        spawn_headless_service_with_source(Some(std::sync::Arc::new(SceneRuntimeMeshSource)))
    })
}

fn map_err(err: RendererError) -> String {
    err.to_string()
}

fn into_renderer_config(config: ViewportConfig) -> RendererViewportConfig {
    RendererViewportConfig {
        width: config.width,
        height: config.height,
        shading_mode: match config.shading_mode {
            ShadingMode::Solid => RendererShadingMode::Solid,
            ShadingMode::Wireframe => RendererShadingMode::Wireframe,
        },
        background_color: config.background_color,
        enable_selection: config.enable_selection,
        enable_shadows: config.enable_shadows,
        msaa_samples: config.msaa_samples,
        renderer_mode: match config.renderer_mode {
            RendererMode::Native => RendererViewportMode::Native,
            RendererMode::ThreeFallback => RendererViewportMode::ThreeFallback,
        },
    }
}

fn into_renderer_camera(camera: CameraState) -> RendererCameraState {
    RendererCameraState {
        position: camera.position,
        target: camera.target,
        up: camera.up,
        fov_degrees: camera.fov_degrees,
        near: camera.near,
        far: camera.far,
    }
}

fn into_contract_selection(result: RendererSelectionResult) -> SelectionResult {
    SelectionResult {
        hit: result.hit,
        mesh_handle: result.mesh_handle,
        face_index: result.face_index,
        position: result.position,
        normal: result.normal,
        distance: result.distance,
    }
}

fn into_contract_stats(stats: RendererFrameStats) -> FrameStats {
    FrameStats {
        frame_time_ms: stats.frame_time_ms,
        fps: stats.fps,
        vertex_count: stats.vertex_count,
        face_count: stats.face_count,
        draw_calls: stats.draw_calls,
        mesh_sync_time_ms: stats.mesh_sync_time_ms,
        selection_latency_ms: stats.selection_latency_ms,
        gpu_upload_bytes: stats.gpu_upload_bytes,
        gpu_memory_bytes: stats.gpu_memory_bytes,
    }
}

#[tauri::command]
pub async fn viewport_create(
    app: tauri::AppHandle,
    config: ViewportConfig,
) -> Result<ViewportHandle, String> {
    let renderer_config = into_renderer_config(config.clone());
    let handle = renderer_service()
        .create_viewport(renderer_config.clone())
        .map_err(map_err)?;

    if let Err(err) = viewport_host::create_native_viewport_session(&app, handle, &renderer_config)
    {
        let _ = renderer_service().dispose_viewport(handle);
        return Err(err);
    }

    Ok(handle)
}

#[tauri::command]
pub async fn viewport_dispose(
    app: tauri::AppHandle,
    viewport: ViewportHandle,
) -> Result<(), String> {
    viewport_host::close_native_viewport_session(&app, viewport)?;
    renderer_service()
        .dispose_viewport(viewport)
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_attach_mesh(
    viewport: ViewportHandle,
    mesh: u64,
) -> Result<RenderMeshHandle, String> {
    renderer_service()
        .attach_mesh(viewport, MeshHandle(mesh))
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_detach_mesh(
    viewport: ViewportHandle,
    render_mesh: RenderMeshHandle,
) -> Result<(), String> {
    renderer_service()
        .detach_mesh(viewport, render_mesh)
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_set_camera(
    viewport: ViewportHandle,
    camera: CameraState,
) -> Result<(), String> {
    renderer_service()
        .set_camera(viewport, into_renderer_camera(camera))
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_request_redraw(viewport: ViewportHandle) -> Result<(), String> {
    renderer_service().request_redraw(viewport).map_err(map_err)
}

#[tauri::command]
pub async fn viewport_request_selection(
    viewport: ViewportHandle,
    ndc_x: f32,
    ndc_y: f32,
) -> Result<SelectionResult, String> {
    renderer_service()
        .request_selection(viewport, [ndc_x, ndc_y])
        .map(into_contract_selection)
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_get_stats(viewport: ViewportHandle) -> Result<FrameStats, String> {
    renderer_service()
        .get_stats(viewport)
        .map(into_contract_stats)
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_sync_sculpt_mesh(
    app: tauri::AppHandle,
    viewport: ViewportHandle,
    sculpt_handle: SculptMeshHandle,
) -> Result<RenderMeshHandle, String> {
    let payload = get_sculpt_viewport_payload(sculpt_handle)?;
    let render_mesh = renderer_service()
        .sync_viewport_payload(viewport, payload.clone())
        .map_err(map_err)?;

    let local_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve app local data dir: {e}"))?;
    std::fs::create_dir_all(&local_data_dir)
        .map_err(|e| format!("Failed to create viewport payload dir: {e}"))?;
    let payload_path = local_data_dir.join(format!("viewport-payload-{}.json", viewport.raw()));
    std::fs::write(&payload_path, to_vec(&payload).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Failed to write viewport payload: {e}"))?;
    viewport_host::send_viewport_payload_path(&payload_path.to_string_lossy())?;

    Ok(render_mesh)
}

#[tauri::command]
pub async fn viewport_sync_scene_mesh(
    viewport: ViewportHandle,
    mesh: u64,
) -> Result<RenderMeshHandle, String> {
    renderer_service()
        .sync_mesh_from_source(viewport, MeshHandle(mesh))
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_mark_mesh_dirty(mesh: u64) -> Result<usize, String> {
    renderer_service()
        .mark_mesh_dirty(MeshHandle(mesh))
        .map_err(map_err)
}

#[tauri::command]
pub async fn viewport_sync_primitive(
    viewport: ViewportHandle,
    primitive_id: String,
) -> Result<(), String> {
    let primitive_type = match primitive_id.to_lowercase().as_str() {
        "sphere" | "icosphere" => 0,
        "cube" => 1,
        "cylinder" => 2,
        "torus" => 3,
        "plane" => 4,
        "capsule" | "octahedron" => 0,
        other => return Err(format!("Unsupported native primitive '{}'", other)),
    };

    renderer_service()
        .request_redraw(viewport)
        .map_err(map_err)?;
    viewport_host::send_primitive_load(primitive_type)?;
    Ok(())
}

#[tauri::command]
pub async fn native_host_cursor(x: f32, y: f32) -> Result<(), String> {
    viewport_host::send_cursor_ndc(x, y)
}

#[tauri::command]
pub async fn native_host_camera_rotate(dx: f32, dy: f32) -> Result<(), String> {
    viewport_host::send_camera_rotate(dx, dy)
}

#[tauri::command]
pub async fn native_host_camera_zoom(delta: f32) -> Result<(), String> {
    viewport_host::send_camera_zoom(delta)
}

#[tauri::command]
pub async fn native_host_brush(
    tool: u8,
    radius: f32,
    intensity: f32,
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
) -> Result<(), String> {
    viewport_host::send_brush_stroke(tool, radius, intensity, x, y, dx, dy)
}

#[tauri::command]
pub async fn native_host_snapshot() -> Result<(), String> {
    viewport_host::send_snapshot()
}
