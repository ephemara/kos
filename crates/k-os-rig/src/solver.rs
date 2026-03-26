// K-RIG 8-Point Marker Skeleton Solver
// Generates anatomically correct skeleton from 8 marker positions

use super::skeleton::{Bone, IKChainDef, Skeleton};
use glam::Vec3;

/// Marker positions for 8-point rigging
///
/// Order:
/// 0 = Chin (head position)
/// 1 = Left Wrist
/// 2 = Right Wrist
/// 3 = Left Elbow
/// 4 = Right Elbow
/// 5 = Left Knee
/// 6 = Right Knee
/// 7 = Groin/Hips (pelvis center)
pub fn solve_skeleton_from_markers(markers: &[[f32; 3]; 8]) -> Skeleton {
    let chin = Vec3::from(markers[0]);
    let l_wrist = Vec3::from(markers[1]);
    let r_wrist = Vec3::from(markers[2]);
    let l_elbow = Vec3::from(markers[3]);
    let r_elbow = Vec3::from(markers[4]);
    let l_knee = Vec3::from(markers[5]);
    let r_knee = Vec3::from(markers[6]);
    let hips = Vec3::from(markers[7]);

    let mut skel = Skeleton::new();

    // === DERIVE ADDITIONAL POSITIONS FROM MARKERS ===

    // Chest is between shoulders (estimated from elbows + offset)
    let l_shoulder_est = l_elbow + (l_elbow - l_wrist).normalize() * 0.3;
    let r_shoulder_est = r_elbow + (r_elbow - r_wrist).normalize() * 0.3;
    let chest = (l_shoulder_est + r_shoulder_est) * 0.5;

    // Neck is between chest and chin
    let neck = chest.lerp(chin, 0.6);

    // Head is above chin
    let head = chin + Vec3::new(0.0, 0.15, 0.0);

    // Spine interpolation between hips and chest
    let spine = hips.lerp(chest, 0.5);

    // Shoulder positions (offset from chest horizontally)
    let shoulder_width = (l_shoulder_est - r_shoulder_est).length() * 0.5;
    let l_shoulder = chest + Vec3::new(shoulder_width * 0.3, 0.0, 0.0);
    let r_shoulder = chest + Vec3::new(-shoulder_width * 0.3, 0.0, 0.0);

    // Arm positions derived from markers
    let l_arm = l_shoulder + (l_elbow - l_shoulder).normalize() * 0.15;
    let r_arm = r_shoulder + (r_elbow - r_shoulder).normalize() * 0.15;

    // Forearm is between elbow and wrist
    let l_forearm = l_elbow;
    let r_forearm = r_elbow;

    // Hand is at wrist
    let l_hand = l_wrist;
    let r_hand = r_wrist;

    // Leg positions
    let hip_width = (l_knee - r_knee).length() * 0.4;
    let l_thigh_start = hips + Vec3::new(hip_width * 0.5, -0.05, 0.0);
    let r_thigh_start = hips + Vec3::new(-hip_width * 0.5, -0.05, 0.0);

    // Shin is at knee + down
    let l_shin = l_knee;
    let r_shin = r_knee;

    // Foot is estimated below knee
    let leg_length = hips.y - l_knee.y;
    let l_foot = l_knee + Vec3::new(0.0, -leg_length, 0.1);
    let r_foot = r_knee + Vec3::new(0.0, -leg_length, 0.1);

    // === BUILD SKELETON ===

    // Spine chain
    let hips_idx = skel.add_bone(Bone::new("Hips", None, hips.to_array()));
    let spine_idx = skel.add_bone(Bone::new(
        "Spine",
        Some(hips_idx),
        (spine - hips).to_array(),
    ));
    let chest_idx = skel.add_bone(Bone::new(
        "Chest",
        Some(spine_idx),
        (chest - spine).to_array(),
    ));
    let neck_idx = skel.add_bone(Bone::new(
        "Neck",
        Some(chest_idx),
        (neck - chest).to_array(),
    ));
    let _head_idx = skel.add_bone(Bone::new("Head", Some(neck_idx), (head - neck).to_array()));

    // Left arm
    let l_shoulder_idx = skel.add_bone(Bone::new(
        "L_Shoulder",
        Some(chest_idx),
        (l_shoulder - chest).to_array(),
    ));
    let l_arm_idx = skel.add_bone(Bone::new(
        "L_Arm",
        Some(l_shoulder_idx),
        (l_arm - l_shoulder).to_array(),
    ));
    let l_forearm_idx = skel.add_bone(Bone::new(
        "L_ForeArm",
        Some(l_arm_idx),
        (l_forearm - l_arm).to_array(),
    ));
    let l_hand_idx = skel.add_bone(
        Bone::new(
            "L_Hand",
            Some(l_forearm_idx),
            (l_hand - l_forearm).to_array(),
        )
        .with_ik(),
    );

    // Right arm
    let r_shoulder_idx = skel.add_bone(Bone::new(
        "R_Shoulder",
        Some(chest_idx),
        (r_shoulder - chest).to_array(),
    ));
    let r_arm_idx = skel.add_bone(Bone::new(
        "R_Arm",
        Some(r_shoulder_idx),
        (r_arm - r_shoulder).to_array(),
    ));
    let r_forearm_idx = skel.add_bone(Bone::new(
        "R_ForeArm",
        Some(r_arm_idx),
        (r_forearm - r_arm).to_array(),
    ));
    let r_hand_idx = skel.add_bone(
        Bone::new(
            "R_Hand",
            Some(r_forearm_idx),
            (r_hand - r_forearm).to_array(),
        )
        .with_ik(),
    );

    // Left leg
    let l_thigh_idx = skel.add_bone(Bone::new(
        "L_Thigh",
        Some(hips_idx),
        (l_thigh_start - hips).to_array(),
    ));
    let l_shin_idx = skel.add_bone(Bone::new(
        "L_Shin",
        Some(l_thigh_idx),
        (l_shin - l_thigh_start).to_array(),
    ));
    let l_foot_idx = skel
        .add_bone(Bone::new("L_Foot", Some(l_shin_idx), (l_foot - l_shin).to_array()).with_ik());

    // Right leg
    let r_thigh_idx = skel.add_bone(Bone::new(
        "R_Thigh",
        Some(hips_idx),
        (r_thigh_start - hips).to_array(),
    ));
    let r_shin_idx = skel.add_bone(Bone::new(
        "R_Shin",
        Some(r_thigh_idx),
        (r_shin - r_thigh_start).to_array(),
    ));
    let r_foot_idx = skel
        .add_bone(Bone::new("R_Foot", Some(r_shin_idx), (r_foot - r_shin).to_array()).with_ik());

    // === IK CHAINS ===

    // Arm IK (elbow bends backward)
    skel.ik_chains.push(IKChainDef {
        bone_indices: vec![l_arm_idx, l_forearm_idx, l_hand_idx],
        target_position: l_hand.to_array(),
        pole_vector: [0.0, 0.0, -1.0],
    });
    skel.ik_chains.push(IKChainDef {
        bone_indices: vec![r_arm_idx, r_forearm_idx, r_hand_idx],
        target_position: r_hand.to_array(),
        pole_vector: [0.0, 0.0, -1.0],
    });

    // Leg IK (knee bends forward)
    skel.ik_chains.push(IKChainDef {
        bone_indices: vec![l_thigh_idx, l_shin_idx, l_foot_idx],
        target_position: l_foot.to_array(),
        pole_vector: [0.0, 0.0, 1.0],
    });
    skel.ik_chains.push(IKChainDef {
        bone_indices: vec![r_thigh_idx, r_shin_idx, r_foot_idx],
        target_position: r_foot.to_array(),
        pole_vector: [0.0, 0.0, 1.0],
    });

    // Update world matrices
    skel.update_world_matrices();

    log::info!(
        "K-RIG: Generated skeleton with {} bones from 8 markers",
        skel.bones.len()
    );

    skel
}

