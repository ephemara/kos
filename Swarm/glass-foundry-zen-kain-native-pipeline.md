# Swarm: Glass Foundry

- Swarm Slug: glass-foundry-zen-kain-native-pipeline
- Mission: Unify the Zen native 3D renderer pipeline around the shared K_OS renderer and evaluation stack, wire the major crate surface into Zen through data-driven host contracts, and land a practical Kain-backed DCC integration path without preserving duplicate renderer ownership.
- Workspace Root: M:\K_OS
- Swarm Status: active
- Swarm Owner: Sovereign
- Created At: 2026-03-26 21:20 EDT
- Updated At: 2026-03-26 21:34 EDT
- Completion Rule: When every lane is done or cancelled, Sovereign moves this file into ./Swarm/completed/.

## Objectives

- [ ] Replace Zen's host-local viewport pipeline with a canonical path built on `k-os-renderer`, `k-os-eval`, and `k-os-scene-runtime`.
- [ ] Wire the major crate surface into Zen through registry-driven contracts, recommended entrypoints, and explicit host/tool adapters.
- [ ] Keep Zen functional as a native DCC host while Kain renderer dispatch, tool surfaces, and migration cleanup are landed in stages.
- [ ] Leave behind architecture, validation, and operator guidance strong enough for sustained parallel execution.

## Shared Constraints

- Do not run broad tests or heavy validation unless the user enables testing mode for this conversation.
- Prefer data-driven manifests, registries, and typed contracts over new hardcoded crate wiring.
- Treat `zen` as the native host composition root, not as the long-term owner of duplicate renderer logic.
- Preserve temporary compatibility paths only when they unblock migration; delete them once the shared path is proven.
- Keep ownership crisp across lanes. No overlapping write scopes without an explicit handoff note in this file.
- Do not use destructive git operations or revert unrelated local changes.

## Launch Order

1. Sovereign
2. Atlas
3. Forge + Vector
4. Delta
5. Aegis
6. Scribe
7. Sweep

## Lane: Sovereign

- Role: Lead planner, dependency arbitration, merge strategy, and archive owner.
- Status: in_progress
- Claimed By: Sovereign
- Claimed At: 2026-03-26 21:20 EDT
- Depends On: none
- Deliverables:
  - Finalized swarm plan
  - Cross-lane dependency decisions
  - Final merge and archive decision record
- Task List:
  - [ ] Maintain the critical path around renderer unification, contract definition, and Zen host adoption.
  - [ ] Resolve overlaps between Atlas, Forge, Vector, and Delta before implementation branches diverge.
  - [ ] Revisit this file as lanes land and tighten priorities, blockers, and handoffs.
  - [ ] Approve the final cutover from host-local Zen renderer code to the shared renderer path.
  - [ ] Move this swarm file into `./Swarm/completed/` once every lane is complete or intentionally cancelled.
- Notes:
  - The core decision is already biased: Zen should host the shared renderer stack, not remain a second renderer implementation.

## Lane: Atlas

- Role: Architecture mapping, codebase graphing, migration design, and boundary proposal.
- Status: done
- Claimed By: Atlas
- Claimed At: 2026-03-26 21:26 EDT
- Depends On: Sovereign
- Deliverables:
  - Architecture map of current Zen renderer ownership versus shared renderer crates
  - Target boundary proposal for Zen, `k-os-renderer`, `k-os-eval`, `k-os-scene-runtime`, and Kain runtime
  - Migration sequence note with hard blockers and fallback seams
  - Durable architecture note at `docs/zen_renderer_unification.md`
- Task List:
  - [x] Inventory the current native renderer ownership across `crates/zen/src/main.rs`, `crates/k-os-renderer`, `crates/k-os-eval`, and `crates/k-os-scene-runtime`.
  - [x] Identify the exact cut points for camera ownership, viewport texture handoff, mesh payload sync, selection, frame stats, and post-processing.
  - [x] Propose the target runtime data flow from scene state to evaluated viewport payload to renderer service to Zen viewport presentation.
  - [x] Record the migration hazards around duplicate WGSL, renderer service threading, egui texture integration, and staged Kain dispatch.
  - [x] Write the target architecture note in a durable project location for the implementation lanes to follow.
