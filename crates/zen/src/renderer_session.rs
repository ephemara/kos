use crate::config::RendererConfig;
use crate::FlyCamera;
use glam::Vec3;
use k_os_scene::MeshHandle;
use k_os_renderer::{
    spawn_headless_service, CameraState as RendererCameraState, RenderMeshHandle,
    RendererMode as RendererViewportMode, RendererService, SelectionResult,
    ShadingMode as RendererShadingMode, ViewportConfig as RendererViewportConfig,
    ViewportHandle,
};
use std::collections::{HashMap, HashSet};
use wgpu::util::DeviceExt;
use winit::dpi::PhysicalSize;
use zen_scene::{SceneMesh, ZenScene};

struct SceneGeometry {
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    index_count: u32,
    vertex_count: u32,
}

pub(crate) struct ZenRendererSession {
    renderer_service: RendererService,
    viewport: Option<ViewportHandle>,
    viewport_size: Option<(u32, u32)>,
    scene_meshes: HashMap<u64, RenderMeshHandle>,
    scene_geometry: Option<SceneGeometry>,
}

impl ZenRendererSession {
    pub(crate) fn new() -> Self {
        Self {
            renderer_service: spawn_headless_service(),
            viewport: None,
            viewport_size: None,
            scene_meshes: HashMap::new(),
            scene_geometry: None,
        }
    }

    pub(crate) fn sync_scene(
        &mut self,
        device: &wgpu::Device,
        scene: &ZenScene,
        viewport_size: PhysicalSize<u32>,
        _renderer_config: &RendererConfig,
    ) -> Result<(), String> {
        let viewport = self.ensure_viewport(viewport_size)?;
        let payloads = scene.bridge_sources()?;
        let active_handles = payloads
            .iter()
            .map(|payload| payload.mesh_handle.raw())
            .collect::<HashSet<_>>();
        self.detach_missing_meshes(viewport, &active_handles)?;

        for payload in payloads {
            let mesh_handle = payload.mesh_handle.raw();
            let shared_handle = k_os_scene_runtime::mesh_state::sync_shared_mesh_for_source(
                payload.mesh_handle,
                payload.positions,
                payload.normals,
                payload.indices,
            )?;
            let runtime_mesh_handle =
                k_os_scene_runtime::mesh_state::shared_mesh_scene_handle(shared_handle)?;
            let render_payload =
                k_os_scene_runtime::mesh_state::evaluate_viewport_payload(runtime_mesh_handle)?;
            let render_mesh = self
                .renderer_service
                .sync_viewport_payload(viewport, render_payload)
                .map_err(|err| err.to_string())?;
            self.scene_meshes.insert(mesh_handle, render_mesh);
        }

        self.renderer_service
            .request_redraw(viewport)
            .map_err(|err| err.to_string())?;

        let scene_mesh = scene.build_render_mesh()?;
        self.scene_geometry = Some(create_scene_buffers(device, &scene_mesh));
        Ok(())
    }

    pub(crate) fn sync_camera(&self, camera: &FlyCamera) -> Result<(), String> {
        let viewport = match self.viewport {
            Some(viewport) => viewport,
            None => return Ok(()),
        };

        self.renderer_service
            .set_camera(viewport, into_renderer_camera(camera))
            .map_err(|err| err.to_string())
    }

    pub(crate) fn request_selection(&self, ndc: [f32; 2]) -> Result<SelectionResult, String> {
        let viewport = self
            .viewport
            .ok_or_else(|| "renderer viewport not initialized".to_string())?;
        self.renderer_service
            .request_selection(viewport, ndc)
            .map_err(|err| err.to_string())
    }

    pub(crate) fn scene_geometry(&self) -> Option<(&wgpu::Buffer, &wgpu::Buffer, u32, u32)> {
        self.scene_geometry.as_ref().map(|geometry| {
            (
                &geometry.vertex_buffer,
                &geometry.index_buffer,
                geometry.index_count,
                geometry.vertex_count,
            )
        })
    }

