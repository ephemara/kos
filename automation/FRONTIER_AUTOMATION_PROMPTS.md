# Frontier Automation Prompt Pack

## Purpose

This document defines high-value automation prompts for frontier LLMs operating inside `M:/K_OS`.
These prompts are not generic cleanup prompts. They are intended to drive real architecture progress across the suite while preserving the current strategic direction:

- React/Tauri remains the shell and extension-facing editor UI
- native viewport ownership moves into Rust/WGPU/Bevy-backed infrastructure
- Three.js is deprecated architecturally and must be removed by replacement, not by blind deletion
- `k-os-kain` is the source-of-truth Kain workspace
- `k-os-engine` must continue shrinking into a compatibility shell
- all new work should prefer data-driven contracts over scattered hardcoded behavior

## Current Remaining Work Map

The codebase is in a materially better state, but these workstreams are still open:

### 1. Native renderer migration is incomplete

Evidence:
- `M:/K_OS/.kiro/specs/native-renderer-migration/tasks.md` still has incomplete Phase B through E tasks
- `M:/K_OS/docs/NATIVE_RENDERER_PROGRESS.md` explicitly says KSculpt, KPainter, and KAutoPBR still retain transitional Three-backed state
- `M:/K_OS/src-frontend/ui/viewport/WebViewport.tsx` still instantiates `StudioStage`
- `M:/K_OS/package.json` still carries the full Three/R3F dependency stack

What remains:
- finish KSculpt native backing-state extraction
- finish KPainter native paint-state ownership
- finish KAutoPBR native preview/material ownership
- complete overlay alignment, renderer auto-sync, and multi-viewport sharing
- migrate remaining viewport-heavy apps cleanly
- delete Three.js by deprecating each responsibility, not just the package

### 2. Three.js ownership is still widespread

Evidence:
- `M:/K_OS/src-frontend/lib/hooks/useAltCamera.ts`
- `M:/K_OS/src-frontend/lib/hooks/useThreeSession.ts`
- `M:/K_OS/src-frontend/features/weight/KWeight.tsx`
- `M:/K_OS/src-frontend/ui/viewport/WebViewport.tsx`
- many docs and feature flags still assume native/Three duality

What remains:
- inventory every live Three owner
- classify by role: presentation, state carrier, input carrier, preview fallback, experimental-only
- replace ownership category by category
- remove dead dependencies and stale fallback code after each app is truly native-complete

### 3. Kain pipeline is improved but not finished

Evidence:
- `M:/K_OS/crates/k-os-kain` is now the source-of-truth workspace
- `M:/K_OS/src-omni` exists and should be treated as an active omni/meta authoring workspace
- `M:/K_OS/src-frontend/systems/kain/KAINConsole.tsx` is still a practical but not fully polished authoring surface
- `M:/K_OS/src-frontend/kain/bridge/KAINBridge.ts` and `M:/K_OS/src-frontend/systems/kain/KAINBridge.ts` indicate there may still be duplicated bridge surfaces
- `M:/K_OS/crates/k-os-kain/domains/materials/MATERIAL_SYSTEM_SUMMARY.md` still calls out renderer integration gaps
- many generated/runtime assets exist under `M:/K_OS/crates/k-os-kain/generated`
- upstream Kain language/compiler reference lives at `M:/Code/Kain`

What remains:
- unify Kain bridge surfaces and source registry usage
- harden Kain authoring UX and compile diagnostics
- add template generation and output history
- wire material, AutoPBR, native renderer, and remaining shader domains through `k-os-kain`
- define how `src-omni` feeds into suite-owned Kain integration instead of becoming a second source-of-truth
- remove stale engine-local assumptions and direct path literals

### 4. Crate ownership is still transitional

Evidence:
- `M:/K_OS/docs/K_OS_DOMAIN_MIGRATION_TASK_DOC.md`
- wrapper crates `k-os-sculpt`, `k-os-sim`, and `k-os-io` currently exist but are still compatibility-oriented
- `k-os-engine` remains a broad compatibility monolith with domain logic still inside it

What remains:
- make `k-os-gpu-pipeline` authoritative for shared GPU infra
- make `k-os-sculpt` authoritative for sculpt domain logic
- make `k-os-sim` authoritative for simulation domain logic
- make `k-os-io` authoritative for storage/import/export logic
- continue moving animation and photogrammetry into proper domain crates

