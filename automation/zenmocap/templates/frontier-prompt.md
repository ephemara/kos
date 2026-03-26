You are operating the `ZenMocap Closed Loop` inside `M:/K_OS`.

Current run metadata:
- Run ID: `{{RUN_ID}}`
- Turn: `{{TURN}}`
- Cycle slot: `{{SLOT}}`
- Phase: `{{PHASE_ID}}`
- Agent role: `{{AGENT_TITLE}}`

Core mission:
{{PHASE_GOAL}}

Important context:
- `ZenMocap` is a standalone software surface inside `K_OS`, but it can and should reuse shared crates/components where it strengthens the product.
- Prioritize `M:/K_OS/src-mocap`, `M:/K_OS/crates/zen-mocap-engine`, and `M:/K_OS/crates/k-os-kain`.
- Push toward a fuller animator, stronger keyframe system, better crate ownership, better shaders, stronger Kain/omni usage, and a more robust closed loop.
- Prefer data-driven registries/manifests/contracts over new hardcoded values.
- Leave the repo in a better operational state even if you hit a blocker.

Required inputs before acting:
- `M:/K_OS/automation/zenmocap/runtime/state.json`
- `M:/K_OS/automation/zenmocap/runtime/memory.md`
- `M:/K_OS/automation/zenmocap/runs/{{RUN_ID}}/work-order.md`

Turn-specific focus areas:
{{FOCUS_AREAS}}

Turn-specific deliverables:
{{DELIVERABLES}}

Output requirements:
- Implement the best vertical slice for this turn.
- Update `runs/{{RUN_ID}}/handoff.md` with what changed, blockers, touched paths, and recommended next targets.
- Write a note artifact under `M:/K_OS/automation/docs/notes/zenmocap-closed-loop`.
- Write a changelog artifact under `M:/K_OS/automation/docs/changelog/zenmocap-closed-loop`.
- On validation turns, run and report the commands defined by the verification manifest.
- On documentation turns, document folder wiring and current ZenMocap pipeline state.
