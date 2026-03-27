//! Shared mesh state and viewport bridge ownership for K_OS scene runtime.

#![allow(dead_code)]

use k_os_eval::mesh_pipeline::{
    register_mesh_pipeline, MeshEditNode, MeshPipelineIds, MeshSourceNode, NormalsNode,
    SubdivisionNode, ViewportBuffersNode,
};
use k_os_eval::{EvalContext, EvalGraph};
use k_os_gpu_pipeline::{GpuMeshBridge, GpuMeshUploadSummary};
use k_os_scene::{MeshHandle, SceneWorld, ShadingMode, ViewportStateComponent};
use parry3d::math::{Point, Real};
use parry3d::shape::TriMesh;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Shared mesh data accessible by both sculpt and raycast modules.
pub struct SharedMesh {
    pub mesh_handle: MeshHandle,
    pub trimesh: Option<TriMesh>,
    pub raycast_dirty: bool,
    pub vertex_count: usize,
    pub face_count: usize,
    pub bridge_summary: Option<GpuMeshUploadSummary>,
}

impl SharedMesh {
    pub fn new(mesh_handle: MeshHandle, positions: &[f32], indices: &[u32]) -> Self {
        let vertex_count = positions.len() / 3;
        let face_count = indices.len() / 3;

        Self {
            mesh_handle,
            trimesh: Some(Self::build_trimesh(positions, indices)),
            raycast_dirty: false,
            vertex_count,
            face_count,
            bridge_summary: None,
        }
    }

    fn build_trimesh(positions: &[f32], indices: &[u32]) -> TriMesh {
        let points: Vec<Point<Real>> = positions
            .chunks_exact(3)
            .map(|chunk| Point::new(chunk[0] as Real, chunk[1] as Real, chunk[2] as Real))
            .collect();

        let triangles: Vec<[u32; 3]> = indices
            .chunks_exact(3)
            .map(|chunk| [chunk[0], chunk[1], chunk[2]])
            .collect();

        TriMesh::new(points, triangles)
    }

    pub fn mark_dirty(&mut self) {
        self.raycast_dirty = true;
    }

    pub fn ensure_trimesh(&mut self) {
        if self.raycast_dirty || self.trimesh.is_none() {
            let scene = SCENE_WORLD.read().unwrap();
            if let Ok(source) = scene.mesh_source(self.mesh_handle) {
                self.trimesh = Some(Self::build_trimesh(
                    source.positions.as_ref(),
                    source.indices.as_ref(),
                ));
                self.vertex_count = source.positions.len() / 3;
                self.face_count = source.indices.len() / 3;
            }
            self.bridge_summary = evaluate_viewport_bridge_summary(self.mesh_handle).ok();
            self.raycast_dirty = false;
            log::debug!("[SharedMesh] Rebuilt BVH for {} verts", self.vertex_count);
        }
    }

    pub fn get_trimesh(&mut self) -> &TriMesh {
        self.ensure_trimesh();
        self.trimesh.as_ref().unwrap()
    }
}

lazy_static::lazy_static! {
    pub static ref SHARED_MESHES: Arc<RwLock<HashMap<u64, SharedMesh>>> =
        Arc::new(RwLock::new(HashMap::new()));
    pub static ref SHARED_SOURCE_ALIASES: Arc<RwLock<HashMap<u64, SharedMeshHandle>>> =
        Arc::new(RwLock::new(HashMap::new()));
    pub static ref NEXT_SHARED_HANDLE: Arc<RwLock<u64>> = Arc::new(RwLock::new(1));
    pub static ref SCENE_WORLD: Arc<RwLock<SceneWorld>> = Arc::new(RwLock::new(SceneWorld::new()));
}

pub type SharedMeshHandle = u64;

pub fn register_shared_mesh(
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
    viewport_state: ViewportStateComponent,
) -> SharedMeshHandle {
    let handle = {
        let mut next = NEXT_SHARED_HANDLE.write().unwrap();
        let current = *next;
        *next += 1;
        current
    };

    let mesh_handle = {
        let mut scene = SCENE_WORLD.write().unwrap();
        let mesh_handle = scene.create_mesh(positions, indices, Some(normals));
        scene
            .update_viewport_state(mesh_handle, viewport_state)
            .expect("registered mesh viewport state must update");
        mesh_handle
    };

    let source = {
        let scene = SCENE_WORLD.read().unwrap();
        scene
            .mesh_source(mesh_handle)
            .expect("registered mesh must exist")
    };

    let mesh = SharedMesh::new(
        mesh_handle,
        source.positions.as_ref(),
        source.indices.as_ref(),
    );
    SHARED_MESHES.write().unwrap().insert(handle, mesh);

    log::info!("[SharedMesh] Registered mesh with handle {}", handle);
    handle
}

