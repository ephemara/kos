# ZenMocap Closed-Loop Note

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: diagnostics-policy-frontend-parity

## Summary

- Aligned frontend timeline diagnostics behavior with the engine-owned diagnostics policy contract already enforced in Tauri.

## Detailed Notes

- `ZenMocap.tsx` now fetches `TimelineRuntimeDiagnosticsPolicy` from `mocap_get_timeline_runtime_diagnostics_policy` and uses it for diagnostics polling cadence.
- `LiveLinkStatus.tsx` and `GpuDoctorPanel.tsx` now conditionally render diagnostics fields using shared `field_visibility` flags.
- `GpuDoctorPanel.tsx` now consumes parent-passed diagnostics state instead of re-invoking diagnostics load on panel open.

## Evidence

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) passed (3 tests).

## Next Target

- Add targeted UI tests that toggle diagnostics policy visibility flags and assert STATUS + GPU Doctor parity.
