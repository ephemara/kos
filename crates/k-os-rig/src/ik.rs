// K-RIG FABRIK IK Solver
// Forward And Backward Reaching Inverse Kinematics

use glam::Vec3;
use serde::{Deserialize, Serialize};

/// Result of IK solve - new bone positions
#[derive(Serialize, Deserialize)]
pub struct IKSolveResult {
    pub positions: Vec<[f32; 3]>,
    pub converged: bool,
    pub iterations_used: u32,
}

/// FABRIK IK Solver
///
/// Fast, stable IK for chains of any length.
/// Uses forward/backward reaching to satisfy constraints.
pub fn solve_fabrik(
    chain_positions: &[[f32; 3]],
    target: [f32; 3],
    max_iterations: u32,
    tolerance: f32,
) -> IKSolveResult {
    if chain_positions.len() < 2 {
        return IKSolveResult {
            positions: chain_positions.to_vec(),
            converged: true,
            iterations_used: 0,
        };
    }

    let mut positions: Vec<Vec3> = chain_positions.iter().map(|p| Vec3::from(*p)).collect();
    let target = Vec3::from(target);
    let root = positions[0];

    // Pre-calculate bone lengths
    let mut lengths: Vec<f32> = Vec::with_capacity(positions.len() - 1);
    for i in 0..positions.len() - 1 {
        lengths.push(positions[i].distance(positions[i + 1]));
    }

    let total_length: f32 = lengths.iter().sum();
    let root_to_target = root.distance(target);

    // Check if target is reachable
    if root_to_target > total_length {
        // Target unreachable - stretch towards it
        let dir = (target - root).normalize_or_zero();
        let mut current = root;
        for i in 0..positions.len() {
            positions[i] = current;
            if i < lengths.len() {
                current += dir * lengths[i];
            }
        }
        return IKSolveResult {
            positions: positions.iter().map(|p| p.to_array()).collect(),
            converged: false,
            iterations_used: 1,
        };
    }

    // FABRIK iterations
    let mut iterations = 0;
    for iter in 0..max_iterations {
        iterations = iter + 1;

        // FORWARD: Start from end effector, move towards target
        *positions.last_mut().unwrap() = target;
        for i in (0..positions.len() - 1).rev() {
            let dir = (positions[i] - positions[i + 1]).normalize_or_zero();
            positions[i] = positions[i + 1] + dir * lengths[i];
        }

        // BACKWARD: Start from root, move back to anchored root
        positions[0] = root;
        for i in 0..positions.len() - 1 {
            let dir = (positions[i + 1] - positions[i]).normalize_or_zero();
            positions[i + 1] = positions[i] + dir * lengths[i];
        }

        // Check convergence
        let end_pos = *positions.last().unwrap();
        if end_pos.distance(target) < tolerance {
            return IKSolveResult {
                positions: positions.iter().map(|p| p.to_array()).collect(),
                converged: true,
                iterations_used: iterations,
            };
        }
    }

    IKSolveResult {
        positions: positions.iter().map(|p| p.to_array()).collect(),
        converged: false,
        iterations_used: iterations,
    }
}

/// Two-bone IK with pole vector (for elbows/knees)
/// More stable for common limb setups
pub fn solve_two_bone_ik(
    root: [f32; 3],
    mid: [f32; 3],
    end: [f32; 3],
    target: [f32; 3],
    pole: [f32; 3],
) -> ([f32; 3], [f32; 3], [f32; 3]) {
    let root = Vec3::from(root);
    let mid = Vec3::from(mid);
    let end = Vec3::from(end);
    let target = Vec3::from(target);
    let pole = Vec3::from(pole);

    let len_upper = root.distance(mid);
    let len_lower = mid.distance(end);
    let len_total = len_upper + len_lower;

    let root_to_target = target - root;
    let dist = root_to_target.length().min(len_total - 0.001);

    if dist < 0.001 {
        return (root.to_array(), mid.to_array(), end.to_array());
    }

    // Law of cosines to find mid angle
    let cos_angle = ((len_upper * len_upper + dist * dist - len_lower * len_lower)
        / (2.0 * len_upper * dist))
        .clamp(-1.0, 1.0);
    let angle = cos_angle.acos();

    // Direction from root to target
    let dir = root_to_target.normalize_or_zero();

    // Pole vector for elbow/knee direction
    let pole_dir = (pole - root).normalize_or_zero();
    let right = dir.cross(pole_dir).normalize_or_zero();
    let up = right.cross(dir);

    // Calculate mid position
    let mid_offset = dir * (len_upper * cos_angle) + up * (len_upper * angle.sin());
    let new_mid = root + mid_offset;

    // End position moves to target
    let new_end = target;

    (root.to_array(), new_mid.to_array(), new_end.to_array())
}

/// CCD (Cyclic Coordinate Descent) solver
/// Alternative to FABRIK - sometimes better for spines
pub fn solve_ccd(
    chain_positions: &[[f32; 3]],
    target: [f32; 3],
    max_iterations: u32,
    tolerance: f32,
) -> IKSolveResult {
    let mut positions: Vec<Vec3> = chain_positions.iter().map(|p| Vec3::from(*p)).collect();
    let target = Vec3::from(target);

    let mut lengths: Vec<f32> = Vec::with_capacity(positions.len() - 1);
    for i in 0..positions.len() - 1 {
        lengths.push(positions[i].distance(positions[i + 1]));
    }

    let mut iterations = 0;
    for iter in 0..max_iterations {
        iterations = iter + 1;

        // Iterate from end to root (excluding effector itself)
        for i in (0..positions.len() - 1).rev() {
            let effector = *positions.last().unwrap();
            let to_effector = effector - positions[i];
            let to_target = target - positions[i];

            if to_effector.length() < 0.0001 || to_target.length() < 0.0001 {
                continue;
            }

            // Rotate this joint to point effector at target
            let rotation =
                glam::Quat::from_rotation_arc(to_effector.normalize(), to_target.normalize());

            // Apply rotation to all children
            for j in (i + 1)..positions.len() {
                let offset = positions[j] - positions[i];
                positions[j] = positions[i] + rotation * offset;
            }
        }

        // Fix lengths after rotation
        for i in 0..positions.len() - 1 {
            let dir = (positions[i + 1] - positions[i]).normalize_or_zero();
            positions[i + 1] = positions[i] + dir * lengths[i];
        }

        // Check convergence
        let end_pos = *positions.last().unwrap();
        if end_pos.distance(target) < tolerance {
            return IKSolveResult {
                positions: positions.iter().map(|p| p.to_array()).collect(),
                converged: true,
                iterations_used: iterations,
            };
        }
    }

    IKSolveResult {
        positions: positions.iter().map(|p| p.to_array()).collect(),
        converged: false,
        iterations_used: iterations,
    }
}
