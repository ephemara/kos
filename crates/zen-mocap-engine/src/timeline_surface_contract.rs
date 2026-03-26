use std::collections::{BTreeMap, BTreeSet};

use once_cell::sync::Lazy;
use serde::Deserialize;

use crate::{
    timeline_batch::TimelineEditOrigin,
    timeline_event::enabled_timeline_event_sources,
};

#[derive(Debug, Clone, Deserialize)]
struct OriginSourceBindingManifest {
    origin_id: String,
    event_source_id: String,
}

#[derive(Debug, Clone, Deserialize)]
struct TimelineSurfaceContractManifest {
    origin_source_bindings: Vec<OriginSourceBindingManifest>,
}

#[derive(Debug)]
struct TimelineSurfaceContract {
    origin_to_event_source: BTreeMap<String, String>,
}

static TIMELINE_SURFACE_CONTRACT_TOML: &str = include_str!("../resources/timeline_surface_contract.toml");

static TIMELINE_SURFACE_CONTRACT: Lazy<TimelineSurfaceContract> = Lazy::new(|| {
    let manifest: TimelineSurfaceContractManifest = toml::from_str(TIMELINE_SURFACE_CONTRACT_TOML)
        .expect("timeline_surface_contract.toml is invalid - this is a compile-time bug");
    validate_contract_manifest(&manifest)
        .expect("timeline_surface_contract.toml failed validation - this is a compile-time bug")
});

pub fn timeline_event_source_for_origin(origin: TimelineEditOrigin) -> &'static str {
    TIMELINE_SURFACE_CONTRACT
        .origin_to_event_source
        .get(origin.policy_id())
        .map(String::as_str)
        .expect("timeline surface contract is missing origin binding")
}

pub fn timeline_surface_bindings() -> Vec<(String, String)> {
    TIMELINE_SURFACE_CONTRACT
        .origin_to_event_source
        .iter()
        .map(|(origin_id, source_id)| (origin_id.clone(), source_id.clone()))
        .collect()
}

fn validate_contract_manifest(manifest: &TimelineSurfaceContractManifest) -> Result<TimelineSurfaceContract, String> {
    if manifest.origin_source_bindings.is_empty() {
        return Err("origin_source_bindings must not be empty".to_string());
    }

    let enabled_event_sources: BTreeSet<String> = enabled_timeline_event_sources().into_iter().collect();

    let mut origin_to_event_source = BTreeMap::new();
    for binding in &manifest.origin_source_bindings {
        let origin_id = binding.origin_id.trim();
        if origin_id.is_empty() {
            return Err("origin_source_bindings.origin_id cannot be empty".to_string());
        }
        if TimelineEditOrigin::from_policy_id(origin_id).is_none() {
            return Err(format!(
                "origin_source_bindings.origin_id '{}' is not a known timeline origin id",
                origin_id
            ));
        }

        let event_source_id = binding.event_source_id.trim();
        if event_source_id.is_empty() {
            return Err(format!(
                "origin_source_bindings.event_source_id for origin '{}' cannot be empty",
                origin_id
            ));
        }
        if !enabled_event_sources.contains(event_source_id) {
            return Err(format!(
                "origin '{}' references event source '{}' that is not enabled by timeline_event policy",
                origin_id, event_source_id
            ));
        }

        if origin_to_event_source
            .insert(origin_id.to_string(), event_source_id.to_string())
            .is_some()
        {
            return Err(format!(
                "duplicate origin_source_bindings entry for origin '{}'",
                origin_id
            ));
        }
    }

    for origin in TimelineEditOrigin::ALL {
        let origin_id = origin.policy_id();
        if !origin_to_event_source.contains_key(origin_id) {
            return Err(format!(
                "timeline surface contract missing required origin binding '{}'",
                origin_id
            ));
        }
    }

    Ok(TimelineSurfaceContract {
        origin_to_event_source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_origins_have_an_enabled_event_source_binding() {
        for origin in TimelineEditOrigin::ALL {
            let source = timeline_event_source_for_origin(origin);
            assert!(
                enabled_timeline_event_sources().contains(&source.to_string()),
                "origin '{}' mapped to disabled source '{}'",
                origin.policy_id(),
                source
            );
        }
    }

    #[test]
    fn import_and_automation_origins_bind_to_non_sequencer_sources() {
        assert_eq!(
            timeline_event_source_for_origin(TimelineEditOrigin::Import),
            "take-import"
        );
        assert_eq!(
            timeline_event_source_for_origin(TimelineEditOrigin::Automation),
            "automation-replay"
        );
    }
}
