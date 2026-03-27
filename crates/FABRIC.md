# Kain Fabric For Zen DCC

## Decision

Use Kain Fabric as a first-class embedded subsystem inside Zen DCC for typed orchestration and intent execution.

Do not use Fabric as the native viewport host and do not let it become the owner of Zen's frame loop, camera loop, or presentation stack.

The clean split is:

- Zen owns native windowing, input, viewport presentation, selection UX, and operator workflow.
- Shared K_OS crates own renderer, eval, scene-runtime, mesh/material/rig/sim domains, and native performance-critical systems.
- Kain plus Fabric own cross-runtime job planning, intent routing, report emission, and background or derived pipeline work.

That split matches both repos better than trying to make Fabric the app host or trying to keep Zen as a hand-wired shell with no orchestration spine.

The current K_OS embed now goes beyond theory: `crates/zen` reads an intent registry from `crates/k-os-kain/fabric/zen-dcc/config/fabric_intents.json`, exposes native host actions for the first Zen DCC Fabric lanes, and auto-runs selected intents on scene-dirty transitions through the normal Zen command/event path.

## What Is Actually Shipped In Kain

Fabric in `M:\Code\Kain` is not just a design note anymore.

Today the CLI already supports:

- `kain fabric init`
- `kain fabric validate`
- `kain fabric run`

The current manifest model in `M:\Code\Kain\crates\kain-omni\src\fabric.rs` supports:

- versioned `KAIN.fabric.toml` manifests
- workspace roots plus `search_roots`
- explicit capability requirements
- step DAGs through `depends_on`
- runtime kinds:
  - `kain`
  - `python`
  - `rust_crate`
  - `c_abi`
  - `node`
  - `gpu_compute`
- contract kinds:
  - `value`
  - `shared_buffer`
  - `shared_image`
  - `compute_plan`
- structured validation, lock files, reports, and JSONL event logs

The current executor in `M:\Code\Kain\crates\kain-host\src\fabric.rs` already registers adapters for all of those runtime kinds, resolves the graph, tracks outputs, emits step events, and writes a session report plus lock artifact.

That means the Kain side is already at the point where Zen can treat Fabric as real infrastructure instead of as future architecture.

## The Important Pattern From The Fabric Apps

The two app scaffolds are the useful proof:

- `M:\Code\Kain\apps\kain-fabric-modeler`
- `M:\Code\Kain\apps\kain-fabric-dcc-suite`

Both apps keep the same durable ownership split:

1. `config/*.json` owns shell-facing registries, tool catalogs, runtime packs, Fabric summaries, and intent catalogs.
2. `session/*.kn` owns canonical session truth, reducers, derived state, resource/report registries, and intent planning.
3. `KAIN.fabric.toml` owns the broad bootstrap pipeline.
4. `fabric/intents/*.fabric.toml` owns reusable lane-specific graphs.
5. `src/*.kn`, `scripts/*`, `native/*`, `local_crate/*`, and `shaders/*` own narrow runtime seams.
6. Generated shell files and runtime snapshots are treated as projections, not truth.

This is the core lesson for Zen:

Fabric works best when it is the orchestration spine behind a native app, not the app itself.

The strongest reusable ideas are:

- keep registries and shell surfaces data-driven
- keep session truth separate from generated UI and runtime snapshots
- route heavy work through planned intents rather than reducers or UI callbacks
- keep native and Rust helpers narrow and replaceable
- use reports and events as the shell-facing integration surface for long or mixed-runtime work

## Why This Fits Zen

Zen already has the host-side pieces that Fabric wants to sit behind.

From `M:\K_OS\ARCHITECTURE.md` and the current Zen resources:

- `M:\K_OS\crates\zen` is already the native host
- `M:\K_OS\crates\zen\resources\runtime.toml` already uses manifest-driven runtime configuration
- `M:\K_OS\crates\zen\resources\workspace_ui.toml` already uses a data-driven workspace and feature registry
- `M:\K_OS\crates\zen\resources\host_api.toml` already exposes a typed host action and binding surface
- `M:\K_OS\crates\k-os-workspace-registry` already provides generated discovery for crates and adapter surfaces

Zen is therefore already aligned with the same pattern the Fabric apps are using:

- manifest-driven shell
- typed registries
- explicit ownership boundaries
- generated projections over stable source data

What Zen is missing is not another host. What Zen is missing is a stronger orchestration layer for cross-runtime DCC work.

Fabric is a good answer to that specific gap.

## Recommended Zen Adoption Model

### 1. Keep Zen As The Native Shell

Zen should continue to own:

- viewport lifecycle
- camera and selection interaction
- input and tool ergonomics
- docked workspace layout
- direct renderer session coordination
- scene/runtime inspection

Do not move per-frame viewport work into Fabric.

### 2. Introduce Fabric As The Job And Intent Spine

Use Fabric for:

- project bootstrap
- asset ingest and conditioning
- topology rebuild and analysis
- material bake and preview generation
- rig sync and validation
- simulation planning or coarse sim jobs
- publish/package/report jobs
- tensor and ML lanes
- cache warming, snapshotting, and other recurring background tasks

These are exactly the kinds of jobs the DCC suite scaffold already models well.

### 3. Keep Semantic Ownership In K_OS Owner Crates

Do not let Fabric manifests become a dumping ground for business logic.

The right mapping is:

- K_OS owner crates keep domain truth
- Kain modules assemble typed orchestration glue
- Fabric manifests declare ordering, runtime choice, and contract edges
- Zen consumes the reports, resources, and status

That keeps Fabric declarative and keeps domain reasoning close to the actual owners.

