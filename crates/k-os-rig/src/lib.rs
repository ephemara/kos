//! K_OS Rig Domain
//!
//! This crate is the ownership boundary for rigging-specific logic.
//! During migration it hosts the migrated rigging modules directly.
//! New rigging code should land here first.

pub mod commands;
pub mod ik;
pub mod skeleton;
pub mod skinning;
pub mod solver;

pub use commands::{
    compute_skin_weights_distance, compute_skin_weights_geodesic, create_biped_skeleton,
    fit_skeleton_to_mesh, generate_skeleton_from_markers, solve_ik_ccd, solve_ik_fabrik,
    solve_ik_two_bone, update_skeleton_matrices, Bone, IKChainDef, IKSolveResult, Skeleton,
    SkinWeights,
};
