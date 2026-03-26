# ZenMocap Discovery Note — Diagnostics Event Contract Stabilization

## Context

Recent discovery iterations introduced diagnostics policy + event payload metadata, but the active manifest drifted into an invalid shape (duplicate `[event]` table), and backend unknown-reason behavior silently dropped mutation metadata.

## What Was Improved

- Re-stabilized `timeline_runtime_diagnostics_policy.toml` as a single-source policy with one `[event]` table and explicit allowed reasons.
- Hardened `mocap.rs` diagnostics event payload builder so reason metadata is deterministic:
  - allowed reason -> emitted as-is,
  - unknown reason -> policy-backed fallback reason with warning log.
- Preserved policy-driven optionality for metadata fields (`include_reason`, `include_emitted_at_ms`) and report field-visibility redaction.
- Unblocked focused backend verification by adding `KainDomain::Procedural` registry mapping in `kain_commands.rs`.

## Architectural Impact

- Diagnostics mutation metadata is now less brittle and policy-centric.
- Event consumers receive stable reason semantics even when a callsite introduces an unregistered reason.
- Verification reliability improved because unrelated Kain enum growth no longer blocks mocap command test runs.

## Follow-up Recommendation

Create a manifest-owned diagnostics mutation taxonomy (reason id -> label, severity, suggested UI action) in `zen-mocap-engine` and consume it from STATUS/GPU Doctor so event rendering becomes contract-driven rather than ad hoc component logic.
