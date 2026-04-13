# K_OS Game Renderer and UI Options

Date: 2026-03-11

## Summary

The best near-term engine architecture is:

- `k-os-renderer` remains the strategic renderer contract
- `k-os-gpu-pipeline` remains the shared GPU infrastructure owner
- `k-os-bevy` is the practical native runtime host and bootstrap renderer path
- React/Tauri remains the highest-productivity editor shell for now
- Bevy UI / egui should be used selectively for in-viewport and runtime-native tooling

Do not collapse all of this into one UI stack.

The strongest option is a layered UI model.

## 1. Current renderer system in K_OS

### What exists now

From the repo state, the renderer story is hybrid but increasingly coherent:

- `k-os-renderer` owns viewport/session contracts, service threading, selection, render graph scaffolding, and scene/eval bridge work
- `k-os-gpu-pipeline` owns shared GPU support: pipeline cache, buffer pooling, staging, hot reload, and compute-heavy infrastructure
- `k-os-bevy` is currently the concrete native runtime host doing real viewport and tool-host work
- React/Tauri still owns shell UI and product chrome

This is already close to the right long-term structure.

### What should be true for `K_OS Game`

Long-term ownership should be:

- `k-os-renderer`: renderer identity, scene-to-render contracts, render graph, material/runtime interfaces
- `k-os-gpu-pipeline`: shared GPU infra and upload/staging/cache ownership
- `k-os-bevy`: runtime host, ECS runtime shell, editor preview/bootstrap renderer path

### Recommendation

Do not replace `k-os-renderer` with Bevy.

Instead:

- let Bevy be the runtime host and current renderer implementation path where helpful
- keep `k-os-renderer` as the K_OS-owned renderer contract
- let the game engine product depend on that contract, not on raw Bevy rendering concepts everywhere

This gives you:

- speed now
- architectural control later
- freedom to migrate specific render subsystems without rewriting the whole engine

## 2. Renderer strategy options

### Option A: Make Bevy the renderer owner

Pros:

- fastest route to a fully playable runtime
- immediate access to Bevy rendering, ECS, assets, cameras, input, scene flow
- simplest bootstrap

Cons:

- engine identity starts drifting toward Bevy internals
- harder to preserve K_OS-specific renderer contracts
- greater coupling between product features and Bevy render API churn

Verdict:

Useful tactically, wrong strategically if taken too far.

### Option B: Keep K_OS renderer ownership and use Bevy as host/runtime

Pros:

- best balance of speed and control
- preserves K_OS render contracts and GPU pipeline ownership
- fits current repo direction
- easiest path to a differentiated engine product rather than a Bevy editor fork

Cons:

- requires discipline
- requires adapter layers instead of one-stack convenience

Verdict:

This is the best option.

### Option C: Replace both with a fresh renderer/runtime stack

Pros:

- maximal purity and control

Cons:

- throws away momentum
- delays productization dramatically
- duplicates infrastructure you already have

Verdict:

Not the right move now.

## 3. UI options

There should not be one universal UI technology for the whole engine.
Different UI layers have different jobs.

## 4. Recommended layered UI model

### Layer A: Editor shell UI

Recommended choice:

- React + Tauri

Why:

- already present in the repo
- already integrated into launcher/product model
- strongest productivity for:
  - content browser
  - inspector panels
  - sequencer/timeline shells
  - graph editors
  - asset management
  - project settings
  - plugin surfaces
  - command palettes and workspace chrome

Your repo already heavily reflects this direction:

- `M:/K_OS/package.json`
- large React/Tauri dependency surface
- dock/panel/graph/editor libraries already included

Verdict:

Keep this as the primary editor UI shell.

### Layer B: Native runtime/editor overlays inside Bevy

Recommended choice:

- `bevy_egui` and targeted Bevy-native widget surfaces

Why:

- great for debug overlays, inspectors, in-viewport tooling, runtime HUDs, and native-hosted quick tools
- already integrated in `k-os-bevy`
- easy to use for editor-adjacent surfaces that must live in the native host

Constraints:

- egui is not ideal as the primary large-scale cinematic/content-browser/editor shell
- immediate mode is strong for tools, weak for highly authored complex desktop UX

Verdict:

Use it for native surfaces, not for the whole editor.

### Layer C: Data-driven cross-boundary UI protocol

Recommended choice:

- continue exploring KRUE-style protocol-driven UI

Why:

- `kos-proto` already contains a serious idea here:
  - React -> UI commands -> Bevy -> UI patches -> React
