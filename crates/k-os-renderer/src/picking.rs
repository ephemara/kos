use crate::types::{CameraState, RendererError, SelectionResult};
use glam::{Mat4, Vec3, Vec4};
use k_os_eval::mesh_pipeline::ViewportBufferPayload;
use k_os_mesh_processing::{spatial, Mesh};
use k_os_scene::MeshHandle;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Clone)]
pub struct MeshSelectionCache {
    pub mesh_handle: MeshHandle,
    pub version: u64,
    pub bvh: std::sync::Arc<spatial::MeshBVH>,
}

pub fn payload_version(payload: &ViewportBufferPayload) -> u64 {
    let mut hasher = DefaultHasher::new();
    payload.mesh_handle.raw().hash(&mut hasher);
    payload.vertex_count.hash(&mut hasher);
    payload.index_count.hash(&mut hasher);
    for value in payload.positions.iter().step_by(17) {
        value.to_bits().hash(&mut hasher);
    }
    for value in payload.indices.iter().step_by(17) {
        value.hash(&mut hasher);
    }
    hasher.finish()
}

pub fn build_selection_cache(
    payload: &ViewportBufferPayload,
) -> Result<MeshSelectionCache, RendererError> {
    let vertices = payload
        .positions
        .chunks_exact(3)
        .map(|p| Vec3::new(p[0], p[1], p[2]))
        .collect();
    let mesh = Mesh::from_vertices_indices(vertices, payload.indices.clone());
    let bvh =
        spatial::build_bvh(&mesh).map_err(|e| RendererError::MeshSyncFailed(e.to_string()))?;
    Ok(MeshSelectionCache {
        mesh_handle: payload.mesh_handle,
        version: payload_version(payload),
        bvh: std::sync::Arc::new(bvh),
    })
}

pub fn pick(
    camera: &CameraState,
    ndc: [f32; 2],
    selection: &MeshSelectionCache,
) -> Result<SelectionResult, RendererError> {
    let origin = Vec3::from_array(camera.position);
    let target = Vec3::from_array(camera.target);
    let up = Vec3::from_array(camera.up).normalize();

    let view = Mat4::look_at_rh(origin, target, up);
    let distance = origin.distance(target).max(0.001);
    let projection = Mat4::perspective_rh_gl(
        camera.fov_degrees.to_radians(),
        16.0 / 9.0,
        camera.near,
        camera.far.max(distance + camera.near),
    );
    let inv_view_proj = (projection * view).inverse();

    let near = inv_view_proj * Vec4::new(ndc[0], ndc[1], -1.0, 1.0);
    let far = inv_view_proj * Vec4::new(ndc[0], ndc[1], 1.0, 1.0);
    let near_world = near.truncate() / near.w;
    let far_world = far.truncate() / far.w;
    let direction = (far_world - near_world).normalize_or_zero();

    if direction.length_squared() <= f32::EPSILON {
        return Ok(SelectionResult::no_hit());
    }

    let hit = selection.bvh.raycast(origin, direction, camera.far);
    if let Some(hit) = hit {
        Ok(SelectionResult {
            hit: true,
            mesh_handle: Some(selection.mesh_handle.raw()),
            face_index: Some(hit.triangle_index as u32),
            position: Some(hit.position.to_array()),
            normal: Some(hit.normal.to_array()),
            distance: Some(hit.distance),
        })
    } else {
        Ok(SelectionResult::no_hit())
    }
}
