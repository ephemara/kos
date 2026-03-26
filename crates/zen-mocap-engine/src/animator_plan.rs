//! Animator capability planning contract for ZenMocap closed-loop development.
//!
//! This module is intentionally data-driven: it centralizes the highest-value
//! product slices, ownership boundaries, and Kain supermotion dependencies so
//! discovery, animator, and engine turns can converge on one source of truth.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::gpu_pipeline::SUPERMOTION_LIVELINK_MODES;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityArea {
    AnimatorTimeline,
    KeyframeAuthoring,
    Retargeting,
    SupermotionRuntime,
    Validation,
}

#[derive(Debug, Clone, Copy)]
struct CapabilitySliceSpec {
    id: &'static str,
    title: &'static str,
    area: CapabilityArea,
    priority: u8,
    objective: &'static str,
    engine_paths: &'static [&'static str],
    frontend_paths: &'static [&'static str],
    kain_mode_ids: &'static [u32],
    known_blockers: &'static [&'static str],
    next_turn_recommendation: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CapabilitySlice {
    pub id: String,
    pub title: String,
    pub area: CapabilityArea,
    pub priority: u8,
    pub objective: String,
    pub engine_paths: Vec<String>,
    pub frontend_paths: Vec<String>,
    pub kain_mode_ids: Vec<u32>,
    pub known_blockers: Vec<String>,
    pub next_turn_recommendation: String,
}

impl From<&CapabilitySliceSpec> for CapabilitySlice {
    fn from(spec: &CapabilitySliceSpec) -> Self {
        Self {
            id: spec.id.to_string(),
            title: spec.title.to_string(),
            area: spec.area,
            priority: spec.priority,
            objective: spec.objective.to_string(),
            engine_paths: spec.engine_paths.iter().map(|p| (*p).to_string()).collect(),
            frontend_paths: spec.frontend_paths.iter().map(|p| (*p).to_string()).collect(),
            kain_mode_ids: spec.kain_mode_ids.to_vec(),
            known_blockers: spec.known_blockers.iter().map(|b| (*b).to_string()).collect(),
            next_turn_recommendation: spec.next_turn_recommendation.to_string(),
        }
    }
}

