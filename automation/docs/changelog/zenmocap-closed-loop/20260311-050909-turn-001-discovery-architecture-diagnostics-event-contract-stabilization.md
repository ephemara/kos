# ZenMocap Closed-Loop Changelog

Run: `20260311-050909-turn-001-discovery-architecture`
Slice: `diagnostics-event-contract-stabilization`
Date: `2026-03-11`

## Added/Changed

- Fixed `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` to keep a single valid `[event]` policy contract with explicit allowed reasons.
- Updated `src-tauri/src/mocap/mocap.rs` diagnostics event payload construction:
  - unknown mutation reasons now normalize to the policy fallback reason,
  - metadata emission remains policy-gated via `include_reason` and `include_emitted_at_ms`.
- Updated `src-tauri/src/mocap/mocap.rs` test expectation for reason fallback behavior.
- Added `KainDomain::Procedural` mapping in `src-tauri/src/kain_commands.rs` to keep source registry mapping exhaustive.

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` ✅
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` ✅
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` ✅

## Notes

- Backend still emits DIRECTORY.md sentry warnings during `k-os-backend` test runs; warnings are pre-existing and non-blocking for this slice.