### 4. Treat Fabric Reports As A Native Shell Surface

Zen should gain a Fabric-facing shell surface that reads:

- current session status
- step graph state
- produced reports
- recent events
- resource snapshots

This should look more like a job inspector or pipeline console than like a second viewport.

## What To Use Fabric For First

Start with work that is high-value, asynchronous, and already crosses boundaries.

### Best First Lanes

1. Project bootstrap
   Use Fabric to seed workspace defaults, runtime packs, starter assets, preview buffers, and initial reports.

2. Asset ingest
   Route import, conditioning, transcoding, thumbnail generation, metadata extraction, and validation through Fabric.

3. Material bake and preview products
   Use `gpu_compute` plus Kain orchestration for bake jobs, preview buffers, and derived render artifacts.

4. Topology analysis and rebuild
   Use `rust_crate` helpers for analysis and repair plans, but keep final scene ownership in K_OS.

5. Publish and packaging
   Use Fabric for export bundles, summaries, packaging reports, and bridge work into Node or Python tooling.

6. Tensor and ML utility lanes
   This is a very natural fit for Fabric because it is already comfortable with Python plus report-driven status.

### Good Second-Wave Lanes

- rig sync
- render preview jobs that are not on the immediate interactive frame path
- simulation planning or batched sim work
- recurring automation and maintenance passes

### Lanes To Avoid At First

- interactive sculpt stroke execution on the critical latency path
- direct viewport redraw or frame submission
- camera and navigation handling
- hot selection feedback
- canonical live scene ownership

Those paths are too latency-sensitive and too central to Zen's host role.

## Concrete Structure For K_OS

The cleanest first shape is an embedded Fabric workspace and service inside K_OS rather than a major rewrite of the native host.

Recommended ownership:

- `M:\K_OS\crates\k-os-kain\fabric\zen-dcc\`
  - Kain-authored orchestration modules
  - `KAIN.fabric.toml`
  - `fabric/intents/*.fabric.toml`
  - optional `session/*.kn` if Zen needs explicit intent planning in Kain
- `M:\K_OS\crates\zen\resources\fabric\`
  - shell-facing summaries
  - UI labels or lane metadata
  - optional operator-facing registry projections
- existing K_OS owner crates
  - continue owning Rust-native runtime helpers and domain code

That keeps authored orchestration close to Kain while keeping Zen's shell manifests clean and operator-facing.

## A Realistic Phase Plan

### Phase 0: Add Fabric As An Embedded Host Subsystem

Goal:
Zen can launch, inspect, and surface Fabric runs natively without depending on Fabric for normal viewport interaction.

Work:

- add a small Zen DCC Fabric workspace under `k-os-kain`
- create one broad `KAIN.fabric.toml`
- add 3-5 intent graphs:
  - `project.bootstrap`
  - `asset.ingest`
  - `material.bake_preview`
  - `topology.rebuild`
  - `publish.package`
- expose a new Zen shell surface for Fabric sessions, reports, and event logs

### Phase 1: Connect Zen Commands To Intent Planning

Goal:
Zen actions can mark work dirty and request intent execution without embedding heavy job logic in UI code.

Work:

- add a small command-to-intent planner layer
- map selected host actions to Fabric intents
- use debounce and priority rules the same way the DCC scaffold does
- keep reducers fast and local; let Fabric own slow derived work

### Phase 2: Promote Derived Products Into First-Class Zen Inputs

Goal:
Fabric outputs become useful native-side artifacts instead of detached reports.

Work:

- connect bake outputs, topology reports, and publish summaries into Zen inspectors
- consume resource snapshots and report registries as native shell panels
- optionally use runtime snapshots to hydrate secondary Zen UI surfaces

### Phase 3: Expand Runtime Coverage Carefully

Goal:
Fabric becomes the standard orchestration path for mixed-runtime DCC jobs.

Work:

- add Python-conditioned asset tools
- add GPU compute bake jobs
- add Rust crate analysis helpers
- add optional Node bridges for reporting and packaging

Only after the first phases are stable should Zen consider more interactive Fabric-backed lanes.

## Guardrails

If Zen adopts Fabric, keep these rules strict:

- Do not duplicate renderer ownership.
- Do not move the native viewport host into Fabric.
- Do not let generated shell projections become the source of truth.
- Do not put core scene semantics into ad hoc Python or Node scripts when an owner crate should hold them.
- Do not force all jobs through Fabric; synchronous host-local work should stay local when that is the right shape.
- Do not start with the most latency-sensitive tool loops.

## Recommended First Implementation Slice

If we want the highest return with the lowest architectural risk, the first slice should be:

1. Add a Zen DCC Fabric workspace with a bootstrap graph and an asset-ingest graph.
2. Add a Zen shell panel for Fabric reports and recent event logs.
3. Add one material preview or bake job through `gpu_compute`.
4. Keep the viewport path entirely on the existing Zen plus shared-renderer architecture.

That gives Zen immediate leverage from Fabric without disturbing the current renderer unification effort.

## Bottom Line

Fabric should become Zen DCC's orchestration backbone for mixed-runtime, reportable, background, and derived work.

Zen should remain the native viewport host and operator shell.

The winning move is not "replace Zen with Fabric" and not "ignore Fabric until the whole app is rewritten."

The winning move is:

- Zen for native interaction and presentation
- shared K_OS crates for core runtime ownership
- Kain plus Fabric for intent planning, job orchestration, and cross-runtime acceleration

That path matches the strongest architecture already present in both repos and gives Zen a practical way to scale beyond hand-wired tool flows.
