// K-RIG Skeleton Data Structures
// Bone hierarchy, transforms, and IK chain definitions

use glam::{Mat4, Quat, Vec3};
use serde::{Deserialize, Serialize};

/// Single bone in the skeleton hierarchy
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Bone {
    pub name: String,
    pub parent_index: Option<usize>,
    /// Local position relative to parent
    pub local_position: [f32; 3],
    /// Local rotation as quaternion [x, y, z, w]
    pub local_rotation: [f32; 4],
    /// Cached world transform matrix (row-major)
    pub world_matrix: [f32; 16],
    /// Is this an IK effector (hand, foot)?
    pub is_ik_effector: bool,
}

impl Bone {
    pub fn new(name: &str, parent_index: Option<usize>, position: [f32; 3]) -> Self {
        Self {
            name: name.to_string(),
            parent_index,
            local_position: position,
            local_rotation: [0.0, 0.0, 0.0, 1.0], // Identity quaternion
            world_matrix: [
                1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
            ],
            is_ik_effector: false,
        }
    }

    pub fn with_ik(mut self) -> Self {
        self.is_ik_effector = true;
        self
    }

    pub fn get_world_position(&self) -> Vec3 {
        Vec3::new(
            self.world_matrix[12],
            self.world_matrix[13],
            self.world_matrix[14],
        )
    }
}

/// Definition of an IK chain (used for limbs)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IKChainDef {
    /// Indices of bones in this chain (root to effector)
    pub bone_indices: Vec<usize>,
    /// Target position in world space
    pub target_position: [f32; 3],
    /// Pole vector for elbow/knee direction
    pub pole_vector: [f32; 3],
}

/// Complete skeleton with bones and IK chains
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Skeleton {
    pub bones: Vec<Bone>,
    pub ik_chains: Vec<IKChainDef>,
}

impl Skeleton {
    pub fn new() -> Self {
        Self {
            bones: Vec::new(),
            ik_chains: Vec::new(),
        }
    }

    /// Add a bone and return its index
    pub fn add_bone(&mut self, bone: Bone) -> usize {
        let idx = self.bones.len();
        self.bones.push(bone);
        idx
    }

    /// Update all world matrices based on local transforms
    pub fn update_world_matrices(&mut self) {
        for i in 0..self.bones.len() {
            let local_pos = Vec3::from(self.bones[i].local_position);
            let local_rot = Quat::from_array(self.bones[i].local_rotation);
            let local_mat = Mat4::from_rotation_translation(local_rot, local_pos);

            let world_mat = if let Some(parent_idx) = self.bones[i].parent_index {
                let parent_mat = Mat4::from_cols_array(&self.bones[parent_idx].world_matrix);
                parent_mat * local_mat
            } else {
                local_mat
            };

            self.bones[i].world_matrix = world_mat.to_cols_array();
        }
    }

    /// Get bone by name
    pub fn find_bone(&self, name: &str) -> Option<usize> {
        self.bones.iter().position(|b| b.name == name)
    }

    /// Create a standard biped skeleton
    pub fn create_biped() -> Self {
        let mut skel = Self::new();

        // Spine chain
        let hips = skel.add_bone(Bone::new("Hips", None, [0.0, 1.0, 0.0]));
        let spine = skel.add_bone(Bone::new("Spine", Some(hips), [0.0, 0.15, 0.0]));
        let chest = skel.add_bone(Bone::new("Chest", Some(spine), [0.0, 0.15, 0.0]));
        let neck = skel.add_bone(Bone::new("Neck", Some(chest), [0.0, 0.1, 0.0]));
        let _head = skel.add_bone(Bone::new("Head", Some(neck), [0.0, 0.1, 0.0]));

        // Left arm
        let l_shoulder = skel.add_bone(Bone::new("L_Shoulder", Some(chest), [0.1, 0.05, 0.0]));
        let l_arm = skel.add_bone(Bone::new("L_Arm", Some(l_shoulder), [0.15, 0.0, 0.0]));
        let l_forearm = skel.add_bone(Bone::new("L_ForeArm", Some(l_arm), [0.25, 0.0, 0.0]));
        let l_hand = skel.add_bone(Bone::new("L_Hand", Some(l_forearm), [0.2, 0.0, 0.0]).with_ik());

        // Right arm
        let r_shoulder = skel.add_bone(Bone::new("R_Shoulder", Some(chest), [-0.1, 0.05, 0.0]));
        let r_arm = skel.add_bone(Bone::new("R_Arm", Some(r_shoulder), [-0.15, 0.0, 0.0]));
        let r_forearm = skel.add_bone(Bone::new("R_ForeArm", Some(r_arm), [-0.25, 0.0, 0.0]));
        let r_hand =
            skel.add_bone(Bone::new("R_Hand", Some(r_forearm), [-0.2, 0.0, 0.0]).with_ik());

        // Left leg
        let l_thigh = skel.add_bone(Bone::new("L_Thigh", Some(hips), [0.1, -0.05, 0.0]));
        let l_shin = skel.add_bone(Bone::new("L_Shin", Some(l_thigh), [0.0, -0.4, 0.0]));
        let l_foot = skel.add_bone(Bone::new("L_Foot", Some(l_shin), [0.0, -0.4, 0.1]).with_ik());

        // Right leg
        let r_thigh = skel.add_bone(Bone::new("R_Thigh", Some(hips), [-0.1, -0.05, 0.0]));
        let r_shin = skel.add_bone(Bone::new("R_Shin", Some(r_thigh), [0.0, -0.4, 0.0]));
        let r_foot = skel.add_bone(Bone::new("R_Foot", Some(r_shin), [0.0, -0.4, 0.1]).with_ik());

        // IK Chains
        skel.ik_chains.push(IKChainDef {
            bone_indices: vec![l_arm, l_forearm, l_hand],
            target_position: [0.0; 3],
            pole_vector: [0.0, 0.0, -1.0],
        });
        skel.ik_chains.push(IKChainDef {
            bone_indices: vec![r_arm, r_forearm, r_hand],
            target_position: [0.0; 3],
            pole_vector: [0.0, 0.0, -1.0],
        });
        skel.ik_chains.push(IKChainDef {
            bone_indices: vec![l_thigh, l_shin, l_foot],
            target_position: [0.0; 3],
            pole_vector: [0.0, 0.0, 1.0],
        });
        skel.ik_chains.push(IKChainDef {
            bone_indices: vec![r_thigh, r_shin, r_foot],
            target_position: [0.0; 3],
            pole_vector: [0.0, 0.0, 1.0],
        });

        skel.update_world_matrices();
        skel
    }
}

impl Default for Skeleton {
    fn default() -> Self {
        Self::new()
    }
}