### 5. GPU ownership is duplicated

Evidence:
- `M:/K_OS/crates/k-os-gpu-pipeline`
- `M:/K_OS/crates/k-os-engine/src/gpu`
- `M:/K_OS/crates/k-os-renderer`

What remains:
- remove duplicate/shared GPU logic from engine
- establish one owner for pipeline cache, staging, shader loading, upload bridge, and buffer residency
- ensure renderer consumes shared GPU infra rather than growing its own duplicate stack

### 6. Technical debt is still being suppressed in some areas

Evidence:
- `M:/K_OS/tsconfig.json` excludes multiple legacy and dormant surfaces from type-checking
- `M:/K_OS/src-frontend/features/quantum/**` and `M:/K_OS/src-frontend/features/tecton/**` are excluded
- docs reference unfinished photogrammetry, materials, and benchmark work

What remains:
- reduce exclusion-driven debt over time
- restore active modules to first-class typechecked/tested status
- convert backup/legacy folders into archive or documented deprecation instead of semi-live code

### 7. Domain completeness gaps remain outside renderer/Kain

Evidence:
- `M:/K_OS/crates/k-os-photogrammetry/src/photogrammetry/*` has multiple TODOs in reconstruction and PBR extraction
- `M:/K_OS/crates/k-os-kain/domains/materials/MATERIAL_SYSTEM_SUMMARY.md` still reports renderer integration missing
- `M:/K_OS/.kiro/specs/native-renderer-migration/tasks.md` benchmark and material-preview expansion are not complete

What remains:
- photogrammetry productionization
- materials/native renderer integration
- benchmark scene/benchmark harness completion
- plugin/runtime surface hardening

### 8. Game-engine product layer is still mostly architectural intent

Evidence:
- `M:/K_OS/src-game/docs/PIPELINE_ARCHITECTURE.md`
- `M:/K_OS/src-game/docs/CRATE_ARCHITECTURE.md`
- `M:/K_OS/src-game/docs/AUTOMATION_GUIDE.md`
- `M:/K_OS/crates/k-os-game-runtime` exists
- the wider `k-os-game-*` product crate layer does not yet exist

What remains:
- create the missing game-product owner crates in a disciplined order
- move gameplay ownership out of `k-os-bevy`
- turn registry/bootstrap state into authoritative gameplay, AI, camera, and sequencing systems
- wire launcher and editor/product identity around the new game-product layer

## Universal Prompt Design Rules

All automation prompts below assume the model can edit code, run repo-local checks, and produce a concrete deliverable.
Each prompt should be used as a self-contained work order.

Rules for all prompts:
- treat `M:/K_OS/docs/K_OS_ENGINE_ARCHITECTURE_STANDARD.md` as the architectural standard
- prefer data-driven registries, manifests, typed contracts, and lookup tables over hardcoded values
- do not add new foundational logic to `k-os-engine` unless it is a temporary compatibility shim
- do not restore or deepen legacy Three.js ownership
- preserve current app behavior where possible while migrating ownership
- verify changes with the narrowest relevant build/test commands and report exact pass/fail status
- if blocked, leave the repo in a more organized state and record the blocker precisely
- for Kain-related work, treat `M:/K_OS/crates/k-os-kain` as the suite-owned integration boundary, `M:/K_OS/src-omni` as the experimental/omni authoring workspace, and `M:/Code/Kain` as the upstream reference implementation when syntax, compiler behavior, output layout, or runtime conventions need authoritative guidance
- assume Kain tasks may generate large multi-file directory trees and preserve manifests, nested folders, generated bindings, and output families instead of flattening everything into one file

---

## Prompt 1: Native Renderer Completion Sweep

### Use when
You want a frontier model to push the native viewport program forward without thrashing architecture.

### Prompt
You are working inside `M:/K_OS`. Continue the native renderer migration using `M:/K_OS/.kiro/specs/native-renderer-migration/tasks.md`, `M:/K_OS/docs/NATIVE_RENDERER_PROGRESS.md`, and `M:/K_OS/docs/K_OS_NATIVE_RENDERER_ARCHITECTURE.md` as the source of truth.

