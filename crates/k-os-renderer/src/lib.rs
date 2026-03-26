pub mod bridge;
mod camera;
mod mesh;
mod picking;
mod render_graph;
pub mod service;
mod types;
mod viewport;

pub use bridge::{
    sync_mesh_from_source, BridgeError, DirectRendererUploadBridge, EvaluatedMeshSource,
    PipelineRendererUploadBridge, RendererUploadBridge,
};
pub use mesh::RenderMeshRuntime;
pub use render_graph::{
    has_renderer_shader, renderer_shader_by_id, renderer_shader_catalog, renderer_shader_for_pass,
    DispatchTopology, DrawPacket, RenderGraph, RenderGraphExecutionContext,
    RenderGraphExecutionReport, RenderPassKind, RenderResourceBinding, RenderResourceUsage,
    RendererShaderBinding,
};
pub use service::{
    spawn_headless_service, spawn_headless_service_with_source,
    spawn_headless_service_with_source_and_bridge, RendererCommand, RendererService,
};
pub use types::{
    CameraState, FrameStats, RenderMeshHandle, RendererError, RendererMode, SelectionResult,
    ShadingMode, ViewportConfig, ViewportHandle,
};
pub use viewport::ViewportRuntime;

use camera::validate_camera;
use k_os_eval::mesh_pipeline::ViewportBufferPayload;
use k_os_scene::MeshHandle;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

fn request_gpu_device() -> Option<(Arc<wgpu::Device>, Arc<wgpu::Queue>)> {
    pollster::block_on(async {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                force_fallback_adapter: false,
                compatible_surface: None,
            })
            .await
            .ok()?;
        let limits = adapter.limits();
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: limits,
                memory_hints: wgpu::MemoryHints::Performance,
                label: Some("k-os-renderer-device"),
                trace: wgpu::Trace::Off,
            })
            .await
            .ok()?;
        Some((Arc::new(device), Arc::new(queue)))
    })
}

static NEXT_VIEWPORT_ID: AtomicU64 = AtomicU64::new(1);
static NEXT_RENDER_MESH_ID: AtomicU64 = AtomicU64::new(1);

pub struct Renderer {
    _device: Option<Arc<wgpu::Device>>,
    _queue: Option<Arc<wgpu::Queue>>,
    render_graph: RenderGraph,
    viewports: HashMap<ViewportHandle, ViewportRuntime>,
    meshes: HashMap<RenderMeshHandle, RenderMeshRuntime>,
    scene_to_render: HashMap<MeshHandle, Vec<RenderMeshHandle>>,
    selection_cache: HashMap<MeshHandle, picking::MeshSelectionCache>,
}

impl Renderer {
    pub fn new(device: Arc<wgpu::Device>, queue: Arc<wgpu::Queue>) -> Self {
        Self {
            _device: Some(device),
            _queue: Some(queue),
            render_graph: RenderGraph::default(),
            viewports: HashMap::new(),
            meshes: HashMap::new(),
            scene_to_render: HashMap::new(),
            selection_cache: HashMap::new(),
        }
    }

    pub fn with_optional_gpu() -> Self {
        if let Some((device, queue)) = request_gpu_device() {
            Self::new(device, queue)
        } else {
            Self::headless()
        }
    }

    pub fn headless() -> Self {
        Self {
            _device: None,
            _queue: None,
            render_graph: RenderGraph::default(),
            viewports: HashMap::new(),
            meshes: HashMap::new(),
            scene_to_render: HashMap::new(),
            selection_cache: HashMap::new(),
        }
    }

    pub fn render_graph(&self) -> &RenderGraph {
        &self.render_graph
    }

    pub fn is_gpu_enabled(&self) -> bool {
        self._device.is_some() && self._queue.is_some()
    }

    pub fn gpu_device_queue(&self) -> Option<(Arc<wgpu::Device>, Arc<wgpu::Queue>)> {
        match (&self._device, &self._queue) {
            (Some(device), Some(queue)) => Some((Arc::clone(device), Arc::clone(queue))),
            _ => None,
        }
    }

