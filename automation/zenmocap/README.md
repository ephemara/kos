# ZenMocap Closed-Loop Automation

This package scaffolds a data-driven hourly improvement loop for `ZenMocap` inside `M:\K_OS`.
It is designed for frontier-model automation runs that should keep pushing the standalone mocap stack toward:

- a more robust real-time mocap pipeline
- a fuller animator surface with Cascadeur/Maya-style editing depth
- stronger `crates/zen-mocap-engine` ownership
- deeper `crates/k-os-kain` and Kain omni usage
- repeatable testing and documentation turns

## What This Package Owns

- `config/`
  - loop cadence
  - agent registry
  - target surfaces
  - test/doc command manifests
- `runtime/`
  - mutable loop state
  - long-lived memory and carry-forward context
- `templates/`
  - work-order, prompt, notes, and changelog templates
- `scripts/`
  - turn resolver / run-folder scaffolder
- `runs/`
  - per-turn generated work orders and artifacts

## Closed-Loop Cadence

The loop is six turns long and then repeats:

1. `discovery-architecture`
2. `animator-systems`
3. `engine-kain-shaders`
4. `integration-polish`
5. `validation`
6. `documentation`

Turns `1-4` aggressively improve the product.
Turn `5` runs the heavier validation sweep.
Turn `6` updates docs, folder wiring notes, and changelog records.

## Inter-Agent Communication Contract

Every run reads from and writes to:

- `runtime/state.json`
- `runtime/memory.md`
- `runs/<run-id>/work-order.md`
- `runs/<run-id>/handoff.md`
- `automation/docs/notes/zenmocap-closed-loop/`
- `automation/docs/changelog/zenmocap-closed-loop/`

The intended handshake is:

1. Resolver script computes the active turn and agent scope.
2. Automation agent reads `runtime/state.json` plus `runtime/memory.md`.
3. Agent executes the scoped work order.
4. Agent updates handoff, touched surfaces, verification status, blockers, and next recommendations.
5. A later run uses that state as the next closed-loop input.

## Usage

Generate the next run folder and work order:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File M:\K_OS\automation\zenmocap\scripts\Invoke-ZenMocapLoop.ps1 -Mode Prepare
```

Advance the loop after a run lands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File M:\K_OS\automation\zenmocap\scripts\Invoke-ZenMocapLoop.ps1 -Mode Advance -Status completed -Summary "Implemented scoped ZenMocap improvements."
```

Preview current status without changing anything:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File M:\K_OS\automation\zenmocap\scripts\Invoke-ZenMocapLoop.ps1 -Mode Status
```

## Notes

- The manifests are intentionally data-driven so cadence, commands, folders, and role behavior can evolve without rewriting the script.
- This package does not schedule the hourly automation itself; it prepares the loop state and run payloads that a scheduler can invoke.
- Use `-NoProfile` when calling the script on this machine so local PowerShell profile errors do not pollute automation runs.
- The scaffold already points docs/changelog output at the existing `automation/docs` pattern used elsewhere in the repo.
