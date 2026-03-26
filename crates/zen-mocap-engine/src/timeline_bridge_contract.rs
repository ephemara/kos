use std::collections::{BTreeMap, BTreeSet};

use once_cell::sync::Lazy;
use serde::Deserialize;

use crate::{
    timeline_batch::TimelineEditOrigin,
    timeline_edit::enabled_keyframe_operations,
    timeline_surface_contract::timeline_event_source_for_origin,
};

#[derive(Debug, Clone, Deserialize)]
struct SequencerActionBindingManifest {
    action_id: String,
    origin_id: String,
    operation_id: String,
    event_source_id: String,
}

#[derive(Debug, Clone, Deserialize)]
struct TimelineBridgeContractManifest {
    sequencer_action_bindings: Vec<SequencerActionBindingManifest>,
}

#[derive(Debug)]
struct TimelineBridgeContract {
    bindings: BTreeMap<String, TimelineBridgeBinding>,
}

static TIMELINE_BRIDGE_CONTRACT_TOML: &str = include_str!("../resources/timeline_bridge_contract.toml");

static TIMELINE_BRIDGE_CONTRACT: Lazy<TimelineBridgeContract> = Lazy::new(|| {
    let manifest: TimelineBridgeContractManifest = toml::from_str(TIMELINE_BRIDGE_CONTRACT_TOML)
        .expect("timeline_bridge_contract.toml is invalid - this is a compile-time bug");
    validate_contract_manifest(&manifest)
        .expect("timeline_bridge_contract.toml failed validation - this is a compile-time bug")
});

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimelineBridgeBinding {
    pub action_id: String,
    pub origin: TimelineEditOrigin,
    pub operation_id: String,
    pub event_source_id: String,
}

pub fn timeline_bridge_binding_for_action(action_id: &str) -> Option<TimelineBridgeBinding> {
    TIMELINE_BRIDGE_CONTRACT.bindings.get(action_id).cloned()
}

pub fn timeline_bridge_bindings() -> Vec<TimelineBridgeBinding> {
    TIMELINE_BRIDGE_CONTRACT
        .bindings
        .values()
        .cloned()
        .collect()
}

fn validate_contract_manifest(manifest: &TimelineBridgeContractManifest) -> Result<TimelineBridgeContract, String> {
    if manifest.sequencer_action_bindings.is_empty() {
        return Err("sequencer_action_bindings must not be empty".to_string());
    }

    let enabled_operations: BTreeSet<String> = enabled_keyframe_operations().into_iter().collect();

    let mut bindings = BTreeMap::new();
    for entry in &manifest.sequencer_action_bindings {
        let action_id = entry.action_id.trim();
        if action_id.is_empty() {
            return Err("sequencer_action_bindings.action_id cannot be empty".to_string());
        }

        let Some(origin) = TimelineEditOrigin::from_policy_id(entry.origin_id.trim()) else {
            return Err(format!(
                "sequencer action '{}' references unknown origin '{}'",
                action_id, entry.origin_id
            ));
        };

        let operation_id = entry.operation_id.trim();
        if operation_id.is_empty() {
            return Err(format!(
                "sequencer action '{}' has empty operation_id",
                action_id
            ));
        }
        if !enabled_operations.contains(operation_id) {
            return Err(format!(
                "sequencer action '{}' references operation '{}' which is not enabled in keyframe policy",
                action_id, operation_id
            ));
        }

        let event_source_id = entry.event_source_id.trim();
        if event_source_id.is_empty() {
            return Err(format!(
                "sequencer action '{}' has empty event_source_id",
                action_id
            ));
        }

        let expected_event_source_id = timeline_event_source_for_origin(origin);
        if event_source_id != expected_event_source_id {
            return Err(format!(
                "sequencer action '{}' maps origin '{}' to event source '{}' but timeline surface contract requires '{}'",
                action_id,
                origin.policy_id(),
                event_source_id,
                expected_event_source_id
            ));
        }

        let binding = TimelineBridgeBinding {
            action_id: action_id.to_string(),
            origin,
            operation_id: operation_id.to_string(),
            event_source_id: event_source_id.to_string(),
        };

        if bindings.insert(binding.action_id.clone(), binding).is_some() {
            return Err(format!(
                "duplicate sequencer action binding '{}'",
                action_id
            ));
        }
    }

    for required_action_id in [
        "sequencer-add-keyframe",
        "sequencer-remove-keyframe",
        "sequencer-move-keyframe",
    ] {
        if !bindings.contains_key(required_action_id) {
            return Err(format!(
                "required sequencer action binding '{}' is missing",
                required_action_id
            ));
        }
    }

    Ok(TimelineBridgeContract { bindings })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn required_sequencer_actions_are_present() {
        let binding = timeline_bridge_binding_for_action("sequencer-add-keyframe")
            .expect("add-keyframe binding should exist");
        assert_eq!(binding.origin, TimelineEditOrigin::SequencerUi);
        assert_eq!(binding.operation_id, "upsert");
        assert_eq!(binding.event_source_id, "sequencer-ui");

        let move_binding = timeline_bridge_binding_for_action("sequencer-move-keyframe")
            .expect("move-keyframe binding should exist");
        assert_eq!(move_binding.operation_id, "move");
    }

    #[test]
    fn cross_surface_origins_use_surface_contract_sources() {
        let import_binding = timeline_bridge_binding_for_action("sequencer-import-track")
            .expect("import binding should exist");
        assert_eq!(import_binding.origin, TimelineEditOrigin::Import);
        assert_eq!(import_binding.event_source_id, "take-import");

        let automation_binding = timeline_bridge_binding_for_action("sequencer-automation-replay")
            .expect("automation binding should exist");
        assert_eq!(automation_binding.origin, TimelineEditOrigin::Automation);
        assert_eq!(automation_binding.event_source_id, "automation-replay");
    }

    #[test]
    fn all_bindings_use_enabled_keyframe_operations() {
        let enabled_ops: BTreeSet<String> = enabled_keyframe_operations().into_iter().collect();
        for binding in timeline_bridge_bindings() {
            assert!(
                enabled_ops.contains(&binding.operation_id),
                "binding '{}' references disabled op '{}'",
                binding.action_id,
                binding.operation_id
            );
        }
    }
}