//! Rig retargeting — maps 2D/2.5D COCO joints to the k-os-rig biped skeleton.
//!
//! The actual IK solvers (FABRIK, two-bone, CCD) live in k-os-rig.
//! This module is the adapter layer that:
//!   1. Converts COCO joint layout → k-os-rig marker format
//!   2. Calls rig::solver::solve_skeleton_from_markers()
//!   3. Runs per-limb FABRIK pass for foot lock and hand IK
//!   4. Returns solved BoneTransforms for the Three.js renderer

pub mod topology;

use k_os_rig::{
    ik,
    skeleton::{Bone, Skeleton},
    solver,
};
use crate::types::{BoneTransform, IkConstraintParams, Joint, COCO_JOINT_NAMES};

// ─── COCO → Marker index map (data-driven) ───────────────────────────────────
//
// solve_skeleton_from_markers() expects 8 anatomical markers in this order:
//   0=chin, 1=left_wrist, 2=right_wrist, 3=left_elbow, 4=right_elbow,
//   5=left_knee, 6=right_knee, 7=groin
//
// We derive these from COCO joints using the index lookup below.

const MARKER_CHIN:         usize = 0;  // COCO nose as approximation
const MARKER_LEFT_WRIST:   usize = 9;
const MARKER_RIGHT_WRIST:  usize = 10;
const MARKER_LEFT_ELBOW:   usize = 7;
const MARKER_RIGHT_ELBOW:  usize = 8;
const MARKER_LEFT_KNEE:    usize = 13;
const MARKER_RIGHT_KNEE:   usize = 14;
const COCO_LEFT_HIP:       usize = 11;
const COCO_RIGHT_HIP:      usize = 12;
const MIN_RETARGET_JOINT_COUNT: usize = 17;

#[derive(Debug, Clone)]
pub struct LiveRetargetContract {
    pub required_joint_indices: Vec<usize>,
    pub minimum_reliable_joints: usize,
}

