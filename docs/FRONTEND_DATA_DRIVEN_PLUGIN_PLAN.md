# Frontend Data-Driven Plugin Refactor Plan

## Verdict

Yes. This is the correct next move.

The backend/crate split is already in owner-crate shape. The frontend is now the main architectural bottleneck if the end goal is Blender-like extensibility.

The good news is that K-OS already has a real extension control plane:

- `src-frontend/systems/ui-engine/extensionApi.ts`
- `src-frontend/systems/ui-engine/extensionRegistry.ts`
- `src-frontend/systems/ui-engine/hooks/HookBus.ts`
- `src-frontend/systems/ui-engine/slots/SlotSystem.tsx`
- `src-frontend/systems/ui-engine/appApi/AppApiRegistry.ts`
- `src-frontend/systems/ui-engine/studio/PluginMatrix.tsx`
- `src-frontend/systems/ui-engine/studio/ExtensionManager.tsx`
- `src-frontend/systems/ui-engine/studio/examplePlugin.ts`

The bad news is that the feature layer is not consistently wired into it yet.

## What The Investigation Found

### 1. The plugin system is real

It already supports:

- extension manifests
- command contribution
- theme contribution
- shader contribution
- hook registration
- slot injection
- per-app APIs
- extension lifecycle and persistence

This is not fake scaffolding.

### 2. The feature apps are not yet consistently using it

Current gaps:

- no real `appApiRegistry.mount(...)` usage was found in `src-frontend`
- no real `<Slot id="...">` host usage was found in feature UIs
- hook firing is mostly inside the extension infrastructure itself, not at feature behavior seams

That means the extension runtime exists, but most feature behavior is still hardwired inside app components and local engines.

### 3. The feature directories are not yet systematically data-driven

The requested targets:

- `atlas`
- `autopbr`
- `bake`
- `cloner`
- `graphos`
- `greeble`
- `paint`
- `quantum`
- `retopo`
- `scatter`
- `sculpting`
- `tecton`

Current reality:

- some isolated registries/configs exist
- there is no consistent per-feature manifest/registry/slot/hook/API contract
- the larger features are still strongly component-driven and local-state-heavy

### 4. Can current behavior be modified reliably through plugins?

Not enough yet.

Today the answer is:

- extension management UI: yes
- extension registration/runtime: yes
- true behavior override or behavior injection across feature apps: only partially

So the next move should not be "write plugins."
It should be "make every feature expose stable, data-driven extension seams."

## Target Frontend Contract

Every major feature should converge on the same shape:

- `feature.manifest.ts`
- `feature.catalog.ts`
- `feature.commands.ts`
- `feature.hooks.ts`
- `feature.slots.ts`
- `feature.api.ts`
- `feature.panels.ts`
- `feature.tools.ts`
- `feature.store.ts`
- `feature.schema.ts` or `feature.schema.json`

Rules:

- no feature-local hardcoded toolbar wiring in giant components
- no feature-local ad hoc command registration
- no plugin injection by direct imports
- all extension points declared in data first, then rendered by host surfaces
- all user-visible tools, modes, panels, node types, brush types, layer types, presets, and exporters represented as registry data

## Phase Structure

## Phase 1: Shared Foundation

This must happen before broad parallel feature migration.

Deliverables:

- define one canonical frontend feature contract template
- mount real app APIs through `appApiRegistry.mount(...)`
- host real UI slots in the feature shells with `<Slot id="...">`
- define feature hook catalogs and emit hooks from actual behavior seams
- create feature manifest files for all target features
- create one central feature catalogue for discovery, routing, permissions, and plugin targeting
- define a standard registry pattern for:
  - tools
  - panels
  - presets
  - commands
  - node types
  - exporters
  - simulation operators

Exit criteria:

- Plugin Matrix shows mounted apps accurately
- example plugin can affect at least KSculpt and KPainter through real seams
- at least one slot renders in live feature UI
- at least one app API is mounted and callable at runtime

## Phase 2: Feature Migration

Move features from component-owned behavior to registry-owned behavior.

Order:

1. easiest / lowest-risk
2. medium-complexity
3. largest monoliths last

## Phase 3: Plugin Hardening

Once features are converted:

- plugin capability validation
- permissions audit
- runtime safety guards
- extension fixture plugins
- feature-level smoke tests

## Three-Agent Split

## Agent 1: Control Plane And Core Editor Surfaces

Primary objective:
Turn the existing plugin runtime into a real host platform used by the biggest feature editors.

Scope:

- `src-frontend/systems/ui-engine/**/*`
- `src-frontend/features/sculpting/**/*`
- `src-frontend/features/paint/**/*`
- `src-frontend/features/autopbr/**/*`
- `src-frontend/features/atlas/**/*`

Tasks:

- add canonical feature manifest contract and registry helpers
- wire `appApiRegistry.mount(...)` into KSculpt and KPainter first
- host live slots in sculpt and paint UI shells
- define and emit hook points for:
  - sculpt brush lifecycle
  - sculpt selection / mesh update / tool switch
  - paint stroke lifecycle
  - layer add/remove/change
  - material preset apply / export prepare
  - atlas operation start/finish
