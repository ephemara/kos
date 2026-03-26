# ZenMocap Discovery Note - Sequencer Runtime Flush Integration

Run: `20260311-050909-turn-001-discovery-architecture`
Turn: `1` (discovery-architecture)
Date: `2026-03-11`

## What Improved

- Sequencer bridge queue now flushes through the runtime command boundary from `ZenMocap.tsx`.
- Queue draining is now acknowledgement-based (`acknowledgeTimelineRuntimeRequests`) instead of blind clear, preventing accidental drop of uncommitted requests.
- Frontend timeline runtime envelope payload now matches Rust serde contract (`origin`, numeric `requested_supermotion_mode_id`).
- Bridge errors are now captured in sequencer state through `setTimelineBridgeError`, improving runtime diagnosis.

## Verification

- `npx tsc --noEmit` from `M:/K_OS/src-mocap` -> pass
- `cargo check -p k-os-backend` from `M:/K_OS` -> pass

## Remaining Gap

- Runtime timeline commit state is in-memory in Tauri and is not persisted yet into take `timeline_edit_events`.

## Recommended Next Slice

Persist emitted timeline events to take storage and add explicit load/save command paths for sequencer timeline state per take.
