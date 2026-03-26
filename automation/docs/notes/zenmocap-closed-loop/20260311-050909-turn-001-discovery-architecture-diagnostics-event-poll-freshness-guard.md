# ZenMocap Closed-Loop Note

Run ID: 20260311-050909-turn-001-discovery-architecture
Phase: discovery-architecture
Timestamp: 2026-03-11T21:37:14.1978449-04:00

## Slice

Diagnostics event/poll freshness guard for ZenMocap timeline runtime diagnostics.

## Why

Event-first diagnostics can race with fallback polling. Without freshness gating, older poll snapshots can overwrite newer event payloads and clear mutation attribution.

## What Changed

- Added timelineDiagnosticsFreshness.ts with deterministic diagnostics versioning based on max(report latest event timestamp, mutation emitted timestamp).
- Added shouldApplyTimelineDiagnosticsUpdate to gate stale updates.
- Updated ZenMocap.tsx to apply freshness checks on both polling refresh and diagnostics event listener paths.
- Polling now clears mutation metadata only when the poll snapshot is strictly newer than current diagnostics state.
- Added timelineDiagnosticsFreshness.test.ts to lock stale-poll rejection and version behavior.

## Verification

- npx vitest run src-mocap/features/ZenMocap/timelineDiagnosticsFreshness.test.ts src-mocap/features/ZenMocap/timelineDiagnosticsEvent.test.ts -> pass.
- npx tsc --noEmit (workdir M:/K_OS) -> pass.

## Follow-Up

- Add policy-matrix component tests for diagnostics field visibility + reason severity rendering in STATUS and GPU Doctor.
