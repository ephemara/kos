# ZenMocap Discovery Note — Diagnostics Reason Taxonomy Contract

## Context

Diagnostics mutation events were carrying reason IDs but UI-facing semantics (label/severity/action) were still inferred per component.

## What Was Improved

- Added a manifest-owned reason taxonomy under `event.reason_catalog` in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml`.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed reason descriptors and strict validation:
  - unique/non-empty IDs,
  - non-empty labels/actions,
  - severity constrained to `info|warn|error`,
  - exact parity between `allowed_reasons` and `reason_catalog`.
- Extended backend diagnostics payload in `src-tauri/src/mocap/mocap.rs` with policy-derived `mutation.reason_detail`.
- Updated frontend parser and diagnostics surfaces (`timelineDiagnosticsEvent.ts`, `LiveLinkStatus.tsx`, `GpuDoctorPanel.tsx`) to render policy-owned reason metadata instead of raw IDs.

## Architectural Impact

- Diagnostics reason presentation is now contract-driven and consistent across STATUS and GPU Doctor.
- Future reason changes can be made by policy edits with compile-time validation guardrails.

## Follow-up Recommendation

Add policy-matrix UI tests for all reason catalog entries to lock severity/action rendering parity across diagnostics surfaces.
