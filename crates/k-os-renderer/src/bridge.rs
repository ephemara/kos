use crate::{RenderMeshHandle, Renderer, RendererError, ViewportHandle};
use k_os_eval::mesh_pipeline::ViewportBufferPayload;
use k_os_gpu_pipeline::{
    next_buffer_capacity, GPUPipelineManager, GpuMeshBridge, GpuMeshBufferHandles,
    GpuMeshBufferSizing, GpuMeshUploadPlan,
};
use k_os_scene::MeshHandle;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("evaluated mesh payload unavailable for mesh {mesh}: {reason}")]
    PayloadUnavailable { mesh: u64, reason: String },
    #[error("gpu upload failed for mesh {mesh}: {reason}")]
    GpuUploadFailed { mesh: u64, reason: String },
    #[error("renderer sync failed: {0}")]
    Renderer(#[from] RendererError),
}

impl From<BridgeError> for RendererError {
    fn from(value: BridgeError) -> Self {
        match value {
            BridgeError::Renderer(err) => err,
            other => RendererError::MeshSyncFailed(other.to_string()),
        }
    }
}

pub trait EvaluatedMeshSource: Send + Sync {
    fn viewport_payload(&self, mesh: MeshHandle) -> Result<ViewportBufferPayload, BridgeError>;
}

pub trait RendererUploadBridge: Send + Sync {
    fn sync_mesh(
        &self,
        renderer: &mut Renderer,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<RenderMeshHandle, BridgeError>;

    fn mark_mesh_dirty(&self, renderer: &mut Renderer, mesh: MeshHandle) -> usize;
}

pub struct DirectRendererUploadBridge;

impl RendererUploadBridge for DirectRendererUploadBridge {
    fn sync_mesh(
        &self,
        _renderer: &mut Renderer,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<RenderMeshHandle, BridgeError> {
        let _ = mesh;
        let _ = viewport;
        Err(BridgeError::PayloadUnavailable {
            mesh: mesh.raw(),
            reason: "direct bridge requires payload source; call sync_mesh_from_source".to_string(),
        })
    }

    fn mark_mesh_dirty(&self, renderer: &mut Renderer, mesh: MeshHandle) -> usize {
        renderer.mark_mesh_dirty(mesh)
    }
}

pub struct PipelineRendererUploadBridge {
    source: Arc<dyn EvaluatedMeshSource>,
    manager: Mutex<GPUPipelineManager>,
    buffers: Mutex<HashMap<RenderMeshHandle, GpuMeshBufferHandles>>,
    last_uploads: Mutex<HashMap<RenderMeshHandle, GpuMeshUploadPlan>>,
}

impl PipelineRendererUploadBridge {
    pub fn new(
        device: Arc<wgpu::Device>,
        queue: Arc<wgpu::Queue>,
        source: Arc<dyn EvaluatedMeshSource>,
    ) -> Self {
        Self {
            source,
            manager: Mutex::new(GPUPipelineManager::new(device, queue)),
            buffers: Mutex::new(HashMap::new()),
            last_uploads: Mutex::new(HashMap::new()),
        }
    }
}

impl RendererUploadBridge for PipelineRendererUploadBridge {
    fn sync_mesh(
        &self,
        renderer: &mut Renderer,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<RenderMeshHandle, BridgeError> {
        let payload = self.source.viewport_payload(mesh)?;
        let upload_plan = GpuMeshBridge::plan_from_viewport_payload(&payload);
        let render_mesh = renderer
            .sync_viewport_payload(viewport, payload)
            .map_err(BridgeError::from)?;

        let mut manager = self.manager.lock();
        let mut handles = self.buffers.lock();

        let required_position = upload_plan.positions_bytes.len() as u64;
        let required_normal = upload_plan.normals_bytes.len() as u64;
        let required_index = upload_plan.indices_bytes.len() as u64;
        let needs_realloc = handles
            .get(&render_mesh)
            .map(|existing| {
                existing.positions.size() < required_position
                    || existing.normals.size() < required_normal
                    || existing.indices.size() < required_index
            })
            .unwrap_or(true);

        if needs_realloc {
            let existing = handles.get(&render_mesh);
            let sizing = GpuMeshBufferSizing {
                position_bytes: next_buffer_capacity(
                    required_position,
                    existing.map(|buffer| buffer.positions.size()),
                ),
                normal_bytes: next_buffer_capacity(
                    required_normal,
                    existing.map(|buffer| buffer.normals.size()),
                ),
                index_bytes: next_buffer_capacity(
                    required_index,
                    existing.map(|buffer| buffer.indices.size()),
                ),
            };

            if let Some(previous) = handles.remove(&render_mesh) {
                manager.return_buffer(previous.positions);
                manager.return_buffer(previous.normals);
                manager.return_buffer(previous.indices);
            }

            let allocated = GpuMeshBridge::allocate_buffers_with_sizing(&mut manager, sizing)
                .map_err(|err| BridgeError::GpuUploadFailed {
                    mesh: mesh.raw(),
                    reason: err.to_string(),
                })?;
            handles.insert(render_mesh, allocated);
        }

        if let Some(gpu_buffers) = handles.get(&render_mesh) {
            let previous_upload = {
                let previous = self.last_uploads.lock();
                previous.get(&render_mesh).cloned()
            };
            let partial_plan =
                GpuMeshBridge::build_partial_upload_plan(previous_upload.as_ref(), &upload_plan);
            let uploaded_bytes =
                GpuMeshBridge::upload_partial_plan(&manager, gpu_buffers, &partial_plan).map_err(
                    |err| BridgeError::GpuUploadFailed {
                        mesh: mesh.raw(),
                        reason: err.to_string(),
                    },
                )?;

            self.last_uploads.lock().insert(render_mesh, upload_plan);

            renderer
                .set_render_mesh_upload_bytes(render_mesh, uploaded_bytes as u64)
                .map_err(BridgeError::from)?;
        } else {
            return Err(BridgeError::GpuUploadFailed {
                mesh: mesh.raw(),
                reason: "missing GPU buffers after allocation".to_string(),
            });
        }

        Ok(render_mesh)
    }

    fn mark_mesh_dirty(&self, renderer: &mut Renderer, mesh: MeshHandle) -> usize {
        renderer.mark_mesh_dirty(mesh)
    }
}

pub fn sync_mesh_from_source(
    renderer: &mut Renderer,
    viewport: ViewportHandle,
    mesh: MeshHandle,
    source: &dyn EvaluatedMeshSource,
) -> Result<RenderMeshHandle, BridgeError> {
    let payload = source.viewport_payload(mesh)?;
    renderer
        .sync_viewport_payload(viewport, payload)
        .map_err(BridgeError::from)
}
