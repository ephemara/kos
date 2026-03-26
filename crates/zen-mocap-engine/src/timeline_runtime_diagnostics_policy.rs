use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
struct TimelineRuntimeDiagnosticsPolicyManifest {
    policy_id: String,
    refresh: TimelineRuntimeDiagnosticsRefreshPolicy,
    event: TimelineRuntimeDiagnosticsEventPolicy,
    drift: TimelineRuntimeDiagnosticsDriftPolicy,
    trend: TimelineRuntimeDiagnosticsTrendPolicy,
    field_visibility: TimelineRuntimeDiagnosticsFieldVisibility,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsRefreshPolicy {
    pub enabled: bool,
    pub interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsReasonDescriptor {
    pub reason_id: String,
    pub label: String,
    pub severity: String,
    pub action_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsEventPolicy {
    pub include_reason: bool,
    pub include_emitted_at_ms: bool,
    pub include_trend_summary: bool,
    pub trend_summary_min_severity: String,
    pub trend_summary_top_count: usize,
    pub allowed_reasons: Vec<String>,
    pub reason_catalog: Vec<TimelineRuntimeDiagnosticsReasonDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsDriftPolicy {
    pub warn_pending_request_count: usize,
    pub warn_queue_vs_ledger_gap: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsTrendPolicy {
    pub reason_history_limit: usize,
    pub decay_window_ms: u64,
    pub cooldown_window_ms: u64,
    pub top_reason_count: usize,
    pub default_warn_count: usize,
    pub default_error_count: usize,
    pub reason_thresholds: Vec<TimelineRuntimeDiagnosticsReasonTrendThreshold>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsReasonTrendThreshold {
    pub reason_id: String,
    pub warn_count: usize,
    pub error_count: usize,
    pub warn_action_hint: Option<String>,
    pub error_action_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsFieldVisibility {
    pub show_active_take_path: bool,
    pub show_take_existence: bool,
    pub show_active_track_count: bool,
    pub show_active_track_ids: bool,
    pub show_event_log_size: bool,
    pub show_latest_event_timestamp: bool,
    pub show_track_keyframe_counts: bool,
    pub show_event_source_counts: bool,
    pub show_recent_reason_counts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TimelineRuntimeDiagnosticsPolicy {
    pub policy_id: String,
    pub refresh: TimelineRuntimeDiagnosticsRefreshPolicy,
    pub event: TimelineRuntimeDiagnosticsEventPolicy,
    pub drift: TimelineRuntimeDiagnosticsDriftPolicy,
    pub trend: TimelineRuntimeDiagnosticsTrendPolicy,
    pub field_visibility: TimelineRuntimeDiagnosticsFieldVisibility,
}

static TIMELINE_RUNTIME_DIAGNOSTICS_POLICY_TOML: &str =
    include_str!("../resources/timeline_runtime_diagnostics_policy.toml");

static TIMELINE_RUNTIME_DIAGNOSTICS_POLICY: Lazy<TimelineRuntimeDiagnosticsPolicy> = Lazy::new(|| {
    let manifest: TimelineRuntimeDiagnosticsPolicyManifest =
        toml::from_str(TIMELINE_RUNTIME_DIAGNOSTICS_POLICY_TOML)
            .expect("timeline_runtime_diagnostics_policy.toml is invalid - this is a compile-time bug");
    validate_manifest(manifest)
        .expect("timeline_runtime_diagnostics_policy.toml failed validation - this is a compile-time bug")
});

pub fn timeline_runtime_diagnostics_policy() -> &'static TimelineRuntimeDiagnosticsPolicy {
    &TIMELINE_RUNTIME_DIAGNOSTICS_POLICY
}

impl TimelineRuntimeDiagnosticsEventPolicy {
    pub fn reason_descriptor(
        &self,
        reason_id: &str,
    ) -> Option<&TimelineRuntimeDiagnosticsReasonDescriptor> {
        self.reason_catalog
            .iter()
            .find(|descriptor| descriptor.reason_id == reason_id)
    }
}

impl TimelineRuntimeDiagnosticsPolicy {
    pub fn trend_threshold_for_reason(&self, reason_id: &str) -> (usize, usize) {
        self.trend
            .reason_thresholds
            .iter()
            .find(|threshold| threshold.reason_id == reason_id)
            .map(|threshold| (threshold.warn_count, threshold.error_count))
            .unwrap_or((
                self.trend.default_warn_count,
                self.trend.default_error_count,
            ))
    }

    pub fn trend_severity_for_count(&self, reason_id: &str, count: usize) -> &'static str {
        let (warn_count, error_count) = self.trend_threshold_for_reason(reason_id);
        if count >= error_count {
            "error"
        } else if count >= warn_count {
            "warn"
        } else {
            "info"
        }
    }

    pub fn trend_action_hint_for_count(&self, reason_id: &str, count: usize) -> Option<&str> {
        self.trend
            .reason_thresholds
            .iter()
            .find(|threshold| threshold.reason_id == reason_id)
            .and_then(|threshold| {
                if count >= threshold.error_count {
                    threshold.error_action_hint.as_deref()
                } else if count >= threshold.warn_count {
                    threshold.warn_action_hint.as_deref()
                } else {
                    None
                }
            })
    }
}

fn validate_manifest(
    manifest: TimelineRuntimeDiagnosticsPolicyManifest,
) -> Result<TimelineRuntimeDiagnosticsPolicy, String> {
    if manifest.policy_id.trim().is_empty() {
        return Err("policy_id must be a non-empty string".to_string());
    }
    if manifest.refresh.enabled && manifest.refresh.interval_ms < 250 {
        return Err("refresh.interval_ms must be >= 250 when diagnostics refresh is enabled".to_string());
    }
    if manifest.event.allowed_reasons.is_empty() {
        return Err("event.allowed_reasons must include at least one reason".to_string());
    }
    if manifest.event.include_trend_summary && manifest.event.trend_summary_top_count == 0 {
        return Err("event.trend_summary_top_count must be >= 1 when event.include_trend_summary is enabled".to_string());
    }
    if !matches!(
        manifest.event.trend_summary_min_severity.trim(),
        "info" | "warn" | "error"
    ) {
        return Err("event.trend_summary_min_severity must be one of info|warn|error".to_string());
    }

    let mut deduped_allowed = std::collections::BTreeSet::new();
    for reason in &manifest.event.allowed_reasons {
        let trimmed = reason.trim();
        if trimmed.is_empty() {
            return Err("event.allowed_reasons cannot include empty values".to_string());
        }
        if !deduped_allowed.insert(trimmed.to_string()) {
            return Err(format!(
                "event.allowed_reasons must be unique (duplicate '{trimmed}')"
            ));
        }
    }

    if manifest.event.reason_catalog.is_empty() {
        return Err("event.reason_catalog must include at least one reason descriptor".to_string());
    }
    let mut deduped_catalog = std::collections::BTreeSet::new();
    let mut catalog_ids = std::collections::BTreeSet::new();
    for descriptor in &manifest.event.reason_catalog {
        let reason_id = descriptor.reason_id.trim();
        if reason_id.is_empty() {
            return Err("event.reason_catalog.reason_id cannot be empty".to_string());
        }
        if !deduped_catalog.insert(reason_id.to_string()) {
            return Err(format!(
                "event.reason_catalog.reason_id must be unique (duplicate '{reason_id}')"
            ));
        }
        if descriptor.label.trim().is_empty() {
            return Err(format!(
                "event.reason_catalog label cannot be empty for '{reason_id}'"
            ));
        }
        if descriptor.action_hint.trim().is_empty() {
            return Err(format!(
                "event.reason_catalog action_hint cannot be empty for '{reason_id}'"
            ));
        }
        if !matches!(descriptor.severity.trim(), "info" | "warn" | "error") {
            return Err(format!(
                "event.reason_catalog severity must be one of info|warn|error for '{reason_id}'"
            ));
        }
        catalog_ids.insert(reason_id.to_string());
    }
    for allowed in &deduped_allowed {
        if !catalog_ids.contains(allowed) {
            return Err(format!(
                "event.reason_catalog missing descriptor for allowed reason '{allowed}'"
            ));
        }
    }
    for catalog_reason_id in &catalog_ids {
        if !deduped_allowed.contains(catalog_reason_id) {
            return Err(format!(
                "event.reason_catalog includes unknown reason '{catalog_reason_id}'"
            ));
        }
    }

    if manifest.drift.warn_pending_request_count == 0 {
        return Err("drift.warn_pending_request_count must be >= 1".to_string());
    }
    if manifest.drift.warn_queue_vs_ledger_gap == 0 {
        return Err("drift.warn_queue_vs_ledger_gap must be >= 1".to_string());
    }
    if manifest.trend.reason_history_limit == 0 {
        return Err("trend.reason_history_limit must be >= 1".to_string());
    }
    if manifest.trend.decay_window_ms < 1_000 {
        return Err("trend.decay_window_ms must be >= 1000".to_string());
    }
    if manifest.trend.cooldown_window_ms < 1_000 {
        return Err("trend.cooldown_window_ms must be >= 1000".to_string());
    }
    if manifest.trend.top_reason_count == 0 {
        return Err("trend.top_reason_count must be >= 1".to_string());
    }
    if manifest.trend.default_warn_count == 0 {
        return Err("trend.default_warn_count must be >= 1".to_string());
    }
    if manifest.trend.default_error_count == 0 {
        return Err("trend.default_error_count must be >= 1".to_string());
    }
    if manifest.trend.default_error_count <= manifest.trend.default_warn_count {
        return Err("trend.default_error_count must be > trend.default_warn_count".to_string());
    }
    if manifest.trend.decay_window_ms < 1000 {
        return Err("trend.decay_window_ms must be >= 1000".to_string());
    }
    if manifest.trend.cooldown_window_ms < 1000 {
        return Err("trend.cooldown_window_ms must be >= 1000".to_string());
    }
    if manifest.trend.cooldown_window_ms > manifest.trend.decay_window_ms {
        return Err(
            "trend.cooldown_window_ms must be <= trend.decay_window_ms".to_string(),
        );
    }
    let mut seen_reason_thresholds = std::collections::BTreeSet::new();
    for threshold in &manifest.trend.reason_thresholds {
        let reason_id = threshold.reason_id.trim();
        if reason_id.is_empty() {
            return Err("trend.reason_thresholds.reason_id cannot be empty".to_string());
        }
        if !deduped_allowed.contains(reason_id) {
            return Err(format!(
                "trend.reason_thresholds includes unknown reason '{reason_id}'"
            ));
        }
        if !seen_reason_thresholds.insert(reason_id.to_string()) {
            return Err(format!(
                "trend.reason_thresholds reason_id must be unique (duplicate '{reason_id}')"
            ));
        }
        if threshold.warn_count == 0 {
            return Err(format!(
                "trend.reason_thresholds warn_count must be >= 1 for '{reason_id}'"
            ));
        }
        if threshold.error_count <= threshold.warn_count {
            return Err(format!(
                "trend.reason_thresholds error_count must be > warn_count for '{reason_id}'"
            ));
        }
        if threshold
            .warn_action_hint
            .as_ref()
            .map(|hint| hint.trim().is_empty())
            .unwrap_or(false)
        {
            return Err(format!(
                "trend.reason_thresholds warn_action_hint cannot be empty for '{reason_id}'"
            ));
        }
        if threshold
            .error_action_hint
            .as_ref()
            .map(|hint| hint.trim().is_empty())
            .unwrap_or(false)
        {
            return Err(format!(
                "trend.reason_thresholds error_action_hint cannot be empty for '{reason_id}'"
            ));
        }
    }

    Ok(TimelineRuntimeDiagnosticsPolicy {
        policy_id: manifest.policy_id,
        refresh: manifest.refresh,
        event: manifest.event,
        drift: manifest.drift,
        trend: manifest.trend,
        field_visibility: manifest.field_visibility,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_manifest_loads_with_expected_defaults() {
        let policy = timeline_runtime_diagnostics_policy();
        assert_eq!(policy.policy_id, "timeline-runtime-diagnostics-v1");
        assert!(policy.refresh.enabled);
        assert_eq!(policy.refresh.interval_ms, 1500);
        assert!(policy.event.include_reason);
        assert!(policy.event.include_emitted_at_ms);
        assert!(policy.event.include_trend_summary);
        assert_eq!(policy.event.trend_summary_min_severity, "warn");
        assert_eq!(policy.event.trend_summary_top_count, 2);
        assert!(policy
            .event
            .allowed_reasons
            .iter()
            .any(|reason| reason == "runtime_requests_applied"));
        let descriptor = policy
            .event
            .reason_descriptor("runtime_requests_applied")
            .expect("reason descriptor should exist");
        assert_eq!(descriptor.label, "Runtime Requests Applied");
        assert_eq!(descriptor.severity, "info");
        assert_eq!(policy.drift.warn_pending_request_count, 6);
        assert_eq!(policy.drift.warn_queue_vs_ledger_gap, 4);
        assert_eq!(policy.trend.reason_history_limit, 64);
        assert_eq!(policy.trend.decay_window_ms, 300_000);
        assert_eq!(policy.trend.cooldown_window_ms, 120_000);
        assert_eq!(policy.trend.top_reason_count, 3);
        assert_eq!(policy.trend.default_warn_count, 6);
        assert_eq!(policy.trend.default_error_count, 12);
        assert_eq!(policy.trend.decay_window_ms, 300000);
        assert_eq!(policy.trend.cooldown_window_ms, 120000);
        assert_eq!(
            policy
                .trend
                .reason_thresholds
                .iter()
                .find(|threshold| threshold.reason_id == "runtime_state_reset")
                .map(|threshold| (threshold.warn_count, threshold.error_count)),
            Some((2, 4))
        );
        assert_eq!(policy.trend_severity_for_count("runtime_state_reset", 2), "warn");
        assert_eq!(policy.trend_severity_for_count("runtime_state_reset", 4), "error");
        assert_eq!(policy.trend_severity_for_count("runtime_requests_applied", 5), "info");
        assert_eq!(
            policy.trend_action_hint_for_count("runtime_state_reset", 2),
            Some("Confirm resets are intentional and session ownership is stable.")
        );
        assert_eq!(
            policy.trend_action_hint_for_count("runtime_state_reset", 4),
            Some("Investigate repeated runtime resets and capture repro logs immediately.")
        );
        assert!(!policy.field_visibility.show_active_track_ids);
        assert!(policy.field_visibility.show_track_keyframe_counts);
        assert!(policy.field_visibility.show_recent_reason_counts);
    }
}
