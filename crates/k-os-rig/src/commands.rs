// K-RIG Tauri Command Interface
// Exposes rigging functionality to the React frontend

use super::{ik, skeleton, skinning, solver};

// Re-exports for internal use
pub use ik::{solve_ccd, solve_fabrik, solve_two_bone_ik, IKSolveResult};
pub use skeleton::{Bone, IKChainDef, Skeleton};
pub use skinning::{compute_distance_weights, compute_geodesic_weights, SkinWeights};
pub use solver::{fit_skeleton_to_bounds, solve_skeleton_from_markers};

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Generate a biped skeleton (standard humanoid)
pub fn create_biped_skeleton() -> Skeleton {
    log::info!("K-RIG: Creating biped skeleton");
    Skeleton::create_biped()
}

/// Generate skeleton from 8 anatomical markers
///
/// Markers order:
/// 0=chin, 1=left_wrist, 2=right_wrist, 3=left_elbow, 4=right_elbow,
/// 5=left_knee, 6=right_knee, 7=groin
pub fn generate_skeleton_from_markers(markers: [[f32; 3]; 8]) -> Skeleton {
    log::info!("K-RIG: Generating skeleton from 8 markers");
    solver::solve_skeleton_from_markers(&markers)
}

/// Scale and align skeleton to mesh bounds
pub fn fit_skeleton_to_mesh(
    mut skeleton: Skeleton,
    mesh_min: [f32; 3],
    mesh_max: [f32; 3],
) -> Skeleton {
    log::info!("K-RIG: Fitting skeleton to mesh bounds");
    solver::fit_skeleton_to_bounds(&mut skeleton, mesh_min, mesh_max);
    skeleton
}

/// Compute geodesic skin weights using heat diffusion
/// This is the production-quality auto-skinning
pub fn compute_skin_weights_geodesic(
    vertices: Vec<[f32; 3]>,
    triangles: Vec<[u32; 3]>,
    bone_positions: Vec<[f32; 3]>,
    resolution: u32,
) -> SkinWeights {
    log::info!(
        "K-RIG: Computing geodesic skin weights ({} verts, {} bones)",
        vertices.len(),
        bone_positions.len()
    );
    skinning::compute_geodesic_weights(&vertices, &triangles, &bone_positions, resolution)
}

/// Compute skin weights using simple distance falloff (fast preview)
pub fn compute_skin_weights_distance(
    vertices: Vec<[f32; 3]>,
    bone_positions: Vec<[f32; 3]>,
) -> SkinWeights {
    log::info!(
        "K-RIG: Computing distance-based skin weights ({} verts)",
        vertices.len()
    );
    skinning::compute_distance_weights(&vertices, &bone_positions)
}

/// Solve IK chain using FABRIK algorithm
pub fn solve_ik_fabrik(
    chain_positions: Vec<[f32; 3]>,
    target: [f32; 3],
    max_iterations: u32,
    tolerance: f32,
) -> ik::IKSolveResult {
    ik::solve_fabrik(&chain_positions, target, max_iterations, tolerance)
}

/// Solve 2-bone IK with pole vector (for elbows/knees)
pub fn solve_ik_two_bone(
    root: [f32; 3],
    mid: [f32; 3],
    end: [f32; 3],
    target: [f32; 3],
    pole: [f32; 3],
) -> ([f32; 3], [f32; 3], [f32; 3]) {
    ik::solve_two_bone_ik(root, mid, end, target, pole)
}

/// Solve IK chain using CCD algorithm (alternative to FABRIK)
pub fn solve_ik_ccd(
    chain_positions: Vec<[f32; 3]>,
    target: [f32; 3],
    max_iterations: u32,
    tolerance: f32,
) -> ik::IKSolveResult {
    ik::solve_ccd(&chain_positions, target, max_iterations, tolerance)
}

/// Update skeleton world matrices after bone transforms change
pub fn update_skeleton_matrices(mut skeleton: Skeleton) -> Skeleton {
    skeleton.update_world_matrices();
    skeleton
}