- convert brush, layer, preset, and tool definitions into registries
- expose app APIs for:
  - custom sculpt brushes
  - custom paint brushes
  - custom paint layers
  - AutoPBR preset/material actions
  - Atlas operators

Success criteria:

- example plugin can add a sculpt brush through the real mounted API
- example plugin can inject paint UI through slots
- Plugin Matrix shows `ksculpt` and `kpainter` online
- sculpt and paint behavior is no longer mostly hardcoded to top-level components

## Agent 2: Simulation, Generative, And Procedural Systems

Primary objective:
Make the simulation and procedural feature stack registry-driven instead of app-local.

Scope:

- `src-frontend/features/quantum/**/*`
- `src-frontend/features/tecton/**/*`
- `src-frontend/features/scatter/**/*`
- `src-frontend/features/greeble/**/*`
- `src-frontend/features/cloner/**/*`

Tasks:

- define node/operator/force catalogs for Quantum
- define terrain operator / sequencer / shader mode catalogs for Tecton
- define scatter rule catalogs and placement operator registries
- define greeble modifier/lighting/physics catalogs
- define cloner strategy registry and tool manifest
- expose app APIs for:
  - sim nodes
  - terrain operators
  - scatter generators
  - greeble modifiers
  - cloner modes
- emit hooks around:
  - sim tick
  - terrain update
  - scatter generation
  - procedural bake / apply

Success criteria:

- Quantum can register custom simulation nodes from a plugin
- Tecton and Scatter expose operator registries rather than inline behavior menus
- procedural features become manifest-driven, not switch-statement-driven

## Agent 3: Workflow, Retopo, Bake, And Graph Editing Tools

Primary objective:
Normalize the workflow tools and smaller features onto the same contract so the platform is consistent across the suite.

Scope:

- `src-frontend/features/retopo/**/*`
- `src-frontend/features/bake/**/*`
- `src-frontend/features/graphos/**/*`
- `src-frontend/features/atlas/**/*` support if Agent 1 needs help after foundation lands
- cross-feature docs and migration fixtures

Tasks:

- define retopo tool registry
- define bake task manifest / preset / pipeline registry
- define Graphos node/tool/preset registries
- move feature commands into data-driven registration surfaces
- add slots and hook catalogs to these smaller features
- create fixture plugins that validate:
  - add a retopo tool
  - add a bake preset
  - add a Graphos node or brush

Success criteria:

- Bake and Retopo no longer rely on inline toolbar/menu hardcoding
- Graphos becomes a registry-first editor instead of a bespoke app shell
- smaller tools match the same extension contract as sculpt and paint

## Safe To Parallelize

- feature manifest creation for all target features
- catalog/schema file creation
- registry extraction for isolated feature-local presets/tools
- documentation and plugin fixture authoring
- slot definition expansion in `SlotSystem.tsx`
- hook catalog expansion in `HookBus.ts`

## Do Not Parallelize

- canonical feature contract design
- `ui-engine` registry interface changes
- app API type contract changes
- top-level feature shell wiring for mounted apps
- shared command/panel/slot infrastructure changes

These must be merged in a controlled order or the agents will stomp each other.

## Recommended Execution Order

1. Agent 1 lands the shared contract and live host wiring.
2. Agent 2 and Agent 3 branch off after the host contract stabilizes.
3. Agent 1 continues with KSculpt and KPainter because they are the highest-risk proof points.
4. Agent 2 handles Quantum/Tecton/Scatter/Greeble/Cloner in parallel.
5. Agent 3 handles Retopo/Bake/Graphos in parallel.
6. Agent 1 finishes Atlas/AutoPBR integration after the shared surfaces are proven.

## Feature Priority

Highest priority:

- sculpting
- paint
- quantum
- autopbr
- atlas

Medium priority:

- tecton
- retopo
- graphos
- bake

Lower-risk / faster wins:

- scatter
- greeble
- cloner

## Why This Is The Correct Next Move

Because the current blocker is not backend ownership anymore.
It is frontend behavior discoverability and modifiability.

If this step is skipped:

- plugins remain mostly cosmetic
- behavior remains trapped in monolithic React files
- each feature invents its own extension story
- Blender-style suite modding stays aspirational

If this step is done well:

- every major tool becomes registry-driven
- plugin surfaces become stable and testable
- new feature work stops hardcoding itself into app shells
- the suite becomes composable instead of brittle

## First Concrete Sprint

The first sprint should be:

1. define `feature.manifest.ts` and `feature.api.ts` contract template
2. wire `ksculpt` and `kpainter` into `appApiRegistry.mount(...)`
3. add real `<Slot id=\"...\">` hosts to sculpt and paint shell regions
4. emit first real hook points from sculpt and paint actions
5. register one proof plugin that:
   - adds a sculpt brush
   - injects a toolbar control
   - listens to a paint hook

If that sprint works, the rest of the feature migration becomes straightforward rather than speculative.