    pub(crate) fn scene_counts(&self) -> (u32, u32) {
        self.scene_geometry()
            .map(|(_, _, index_count, vertex_count)| (vertex_count, index_count))
            .unwrap_or((0, 0))
    }

    pub(crate) fn status_suffix(&self) -> String {
        let Some(viewport) = self.viewport else {
            return "renderer offline".to_string();
        };

        match self.renderer_service.get_stats(viewport) {
            Ok(stats) => format!(
                "renderer {}v/{}f // {} draw // {:.2}ms sync // {:.2}ms sel",
                stats.vertex_count,
                stats.face_count,
                stats.draw_calls,
                stats.mesh_sync_time_ms,
                stats.selection_latency_ms
            ),
            Err(err) => format!("renderer degraded // {err}"),
        }
    }

    fn ensure_viewport(
        &mut self,
        viewport_size: PhysicalSize<u32>,
    ) -> Result<ViewportHandle, String> {
        let normalized_size = (viewport_size.width.max(1), viewport_size.height.max(1));
        if self.viewport_size == Some(normalized_size) {
            return self
                .viewport
                .ok_or_else(|| "renderer viewport not initialized".to_string());
        }

        if let Some(viewport) = self.viewport.take() {
            let _ = self.renderer_service.dispose_viewport(viewport);
        }
        self.scene_meshes.clear();

        let viewport = self
            .renderer_service
            .create_viewport(RendererViewportConfig {
                width: normalized_size.0,
                height: normalized_size.1,
                shading_mode: RendererShadingMode::Solid,
                background_color: [0.0, 0.0, 0.0, 1.0],
                enable_selection: true,
                enable_shadows: true,
                msaa_samples: 1,
                renderer_mode: RendererViewportMode::Native,
            })
            .map_err(|err| err.to_string())?;

        self.viewport = Some(viewport);
        self.viewport_size = Some(normalized_size);
        Ok(viewport)
    }

    fn detach_missing_meshes(
        &mut self,
        viewport: ViewportHandle,
        active_handles: &HashSet<u64>,
    ) -> Result<(), String> {
        let stale = self
            .scene_meshes
            .iter()
            .filter_map(|(mesh_handle, render_mesh)| {
                (!active_handles.contains(mesh_handle)).then_some((*mesh_handle, *render_mesh))
            })
            .collect::<Vec<_>>();

        for (mesh_handle, render_mesh) in stale {
            k_os_scene_runtime::mesh_state::dispose_shared_mesh_for_source(MeshHandle(mesh_handle));
            self.renderer_service
                .detach_mesh(viewport, render_mesh)
                .map_err(|err| err.to_string())?;
            self.scene_meshes.remove(&mesh_handle);
        }

        Ok(())
    }
}

fn into_renderer_camera(camera: &FlyCamera) -> RendererCameraState {
    let forward = camera.forward();
    RendererCameraState {
        position: camera.position.to_array(),
        target: (camera.position + forward).to_array(),
        up: Vec3::Y.to_array(),
        fov_degrees: camera.fov_degrees,
        near: camera.near_plane,
        far: camera.far_plane,
    }
}

fn create_scene_buffers(device: &wgpu::Device, mesh: &SceneMesh) -> SceneGeometry {
    let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("zen-vertex-buffer"),
        contents: bytemuck::cast_slice(&mesh.vertices),
        usage: wgpu::BufferUsages::VERTEX,
    });
    let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("zen-index-buffer"),
        contents: bytemuck::cast_slice(&mesh.indices),
        usage: wgpu::BufferUsages::INDEX,
    });
    SceneGeometry {
        vertex_buffer,
        index_buffer,
        index_count: mesh.indices.len() as u32,
        vertex_count: mesh.vertices.len() as u32,
    }
}