pub fn sync_shared_mesh_for_source(
    source_handle: MeshHandle,
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
    viewport_state: ViewportStateComponent,
) -> Result<SharedMeshHandle, String> {
    let source_raw = source_handle.raw();
    if let Some(shared_handle) = SHARED_SOURCE_ALIASES
        .read()
        .unwrap()
        .get(&source_raw)
        .copied()
    {
        let mesh_handle = {
            let meshes = SHARED_MESHES.read().unwrap();
            meshes
                .get(&shared_handle)
                .map(|mesh| mesh.mesh_handle)
                .ok_or_else(|| {
                    format!(
                        "shared mesh alias {} points at missing mesh {}",
                        source_raw, shared_handle
                    )
                })?
        };

        {
            let mut scene = SCENE_WORLD.write().unwrap();
            scene
                .update_mesh_source(mesh_handle, positions.clone(), indices.clone(), Some(normals))
                .map_err(|err| err.to_string())?;
            scene
                .update_viewport_state(mesh_handle, viewport_state)
                .map_err(|err| err.to_string())?;
        }

        {
            let mut meshes = SHARED_MESHES.write().unwrap();
            if let Some(mesh) = meshes.get_mut(&shared_handle) {
                mesh.vertex_count = positions.len() / 3;
                mesh.face_count = indices.len() / 3;
                mesh.mark_dirty();
                mesh.bridge_summary = evaluate_viewport_bridge_summary(mesh.mesh_handle).ok();
            }
        }

        return Ok(shared_handle);
    }

    let shared_handle = register_shared_mesh(positions, normals, indices, viewport_state);
    SHARED_SOURCE_ALIASES
        .write()
        .unwrap()
        .insert(source_raw, shared_handle);
    Ok(shared_handle)
}

pub fn dispose_shared_mesh(handle: SharedMeshHandle) {
    let mut meshes = SHARED_MESHES.write().unwrap();
    if meshes.remove(&handle).is_some() {
        log::info!("[SharedMesh] Disposed mesh {}", handle);
    }
}

pub fn dispose_shared_mesh_for_source(source_handle: MeshHandle) {
    let source_raw = source_handle.raw();
    let shared_handle = SHARED_SOURCE_ALIASES.write().unwrap().remove(&source_raw);
    if let Some(shared_handle) = shared_handle {
        dispose_shared_mesh(shared_handle);
    }
}

pub fn shared_mesh_scene_handle(shared_handle: SharedMeshHandle) -> Result<MeshHandle, String> {
    SHARED_MESHES
        .read()
        .unwrap()
        .get(&shared_handle)
        .map(|mesh| mesh.mesh_handle)
        .ok_or_else(|| format!("shared mesh not found: {}", shared_handle))
}

pub fn mark_mesh_dirty(handle: SharedMeshHandle) {
    let mut meshes = SHARED_MESHES.write().unwrap();
    if let Some(mesh) = meshes.get_mut(&handle) {
        mesh.mark_dirty();
    }
}

pub fn update_mesh_positions(
    handle: SharedMeshHandle,
    modified_indices: &[usize],
    new_positions: &[f32],
) {
    let mesh_handle = {
        let meshes = SHARED_MESHES.read().unwrap();
        meshes.get(&handle).map(|mesh| mesh.mesh_handle)
    };

    if let Some(mesh_handle) = mesh_handle {
        let _ = SCENE_WORLD.write().unwrap().update_mesh_positions_partial(
            mesh_handle,
            modified_indices,
            new_positions,
        );
        mark_mesh_dirty(handle);
    }
}

