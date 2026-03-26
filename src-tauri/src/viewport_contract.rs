use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RendererMode {
    Native,
    ThreeFallback,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShadingMode {
    Solid,
    Wireframe,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ViewportConfig {
    pub width: u32,
    pub height: u32,
    pub shading_mode: ShadingMode,
    pub background_color: [f32; 4],
    pub enable_selection: bool,
    pub enable_shadows: bool,
    pub msaa_samples: u32,
    pub renderer_mode: RendererMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CameraState {
    pub position: [f32; 3],
    pub target: [f32; 3],
    pub up: [f32; 3],
    pub fov_degrees: f32,
    pub near: f32,
    pub far: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SelectionResult {
    pub hit: bool,
    pub mesh_handle: Option<u64>,
    pub face_index: Option<u32>,
    pub position: Option<[f32; 3]>,
    pub normal: Option<[f32; 3]>,
    pub distance: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FrameStats {
    pub frame_time_ms: f32,
    pub fps: f32,
    pub vertex_count: u32,
    pub face_count: u32,
    pub draw_calls: u32,
    pub mesh_sync_time_ms: f32,
    pub selection_latency_ms: f32,
    pub gpu_upload_bytes: u64,
    pub gpu_memory_bytes: u64,
}