- Notes:
  - Completed in `docs/zen_renderer_unification.md`.

## Lane: Forge

- Role: Core implementation lane for native renderer unification, scene-to-render sync, and runtime backbone work.
- Status: done
- Claimed By: Forge
- Claimed At: 2026-03-26 21:30 EDT
- Depends On: Atlas
- Deliverables:
  - Canonical Zen viewport path backed by `k-os-renderer`
  - `EvaluatedMeshSource` or equivalent bridge from scene/eval state into renderer sync
  - Transitional compatibility layer only if required for cutover
- Task List:
  - [x] Implement the Zen-side adapter that feeds evaluated viewport payloads from scene/runtime ownership into `k-os-renderer`.
  - [x] Route viewport creation, redraw, mesh sync, and selection through `RendererService` instead of host-local scene buffer ownership.
  - [x] Preserve viewport presentation in Zen while moving render execution responsibility out of `zen/src/main.rs`.
  - [x] Wire camera state and frame stats through the shared renderer contract instead of duplicate host-local state where possible.
  - [x] Keep a narrow compatibility seam for any remaining post-processing or presentation code that cannot move in the first pass.
  - [x] Remove or isolate renderer-local code in Zen that becomes redundant once the shared path is active.
- Notes:
  - Shared renderer/session ownership now lives in `crates/zen/src/renderer_session.rs`.
  - `main.rs` keeps presentation/post responsibility; scene sync, canonical scene-runtime eval, camera forwarding, and selection are routed through the session.
  - The final mirror contract also carries viewport state into `k-os-scene-runtime`, so the canonical eval path preserves Zen shading mode rather than defaulting mirrored meshes to `Solid`.

## Lane: Vector

- Role: APIs, schemas, registries, contracts, and integration boundary shaping.
- Status: done
- Claimed By: Vector
- Claimed At: 2026-03-26 21:29 EDT
- Depends On: Atlas
- Deliverables:
  - Updated registry metadata for Zen-native renderer and DCC tool integration
  - Stable host/integration/internal tiering for the Zen-facing crate surface
  - Typed contract or manifest additions needed for tool discovery and crate composition
  - Generated contract artifacts or schema docs in a durable repo location
- Task List:
  - [x] Extend the workspace registry metadata so Zen-facing crates expose clear host contracts, tool capabilities, and renderer-relevant entrypoints.
  - [x] Define the canonical adapter/contract surface for scene viewport, tool actions, asset import, runtime diagnostics, and Kain-backed modules.
  - [x] Add any missing `workspace.metadata.kos` or per-crate metadata needed to classify DCC tools without hand-curating every crate.
  - [x] Tighten recommended entrypoints for high-pressure crates involved in Zen integration so the host does not depend on arbitrary deep `pub` items.
  - [x] Leave behind generated artifacts or schema docs that Delta and Scribe can consume directly.
- Notes:
  - This lane owns clarity of what Zen should call, not just what Zen can call.
  - Durable handoff: [`M:\K_OS\docs\zen_contract_surface.md`](M:\K_OS\docs\zen_contract_surface.md).

## Lane: Delta

- Role: Integration lane for Zen host wiring, Kain shell/tool surfaces, adapter consumption, and editor workflow glue.
- Status: in_progress
- Claimed By: Delta
- Claimed At: 2026-03-27 00:16 -04:00
- Depends On: Forge, Vector
- Deliverables:
  - Zen host integration wired to the new renderer path and registry contracts
  - DCC-style tool surfaces connected through host bindings, manifests, and Kain modules
  - Asset import and workspace UI flows targeting the canonical viewport/runtime path
