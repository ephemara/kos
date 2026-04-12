//! Thin Tauri adapters for rigging commands.

pub use k_os_rig::{Bone, IKChainDef, IKSolveResult, Skeleton, SkinWeights};

#[tauri::command]
pub fn create_biped_skeleton() -> Skeleton {
    k_os_rig::create_biped_skeleton()
}

#[tauri::command]
pub fn generate_skeleton_from_markers(markers: [[f32; 3]; 8]) -> Skeleton {
    k_os_rig::generate_skeleton_from_markers(markers)
}

#[tauri::command]
pub fn fit_skeleton_to_mesh(
    skeleton: Skeleton,
    mesh_min: [f32; 3],
    mesh_max: [f32; 3],
) -> Skeleton {
    k_os_rig::fit_skeleton_to_mesh(skeleton, mesh_min, mesh_max)
}

#[tauri::command]
pub fn compute_skin_weights_geodesic(
    vertices: Vec<[f32; 3]>,
    triangles: Vec<[u32; 3]>,
    bone_positions: Vec<[f32; 3]>,
    resolution: u32,
) -> SkinWeights {
    k_os_rig::compute_skin_weights_geodesic(vertices, triangles, bone_positions, resolution)
}

#[tauri::command]
pub fn compute_skin_weights_distance(
    vertices: Vec<[f32; 3]>,
    bone_positions: Vec<[f32; 3]>,
) -> SkinWeights {
    k_os_rig::compute_skin_weights_distance(vertices, bone_positions)
}

#[tauri::command]
pub fn solve_ik_fabrik(
    chain_positions: Vec<[f32; 3]>,
    target: [f32; 3],
    max_iterations: u32,
    tolerance: f32,
) -> IKSolveResult {
    k_os_rig::solve_ik_fabrik(chain_positions, target, max_iterations, tolerance)
}

#[tauri::command]
pub fn solve_ik_two_bone(
    root: [f32; 3],
    mid: [f32; 3],
    end: [f32; 3],
    target: [f32; 3],
    pole: [f32; 3],
) -> ([f32; 3], [f32; 3], [f32; 3]) {
    k_os_rig::solve_ik_two_bone(root, mid, end, target, pole)
}

#[tauri::command]
pub fn solve_ik_ccd(
    chain_positions: Vec<[f32; 3]>,
    target: [f32; 3],
    max_iterations: u32,
    tolerance: f32,
) -> IKSolveResult {
    k_os_rig::solve_ik_ccd(chain_positions, target, max_iterations, tolerance)
}

#[tauri::command]
pub fn update_skeleton_matrices(skeleton: Skeleton) -> Skeleton {
    k_os_rig::update_skeleton_matrices(skeleton)
}