Your job is to implement the highest-value unfinished native renderer work that preserves the current architecture:
- React/Tauri remains the shell
- `k-os-renderer` remains the renderer/session contract
- `src-tauri/src/viewport_host.rs` remains the host adapter boundary
- Bevy/native host remains an implementation detail, not the architecture itself
- Three.js must lose ownership, not gain new fallback responsibilities

Execution requirements:
- audit the current incomplete Phase B through E tasks first
- choose the next best vertical slice, not a random scatter of edits
- prefer data-driven contracts and reusable sync surfaces
- keep native migration suite-wide, not KSculpt-only
- remove transitional hidden Three ownership where the replacement path is already viable
- do not add new per-app native sync hacks if a shared `NativeViewport` or shared bridge can be extended instead

Required outputs:
- implemented code
- updated task checkboxes if the work truly satisfies them
- a short status note in docs if the architecture state materially changes
- exact verification commands run and their results

Definition of done:
- at least one meaningful native renderer milestone is moved from transitional to real ownership
- no new shared renderer logic is added to `k-os-engine`
- frontend build remains green
- backend compile for the touched path remains green

---

## Prompt 2: Three.js Deletion Audit and Replacement Plan

### Use when
You want a model to identify what still depends on Three.js and turn that into a concrete deletion sequence.

### Prompt
You are working inside `M:/K_OS`. Perform a full audit of remaining Three.js ownership and create the next executable deletion sequence.

You must distinguish between:
- visible rendering ownership
- hidden state carrier ownership
- input routing ownership
- preview/material fallback ownership
- experimental-only or non-core usage

Important constraints:
- do not blindly delete Three.js code
- do not deepen dual-renderer architecture
- identify what must be replaced before each deletion step is safe
- classify each usage as `keep temporarily`, `replace next`, or `delete now`

Required outputs:
- an updated or new repo doc that inventories live Three.js ownership by app/system
- a concrete deletion order by app and by responsibility
- code edits for any dead or clearly replaceable Three usage found during the audit
- exact grep/build/test evidence

Definition of done:
- the repo has an authoritative current Three.js ownership map
- at least one stale or dead Three dependency path is removed or isolated
- the next deletion tranche is explicit and executable by another model without reinterpretation

---

## Prompt 3: Kain Pipeline Hardening and Authoring Completion

### Use when
You want a model to finish turning Kain into a serious suite-wide shader/runtime pipeline.

### Prompt
You are working inside `M:/K_OS`. Make `k-os-kain` the complete source-of-truth authoring and compile pipeline for Kain across sculpt, paint, renderer, AutoPBR, materials, and future shader/runtime domains.

Current facts:
- `crates/k-os-kain` is now the source-of-truth workspace
- `src-omni` exists and should be accounted for as an omni/meta authoring surface
- `M:/Code/Kain` is available as the upstream reference implementation when the in-repo contracts are unclear
- Kain authoring UI exists but still needs hardening and polish
- stale bridge duplication and path assumptions may still exist
- material/renderer integration is not complete

Execution requirements:
- audit all frontend and backend Kain bridge surfaces
- account for `src-omni` as a possible staging/generation surface and make its relationship to `k-os-kain` explicit
- use `M:/Code/Kain` as reference material when compiler/runtime behavior or output conventions are ambiguous
- remove duplicate or stale registry/path logic
- prefer manifest-driven and domain-driven source discovery
- extend authoring UX only where it strengthens the pipeline contract
- wire remaining high-value domains into `k-os-kain`
- design generation flows so large multi-file Kain outputs remain structured and navigable
- avoid new hardcoded path literals if a manifest or registry can own them

Required outputs:
- code changes that reduce stale Kain path/registry drift
- Kain authoring UI improvements with source browser, target selection, compile/rebuild, diagnostics, and output history if feasible
- at least one additional suite domain wired through the crate-owned Kain pipeline
- updated docs if new Kain domains or commands are introduced

Definition of done:
- backend-native Kain manifest model is the authoritative source registry
- frontend fallback logic no longer contradicts backend-native truth
- the Kain UI is materially more useful for real suite authoring
- touched Kain compile/verify paths pass

---

## Prompt 12: K_OS Game Product Layer Buildout

### Use when
You want a frontier model to keep building the game engine as a real product layer instead of a growing host bootstrap pile.

