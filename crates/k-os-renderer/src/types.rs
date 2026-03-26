use serde::{Deserialize, Serialize};
use thiserror::Error;

macro_rules! define_handle {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub u64);

        impl $name {
            pub fn raw(self) -> u64 {
                self.0
            }
        }
    };
}

define_handle!(ViewportHandle);
define_handle!(RenderMeshHandle);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RendererMode {
    Native,
    ThreeFallback,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShadingMode {
    Solid,
    Wireframe,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraState {
    pub position: [f32; 3],
    pub target: [f32; 3],
    pub up: [f32; 3],
    pub fov_degrees: f32,
    pub near: f32,
    pub far: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionResult {
    pub hit: bool,
    pub mesh_handle: Option<u64>,
    pub face_index: Option<u32>,
    pub position: Option<[f32; 3]>,
    pub normal: Option<[f32; 3]>,
    pub distance: Option<f32>,
}

impl SelectionResult {
    pub fn no_hit() -> Self {
        Self {
            hit: false,
            mesh_handle: None,
            face_index: None,
            position: None,
            normal: None,
            distance: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

impl Default for FrameStats {
    fn default() -> Self {
        Self {
            frame_time_ms: 0.0,
            fps: 0.0,
            vertex_count: 0,
            face_count: 0,
            draw_calls: 0,
            mesh_sync_time_ms: 0.0,
            selection_latency_ms: 0.0,
            gpu_upload_bytes: 0,
            gpu_memory_bytes: 0,
        }
    }
}

#[derive(Debug, Error)]
pub enum RendererError {
    #[error("renderer service unavailable")]
    ServiceUnavailable,
    #[error("viewport not found: {0}")]
    ViewportNotFound(u64),
    #[error("render mesh not found: {0}")]
    RenderMeshNotFound(u64),
    #[error("viewport limit exceeded")]
    ViewportLimitExceeded,
    #[error("invalid viewport config: {0}")]
    InvalidConfig(String),
    #[error("invalid camera: {0}")]
    InvalidCamera(String),
    #[error("mesh payload sync failed: {0}")]
    MeshSyncFailed(String),
    #[error("render execution failed: {0}")]
    RenderExecutionFailed(String),
}
