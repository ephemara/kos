use std::collections::HashSet;

use once_cell::sync::Lazy;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct RigTopologyBinding {
    pub keypoints: usize,
    pub profile_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RigTopologyProfile {
    pub id: String,
    pub keypoints: usize,
    pub description: String,
    #[serde(default)]
    pub live_retarget_enabled: bool,
    #[serde(default)]
    pub live_retarget_required_joint_indices: Vec<usize>,
    #[serde(default)]
    pub live_retarget_min_reliable_joints: usize,
    pub parents: Vec<i32>,
    pub rest_lengths: Vec<f32>,
}

#[derive(Debug, Clone, Deserialize)]
struct RigTopologyManifest {
    bindings: Vec<RigTopologyBinding>,
    profiles: Vec<RigTopologyProfile>,
}

static TOPOLOGY_MANIFEST_TOML: &str = include_str!("../../resources/rig_topology_manifest.toml");

static TOPOLOGY_MANIFEST: Lazy<RigTopologyManifest> = Lazy::new(|| {
    let manifest: RigTopologyManifest = toml::from_str(TOPOLOGY_MANIFEST_TOML)
        .expect("rig_topology_manifest.toml is invalid — this is a compile-time bug");
    validate_manifest(&manifest)
        .expect("rig_topology_manifest.toml failed validation — this is a compile-time bug");
    manifest
});

pub fn profile_for_keypoints(keypoints: usize) -> Option<&'static RigTopologyProfile> {
    let binding = TOPOLOGY_MANIFEST
        .bindings
        .iter()
        .find(|binding| binding.keypoints == keypoints)?;

    TOPOLOGY_MANIFEST
        .profiles
        .iter()
        .find(|profile| profile.id == binding.profile_id)
}

fn validate_manifest(manifest: &RigTopologyManifest) -> Result<(), String> {
    if manifest.bindings.is_empty() {
        return Err("bindings must contain at least one entry".to_string());
    }

    if manifest.profiles.is_empty() {
        return Err("profiles must contain at least one entry".to_string());
    }

    let mut profile_ids = HashSet::new();
    for profile in &manifest.profiles {
        if profile.id.trim().is_empty() {
            return Err("profile id cannot be empty".to_string());
        }

        if !profile_ids.insert(profile.id.clone()) {
            return Err(format!("duplicate profile id '{}'", profile.id));
        }

        if profile.parents.len() != profile.keypoints {
            return Err(format!(
                "profile '{}' parents length {} does not match keypoints {}",
                profile.id,
                profile.parents.len(),
                profile.keypoints
            ));
        }

        if profile.rest_lengths.len() != profile.keypoints {
            return Err(format!(
                "profile '{}' rest_lengths length {} does not match keypoints {}",
                profile.id,
                profile.rest_lengths.len(),
                profile.keypoints
            ));
        }

        if profile.live_retarget_enabled {
            if profile.live_retarget_required_joint_indices.is_empty() {
                return Err(format!(
                    "profile '{}' live_retarget_required_joint_indices must contain at least one index when live_retarget_enabled=true",
                    profile.id
                ));
            }

            if profile.live_retarget_min_reliable_joints == 0 {
                return Err(format!(
                    "profile '{}' live_retarget_min_reliable_joints must be > 0 when live_retarget_enabled=true",
                    profile.id
                ));
            }

            if profile.live_retarget_min_reliable_joints
                > profile.live_retarget_required_joint_indices.len()
            {
                return Err(format!(
                    "profile '{}' live_retarget_min_reliable_joints {} exceeds required joint count {}",
                    profile.id,
                    profile.live_retarget_min_reliable_joints,
                    profile.live_retarget_required_joint_indices.len()
                ));
            }
        }

        let mut required_indices = HashSet::new();
        for index in &profile.live_retarget_required_joint_indices {
            if *index >= profile.keypoints {
                return Err(format!(
                    "profile '{}' live_retarget_required_joint_indices contains out-of-range index {} for keypoint count {}",
                    profile.id, index, profile.keypoints
                ));
            }
            if !required_indices.insert(*index) {
                return Err(format!(
                    "profile '{}' has duplicate live retarget required index {}",
                    profile.id, index
                ));
            }
        }

        for parent in &profile.parents {
            if *parent >= profile.keypoints as i32 {
                return Err(format!(
                    "profile '{}' has invalid parent index {} for keypoint count {}",
                    profile.id, parent, profile.keypoints
                ));
            }
        }
    }

    for binding in &manifest.bindings {
        if binding.profile_id.trim().is_empty() {
            return Err("binding profile_id cannot be empty".to_string());
        }

        let profile = manifest
            .profiles
            .iter()
            .find(|profile| profile.id == binding.profile_id)
            .ok_or_else(|| {
                format!(
                    "binding for keypoints {} references unknown profile '{}'",
                    binding.keypoints, binding.profile_id
                )
            })?;

        if binding.keypoints != profile.keypoints {
            return Err(format!(
                "binding keypoints {} does not match profile '{}' keypoints {}",
                binding.keypoints, profile.id, profile.keypoints
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn has_coco17_profile_binding() {
        let profile = profile_for_keypoints(17).expect("expected COCO-17 topology profile");
        assert_eq!(profile.id, "coco17_live_v1");
        assert!(profile.live_retarget_enabled);
        assert_eq!(profile.live_retarget_min_reliable_joints, 4);
        assert_eq!(profile.parents.len(), 17);
        assert_eq!(profile.rest_lengths.len(), 17);
    }

    #[test]
    fn unknown_keypoint_layout_returns_none() {
        assert!(profile_for_keypoints(999).is_none());
    }
}