### Prompt
You are working inside `M:/K_OS`. Continue building `K_OS Game` as a serious game-engine product surface using these docs as the local source of truth:

- `M:/K_OS/src-game/docs/PIPELINE_ARCHITECTURE.md`
- `M:/K_OS/src-game/docs/CRATE_ARCHITECTURE.md`
- `M:/K_OS/src-game/docs/AUTOMATION_GUIDE.md`
- `M:/K_OS/src-game/docs/RUN_LOG_2026-03-11.md`
- `M:/K_OS/src-game/docs/research/*`

Your job is to move the game engine forward without creating a second monolith.

Architectural constraints:
- `k-os-bevy` is the host adapter, not the permanent owner of game-engine product logic
- reusable truth should live in existing domain crates or new `k-os-game-*` crates
- prefer manifests, registries, schemas, and typed contracts over scattered hardcoded behavior
- do not chase Unreal feature-count parity before the ownership model and vertical slices are coherent
- keep the engine de-Bevyfiable where it matters, even while using Bevy now

Priority order:
- create and harden missing `k-os-game-*` owner crates
- move runtime gameplay ownership out of `k-os-bevy`
- wire launcher/product identity and presets
- extend one strong vertical slice end to end
- only then broaden editor/UI/plugin surfaces

Good task shapes:
- create `k-os-game-framework`, `k-os-game-play`, or another missing owner crate with a narrow useful API
- move one responsibility from host/bootstrap code into the right owner crate
- turn one registry or pipeline contract into an authoritative runtime resource and system
- connect one vertical slice such as gameplay + input + camera, or narrative + UI, or sequencer + camera

Required outputs:
- implemented code or architecture docs that materially reduce ambiguity
- updates to the relevant `src-game/docs/*` files
- exact verification commands and pass/fail status
- a precise next-step recommendation if the run stops at an ownership boundary

Definition of done:
- the game-engine product layer is more explicit than before
- crate ownership is clearer than before
- at least one meaningful responsibility has moved toward its correct long-term owner

---

## Prompt 4: GPU Ownership Consolidation

### Use when
You want a model to reduce duplication between `k-os-gpu-pipeline`, `k-os-engine/src/gpu`, and `k-os-renderer`.

### Prompt
You are working inside `M:/K_OS`. Consolidate GPU infrastructure ownership so shared GPU plumbing lives in one place and domain/renderer code consumes it instead of reimplementing it.

Authoritative direction:
- `k-os-gpu-pipeline` owns shared GPU infrastructure
- `k-os-renderer` owns renderer runtime and viewport-facing resource logic
- `k-os-engine` should lose shared GPU infrastructure over time and keep only compatibility glue or domain-specific code that has not been extracted yet

Execution requirements:
- audit `crates/k-os-engine/src/gpu`, `crates/k-os-gpu-pipeline`, and `crates/k-os-renderer`
- identify duplicated or overlapping responsibilities
- move or normalize one concrete subsystem this pass, such as staging/readback, shader loading, upload bridge helpers, or pipeline cache behavior
- do not move files blindly; preserve dependency direction and update consumers

Required outputs:
- code edits that make one GPU subsystem more clearly owned
- doc updates to record the ownership boundary if it changes materially
- verification that touched crates still compile/test

Definition of done:
- one shared GPU subsystem has a single clear owner
- `k-os-engine` has less shared GPU responsibility than before
- no new duplicate infra is introduced in renderer or engine

---

## Prompt 5: Domain Crate Extraction Sweep

### Use when
You want a model to continue shrinking `k-os-engine` and make wrapper crates real owners.

### Prompt
You are working inside `M:/K_OS`. Continue the domain-crate migration using `M:/K_OS/docs/K_OS_DOMAIN_MIGRATION_TASK_DOC.md` as the migration source of truth.

Priority order:
1. `k-os-sculpt`
2. `k-os-sim`
3. `k-os-io`

Execution requirements:
- choose one domain crate per pass unless there is a trivial adjacent move
- move real ownership, not just filenames
- keep `k-os-engine` as a compatibility shell for touched paths
- do not invert dependencies so the new crate still depends on engine for real behavior
- update consumers and docs as needed

Required outputs:
- code moved into the target crate with clear ownership
- compatibility shim in engine where necessary
- import/consumer updates
- docs or migration checklist updates
- exact compile/test evidence for touched crates