- this could become a powerful engine-specific bridge for shared editor/runtime UI semantics

Verdict:

Worth continued exploration, but should not block shipping the editor.

### Layer D: Specialty native UI candidate

Recommended choice:

- keep Slint as a possible future specialty/native UI option, not the default editor shell today

Why:

- strong native performance story
- strong live preview tooling
- attractive for dedicated native tools, launchers, embedded-style panels, or high-performance product surfaces

Why not default today:

- you already have a deep React/Tauri investment
- switching the main shell now would create unnecessary product churn
- it would not exploit the current frontend assets you already have

Verdict:

Interesting as a secondary/native-specialty option, not the main engine editor UI today.

### Layer E: Dioxus

Assessment:

- interesting for Rust-native React-like UI with live hotreloading
- not the strongest fit as a replacement for the current K_OS shell right now

Verdict:

More interesting as an experimental runtime/tool surface than as the primary editor migration target.

## 5. Best UI stack by product area

### Main editor shell

Use:

- React + Tauri

### Viewport-native overlays and debug tools

Use:

- Bevy native rendering + `bevy_egui`

### Runtime in-game UI

Use:

- start with Bevy-side UI for simple runtime HUDs
- use Kain/data-driven runtime UI semantics where possible
- reserve React for editor/product shell rather than shipping runtime dependence by default

### Node graph editors

Use:

- React in the editor shell

Why:

- graph tooling, zoom/pan, docking, selections, text editing, and rich inspectors are much easier there

### Sequencer/content browser/project panels

Use:

- React + Tauri

### Native diagnostics and host control panels

Use:

- Bevy-native surfaces via egui

## 6. The best option for K_OS specifically

If the goal is "the most intuitive engine", the correct move is not to force one UI framework everywhere.

The correct move is:

- React/Tauri for rich authoring shell
- Bevy native UI for host-local/runtime-local overlays and tools
- Kain/data-driven UI contracts for portability and live reload
- optional future Slint/native specialty surfaces where performance/native behavior matters enough

That gives you flexibility without chaos.

## 7. Recommended renderer/UI architecture

### Renderer

- `k-os-renderer` = strategic renderer contract
- `k-os-gpu-pipeline` = shared GPU infra
- `k-os-bevy` = runtime host and current implementation path

### UI

- React/Tauri = main editor shell
- Bevy/egui = viewport-native tools and runtime-native panels
- KRUE/data-driven UI protocols = bridge layer worth developing further

## 8. Why this wins

This path lets K_OS compete on workflow instead of forcing a false choice:

- not "all web UI"
- not "all native immediate mode"
- not "all Bevy"
- not "throw away existing frontend investment"

Instead:

- authoring ergonomics stay high
- native runtime integration stays strong
- renderer ownership remains in K_OS
- Bevy accelerates instead of dominating

That is the most practical way to build the engine product you are actually describing.

## 9. Final recommendation

Decision:

- do not make Bevy the permanent owner of the renderer architecture
- do use Bevy as the current native runtime host and bootstrap renderer path
- do keep React/Tauri as the primary editor shell
- do use `bevy_egui` for native overlays/tools
- do continue building data-driven UI contracts that can bridge runtime/editor boundaries

## Source notes

Local repo sources:

- `M:/K_OS/crates/k-os-renderer/src/lib.rs`
- `M:/K_OS/crates/k-os-gpu-pipeline/README.md`
- `M:/K_OS/crates/k-os-bevy/src/main.rs`
- `M:/K_OS/crates/k-os-bevy/src/leash.rs`
- `M:/K_OS/crates/k-os-bevy/src/ui/surfaces.rs`
- `M:/K_OS/crates/kos-proto/src/lib.rs`
- `M:/K_OS/crates/kos-proto/src/krue/mod.rs`
- `M:/K_OS/package.json`
- `M:/K_OS/docs/K_OS_ENGINE_ARCHITECTURE_STANDARD.md`
- `M:/K_OS/docs/NATIVE_RENDERER_PROGRESS.md`

External reference sources:

- Bevy 0.17 release notes: https://bevy.org/news/bevy-0-17/
- bevy_remote docs: https://docs.rs/bevy_remote/latest/bevy_remote/
- bevy_egui docs: https://docs.rs/bevy_egui/latest/bevy_egui/
- Tauri homepage/docs: https://tauri.app/
- Slint homepage/docs: https://slint.dev/
- Dioxus homepage/docs: https://dioxuslabs.com/