impl LiveRetargetContract {
    pub fn from_topology_profile(profile: &topology::RigTopologyProfile) -> Result<Self, String> {
        if !profile.live_retarget_enabled {
            return Err(format!(
                "Topology profile '{}' is not flagged as live-retarget enabled",
                profile.id
            ));
        }

        if profile.live_retarget_required_joint_indices.is_empty() {
            return Err(format!(
                "Topology profile '{}' has no live retarget required joints",
                profile.id
            ));
        }

        if profile.live_retarget_min_reliable_joints == 0 {
            return Err(format!(
                "Topology profile '{}' has invalid minimum reliable joint threshold (0)",
                profile.id
            ));
        }

        Ok(Self {
            required_joint_indices: profile.live_retarget_required_joint_indices.clone(),
            minimum_reliable_joints: profile.live_retarget_min_reliable_joints,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetargetSurface {
    LiveSession,
    OfflineVideo,
}

impl RetargetSurface {
    fn compatibility_label(self) -> &'static str {
        match self {
            Self::LiveSession => "live-retarget",
            Self::OfflineVideo => "offline-retarget",
        }
    }
}

#[derive(Debug)]
pub struct ResolvedRetargetContract {
    pub topology_profile: &'static topology::RigTopologyProfile,
    pub live_retarget_contract: LiveRetargetContract,
}

pub fn resolve_retarget_contract(
    model_id: &str,
    keypoints: usize,
    surface: RetargetSurface,
) -> Result<ResolvedRetargetContract, String> {
    let topology_profile = topology::profile_for_keypoints(keypoints).ok_or_else(|| {
        format!(
            "No rig topology profile is configured for {} keypoints. Update resources/rig_topology_manifest.toml with a compatible binding.",
            keypoints
        )
    })?;

    let live_retarget_contract = LiveRetargetContract::from_topology_profile(topology_profile)
        .map_err(|_| {
            format!(
                "Model '{}' is not {} compatible yet (keypoints={}). Topology profile '{}' is not configured for live retargeting.",
                model_id,
                surface.compatibility_label(),
                keypoints,
                topology_profile.id
            )
        })?;

    Ok(ResolvedRetargetContract {
        topology_profile,
        live_retarget_contract,
    })
}

// ─── RigRetargeter ───────────────────────────────────────────────────────────

pub struct RigRetargeter {
    /// The biped skeleton template — created once on session start
    skeleton: Skeleton,
    /// IK solver settings (live-tuneable from IKConstraintPanel)
    ik_params: IkConstraintParams,
    /// Data-driven reliability contract for live retargeting.
    contract: LiveRetargetContract,
}

impl RigRetargeter {
    /// Create a new retargeter with a fresh biped skeleton.
    pub fn new(ik_params: IkConstraintParams, contract: LiveRetargetContract) -> Self {
        Self {
            skeleton: Skeleton::create_biped(),
            ik_params,
            contract,
        }
    }

    /// Hot-reload IK parameters without restarting the session.
    pub fn update_params(&mut self, params: IkConstraintParams) {
        self.ik_params = params;
    }

    /// Map a frame of COCO joints to solved biped bone transforms.
    ///
    /// Returns `None` if too few joints are reliable (confidence < threshold).
    pub fn retarget(&mut self, joints: &[Joint]) -> Option<Vec<BoneTransform>> {
        if joints.len() < MIN_RETARGET_JOINT_COUNT {
            return None;
        }

        // Require at least the key landmarks to be reliable
        let required = &self.contract.required_joint_indices;
        if required.iter().any(|&idx| idx >= joints.len()) {
            log::debug!(
                "[zen-mocap] Required retarget joints exceed frame joint count (required={:?}, len={})",
                required,
                joints.len()
            );
            return None;
        }

        let reliable_count = required.iter().filter(|&&i| joints[i].is_reliable()).count();
        if reliable_count < self.contract.minimum_reliable_joints {
            log::debug!(
                "[zen-mocap] Only {}/{} required joints reliable (min={}) — skipping IK solve",
                reliable_count,
                required.len(),
                self.contract.minimum_reliable_joints
            );
            return None;
        }

        // Build the 8-marker array expected by solve_skeleton_from_markers
        // Groin = midpoint of hips
        let groin = midpoint(joints[COCO_LEFT_HIP].position, joints[COCO_RIGHT_HIP].position);

        let markers: [[f32; 3]; 8] = [
            joints[MARKER_CHIN].position,
            joints[MARKER_LEFT_WRIST].position,
            joints[MARKER_RIGHT_WRIST].position,
            joints[MARKER_LEFT_ELBOW].position,
            joints[MARKER_RIGHT_ELBOW].position,
            joints[MARKER_LEFT_KNEE].position,
            joints[MARKER_RIGHT_KNEE].position,
            groin,
        ];

        // Fit skeleton to detected landmarks
        self.skeleton = solver::solve_skeleton_from_markers(&markers);

        // Per-limb FABRIK pass — refines each chain independently
        self.solve_limb_ik(joints);

        // Update world matrices
        self.skeleton.update_world_matrices();

        // Convert Skeleton → BoneTransforms for the renderer and DCC targets
        Some(self.extract_transforms())
    }

    // ─── Per-limb IK ────────────────────────────────────────────────────────

    fn solve_limb_ik(&mut self, joints: &[Joint]) {
        let tol = self.ik_params.bone_length_tolerance;
        let max_iter = 20u32;

        // Left arm: shoulder → elbow → wrist
        if let Some(chain) = self.get_chain_positions(&["L_Arm", "L_ForeArm", "L_Hand"]) {
            let target = joints[MARKER_LEFT_WRIST].position;
            if joints[MARKER_LEFT_WRIST].is_reliable() {
                let result = ik::solve_fabrik(&chain, target, max_iter, tol);
                self.apply_chain_positions(&["L_Arm", "L_ForeArm", "L_Hand"], &result.positions);
            }
        }

        // Right arm
        if let Some(chain) = self.get_chain_positions(&["R_Arm", "R_ForeArm", "R_Hand"]) {
            let target = joints[MARKER_RIGHT_WRIST].position;
            if joints[MARKER_RIGHT_WRIST].is_reliable() {
                let result = ik::solve_fabrik(&chain, target, max_iter, tol);
                self.apply_chain_positions(&["R_Arm", "R_ForeArm", "R_Hand"], &result.positions);
            }
        }

        // Left leg — foot lock via strength param
        if let Some(chain) = self.get_chain_positions(&["L_Thigh", "L_Shin", "L_Foot"]) {
            let target = joints[15].position; // left_ankle
            if joints[15].is_reliable() {
                let result = ik::solve_fabrik(&chain, target, max_iter, tol);
                self.apply_chain_positions(&["L_Thigh", "L_Shin", "L_Foot"], &result.positions);
            }
        }

        // Right leg
        if let Some(chain) = self.get_chain_positions(&["R_Thigh", "R_Shin", "R_Foot"]) {
            let target = joints[16].position; // right_ankle
            if joints[16].is_reliable() {
                let result = ik::solve_fabrik(&chain, target, max_iter, tol);
                self.apply_chain_positions(&["R_Thigh", "R_Shin", "R_Foot"], &result.positions);
            }
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    fn get_chain_positions(&self, names: &[&str]) -> Option<Vec<[f32; 3]>> {
        let mut positions = Vec::with_capacity(names.len());
        for name in names {
            let idx = self.skeleton.find_bone(name)?;
            positions.push(self.skeleton.bones[idx].get_world_position().to_array());
        }
        Some(positions)
    }

    fn apply_chain_positions(&mut self, names: &[&str], positions: &[[f32; 3]]) {
        for (name, &pos) in names.iter().zip(positions.iter()) {
            if let Some(idx) = self.skeleton.find_bone(name) {
                self.skeleton.bones[idx].local_position = pos;
            }
        }
    }

    fn extract_transforms(&self) -> Vec<BoneTransform> {
        self.skeleton.bones.iter().map(|bone| {
            let pos = bone.get_world_position();
            BoneTransform {
                name: bone.name.clone(),
                world_matrix: bone.world_matrix,
                position: pos.to_array(),
                rotation: bone.local_rotation,
            }
        }).collect()
    }
}

// ─── Utils ───────────────────────────────────────────────────────────────────

fn midpoint(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [(a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0, (a[2] + b[2]) / 2.0]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_retarget_contract_returns_manifest_backed_profile_for_coco17() {
        let resolved = resolve_retarget_contract("yolov11n_pose", 17, RetargetSurface::LiveSession)
            .expect("expected 17-keypoint retarget contract to resolve");
        assert_eq!(resolved.topology_profile.id, "coco17_live_v1");
        assert!(!resolved.live_retarget_contract.required_joint_indices.is_empty());
    }

    #[test]
    fn resolve_retarget_contract_rejects_unknown_layouts() {
        let err = resolve_retarget_contract("unknown_model", 999, RetargetSurface::OfflineVideo)
            .expect_err("expected unknown keypoint layout to fail");
        assert!(err.contains("No rig topology profile is configured for 999 keypoints"));
    }
}