- Task List:
  - [x] Rewire Zen host bindings and workspace features so the viewport, runtime, and tool panes consume the shared renderer/runtime contracts.
  - [x] Connect registry-driven package and tool discovery into Zen where hardcoded wiring still exists.
  - [ ] Ensure imported assets and scene documents flow into the canonical scene/eval/renderer pipeline rather than only the old host-local path.
  - [x] Tighten Kain shell and host API integration so renderer/runtime/tool status surfaces reflect the new backend reality.
  - [x] Preserve operator UX in the native shell during migration, including layout state, selection surfaces, and inspector behavior.
- Notes:
  - Delta should avoid creating a second integration abstraction. Consume the shared contracts from Vector and Forge.

## Lane: Aegis

- Role: Validation strategy, invariants, regression analysis, rollout gates, and proof planning.
- Status: done
- Claimed By: Aegis
- Claimed At: 2026-03-27 00:17 -04:00
- Depends On: Forge
- Deliverables:
  - Validation matrix for renderer cutover
  - Invariant checklist for mesh sync, selection, viewport stats, and Kain dispatch behavior
  - Lightweight proof plan consistent with no-test-mode constraints
- Task List:
  - [x] Define the minimum proof set for Zen renderer cutover without relying on broad test suites.
  - [x] Record invariants for payload correctness, mesh counts, selection routing, redraw behavior, and runtime stats before and after migration.
  - [x] Identify likely regression zones including normals, post-processing handoff, threaded renderer service behavior, and viewport texture presentation.
  - [x] Add instrumentation or verification hooks where the current code is too opaque to validate safely.
  - [x] Produce rollout criteria that Sovereign can use to approve deletion of duplicate renderer code.
- Notes:
  - This lane owns believable proof, not maximal proof.
  - Validation matrix lives at `docs/zen_renderer_validation_matrix.md`.

## Lane: Scribe

- Role: Durable docs, memory updates, operator guidance, migration notes, and human handoff material.
- Status: done
- Claimed By: Scribe
- Claimed At: 2026-03-26 21:40 EDT
- Depends On: Atlas, Vector
- Deliverables:
  - Updated `ARCHITECTURE.md`
  - Updated `memory.md`
  - Renderer unification operator guide and migration notes at `docs/zen_renderer_operator_guide.md`
- Task List:
  - [x] Document the target Zen renderer architecture, crate responsibilities, and data flow once Atlas finalizes the boundary proposal.
  - [x] Update durable memory with the rationale, migration state, unresolved risks, and recommended next step for future agents.
  - [x] Capture the registry/contract model for Zen-facing tool integration so future work does not regress into hardcoded wiring.
  - [x] Write a concise operator guide for how to reason about Zen viewport ownership, Kain runtime state, and adapter manifests.
- Notes:
  - Keep docs structural and durable. Do not turn them into a task transcript.
  - Completed with updates to `ARCHITECTURE.md`, `memory.md`, and `docs/zen_renderer_operator_guide.md`.

## Lane: Sweep

- Role: Cleanup, codemods, dead-code removal, finish-pass consistency, and leftover edge handling.
- Status: blocked
- Claimed By: unclaimed
- Claimed At: unclaimed
- Depends On: Forge, Delta, Aegis
- Deliverables:
  - Duplicate renderer code reduced or removed from Zen
  - Temporary migration shims cleaned up
  - Final consistency pass across manifests, entrypoints, and crate exports
- Task List:
  - [ ] Remove obsolete host-local renderer code that is superseded by the shared pipeline.
  - [ ] Delete or narrow temporary compatibility shims that survive the cutover.
  - [ ] Normalize imports, module boundaries, and generated artifacts touched during the migration.
  - [ ] Trim stale registry metadata, dead entrypoints, or misleading host comments left behind by the transition.
  - [ ] Prepare the final finish-pass checklist for Sovereign before archive.
- Notes:
  - Sweep starts blocked because cleanup quality depends on Forge, Delta, and Aegis proving the final path first.