    fn viewport_context(
        &self,
        viewport: ViewportHandle,
    ) -> Result<RenderGraphExecutionContext, RendererError> {
        let runtime = self
            .viewports
            .get(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        let (vertex_count, index_count, _, _) = self.viewport_mesh_totals(viewport)?;
        let allow_gpu_dispatch = std::env::var_os("KOS_ENABLE_EXPERIMENTAL_RENDER_GRAPH_DISPATCH")
            .is_some()
            && self.is_gpu_enabled()
            && vertex_count > 0
            && index_count > 0;
        Ok(RenderGraphExecutionContext {
            viewport_width: runtime.config.width,
            viewport_height: runtime.config.height,
            vertex_count,
            index_count,
            face_count: index_count / 3,
            instance_count: runtime.attached_meshes.len() as u32,
            shading_mode: runtime.config.shading_mode,
            allow_gpu_dispatch,
        })
    }

    fn viewport_mesh_totals(
        &self,
        viewport: ViewportHandle,
    ) -> Result<(u32, u32, u64, u64), RendererError> {
        if !self.viewports.contains_key(&viewport) {
            return Err(RendererError::ViewportNotFound(viewport.raw()));
        }

        let mut vertex_count = 0_u32;
        let mut index_count = 0_u32;
        let mut gpu_upload_bytes = 0_u64;
        let mut gpu_memory_bytes = 0_u64;
        for mesh in self
            .meshes
            .values()
            .filter(|mesh| mesh.viewport == viewport)
        {
            vertex_count = vertex_count.saturating_add(mesh.vertex_count);
            index_count = index_count.saturating_add(mesh.index_count);
            let estimated_bytes =
                (mesh.vertex_count as u64 * 24).saturating_add(mesh.index_count as u64 * 4);
            gpu_memory_bytes = gpu_memory_bytes.saturating_add(estimated_bytes);
            gpu_upload_bytes = gpu_upload_bytes.saturating_add(if mesh.gpu_upload_bytes == 0 {
                estimated_bytes
            } else {
                mesh.gpu_upload_bytes
            });
        }
        Ok((
            vertex_count,
            index_count,
            gpu_upload_bytes,
            gpu_memory_bytes,
        ))
    }

    pub fn current_frame_stats(
        &self,
        viewport: ViewportHandle,
    ) -> Result<FrameStats, RendererError> {
        let (vertex_count, index_count, gpu_upload_bytes, gpu_memory_bytes) =
            self.viewport_mesh_totals(viewport)?;
        Ok(FrameStats {
            frame_time_ms: 0.0,
            fps: 0.0,
            vertex_count,
            face_count: index_count / 3,
            draw_calls: self.draw_call_count(viewport)?,
            mesh_sync_time_ms: 0.0,
            selection_latency_ms: 0.0,
            gpu_upload_bytes,
            gpu_memory_bytes,
        })
    }

    pub fn execute_viewport(
        &mut self,
        viewport: ViewportHandle,
    ) -> Result<Option<RenderGraphExecutionReport>, RendererError> {
        let redraw_requested = self
            .viewports
            .get(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?
            .redraw_requested;
        if !redraw_requested {
            return Ok(None);
        }

        let device = self._device.clone();
        let queue = self._queue.clone();
        let context = self.viewport_context(viewport)?;
        if !context.allow_gpu_dispatch {
            if let Some(runtime) = self.viewports.get_mut(&viewport) {
                runtime.redraw_requested = false;
            }
            return Ok(None);
        }

        let report = if let (Some(device), Some(queue)) = (device, queue) {
            Some(
                self.render_graph
                    .execute(&device, &queue, &context)
                    .map_err(RendererError::RenderExecutionFailed)?,
            )
        } else {
            None
        };

        if let Some(runtime) = self.viewports.get_mut(&viewport) {
            runtime.redraw_requested = false;
        }
        Ok(report)
    }

    pub fn create_viewport(
        &mut self,
        config: ViewportConfig,
    ) -> Result<ViewportHandle, RendererError> {
        if self.viewports.len() >= 16 {
            return Err(RendererError::ViewportLimitExceeded);
        }

        if config.width == 0 || config.height == 0 {
            return Err(RendererError::InvalidConfig(
                "width and height must be greater than zero".to_string(),
            ));
        }

        if !matches!(config.msaa_samples, 1 | 2 | 4 | 8) {
            return Err(RendererError::InvalidConfig(
                "msaa_samples must be one of 1, 2, 4, or 8".to_string(),
            ));
        }

        let handle = ViewportHandle(NEXT_VIEWPORT_ID.fetch_add(1, Ordering::Relaxed));
        self.viewports.insert(
            handle,
            ViewportRuntime {
                handle,
                config,
                camera: None,
                redraw_requested: false,
                attached_meshes: Vec::new(),
            },
        );
        Ok(handle)
    }

    pub fn dispose_viewport(&mut self, viewport: ViewportHandle) -> Result<(), RendererError> {
        let runtime = self
            .viewports
            .remove(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        let attached = runtime.attached_meshes;
        for scene_mesh in attached {
            let mut remove_scene_entry = false;
            if let Some(render_handles) = self.scene_to_render.get_mut(&scene_mesh) {
                render_handles.retain(|handle| {
                    self.meshes
                        .get(handle)
                        .map(|mesh| mesh.viewport != viewport)
                        .unwrap_or(false)
                });
                remove_scene_entry = render_handles.is_empty();
            }
            if remove_scene_entry {
                self.scene_to_render.remove(&scene_mesh);
            }
        }
        self.meshes.retain(|_, mesh| mesh.viewport != viewport);
        Ok(())
    }

    pub fn attach_mesh(
        &mut self,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<RenderMeshHandle, RendererError> {
        let viewport_runtime = self
            .viewports
            .get_mut(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        viewport_runtime.attached_meshes.push(mesh);

        let handle = RenderMeshHandle(NEXT_RENDER_MESH_ID.fetch_add(1, Ordering::Relaxed));
        self.meshes.insert(
            handle,
            RenderMeshRuntime {
                handle,
                scene_mesh: mesh,
                viewport,
                dirty: true,
                payload_version: None,
                vertex_count: 0,
                index_count: 0,
                gpu_upload_bytes: 0,
            },
        );
        self.scene_to_render.entry(mesh).or_default().push(handle);
        Ok(handle)
    }

    pub fn detach_mesh(
        &mut self,
        viewport: ViewportHandle,
        render_mesh: RenderMeshHandle,
    ) -> Result<(), RendererError> {
        let mesh = self
            .meshes
            .remove(&render_mesh)
            .ok_or(RendererError::RenderMeshNotFound(render_mesh.raw()))?;
        if mesh.viewport != viewport {
            return Err(RendererError::RenderMeshNotFound(render_mesh.raw()));
        }
        if let Some(viewport_runtime) = self.viewports.get_mut(&viewport) {
            viewport_runtime
                .attached_meshes
                .retain(|attached| *attached != mesh.scene_mesh);
        }
        let mut remove_scene_entry = false;
        if let Some(render_handles) = self.scene_to_render.get_mut(&mesh.scene_mesh) {
            render_handles.retain(|handle| *handle != render_mesh);
            remove_scene_entry = render_handles.is_empty();
        }
        if remove_scene_entry {
            self.scene_to_render.remove(&mesh.scene_mesh);
        }
        Ok(())
    }

    pub fn set_camera(
        &mut self,
        viewport: ViewportHandle,
        camera: CameraState,
    ) -> Result<(), RendererError> {
        validate_camera(&camera)?;
        let viewport_runtime = self
            .viewports
            .get_mut(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        viewport_runtime.camera = Some(camera);
        viewport_runtime.redraw_requested = true;
        Ok(())
    }

    pub fn request_redraw(&mut self, viewport: ViewportHandle) -> Result<(), RendererError> {
        let viewport_runtime = self
            .viewports
            .get_mut(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        viewport_runtime.redraw_requested = true;
        Ok(())
    }

    pub fn request_selection(
        &mut self,
        viewport: ViewportHandle,
        ndc: [f32; 2],
    ) -> Result<SelectionResult, RendererError> {
        let runtime = self
            .viewports
            .get(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        let camera = runtime.camera.ok_or_else(|| {
            RendererError::InvalidCamera("viewport camera not initialized".to_string())
        })?;

        for mesh_handle in &runtime.attached_meshes {
            if let Some(cache) = self.selection_cache.get(mesh_handle) {
                let result = picking::pick(&camera, ndc, cache)?;
                if result.hit {
                    return Ok(result);
                }
            }
        }

        Ok(SelectionResult::no_hit())
    }

    pub fn draw_call_count(&self, viewport: ViewportHandle) -> Result<u32, RendererError> {
        let runtime = self
            .viewports
            .get(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        Ok(runtime.attached_meshes.len() as u32)
    }

    pub fn attached_meshes(
        &self,
        viewport: ViewportHandle,
    ) -> Result<Vec<MeshHandle>, RendererError> {
        let runtime = self
            .viewports
            .get(&viewport)
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))?;
        Ok(runtime.attached_meshes.clone())
    }

    pub fn redraw_requested_viewports(&self) -> Vec<ViewportHandle> {
        self.viewports
            .iter()
            .filter_map(|(handle, runtime)| runtime.redraw_requested.then_some(*handle))
            .collect()
    }

    pub fn mark_mesh_dirty(&mut self, mesh: MeshHandle) -> usize {
        let mut touched = 0_usize;
        if let Some(render_handles) = self.scene_to_render.get(&mesh) {
            for render_handle in render_handles {
                if let Some(runtime) = self.meshes.get_mut(render_handle) {
                    runtime.dirty = true;
                    if let Some(viewport) = self.viewports.get_mut(&runtime.viewport) {
                        viewport.redraw_requested = true;
                    }
                    touched += 1;
                }
            }
        }
        touched
    }

    pub fn set_render_mesh_upload_bytes(
        &mut self,
        render_mesh: RenderMeshHandle,
        gpu_upload_bytes: u64,
    ) -> Result<(), RendererError> {
        let runtime = self
            .meshes
            .get_mut(&render_mesh)
            .ok_or(RendererError::RenderMeshNotFound(render_mesh.raw()))?;
        runtime.gpu_upload_bytes = gpu_upload_bytes;
        Ok(())
    }

    pub fn sync_mesh_from_source(
        &mut self,
        viewport: ViewportHandle,
        mesh: MeshHandle,
        source: &dyn crate::bridge::EvaluatedMeshSource,
    ) -> Result<RenderMeshHandle, crate::bridge::BridgeError> {
        crate::bridge::sync_mesh_from_source(self, viewport, mesh, source)
    }

    pub fn sync_viewport_payload(
        &mut self,
        viewport: ViewportHandle,
        payload: ViewportBufferPayload,
    ) -> Result<RenderMeshHandle, RendererError> {
        if !self.viewports.contains_key(&viewport) {
            return Err(RendererError::ViewportNotFound(viewport.raw()));
        }

        let payload_version = picking::payload_version(&payload);
        let scene_mesh = payload.mesh_handle;
        let estimated_bytes = (payload.positions.len() as u64 * 4)
            .saturating_add(payload.normals.len() as u64 * 4)
            .saturating_add(payload.indices.len() as u64 * 4);

        let render_mesh = if let Some(existing) =
            self.scene_to_render.get(&scene_mesh).and_then(|handles| {
                handles.iter().copied().find(|handle| {
                    self.meshes
                        .get(handle)
                        .map(|mesh| mesh.viewport == viewport)
                        .unwrap_or(false)
                })
            }) {
            existing
        } else {
            self.attach_mesh(viewport, scene_mesh)?
        };

        let associated_render_meshes = self
            .scene_to_render
            .get(&scene_mesh)
            .cloned()
            .unwrap_or_else(|| vec![render_mesh]);

        for handle in &associated_render_meshes {
            if let Some(mesh_runtime) = self.meshes.get_mut(handle) {
                mesh_runtime.payload_version = Some(payload_version);
                mesh_runtime.dirty = false;
                mesh_runtime.vertex_count = payload.vertex_count as u32;
                mesh_runtime.index_count = payload.index_count as u32;
                mesh_runtime.gpu_upload_bytes = if *handle == render_mesh {
                    estimated_bytes
                } else {
                    0
                };
            }
        }

        if let Some(viewport_runtime) = self.viewports.get_mut(&viewport) {
            if !viewport_runtime.attached_meshes.contains(&scene_mesh) {
                viewport_runtime.attached_meshes.push(scene_mesh);
            }
        } else {
            return Err(RendererError::ViewportNotFound(viewport.raw()));
        }

        let rebuild = self
            .selection_cache
            .get(&scene_mesh)
            .map(|cache| cache.version != payload_version)
            .unwrap_or(true);

        if rebuild {
            let cache = picking::build_selection_cache(&payload)?;
            self.selection_cache.insert(scene_mesh, cache);
        }

        for handle in associated_render_meshes {
            if let Some(mesh_runtime) = self.meshes.get(&handle) {
                if let Some(runtime) = self.viewports.get_mut(&mesh_runtime.viewport) {
                    runtime.redraw_requested = true;
                }
            }
        }
        Ok(render_mesh)
    }
}
