# ZenMocap Closed-Loop Changelog

Run: `20260311-050909-turn-001-discovery-architecture`
Slice: `diagnostics-reason-taxonomy-contract`
Date: `2026-03-11`

## Added/Changed

- Added `event.reason_catalog` in `crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml` with reason label/severity/action metadata.
- Extended `crates/zen-mocap-engine/src/timeline_runtime_diagnostics_policy.rs` with typed reason descriptors, policy validation, and descriptor lookup APIs.
- Extended backend diagnostics payload in `src-tauri/src/mocap/mocap.rs` with `mutation.reason_detail` sourced from policy.
- Updated frontend diagnostics typing/parsing/rendering:
  - `src-mocap/features/ZenMocap/MocapService.ts`
  - `src-mocap/features/ZenMocap/timelineDiagnosticsEvent.ts`
  - `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx`
  - `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx`
  - `src-mocap/features/ZenMocap/ZenMocap.tsx`

## Verification

- `cargo test -p zen-mocap-engine timeline_runtime_diagnostics_policy::tests:: --lib` ✅
- `cargo test -p k-os-backend mocap::mocap::tests::diagnostics_changed_payload_respects_event_policy --manifest-path M:/K_OS/src-tauri/Cargo.toml` ✅
- `npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts` ✅
- `npx tsc --noEmit` ✅

## Notes

- Backend `DIRECTORY.md` sentry warnings still appear during `k-os-backend` tests and remain non-blocking for this slice.