Definition of done:
- one domain crate owns materially more real logic
- `k-os-engine` owns materially less domain implementation for that slice
- dependency direction is improved, not just reorganized cosmetically

---

## Prompt 6: Technical Debt Re-entry Pass

### Use when
You want a model to reduce exclusion-based debt and restore more of the repo to active correctness checks.

### Prompt
You are working inside `M:/K_OS`. Reduce the current exclusion-driven TypeScript and test debt without destabilizing the suite.

Current signal:
- `tsconfig.json` excludes multiple active-looking surfaces including `quantum`, `tecton`, config editor, service files, and `KAINConsole.tsx`
- some exclusions are justified temporarily; some are drift

Execution requirements:
- classify excluded surfaces into `archive`, `reactivate`, or `defer`
- fix active production-facing files first
- if a folder is truly dormant, move it toward explicit archive/deprecation instead of leaving it half-live
- do not suppress new debt with fresh broad exclusions unless strictly necessary

Required outputs:
- code fixes and/or archive/deprecation moves
- narrower `tsconfig.json` exclusions where possible
- exact `tsc`, `vite build`, and `vitest` results
- a short note on what remains excluded and why

Definition of done:
- fewer exclusions are required than before, or the remaining exclusions are cleaner and better justified
- active runtime surfaces are more type-safe than before
- the suite remains buildable

---

## Prompt 7: KPainter Native-State Ownership

### Use when
You want a model to advance KPainter beyond native presentation and into native ownership.

### Prompt
You are working inside `M:/K_OS`. Advance KPainter from native viewport presentation and native input relay into more native paint-state ownership.

Current state:
- native viewport boundary exists
- native pointer input exists
- paint execution still leans on legacy paint engine state

Execution requirements:
- identify the current KPainter state carrier and interaction loop
- define a native paint-state contract that can be reused later by other paint-like apps
- move one meaningful slice of paint-state ownership into the native path without breaking the app
- avoid app-specific hacks if a shared state/sync abstraction can be introduced instead

Required outputs:
- code changes in KPainter/native viewport/native host path
- a clear statement of what moved from legacy ownership to native/shared ownership
- verification commands and results

Definition of done:
- KPainter relies less on hidden legacy state than before
- native mode owns more than just presentation/input
- the approach is reusable, not KPainter-only

---

## Prompt 8: KAutoPBR Native Preview Ownership

### Use when
You want a model to make AutoPBR native mode real instead of a thin presentation layer.

### Prompt
You are working inside `M:/K_OS`. Tighten KAutoPBR native mode so native presentation owns more preview/material state and depends less on legacy Three-based preview assumptions.

Execution requirements:
- audit current native-vs-legacy split in KAutoPBR
- identify stale preview refs, mesh/material lifecycle assumptions, and old camera/update loops
- move one concrete ownership slice into the native/shared path
- keep the legacy path intact only where still needed

Required outputs:
- code changes in KAutoPBR and any shared bridge/native viewport code needed
- a short note of what ownership moved
- verification commands and results

Definition of done:
- KAutoPBR native mode is materially less dependent on the old Three preview path
- no new legacy preview coupling is introduced

---

## Prompt 9: KSculpt Final Native-State Extraction

### Use when
You want a model to remove the last major Three-backed scaffolding from the hardest app first.

### Prompt
You are working inside `M:/K_OS`. Finish the next real slice of KSculpt native-state extraction so native mode depends less on hidden Three/StudioStage-backed state.

Current known debt:
- native presentation and selection are real
- hidden mesh/state carriers still exist in KSculpt native mode
- this is the highest-value remaining removal before broader suite-wide native completion

Execution requirements:
- map the current KSculpt split between native-owned and legacy-owned responsibilities
- choose one high-value state carrier or lifecycle path to replace this pass
- route the replacement through shared scene/eval/native pathways where possible
- do not reintroduce visible or hidden Three ownership elsewhere

Required outputs:
- code changes
- updated progress docs if the ownership split changes materially
- verification commands and results

Definition of done:
- KSculpt native mode depends on less hidden legacy ownership than before
- the replacement path is built on shared architecture, not one-off glue

---

## Prompt 10: Material and Renderer Integration via Kain

### Use when
You want a model to connect the Kain material domain to the native renderer stack.