/// Scale skeleton to fit mesh bounds
pub fn fit_skeleton_to_bounds(skeleton: &mut Skeleton, mesh_min: [f32; 3], mesh_max: [f32; 3]) {
    let min = Vec3::from(mesh_min);
    let max = Vec3::from(mesh_max);
    let mesh_height = max.y - min.y;
    let mesh_center = (min + max) * 0.5;

    // Find skeleton bounds
    let mut skel_min = Vec3::splat(f32::MAX);
    let mut skel_max = Vec3::splat(f32::MIN);

    for bone in &skeleton.bones {
        let pos = bone.get_world_position();
        skel_min = skel_min.min(pos);
        skel_max = skel_max.max(pos);
    }

    let skel_height = skel_max.y - skel_min.y;
    let scale = if skel_height > 0.001 {
        mesh_height / skel_height
    } else {
        1.0
    };

    // Scale and recenter
    for bone in &mut skeleton.bones {
        bone.local_position[0] *= scale;
        bone.local_position[1] *= scale;
        bone.local_position[2] *= scale;
    }

    // Move root to mesh center (adjusted for hip position)
    if let Some(root) = skeleton.bones.first_mut() {
        root.local_position[0] = mesh_center.x;
        root.local_position[1] = min.y + mesh_height * 0.52; // Hips at about 52% height
        root.local_position[2] = mesh_center.z;
    }

    skeleton.update_world_matrices();
}
