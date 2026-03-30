# Kain Migration Architecture for K_OS

This file is the migration target, not a history log.
It defines how the imported Kain scaffold in `M:\K_OS\kain` should be organized as the repair work continues.

## What Kain is for here

Kain is the authored, data-driven layer that describes and composes K_OS behavior.
It should own declarative module structure, reusable runtime graphs, manifests, intent definitions, repair scaffolds, and code-generation-friendly assets.

Kain is not the place for host UI glue, backend transport plumbing, or compile-time dependency juggling.
Those belong in Rust crates and host adapters.

## Target split

### 1) Pure Kain

Keep this layer free of host assumptions and platform-specific code.
It should contain:

- declarative module graphs and composition rules
- manifests, registries, and source-of-truth tables
- intent graphs for runtime workflows
- reusable repair assets and scaffolds
- Kain-side descriptions of scene, render, material, sculpt, bake, runtime, and host-facing capabilities
- generated or repaired `.kn` bodies that can be evaluated without needing to know whether the host is Tauri, Zen, Bevy, or something else

Pure Kain should be readable as a domain specification.
If a module needs a window handle, IPC call, filesystem watcher, GPU context, or host service lookup, it is not pure Kain anymore.

### 2) Kain + native runtime

This is the bridge layer where Kain definitions become executable in a native process.
It should own:

- runtime bindings and execution adapters
- loader/launcher glue for `.kn` assets
- evaluation hooks that turn manifests into running native work
- host-neutral runtime services such as asset loading, cache population, structured reporting, and task dispatch
- controlled integration with Rust-owned runtime crates such as scene/runtime/eval/renderer services

This layer can know about native capabilities, but it should still be portable in shape.
The rule is simple: Kain defines intent; native runtime executes it.

### 3) Host/backend adapters

These remain in Rust crates and should stay thin.
They should own:

- Tauri commands and frontend IPC
- Zen shell and operator surfaces
- backend-only filesystem, OS, windowing, and GPU integration
- runtime selection, process control, and app lifecycle management
- registry publication and contract exposure for other crates
- any special-case wiring needed to make a host consume the Kain graph

Adapters should translate from host reality into the contract that Kain or the native runtime expects.
They should not become the place where domain logic slowly dies.

## How the repaired domains should be organized

The current imported tree already hints at the right shape.
Keep the top-level domain folders as the stable migration lanes:

- `kain/scene`, `kain/scene_runtime`
- `kain/render`, `kain/renderer`
- `kain/eval`, `kain/gpu_pipeline`
- `kain/material`, `kain/mesh`, `kain/mesh_processing`
- `kain/sculpt`, `kain/rig`, `kain/animation`
- `kain/game_*` for gameplay and runtime concerns
- `kain/io`, `kain/config`, `kain/plugin`, `kain/workspace_registry`
- `kain/zen`, `kain/host`, `kain/kain_api`, `kain/kain_modules` for host-facing surface descriptions

Repair work should happen by domain, not by random file surgery.
Each domain folder should converge on three kinds of content:

1. **raw import evidence** — what was brought in and why
2. **repaired module bodies** — cleaned `.kn` code that preserves intent
3. **supporting notes or reports** — short explanations of what was fixed, what remains hollow, and which Rust crate owns the executable truth

Do not mix those responsibilities in one file unless there is no practical alternative.

## Raw imports feeding repaired modules

Raw imports are not the final product.
They are the evidence base.

Use this flow:

1. keep raw or largely untouched imports under `kain/raw` or the existing imported module folders when preservation matters
2. study `kain/reports`, `kain/validation`, and `kain/_validation` for shape, drift, and missing behavior
3. rebuild the intended contract in `kain/repair`
4. once the repair is stable, let the repaired module supersede the imported body

The repaired module should not pretend the import was clean.
It should be explicit about the contract it now satisfies.
If a raw source still matters for provenance, keep it nearby and named accordingly.
If it no longer matters, move on and stop carrying it as if it were logic.

## Rewrite / wrap / keep rules

Use these rules aggressively.

### Rewrite
Rewrite when the imported body owns real behavior but is hollow, misleading, or structurally broken.
Examples:

- constructors that no longer wire state correctly
- cache/registry loaders that lost normalization or sorting
- manifest parsers that silently dropped fields
- chain-heavy helpers that became unreadable or incorrect
- domain functions that still define policy and cannot be left half-restored

A rewrite should preserve intent, not syntax.

### Wrap
Wrap when the source is still useful but should be isolated behind a cleaner boundary.
Examples:

- a fragile imported helper that can be protected by a stable facade
- a host-specific adapter that should sit on top of a portable Kain contract
- a native runtime bridge that should hide platform differences from the domain layer

A wrap is a containment move.
It buys time and keeps the blast radius small.

### Keep
Keep when the imported code is already structurally honest and the repair risk is higher than the benefit.
Examples:

- straightforward data declarations
- obvious enums and type shapes
- stable manifest tables
- thin glue that already expresses the right ownership split

Do not rewrite clean code just to make it look imported.
That is vanity work.

## Recommended order of migration

Use this order unless a dependency forces a detour.

1. **Identity and registries**
   - `kain/config`
   - `kain/workspace_registry`
   - `kain/kain_api`
   - any module that defines stable names, manifests, or composition metadata

2. **Pure data domains**
   - `kain/scene`
   - `kain/material`
   - `kain/mesh`
   - `kain/io`
   - `kain/plugin`

3. **Evaluation and runtime core**
   - `kain/eval`
   - `kain/scene_runtime`
   - `kain/gpu_pipeline`
   - `kain/runtime`

4. **Renderer-facing domains**
   - `kain/render`
   - `kain/renderer`
   - `kain/hdr`
   - host-neutral presentation contracts that can be shared by Zen and other runtimes

5. **Tooling and execution domains**
   - `kain/sculpt`
   - `kain/rig`
   - `kain/animation`
   - `kain/baking`
   - `kain/photogrammetry`
   - `kain/scatter`
   - `kain/mesh_processing`

6. **Gameplay and app-level flows**
   - `kain/game_*`
   - `kain/sim`
   - `kain/undo`
   - `kain/wasm`

7. **Host-facing integration surfaces**
   - `kain/host`
   - `kain/zen`
   - `kain/kain_modules`
   - `kain/zen-*` imported surfaces

8. **Cleanup and consolidation**
   - delete or archive duplicate bodies
   - merge duplicate scene/render naming where the domain is now settled
   - move stable repairs out of the raw scaffold and into the repaired lane

This order matters.
If you start with host glue, you will freeze the wrong shape.
If you start with leaf tooling before identity and eval are stable, you will keep rewriting the same contracts.

## Practical migration rules

- Preserve raw imports until the repaired replacement is ready.
- Prefer one authoritative module per domain contract.
- Keep manifest and registry logic deterministic.
- Normalize at the boundary.
- Let the host read data; do not let the host invent policy.
- Keep native runtime execution on the Rust side unless the behavior is genuinely authored in Kain.
- Avoid duplicate ownership of scene, renderer, and runtime truth.

## What future agents should do first

When picking up a Kain lane:

1. read the matching note or report first
2. identify the owning Rust crate and the target contract
3. decide whether the file should be rewritten, wrapped, or kept
4. repair the smallest stable boundary first
5. only then widen the migration surface

If the file is still hollow, fix the contract.
If the contract is still unclear, stop and trace the owning Rust side.
That is where the truth lives.