### Prompt
You are working inside `M:/K_OS`. Wire the Kain materials domain into the renderer/material pipeline so material shaders stop being isolated artifacts and become a real part of the suite’s native rendering future.

Evidence:
- `M:/K_OS/crates/k-os-kain/domains/materials/MATERIAL_SYSTEM_SUMMARY.md` explicitly says renderer integration is still missing
- material preview migration in the native-renderer task plan is still incomplete

Execution requirements:
- audit current material domain assets, manifests, renderer expectations, and material preview code paths
- choose one viable vertical slice such as standard PBR pass integration or material preview shader wiring
- preserve data-driven registry ownership in `k-os-kain`
- avoid hardcoding shader paths if a manifest already exists or should be extended

Required outputs:
- code changes connecting one Kain material path to renderer/material runtime
- updated docs/manifests if needed
- verification commands and results

Definition of done:
- one Kain material domain output is materially closer to real renderer usage
- the work reduces isolation between Kain materials and native rendering

---

## Prompt 11: Photogrammetry Productionization Audit

### Use when
You want a model to turn photogrammetry from TODO-heavy experimental code into a real domain plan.

### Prompt
You are working inside `M:/K_OS`. Audit the photogrammetry stack and convert its TODO-heavy surfaces into an executable productionization plan, implementing low-risk fixes where practical.

Evidence:
- `M:/K_OS/crates/k-os-photogrammetry/src/photogrammetry/*` contains multiple TODOs in reconstruction and PBR extraction
- docs in that crate explicitly call out production work still missing

Execution requirements:
- identify which TODOs are algorithmic placeholders, which are integration gaps, and which are test gaps
- do not claim photogrammetry is production-ready unless the evidence supports it
- implement low-risk structural fixes if they materially improve the domain
- produce a concrete backlog by priority

Required outputs:
- updated audit/progress doc inside the photogrammetry crate or docs folder
- any low-risk code cleanup worth landing in the same pass
- verification commands and results

Definition of done:
- photogrammetry remaining work is no longer buried in scattered TODO comments alone
- another agent can pick up the domain with a realistic plan

---

## Prompt 12: Universal Feature Addition Prompt

### Use when
You want a model to add a new feature while respecting the architecture instead of creating more debt.

### Prompt
You are working inside `M:/K_OS`. Implement a new feature, but do it in a way that strengthens the suite architecture rather than deepening monolithic or legacy ownership.

Mandatory constraints:
- prefer existing owner crates and shared contracts over new ad hoc modules
- if the feature touches viewport behavior, prefer `NativeViewport`, `k-os-renderer`, `viewport_host`, `k-os-scene`, and `k-os-eval` over new Three-only logic
- if the feature touches shader/runtime language concerns, prefer `k-os-kain`
- if the feature touches GPU infra, prefer `k-os-gpu-pipeline`
- if the feature touches domain logic currently trapped in `k-os-engine`, move ownership in the right direction while implementing the feature
- use data-driven manifests, registries, or typed config instead of hardcoded literals whenever practical

Required outputs:
- the feature implementation
- any ownership improvements made while implementing it
- verification commands and results
- explicit note if the feature was forced to use a temporary compatibility shim

Definition of done:
- the feature exists and works
- the architecture is at least as good as before, preferably better
- no new foundational logic is dumped into the wrong owner crate without explanation

---

## Recommended Automation Queue

If you want to run these as a high-value sequence rather than one-offs, use this order:

1. Native Renderer Completion Sweep
2. KSculpt Final Native-State Extraction
3. KPainter Native-State Ownership
4. KAutoPBR Native Preview Ownership
5. Three.js Deletion Audit and Replacement Plan
6. GPU Ownership Consolidation
7. Domain Crate Extraction Sweep
8. Kain Pipeline Hardening and Authoring Completion
9. Material and Renderer Integration via Kain
10. Technical Debt Re-entry Pass
11. Photogrammetry Productionization Audit

## Why this ordering

- it keeps the native renderer migration moving while the context is still fresh
- it attacks the biggest remaining suite risk first: hidden transitional ownership
- it keeps Kain aligned with the renderer instead of evolving in isolation
- it reduces `k-os-engine` pressure in parallel
- it leaves debt cleanup as an accelerator, not the only roadmap
