# K_OS Game Automation Guide

Date: 2026-03-11

## Purpose

This guide exists for recurring automation runs working on `sources/game`.
Its job is to keep the engine effort coherent across many hourly increments instead of letting the work drift into random feature spikes.

Primary companion docs:
- `sources/game/docs/PIPELINE_ARCHITECTURE.md`
- `sources/game/docs/CRATE_ARCHITECTURE.md`
- `sources/game/docs/RUN_LOG_2026-03-11.md`
- `sources/game/docs/research/*`

## Core mission

Build `K_OS Game` as a real engine product layer on top of existing K_OS domain crates.

The automation should optimize for:
- clear crate ownership
- data-driven runtime/editor contracts
- end-to-end vertical slices
- future pluginability
- eventual de-Bevyfication where it matters, without pretending Bevy is not useful now

## Architectural rules

- treat `k-os-bevy` as a host adapter, not the permanent owner of game-engine logic
- keep reusable truth in domain crates or new `k-os-game-*` crates
- prefer manifests, registries, schemas, and typed contracts over hardcoded host logic
- do not rebuild a second monolith under `sources/game`
- do not chase Unreal feature-count parity before authoring/runtime workflow quality is strong

## Current authoritative crate map

Existing core owners:
- `k-os-scene`
- `k-os-scene-runtime`
- `k-os-eval`
- `k-os-renderer`
- `k-os-gpu-pipeline`
- `k-os-kain`
- `k-os-animation`
- `k-os-rig`
- `k-os-asset-pipeline`
- `k-os-plugin`
- `k-os-bevy`
- `k-os-game-runtime`
- `k-os-game-framework`
- `k-os-game-play`

Target missing game-product owners:
- `k-os-game-framework`
- `k-os-game-play`
- `k-os-game-ai`
- `k-os-game-camera`
- `k-os-game-sequencer`
- `k-os-game-narrative`
- `k-os-game-visual-scripting`
- `k-os-game-input`
- `k-os-game-ui`
- `k-os-game-build`
- `k-os-game-editor`

## Priority order for future runs

When choosing work, prefer the highest item that is still materially incomplete.

1. Establish missing owner crates for the game-product spine.
2. Convert bootstrap/runtime data into real authoritative runtime systems in those crates.
3. Wire launcher/product-entry presets and product identity.
4. Build one strong vertical slice across scene, gameplay, AI/narrative, camera, and UI.
5. Expand packaging/build/export from validation-only into artifact emission.
6. Improve editor tooling and plugin surfaces only after ownership boundaries are clear.

## Recommended next implementation sequence

### Phase A

- create `k-os-game-framework`
- create `k-os-game-play`
- move registry-derived runtime gameplay concepts out of `k-os-bevy` and into those crates

### Phase B

- create `k-os-game-ai`
- create `k-os-game-camera`
- promote current registry data into authoritative runtime state/resources/systems there

### Phase C

- create `k-os-game-sequencer`
- create `k-os-game-narrative`
- connect cinematic and narrative data flow to gameplay and runtime events

### Phase D

- create `k-os-game-visual-scripting`
- create `k-os-game-input`
- create `k-os-game-ui`
- create `k-os-game-editor`
- create `k-os-game-build`

## Good task shapes for automation

Strong automation increments:
- create one missing owner crate with a narrow, testable API
- move one responsibility out of `k-os-bevy` into the right owner crate
- turn one manifest/registry contract into a runtime resource + system pair
- wire one launcher/profile/product preset end to end
- turn one validation-only stage into a real artifact-producing stage

Weak automation increments:
- adding broad placeholder crates with no ownership move
- scattering random editor panels before runtime ownership exists
- stuffing new gameplay logic directly into the host layer
- adding large speculative APIs without a vertical slice to prove them

## Vertical slice rule

Whenever possible, future runs should prefer vertical slices over menu sprawl.

Best slice candidates:
- playable scene + gameplay framework + input + camera
- narrative graph + dialogue state + UI presentation
- sequencer + camera + event tracks + runtime playback
- visual scripting graph + Kain kernel bridge + gameplay event dispatch

## Documentation rules for each run

Every meaningful run should:
- update `sources/game/docs/RUN_LOG_2026-03-11.md`
- update `sources/game/docs/PIPELINE_ARCHITECTURE.md` if runtime/pipeline guarantees change
- update `sources/game/docs/CRATE_ARCHITECTURE.md` if ownership changes
- record any new assumptions in automation memory

## Verification rules

Each run should verify the narrowest relevant surface:
- `cargo check -p <crate>`
- `cargo test -p <crate>`
- targeted workspace checks only when multiple crates changed materially

If verification cannot run, the blocker must be stated plainly.

## Decision heuristics

When in doubt:
- choose ownership over convenience
- choose data-driven contracts over host-local glue
- choose one strong slice over five incomplete systems
- choose product differentiation through iteration quality, not feature-count theater

## Immediate backlog

At the time of writing, the best next work is:
- expand `k-os-game-framework` beyond registry ingest into canonical game-object/archetype ownership
- expand `k-os-game-play` beyond readiness/bindings into actual gameplay runtime systems
- expand `k-os-game-ai` from registry validation into behavior-tree tick and blackboard mutation ownership
- create `k-os-game-camera` as the next parallel owner crate after AI

## Bottom line

The automation should behave like an engine architect and implementation partner, not a random feature generator.
Every run should make the crate ownership clearer, the runtime more real, and the path to a serious game engine more executable.