const DISCOVERY_PRIORITY_SLICES: &[CapabilitySliceSpec] = &[
    CapabilitySliceSpec {
        id: "timeline-keyframe-edit-ops",
        title: "Timeline keyframe edit ops contract",
        area: CapabilityArea::KeyframeAuthoring,
        priority: 1,
        objective: "Move add/remove/move/scale keyframe edits into an engine-owned command contract shared by Sequencer and take playback timeline.",
        engine_paths: &[
            "crates/zen-mocap-engine/src/take.rs",
            "crates/zen-mocap-engine/src/session.rs",
        ],
        frontend_paths: &[
            "src-mocap/features/Sequencer/useSequencer.ts",
            "src-mocap/features/ZenMocap/ui/TimelinePanel.tsx",
        ],
        kain_mode_ids: &[],
        known_blockers: &[
            "No typed edit operation payload shared between frontend timeline and engine take writer.",
        ],
        next_turn_recommendation: "Add engine-side keyframe edit operation enums and apply/revert execution with deterministic tests.",
    },
    CapabilitySliceSpec {
        id: "retarget-profile-registry",
        title: "Retarget profile registry and mapping",
        area: CapabilityArea::Retargeting,
        priority: 2,
        objective: "Introduce a registry of retarget profiles per character/rig so live session and take playback do not rely on implicit COCO assumptions.",
        engine_paths: &[
            "crates/zen-mocap-engine/src/rig/mod.rs",
            "crates/zen-mocap-engine/src/types.rs",
        ],
        frontend_paths: &[
            "src-mocap/features/ZenMocap/characterOptions.ts",
            "src-mocap/features/ZenMocap/ZenMocap.tsx",
        ],
        kain_mode_ids: &[],
        known_blockers: &[
            "Current runtime rejects non-17 keypoint models instead of resolving through profile metadata.",
        ],
        next_turn_recommendation: "Create a typed retarget profile schema and gate model compatibility through profile rules instead of hardcoded checks.",
    },
    CapabilitySliceSpec {
        id: "supermotion-mode-routing",
        title: "Supermotion mode routing contract",
        area: CapabilityArea::SupermotionRuntime,
        priority: 3,
        objective: "Connect per-joint animation intent from timeline tooling to Kain supermotion mode IDs via a validated engine contract.",
        engine_paths: &[
            "crates/zen-mocap-engine/src/gpu_chain.rs",
            "crates/zen-mocap-engine/src/gpu_pipeline.rs",
        ],
        frontend_paths: &[
            "src-mocap/features/ZenMocap/types.ts",
            "src-mocap/features/ZenMocap/ui/IKConstraintPanel.tsx",
        ],
        kain_mode_ids: &[1, 2, 3, 5, 8, 9, 14, 15],
        known_blockers: &[
            "Supermotion command stream is static-pass-through by default and has no timeline-owned routing layer.",
        ],
        next_turn_recommendation: "Expose mode routing payload in engine API and validate mode IDs against Kain supermotion registry before dispatch.",
    },
    CapabilitySliceSpec {
        id: "take-validation-rules",
        title: "Take validation and repair rules",
        area: CapabilityArea::Validation,
        priority: 4,
        objective: "Add schema-level take validation checks to catch malformed frame streams, fps mismatches, and incompatible skeleton payloads before playback/export.",
        engine_paths: &[
            "crates/zen-mocap-engine/src/take.rs",
        ],
        frontend_paths: &[
            "src-mocap/features/ZenMocap/hooks/useTakes.ts",
        ],
        kain_mode_ids: &[],
        known_blockers: &[
            "Take load/list paths currently trust file contents and skip strict structural checks.",
        ],
        next_turn_recommendation: "Add take validation result type and run it during save/load/list operations with explicit error taxonomy.",
    },
];

/// Returns prioritized discovery slices for ZenMocap closed-loop planning.
pub fn discovery_priority_slices() -> Vec<CapabilitySlice> {
    let mut slices: Vec<CapabilitySlice> = DISCOVERY_PRIORITY_SLICES.iter().map(CapabilitySlice::from).collect();
    slices.sort_by_key(|slice| slice.priority);
    slices
}

/// Returns Kain supermotion livelink mode registry as `(mode_name, mode_id)` tuples.
pub fn supermotion_mode_registry() -> Vec<(String, u32)> {
    SUPERMOTION_LIVELINK_MODES
        .iter()
        .map(|(name, id)| ((*name).to_string(), *id))
        .collect()
}

/// Returns IDs referenced by discovery slices that must exist in the mode registry.
pub fn referenced_supermotion_mode_ids() -> BTreeSet<u32> {
    DISCOVERY_PRIORITY_SLICES
        .iter()
        .flat_map(|slice| slice.kain_mode_ids.iter().copied())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovery_slices_are_sorted_and_unique() {
        let slices = discovery_priority_slices();
        assert!(!slices.is_empty());

        let mut seen = BTreeSet::new();
        for pair in slices.windows(2) {
            assert!(pair[0].priority <= pair[1].priority);
        }

        for slice in &slices {
            assert!(seen.insert(slice.id.clone()), "duplicate slice id: {}", slice.id);
        }
    }

    #[test]
    fn referenced_mode_ids_exist_in_supermotion_registry() {
        let registry_ids: BTreeSet<u32> = supermotion_mode_registry().into_iter().map(|(_, id)| id).collect();
        for mode_id in referenced_supermotion_mode_ids() {
            assert!(
                registry_ids.contains(&mode_id),
                "discovery plan references unknown supermotion mode id: {mode_id}"
            );
        }
    }
}
