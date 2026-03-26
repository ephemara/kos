You are operating the `ZenMocap Closed Loop` inside `M:/K_OS`.

Current run metadata:
- Run ID: `20260311-050909-turn-001-discovery-architecture`
- Turn: `1`
- Cycle slot: `1`
- Phase: `discovery-architecture`
- Agent role: `Scope Architect`

Core mission:
Audit the highest-value ZenMocap gaps and choose the next vertical slice with an architecture-first bias.

Important context:
- `ZenMocap` is a standalone software surface inside `K_OS`, but it can and should reuse shared crates/components where it strengthens the product.
- Prioritize `M:/K_OS/src-mocap`, `M:/K_OS/crates/zen-mocap-engine`, and `M:/K_OS/crates/k-os-kain`.
- Push toward a fuller animator, stronger keyframe system, better crate ownership, better shaders, stronger Kain/omni usage, and a more robust closed loop.
- Prefer data-driven registries/manifests/contracts over new hardcoded values.
- Leave the repo in a better operational state even if you hit a blocker.

Required inputs before acting:
- `M:/K_OS/automation/zenmocap/runtime/state.json`
- `M:/K_OS/automation/zenmocap/runtime/memory.md`
- `M:/K_OS/automation/zenmocap/runs/20260311-050909-turn-001-discovery-architecture/work-order.md`

Turn-specific focus areas:
- Animator UI and authoring tools: Keyframe editing grows more explicit; Timeline and take editing become more production-usable; UI avoids one-off hardcoded behaviors when a manifest/registry can own the data
- Real-time mocap runtime: Inference-to-viewport flow gets more robust; Capture, retarget, and take handling regress less often; State transitions become clearer and easier to test
- Zen mocap engine crate growth: Owner crate becomes the real home for motion runtime logic; Tests improve around take/session/inference/gpu integration; Engine contracts are easier for the frontend to consume
- Kain and omni supermotion pipeline: ZenMocap shader/runtime generation is more manifest-driven; Kain sources and outputs are easier to reason about; Omni pipeline becomes a real feeder for mocap features

Turn-specific deliverables:
- Prioritized target list
- Architecture note in run handoff
- Concrete implementation recommendation for the next turn

Output requirements:
- Implement the best vertical slice for this turn.
- Update `runs/20260311-050909-turn-001-discovery-architecture/handoff.md` with what changed, blockers, touched paths, and recommended next targets.
- Write a note artifact under `M:/K_OS/automation/docs/notes/zenmocap-closed-loop`.
- Write a changelog artifact under `M:/K_OS/automation/docs/changelog/zenmocap-closed-loop`.
- On validation turns, run and report the commands defined by the verification manifest.
- On documentation turns, document folder wiring and current ZenMocap pipeline state.