pub fn update_mesh_normals(
    handle: SharedMeshHandle,
    modified_indices: &[usize],
    new_normals: &[f32],
) {
    let mesh_handle = {
        let meshes = SHARED_MESHES.read().unwrap();
        meshes.get(&handle).map(|mesh| mesh.mesh_handle)
    };

    if let Some(mesh_handle) = mesh_handle {
        let _ = SCENE_WORLD.write().unwrap().update_mesh_normals_partial(
            mesh_handle,
            modified_indices,
            new_normals,
        );
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedMeshInfo {
    pub handle: u64,
    pub vertex_count: usize,
    pub face_count: usize,
    pub is_dirty: bool,
    pub bridge_ready: bool,
    pub bridge_position_bytes: usize,
    pub bridge_normal_bytes: usize,
    pub bridge_index_bytes: usize,
    pub shading_mode: ShadingMode,
}

pub fn evaluate_viewport_payload(
    mesh_handle: MeshHandle,
) -> Result<k_os_eval::mesh_pipeline::ViewportBufferPayload, String> {
    let ids = MeshPipelineIds::from_seed(mesh_handle.raw() * 100);
    let mut graph = EvalGraph::new();
    register_mesh_pipeline(&mut graph, ids).map_err(|e| e.to_string())?;

    let mut ctx = EvalContext::default();
    ctx.insert_resource(SCENE_WORLD.clone());

    let source = MeshSourceNode::new(ids.source, mesh_handle);
    let edit = MeshEditNode::new(ids.edit, mesh_handle, ids.source);
    let subdivision = SubdivisionNode::new(ids.subdivision, mesh_handle, ids.edit);
    let normals = NormalsNode::new(ids.normals, ids.subdivision);
    let viewport = ViewportBuffersNode::new(ids.viewport, mesh_handle, ids.normals);

    graph
        .evaluate_registered_node(&source, &mut ctx)
        .map_err(|e| e.to_string())?;
    graph
        .evaluate_registered_node(&edit, &mut ctx)
        .map_err(|e| e.to_string())?;
    graph
        .evaluate_registered_node(&subdivision, &mut ctx)
        .map_err(|e| e.to_string())?;
    graph
        .evaluate_registered_node(&normals, &mut ctx)
        .map_err(|e| e.to_string())?;
    graph
        .evaluate_registered_node(&viewport, &mut ctx)
        .map(|payload| payload.clone())
        .map_err(|e| e.to_string())
}

pub fn evaluate_viewport_bridge_summary(
    mesh_handle: MeshHandle,
) -> Result<GpuMeshUploadSummary, String> {
    let payload = evaluate_viewport_payload(mesh_handle)?;
    let plan = GpuMeshBridge::plan_from_viewport_payload(&payload);
    Ok(GpuMeshBridge::summarize(&plan))
}

pub fn register_shared_mesh_cmd(positions: Vec<f32>, indices: Vec<u32>) -> Result<u64, String> {
    let vertex_count = positions.len() / 3;
    let normals = vec![0.0_f32; vertex_count * 3];
    Ok(register_shared_mesh(
        positions,
        normals,
        indices,
        ViewportStateComponent::default(),
    ))
}

pub fn dispose_shared_mesh_cmd(handle: u64) -> Result<(), String> {
    dispose_shared_mesh(handle);
    Ok(())
}

pub fn get_shared_meshes_info() -> Result<Vec<SharedMeshInfo>, String> {
    let meshes = SHARED_MESHES.read().unwrap();
    let scene = SCENE_WORLD.read().unwrap();
    Ok(meshes
        .iter()
        .map(|(handle, mesh)| SharedMeshInfo {
            handle: *handle,
            vertex_count: mesh.vertex_count,
            face_count: mesh.face_count,
            is_dirty: mesh.raycast_dirty,
            bridge_ready: mesh.bridge_summary.is_some(),
            bridge_position_bytes: mesh
                .bridge_summary
                .map(|summary| summary.position_bytes)
                .unwrap_or_default(),
            bridge_normal_bytes: mesh
                .bridge_summary
                .map(|summary| summary.normal_bytes)
                .unwrap_or_default(),
            bridge_index_bytes: mesh
                .bridge_summary
                .map(|summary| summary.index_bytes)
                .unwrap_or_default(),
            shading_mode: scene
                .viewport_state(mesh.mesh_handle)
                .map(|viewport| viewport.shading_mode)
                .unwrap_or(ShadingMode::Solid),
        })
        .collect())
}
