use crate::types::{CameraState, ViewportConfig, ViewportHandle};
use k_os_scene::MeshHandle;

#[derive(Debug, Clone)]
pub struct ViewportRuntime {
    pub handle: ViewportHandle,
    pub config: ViewportConfig,
    pub camera: Option<CameraState>,
    pub redraw_requested: bool,
    pub attached_meshes: Vec<MeshHandle>,
}
