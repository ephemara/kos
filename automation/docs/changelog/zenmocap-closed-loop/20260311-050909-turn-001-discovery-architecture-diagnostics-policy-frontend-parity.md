# Changelog - ZenMocap Closed Loop

Date: 2026-03-11
Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Phase: discovery-architecture
Slice: diagnostics-policy-frontend-parity

## What Changed

- `src-mocap/features/ZenMocap/ZenMocap.tsx` now loads diagnostics policy via `mocap_get_timeline_runtime_diagnostics_policy` and uses policy refresh settings.
- `src-mocap/features/ZenMocap/ui/LiveLinkStatus.tsx` and `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` now respect diagnostics `field_visibility` from the shared policy contract.
- `src-mocap/features/ZenMocap/ui/GpuDoctorPanel.tsx` now reuses parent diagnostics state instead of issuing a duplicate diagnostics invoke on open.

## Why It Matters

- Diagnostics behavior is now contract-driven end-to-end instead of split between backend manifest policy and frontend literals.
- STATUS and GPU Doctor surfaces now share one visibility source of truth, reducing UI/runtime drift.

## Verification

- `npx tsc --noEmit` (workdir `M:/K_OS/src-mocap`) passed.
- `npx vitest run src-mocap/features/ZenMocap/trackingConfig.test.ts` (workdir `M:/K_OS`) passed (3 tests).

## Next Up

- Add policy-matrix UI tests for diagnostics field visibility and event-driven diagnostics refresh.
