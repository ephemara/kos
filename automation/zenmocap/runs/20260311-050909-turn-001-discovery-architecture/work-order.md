# ZenMocap Closed-Loop Work Order

Run ID: 20260311-050909-turn-001-discovery-architecture
Turn: 1
Cycle Slot: 1
Phase: discovery-architecture
Agent: Scope Architect (`scope-architect`)
Date: 2026-03-11

## Mission

Audit the highest-value ZenMocap gaps and choose the next vertical slice with an architecture-first bias.

## Workspace Roots

- M:\K_OS\src-mocap
- M:\K_OS\crates\zen-mocap-engine
- M:\K_OS\crates\k-os-kain

## Focus Areas

- Animator UI and authoring tools: Keyframe editing grows more explicit; Timeline and take editing become more production-usable; UI avoids one-off hardcoded behaviors when a manifest/registry can own the data
- Real-time mocap runtime: Inference-to-viewport flow gets more robust; Capture, retarget, and take handling regress less often; State transitions become clearer and easier to test
- Zen mocap engine crate growth: Owner crate becomes the real home for motion runtime logic; Tests improve around take/session/inference/gpu integration; Engine contracts are easier for the frontend to consume
- Kain and omni supermotion pipeline: ZenMocap shader/runtime generation is more manifest-driven; Kain sources and outputs are easier to reason about; Omni pipeline becomes a real feeder for mocap features

## Carry Forward

- ZenMocap still needs a much more robust animator and keyframe system.
- Closed-loop runs should keep improving both standalone ZenMocap behavior and shared K_OS-backed crate ownership.
- Validation belongs on every 5th turn and documentation belongs on every 6th turn.

## Deliverables

- Prioritized target list
- Architecture note in run handoff
- Concrete implementation recommendation for the next turn

## Required Outputs

- code and/or docs that materially move ZenMocap forward
- `runs/20260311-050909-turn-001-discovery-architecture/handoff.md`
- changelog note in `M:\K_OS\automation\docs\changelog\zenmocap-closed-loop`
- notes artifact in `M:\K_OS\automation\docs\notes\zenmocap-closed-loop`

## Validation Rule

Run the narrowest useful verification for touched surfaces and record exact command results.

## Documentation Rule

If architecture or folder ownership meaningfully changed, leave the next documentation turn with clear source material.

