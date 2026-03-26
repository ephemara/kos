use crate::types::RenderMeshHandle;
use k_os_scene::MeshHandle;

#[derive(Debug, Clone)]
pub struct RenderMeshRuntime {
    pub handle: RenderMeshHandle,
    pub scene_mesh: MeshHandle,
    pub viewport: crate::types::ViewportHandle,
    pub dirty: bool,
    pub payload_version: Option<u64>,
    pub vertex_count: u32,
    pub index_count: u32,
    pub gpu_upload_bytes: u64,
}
