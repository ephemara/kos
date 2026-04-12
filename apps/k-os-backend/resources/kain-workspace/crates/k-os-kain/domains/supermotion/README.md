# KAIN — Multi-Paradigm Systems Language with Universal Compilation Targets

> **A compiled language combining Rust's safety, Python's readability, Lisp's metaprogramming, and Zig's comptime — targeting WASM, LLVM native, SPIR-V, HLSL, USF, Rust, JavaScript, C++, and Unreal Engine 5**


## What is KAIN?

KAIN is a **multi-paradigm systems language** with **15+ compilation targets**. It is not just a scripting language or a UE5 tool — it is a full language with its own type system, effect tracking, actor concurrency model, macro system, interpreter, self-hosted compiler, and codegen backends spanning web, native, GPU, and game engine targets.

```
.kn source → kain build → WASM | LLVM native | SPIR-V | HLSL | USF | Rust | JS | C++ | UE5 Plugin
```

### Language Philosophy

| Influence | What KAIN Takes | How It Manifests |
|-----------|----------------|------------------|
| **Rust** | Ownership, borrowing, no null, no data races | Memory-safe by default, no garbage collector |
| **Python** | Significant whitespace, minimal ceremony | Clean syntax, rapid prototyping |
| **Lisp** | Code as data, hygienic macros | DSL-friendly, metaprogramming |
| **Zig** | Compile-time execution | `comptime` blocks, no separate macro language |
| **Erlang** | Actor concurrency | Built-in actor system with message passing |
| **Effect Systems** | Side effects in the type system | `with Pure`, `with IO` effect tracking |

### What Makes KAIN Different

- **One language, every target** — same `.kn` source compiles to WASM, native binaries, GPU shaders, Rust, JS, C++, or full UE5 plugins
- **Actor-native concurrency** — Erlang-style actors are a first-class language construct, not a library
- **Effect tracking** — side effects are part of the type system (`fn factorial(n: Int) -> Int with Pure`)
- **Compile-time execution** — Zig-style comptime without a separate macro language
- **Self-hosted** — the compiler can compile itself (Project Ouroboros)
- **Python FFI** — call Python directly via pyo3 (`py_call("math.sqrt", [16.0])`)
- **UE5 as a target** — the most advanced backend generates full production UE5 C++ plugins with 7 specialized codegen crates
- **Data-driven stdlib** — 200+ functions across 12 categories automatically prepended to every compilation, achieving 1:20 compression ratio (2000 KAIN lines → 40,000+ C++ lines)

---

## Compilation Targets

| Target | Flag | Output | Use Case |
|--------|------|--------|----------|
| **WebAssembly** | `-t wasm` | `.wasm` | Web applications, edge computing |
| **JavaScript** | `-t js` | `.js` | Node.js, browsers |
| **LLVM / Native** | `-t llvm` | executable | Native binaries, systems programming |
| **Rust** | `-t rust` | `.rs` | Rust interop, bootstrap compiler |
| **C++** | `-t cpp` | `.cpp/.h` | C++ interop |
| **SPIR-V** | `-t spirv` | `.spv` | Cross-platform GPU shaders (→ WGSL, GLSL, Metal via naga) |
| **HLSL** | `-t hlsl` | `.hlsl` | DirectX shaders (direct codegen, no middleman) |
| **USF** | `-t usf` | `.usf` | Unreal Engine 5 shaders (direct codegen) |
| **UE5 C++** | `--ue5` | Full plugin | Complete UE5 plugin with C++, .uplugin, Build.cs, shaders, materials, .uasset |
| **UE5 Editor** | `-t ue5editor` | Editor C++ | Slate UI, Details panels, Viewports, Toolbars |
| **Hybrid** | `-t hybrid` | WASM + JS | Full-stack web applications |
| **Interpret** | `-t run` | stdout | Instant execution, REPL, prototyping |
| **Test** | `-t test` | stdout | Unit test runner |

---

## CLI Reference

### Installation

```bash
# Build from source (requires Rust)
cargo install --path crates/cli --force

# Verify
kain --version
```

### Commands

#### `kain build` — Build project or file

```bash
# Build UE5 plugin from KAIN.toml
kain build --ue5

# Build specific file to a target
kain build src/main.kn --target wasm

# Build with multiple targets
kain build --targets wasm,js,rust

# Verbose output
kain build --ue5 --verbose

# Dry run (preview without writing)
kain build --ue5 --dry-run

# Analyze shader complexity
kain build src/shader.kn --target usf --analyze
```

**UE5 Plugin Build (`--ue5`):**
1. Reads `KAIN.toml` `[ue5]` section
2. Parses all `.kn` files in `src/`
3. Generates C++ in `Source/`
4. Generates Blueprints in `Content/Blueprints/`
5. Generates Materials in `Content/Materials/`
6. Generates Shaders in `Shaders/`
7. Creates `.uplugin` and `.Build.cs` files

#### `kain run` — Execute immediately (interpreter)

```bash
kain run examples/hello.kn
kain run examples/test.kn --verbose
```

#### `kain init` — Initialize new project

```bash
kain init                              # Current directory
kain init MyProject                    # New directory
kain init MyProject --name "My Plugin" # Explicit name
```

Generates: `KAIN.toml`, `src/`, `.gitignore`

#### `kain inject` — Inject into existing UE5 plugin (non-destructive)

```bash
kain inject src/new_actor.kn --ue5                        # Auto-detect plugin
kain inject src/a.kn src/b.kn --ue5                       # Multiple files
kain inject src/new_actor.kn --ue5 --plugin MyPlugin      # Explicit plugin
kain inject src/new_actor.kn --ue5 --plugin-dir /path/to  # Explicit directory
kain inject src/new_actor.kn --ue5 --dry-run              # Preview changes
kain inject src/new_actor.kn --ue5 --force                # Overwrite existing
```

How inject works:
1. Detects existing plugin structure
2. Parses input `.kn` files
3. Generates new C++ files in `Source/Private/Generated/`
4. Updates existing headers if needed
5. Preserves existing code (non-destructive)
6. Registers new types in module

#### `kain lsp` — Language Server Protocol

```bash
kain lsp  # Typically invoked by IDE, not manually
```

Provides autocomplete, diagnostics, hover, go-to-definition for IDE integration.

### Global Flags

| Flag | Description |
|------|-------------|
| `-o, --output <FILE>` | Output file or directory |
| `-t, --target <TARGET>` | Compilation target |
| `-r, --run` | Run immediately after compilation |
| `-w, --watch` | Watch for file changes, auto-recompile |
| `-v, --verbose` | Verbose output |
| `--emit-ast` | Dump parsed AST for debugging |
| `--emit-typed` | Dump type-annotated AST |
| `--dry-run` | Print planned actions without executing |
| `--strict` | Treat warnings as errors |
| `--analyze` | Analyze shader complexity (USF only) |
| `--plugin <NAME>` | Target plugin name for UE5 operations |
| `--plugins-dir <DIR>` | Base plugins directory |

### Configuration (KAIN.toml)

```toml
[package]
name = "MyPlugin"
version = "1.0.0"
authors = ["Your Name"]

[ue5]
plugin_name = "MyPlugin"
engine_version = "5.4"
category = "Gameplay"
description = "My awesome UE5 plugin"

[[ue5.modules]]
name = "MyPlugin"
type = "Runtime"
loading_phase = "Default"

[build]
targets = ["wasm", "js"]
output_dir = "dist"
```

---

## Core Language Features

### Actor Concurrency (Erlang-style)

```kain
actor ChatRoom:
    var messages: Array<String> = []
    var users: Array<String> = []
    
    on Join(name: String):
        push(users, name)
        broadcast("{name} joined")
    
    on Message(from: String, text: String):
        push(messages, "{from}: {text}")
        broadcast("{from}: {text}")
```

Actors are first-class — channel-based message passing, no shared mutable state.

### Effect Tracking

```kain
fn factorial(n: Int) -> Int with Pure:
    match n:
        0 => 1
        _ => n * factorial(n - 1)
```

Side effects are tracked in the type system. `Pure` functions cannot perform I/O.

### Pattern Matching

```kain
fn describe(x: Int) -> String:
    match x:
        0 => "zero"
        1..10 => "small"
        _ => "large"
```

### Compile-Time Execution

Zig-style comptime — no separate macro language needed.

### Standard Library

Built-in functions across all targets:
- **I/O:** `print`, `println`, `read_line`, `read_file`, `write_file`
- **Collections:** `push`, `pop`, `len`, `map`, `filter`, `reduce`
- **Math:** `abs`, `min`, `max`, `sqrt`, `pow`
- **String:** `split`, `join`, `trim`, `replace`, `substring`
- **JSON:** `json_parse`, `json_stringify`
- **HTTP:** `http_get`, `http_post`

### Python FFI

```kain
let result = py_call("math.sqrt", [16.0])  # Returns 4.0
```

Direct Python interop via pyo3.

### Self-Hosted Compiler (Project Ouroboros)

The compiler can compile itself — written in KAIN:

| File | Lines | Purpose |
|------|-------|---------|
| `main.kn` | 284 | Compiler driver, CLI |
| `lexer.kn` | ~400 | Tokenizer |
| `parser.kn` | ~800 | Recursive descent parser |
| `codegen.kn` | ~800 | LLVM IR generation |
| `codegen_rust.kn` | 684 | Rust transpilation |

---

## Codegen Backends

### WASM (95KB backend)
Full WebAssembly: struct memory layout, component system, enum discriminants, lambda/closure collection, string pooling, bump allocator.

### LLVM / Native (66KB backend)
Native compilation: struct/actor compilation, reference counting, scope-based cleanup (RAII), external C runtime linkage, debug info.

### SPIR-V (14KB backend)
GPU shaders: vertex/fragment/compute stages, vector/matrix types, input/output decorations, BuiltIn position. Cross-platform via naga (→ WGSL, GLSL, Metal).

### HLSL (25KB backend)
Direct DirectX: `cbuffer` with register bindings, `Texture2D` + `SamplerState`, `VSInput`/`PSOutput` with semantics, PBR math, SM5.0.

### USF (20KB backend)
Direct UE5 shaders: `Platform.ush` includes, scalar parameters, `FPSInput`/`FPSOutput`, `[numthreads]` compute, `RWTexture2D` UAV.

### Rust Transpiler (28KB backend)
Full AST transformation, type mapping, operator translation, pattern matching, generated `Cargo.toml`.

### UE5 C++ (7 specialized crates)
The most advanced backend — see full UE5 feature reference below.

---

## Repository Structure

```
.
├── Kain/                          # Rust compiler monorepo
│   ├── crates/
│   │   ├── kain-core/             # Parser, AST, type checker
│   │   ├── ue5/                   # Runtime codegen (actors, components, RPCs, subsystems, networking)
│   │   ├── ue5-editor/            # Editor codegen (Slate, Details, Viewports, Toolbars, Asset Editors)
│   │   ├── ue5-graphs/            # Graph editor + runtime codegen (UEdGraph, NodeData, GraphInstance)
│   │   ├── ue5-shaders/           # Shader codegen (compute, fragment, vertex, surface .usf)
│   │   ├── ue5-materials/         # Material graph codegen (binary .uasset serialization)
│   │   ├── ue5-blueprints/        # Blueprint node codegen (UK2Node, Kismet bytecode)
│   │   └── cli/                   # CLI binary + packager (data-driven module system)
│   ├── unreal/
│   │   └── metadata/              # 14 JSON metadata files (engine types, widgets, shaders, UHT rules)
│   └── docs/recent/               # V1 compiler documentation
│
├── Factory/                       # 20 production UE5 plugins with compiled binaries
├── Research/                      # 29 UE5 pattern taxonomies, battle reports
└── README.md                      # This file
```

---

# UE5 Backend — Complete Feature Reference

The UE5 backend is the most advanced target, spanning **7 specialized codegen crates**. Everything below is implemented and tested.

---

## Actors (AActor)

```kain
actor Player:
    state health: Float = 100.0
    state max_health: Float = 100.0
    on Server_TakeDamage(amount: Float):
        health = health - amount
        if health <= 0.0:
            Server_Die()
    on Server_Die():
        Multicast_PlayDeathEffect()
    on Multicast_PlayDeathEffect():
        println("Death effect!")
```

**Generates:** `APlayer : public AActor` with `UCLASS(HideCategories=(Input, Collision, LOD))`, `GENERATED_BODY()`, constructor (`PrimaryActorTick.bCanEverTick = true`), `BeginPlay()`, `Tick()`, `UPROPERTY(EditAnywhere, BlueprintReadWrite)` for state fields.

When state has `@replicated` fields: `bReplicates = true`, `GetLifetimeReplicatedProps()` with `DOREPLIFETIME` macros.

When actor has component-typed state: auto-creates `USceneComponent` root + `CreateDefaultSubobject<T>()` for each.

When actor has shaders: double-buffered `UTextureRenderTarget2D*` resources (PositionRT_A/B, VelocityRT_A/B).

**Actor Attributes:**
- `@base("ACharacter")` — custom base class (default AActor)
- `@uclass("Blueprintable", "Abstract")` — data-driven UCLASS specifiers

**RPC auto-detection from handler name prefix:**

| Prefix | UE5 Macro |
|--------|-----------|
| `Server_` | `UFUNCTION(Server, Reliable, WithValidation)` + auto `_Validate()` |
| `Client_` | `UFUNCTION(Client, Reliable)` |
| `Multicast_` | `UFUNCTION(NetMulticast, Reliable)` |

---

## Components (UActorComponent)

```kain
@component
struct HealthComponent:
    @replicated
    current: Float
    @replicated
    max: Float
    @savegame
    is_invulnerable: Bool
```

**Generates:** `UHealthComponent : public UActorComponent` with `UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))`, `SetIsReplicatedByDefault(true)`, `GetLifetimeReplicatedProps()`.

**Lifecycle:** `@tick` → `TickComponent()` override. `@beginplay` → `BeginPlay()` override.

**Advanced Network Sync:** `@replicated(mode: "interpolated", back_time: 0.1)` generates state buffers, interpolation/extrapolation/compression logic in TickComponent.

---

## Structs & DataTables

```kain
struct ItemStack:
    item_id: Int
    quantity: Int
```
→ `FItemStack` with `USTRUCT(BlueprintType)`

```kain
@datatable
struct ItemData:
    id: Int
    name: String
    rarity: ItemRarity
```
→ `FItemData : public FTableRowBase` — CSV import ready.

---

## Enums

```kain
enum ItemRarity:
    Common
    Rare
    Epic
    Legendary
```
→ `UENUM(BlueprintType) enum class EItemRarity : uint8` with `UMETA(DisplayName=...)`. Anti-double-prefix: `enum EItemRarity` stays `EItemRarity`.

---

## Blueprint Integration

**Function Libraries:**
```kain
@blueprint
fn calculate_damage(base: Float, multiplier: Float, armor: Float) -> Float:
    let raw = base * multiplier
    return max(raw * (1.0 - armor / 100.0), 0.0)
```
→ Static method in `UBlueprintFunctionLibrary` with `UFUNCTION(BlueprintCallable)`.

**Blueprint Events:**
```kain
actor GameMode:
    @blueprint_event
    fn on_player_joined(player: Actor):
        println("Player joined!")
```
→ `UFUNCTION(BlueprintNativeEvent)` + `_Implementation()` method. Blueprint can override.

**Method Attributes:** `@blueprint_callable`, `@blueprint_pure` (adds `const`), `@blueprint_event`, `@blueprint_implementable_event`, `@category("X")`, `@meta("ToolTip=...")`, `@inline` (body in header).

**Custom Blueprint Nodes (UK2Node):** Full `UK2Node` subclasses with `AllocateDefaultPins()`, node expansion, async nodes via `UK2Node_AsyncAction`, **Kismet bytecode generation** for binary `.uasset` event graphs.

---

## Subsystems (UWorldSubsystem)

```kain
@subsystem
struct NarrativeManager:
    active_dialogues: Array<DialogueInstance>
    fn start_dialogue(npc_id: Int) -> Bool:
        return true
```
→ `UNarrativeManagerSubsystem : public UWorldSubsystem` with `Initialize()`, `Deinitialize()`, `ShouldCreateSubsystem()`.

**Tickable:** Add `@tick` → adds `FTickableGameObject` interface with `Tick()`, `GetStatId()` (CYCLE_STAT), `IsTickable()`.

---

## Shaders (.usf)

### Compute Shaders
```kain
shader compute VoxelGenerator(thread_id: Vec3):
    uniform grid_size: Int @0
    uniform noise_scale: Float @1
    buffer output: RWBuffer<Float> @2
    let noise = perlin_noise(thread_id * noise_scale)
    output[thread_id.x] = noise
```
→ `.usf` with `[numthreads(X,Y,Z)]` (auto-sized), `FGlobalShader` subclass, `IMPLEMENT_GLOBAL_SHADER`, dispatch helper, UAV writes for outputs.

### Fragment / Surface Shaders
```kain
shader fragment ColorTint(uv: Vec2) -> Vec4:
    uniform base_color: Vec3 @0
    uniform albedo_map: Sampler2D @1
    let tex_color = sample(albedo_map, uv).rgb
    return vec4(tex_color * base_color, 1.0)
```

### Shader Permutations
`CFG_*` / `ENABLE_*` prefixed uniforms → `SHADER_PERMUTATION_BOOL` (zero runtime cost compile-time branches).

### Shared Shader Libraries (.ush)
Multi-shader plugins auto-generate `{Plugin}Common.ush` with shared helpers (IsInBounds, PixelToUV, HashNoise, Grayscale) injected via `#include` after `Platform.ush`.

### Shader Pipeline Features
- Uniform classification (texture vs scalar) — textures excluded from dispatch signature
- Texture coordinate normalization, simulation texture point sampling (`Load()`)
- RDG resource transitions, binding slot validation, POD struct validation
- Conditional shader directory mapping with duplicate assert guard
- Thread group size validation (max 1024)

---

## Material Graphs (Binary .uasset)

```kain
material PBRGround:
    input albedo: Texture2D
    input roughness_value: Float = 0.5
    base_color = texture_sample(albedo).rgb
    roughness = roughness_value
```

**30+ material node types**, custom HLSL (`custom_hlsl()` → `UMaterialExpressionCustom`), texture sampling with auto UV + channel access (.r/.g/.b/.a/.rgb), UV manipulation (`uv_scroll`, `uv_scale`, `uv_rotate` + chaining), time-based effects (`time()`, `sine()`, `cosine()` with deduplication), shader integration (`call_shader()`), nested expression trees, texture deduplication, dynamic material auto-marking, **direct binary .uasset serialization**.

Math functions: `lerp`, `clamp`, `pow`, `dot`, `cross`, `normalize`, `length`, `distance`, `abs`, `min`, `max`, `saturate`, `frac`, `floor`, `ceil`, `round`, `sqrt`, `exp`, `log`.

---

## Graph Editors (UEdGraph)

### Graph Runtime
```kain
@graph_runtime
graph DialogueSystem:
    @node_data
    node SpeakerNode:
        speaker_name: String = "NPC"
        @input_pin
        in_exec: Exec
        @output_pin
        next: Exec
```
→ `UNodeData_SpeakerNode` with `ExecuteNode()`, `UDialogueSystemInstance`, `UDialogueSystemAsset` with `CreateInstance()`/`ValidateGraph()`. Pin types: Exec, Bool, Int, Float, String, Object, Struct, Enum, Wildcard, Array.

### Graph Editor
```kain
@graph_editor
graph DialogueGraph:
    @node_type
    node NPCNode:
        properties:
            SpeakerName: String = "NPC"
        inputs:
            InExec: Exec
        outputs:
            Next: Exec
```
→ `UEdGraphNode` subclasses with `AllocateDefaultPins()`, `GetNodeTitle()`, `GetMenuCategory()`, editor factory, graph schema.

---

## Editor UI

**Slate Widgets** (`@slate`): → `SCompoundWidget` with `SLATE_BEGIN_ARGS`, `SNew()` chains, delegate bridges.

**Details Panels** (`@details`): → `IDetailCustomization` with `IPropertyHandle` binding via `GET_MEMBER_NAME_CHECKED`, `SSpinBox` with `Value_Lambda`/`OnValueChanged_Lambda`, `SColorBlock`, `SObjectPropertyEntryBox`, `SButton` delegates. Supports `@slider(min, max)`, `@color_picker`, `@button(label)`.

**Viewports** (`@viewport`): → `SEditorViewport` + viewport client. `@scene_actor` for meshes, `@camera` for camera setup.

**Toolbars** (`@toolbar`): → `FToolBarBuilder` with `@button`, `@toggle`, `@separator`, `@dropdown`.

**Asset Editors** (`@asset_editor`): → `FAssetEditorToolkit` combining viewport + details + toolbar with tab spawners and docking layout.

**Editor Modules** (`@editor_module`): → `IModuleInterface` with `IMPLEMENT_MODULE`, `@menu_entry`, `@toolbar_button`, `FTSTicker` registration.

---

## Async Tasks

```kain
@async_task
struct MeshGenerator:
    @input
    resolution: Int
    @output
    vertices: Array<Vec3>
    @callback(thread: "game")
    fn on_complete(result: Array<Vec3>):
        println("Done!")
```
→ `FRunnable` task with thread pool, `DoWork()`, game-thread completion callback, cancellation, priority support.

---

## Animation State Machines

```kain
@state_machine
struct CombatAnimations:
    @state(entry: true)
    idle:
        animation: "Idle_Anim"
        @transition(to: "attacking")
        fn can_attack() -> Bool:
            return input_pressed("Attack")
```
→ State enum, state classes with animation refs, transition evaluation, entry/exit methods, update logic.

---

## Data-Driven Validation (Oracle)

**Built-in rules:** replication validation, RPC naming (`Server_`/`Client_`/`Multicast_`), datatable field validation, component validation, name collision detection (engine types, C++ keywords, UE5 macros), circular dependency detection, blueprint event rules.

**Custom rules via `validation_rules.json`** — no recompilation needed:
- 7 categories: Naming, TypeCompatibility, AttributeCombination, Replication, Blueprint, Shader, Editor
- 7 condition types: TypeCollision, IncompatibleAttributes, InvalidRpcNaming, NestedContainer, InvalidNaming, MissingAttribute, ForbiddenType
- Supports: disabling, custom messages/suggestions, severity levels, conflict detection

---

## Metadata-First Architecture

14 JSON metadata files drive the compiler: `engine_knowledge.json` (500+ types), `widget_registry.json`, `shader_knowledge.json`, `uht_rules.json`, `module_graph.json`, `validation_rules.json` + schema. Multi-UE5-version support (5.4-5.7), multi-drive installation, schema validation on load, hot-reload.

---

## Multi-Module Plugin System

```toml
[[ue5.modules]]
name = "MyPlugin"
type = "Runtime"
source_globs = ["src/runtime/**"]

[[ue5.modules]]
name = "MyPluginEditor"
type = "Editor"
depends_on = ["MyPlugin"]
```

Data-driven modules in KAIN.toml. Validation (duplicates, unknown deps, cycles). Auto .uplugin + per-module Build.cs. Module types: Runtime, Editor, Developer, UncookedOnly. Back-compatible with legacy single/split mode.

---

## Binary Asset Pipeline

- **Material .uasset** — `MaterialAssetBuilder` with 30+ node types, direct binary serialization
- **Blueprint .uasset** — `BlueprintBinaryWriter` with 14 property types, Kismet bytecode
- **UDataAsset Writer** — Engine version parameterization (UE 5.0→5.4+), 26 tests
- **Asset Registry Writer** — `AddedDependencyFlags` format (UE 4.27/5.0+), 6 tests

---

## Post-Processing Pipeline

| Fix | Purpose |
|-----|---------|
| **ReplicationFix** | Injects `GetLifetimeReplicatedProps` + `DOREPLIFETIME` |
| **ShaderInitFix** | Shader initialization in `BeginPlay` |
| **ForwardDeclFix** | Missing forward declarations in correct order |
| **IncludeOrderFix** | CoreMinimal → Engine → Project include ordering |
| **FormattingFix** | Tabs, single blank lines, LF line endings |

---

## Type System & Dependency Resolution

**Auto naming:** `actor Player` → `APlayer`, `struct Item` → `FItem`, `enum Rarity` → `ERarity`, `@component Health` → `UHealthComponent`, `@subsystem Narrative` → `UNarrativeSubsystem`. No double-prefixing.

**TypeMapper:** Primitives, engine types (pointer detection), user types, generics (`Array<T>` → `TArray<T>`).

**DependencyResolver:** Auto-detects UE5 modules from includes (RenderCore/RHI for shaders, Slate/SlateCore for widgets, PropertyEditor for details, UnrealEd/AssetTools for editors).

---

## Extension System

```bash
python Kain/unreal/scripts/extension_scanner.py <plugin_path> --name <name>
```

Available: `metahuman.json` (256 classes, 176 structs, 99 enums), `niagara.json`, `pcg.json`. Create your own.

---

## What the UE5 Backend Handles Automatically

- `UCLASS()` / `UPROPERTY()` / `UFUNCTION()` macros with correct specifiers
- `GENERATED_BODY()` in every class
- Module registration (`IMPLEMENT_MODULE`)
- Shader directory mapping (conditional guard against duplicate assert)
- `.uplugin` file generation
- `.Build.cs` with auto-detected module dependencies
- Forward declarations, header guards, include ordering
- Memory management (`CreateDefaultSubobject`, pointer types for UObject-derived)
- `GetLifetimeReplicatedProps` + `DOREPLIFETIME`
- RPC `_Validate` methods
- Constructor initialization (`bCanEverTick`, `bReplicates`, `SetIsReplicatedByDefault`)
- Root component creation for actors with component fields
- Naming conventions (A/F/E/U prefixes, no double-prefix)

---

## Complete Attribute Quick Reference

### Struct-Level
`@component`, `@datatable`, `@subsystem`, `@tick`, `@beginplay`, `@slate`, `@details`, `@viewport`, `@toolbar`, `@asset_editor`, `@editor_module`, `@async_task`, `@state_machine`, `@graph_runtime`, `@graph_editor`

### Field-Level
`@replicated`, `@replicated(mode: "interpolated")`, `@savegame`, `@transient`, `@editdefaults`, `@visibleonly`, `@category("X")`, `@slider(min, max)`, `@color_picker`, `@property`, `@scene_actor`, `@camera`, `@input`, `@output`, `@input_pin`, `@output_pin`

### Function-Level
`@blueprint`, `@blueprint_callable`, `@blueprint_pure`, `@blueprint_event`, `@blueprint_implementable_event`, `@inline`, `@button(label)`, `@toggle(label)`, `@dropdown(label)`, `@menu_entry(path, label)`, `@toolbar_button(section, icon)`, `@callback(thread)`

### Actor-Level
`@base("ACharacter")`, `@uclass("Blueprintable")`

### Shader
`shader compute`, `shader fragment`, `shader surface`, `shader vertex`, `uniform X: Type @N`, `CFG_*`/`ENABLE_*` permutations

---

## Test Coverage — 386 Tests Passing

| Crate | Tests | Coverage |
|-------|-------|----------|
| `ue5` | 148 | Actors, components, RPCs, networking, animation, subsystems, async |
| `ue5-shaders` | 85 | Compute, fragment, vertex, surface, permutations, shared libraries |
| `ue5-graphs` | 58 | Graph runtime, NodeData, GraphInstance, Asset, editor factory |
| `ue5-editor` | 38 | Slate, Details (property binding), Viewports, Toolbars, Asset Editors |
| `ue5-materials` | 36 | Material graphs, binary .uasset, expressions, textures, UV, time |
| `ue5-blueprints` | 21 | UK2Node, Kismet bytecode, async nodes, blueprint binary writer |
| `cli` | 13+ | Packager, multi-file builds, module validation |

---

## Proven Results — 20 Production UE5 Plugins

| Plugin | KAIN Lines | C++ Lines | Features |
|--------|-----------|-----------|----------|
| **VoxelForgePro** | 1,943 | 15,000 | 19 GPU compute shaders, terrain generation |
| **TitanGraph** | 1,692 | 10,000 | Quest/dialogue graph editor with UEdGraph |
| **AeroTunnel** | 1,620 | 12,000 | Flight physics + wind tunnel simulation |
| **KainFlow** | 966 | 8,000 | Soft-body physics engine |
| **NarrativeGraph** | 464 | 2,321 | Dialogue/quest runtime with graph editors |
| **Cinema4DMograph** | 1,000+ | 5,000+ | Mograph system with 20+ modifiers |
| +14 more... | | | |

**Average Compression:** 1 line KAIN → 5-8 lines C++ (base) → **1:20+ with stdlib** (shader functions, gameplay patterns, actor bindings eliminate boilerplate entirely)

---

## Standard Library (stdlib)

KAIN ships a data-driven standard library of 200+ functions across 12 categories, automatically prepended to every compilation. No imports, no configuration — functions are globally available.

### Stdlib Categories

| File | Functions | What It Covers |
|------|-----------|----------------|
| `shaders.kn` | 100+ | PBR, noise, color grading, UV ops, volumetric rendering, SSS, post-processing, ray marching, SDF, procedural generation |
| `actor.kn` | 30+ | Actor lifecycle, transform, attachment, velocity, component access |
| `gameplay.kn` | 20+ | Damage, health, XP, inventory, cooldowns, buffs, loot, quests |
| `utilities.kn` | 20+ | Math helpers, remap, interpolation, random, string formatting |
| `world.kn` | 20+ | World queries, spawning, traces, debug drawing, game mode access |
| `skeletal_mesh.kn` | 20+ | Montages, bone manipulation, sockets, morph targets |
| `materials.kn` | 15+ | Material parameter control, dynamic materials, parameter collections |
| `particles.kn` | 15+ | Niagara variable binding, system control, pooling |
| `components.kn` | 10+ | Common component struct definitions (Health, Inventory, Movement, Combat) |
| `patterns.kn` | 12+ | Shared type definitions (LootRarity, BuffType, DamageType, WeaponStats) |
| `math.kn` | 11+ | Vector math, rotation, interpolation, type aliases |
| `common.kn` | 3+ | Core engine bindings (GetWorldDeltaSeconds, GetActorLocation) |

### Stdlib Discovery

The compiler finds stdlib automatically — no `KAIN.toml` changes needed:
1. `KAIN_STDLIB_PATH` environment variable (highest priority)
2. Walk up from exe location looking for `stdlib/ue5/`
3. Walk up from CWD looking for `stdlib/ue5/`

```toml
# Optional explicit override in KAIN.toml
[ue5]
stdlib_path = "../../stdlib/ue5"
```

### Compression Ratios by Category

| Category | Ratio | Example |
|----------|-------|--------|
| Shader functions | 1:30 | `fresnel_schlick(cos_theta, f0)` → 8 lines HLSL |
| Gameplay patterns | 1:10 | `apply_damage(hp, dmg, armor)` → 12 lines C++ |
| Actor bindings | 1:5 | `@extern fn GetActorLocation()` → UE5 API call |
| **Overall with stdlib** | **1:20** | 2000 KAIN lines → 40,000+ C++ lines |

### Stdlib Location

- **Compiler stdlib:** `Kain/stdlib/ue5/` — loaded by backend during `kain build`
- **Factory testing ground:** `Factory/Stdlib/` — organized by domain for development
- **Documentation:** `Kain/stdlib/USAGE_GUIDE.md`, `Kain/stdlib/PATTERN_EXTRACTION_GUIDE.md`

---

## Compiler Architecture (For Developers)

### Compilation Pipeline

```
Kain/stdlib/ue5/*.kn (200+ functions, auto-discovered)
    ↓ prepended
.kn source files
    ↓
[Lexer] → Tokens (Python-style INDENT/DEDENT)
    ↓
[Parser] → AST (Item::Actor, Item::Struct, Item::MaterialGraph, Item::GraphEditor, ...)
    ↓
[Type Checker] → TypedProgram (effect inference, generic monomorphization)
    ↓
[Packager] → Attribute-driven dispatch to codegen crates:
    ↓
    ├─→ ue5::generate()           → .h/.cpp  (actors, structs, enums, components, subsystems)
    ├─→ ue5_editor::generate()    → .h/.cpp  (Slate, Details, Viewports, Toolbars, Asset Editors)
    ├─→ ue5_graphs::generate()    → .h/.cpp  (UEdGraph nodes, factory, schema, runtime)
    ├─→ ue5_shaders::compile()    → .usf/.h  (HLSL shaders, FGlobalShader, dispatch helpers)
    ├─→ ue5_materials::generate() → .uasset  (binary material graphs)
    └─→ ue5_blueprints::generate()→ .uasset  (binary blueprints, Kismet bytecode)
    ↓
[Post-Processing] → ReplicationFix, ShaderInitFix, ForwardDeclFix, IncludeOrderFix, FormattingFix
    ↓
[Packager Output] → .uplugin, Build.cs, Source/, Shaders/, Content/
```

### Attribute-Driven Dispatch

The packager routes items to codegen crates based on attributes:

```
@component  → ue5 crate (UActorComponent)
@subsystem  → ue5 crate (UWorldSubsystem)
@datatable  → ue5 crate (FTableRowBase)
@slate      → ue5-editor crate (SCompoundWidget)
@details    → ue5-editor crate (IDetailCustomization)
@viewport   → ue5-editor crate (SEditorViewport)
@toolbar    → ue5-editor crate (FToolBarBuilder)
@asset_editor → ue5-editor crate (FAssetEditorToolkit)
@editor_module → ue5-editor crate (IModuleInterface)
@graph_editor  → ue5-graphs crate (UEdGraph)
@graph_runtime → ue5-graphs crate (NodeData, GraphInstance)
shader X       → ue5-shaders crate (.usf + FGlobalShader)
material X     → ue5-materials crate (binary .uasset)
@blueprint     → ue5 crate (UBlueprintFunctionLibrary)
actor X        → ue5 crate (AActor)
enum X         → ue5 crate (UENUM)
struct X       → ue5 crate (USTRUCT)
```

### Crate Dependency Graph

```
kain-core (AST, Types, Effects)
    ↓
    ├─→ ue5           (Runtime)     — independent
    ├─→ ue5-editor    (Editor UI)   — shares Ue5Context with ue5
    ├─→ ue5-graphs    (Graphs)      — independent
    ├─→ ue5-shaders   (Shaders)     — independent
    ├─→ ue5-materials (Materials)    — uses unreal_asset for binary serialization
    ├─→ ue5-blueprints(Blueprints)  — uses unreal_asset for binary serialization
    └─→ cli           (Packager)    — orchestrates ALL crates
```

Each codegen crate is **independent** — they share AST types from `kain-core` but do not depend on each other.

### New Backend Files (Feb 2026)

| File | Crate | Purpose |
|------|-------|---------|
| `kain-core/src/stdlib.rs` | kain-core | `load_stdlib()` — disk-reading stdlib discovery + loading |
| `kain-core/src/stdlib_tests.rs` | kain-core | Unit + property tests for stdlib loading |
| `kain-core/src/diagnostics.rs` | kain-core | `SpanMapper` — span-to-file:line:col for all error messages |
| `ue5-shaders/src/type_mapping.rs` | ue5-shaders | `TypeMapper` — single source of truth for KAIN→HLSL type mappings |
| `ue5/src/stdlib_resolver.rs` | ue5 | Stdlib function resolution in runtime codegen context |
| `ue5/tests/member_access_tests.rs` | ue5 | Tests for UObject pointer vs value type member access |
| `ue5/tests/array_method_tests.rs` | ue5 | Tests for `.len()→.Num()`, `.push()→.Add()` etc. |

### New Codegen Features (Feb 2026)

- **Vector operation codegen** — `floor(v)` on Vec2/Vec3/Vec4 now emits component-wise `FVector(FMath::FloorToFloat(v.X), ...)` instead of scalar call
- **UObject pointer detection** — member access on UObject-derived types correctly uses `->` vs `.` for value types
- **Array method translation** — `.len()→.Num()`, `.push()→.Add()`, `.pop()→.Pop()`, `.clear()→.Empty()`
- **Delegate codegen** — `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*` macros instead of `TFunction`
- **USF array literals** — `[a, b, c]` in shaders now emits `static const float arr[] = {a, b, c}` instead of requiring manual if/else chains
- **USF cast expressions** — `expr as Float` now emits `(float)expr` in HLSL with type compatibility validation
- **TypeMapper** — unified KAIN→HLSL type mapping used by both validator and codegen (no more divergence)
- **SpanMapper** — all errors now report `file:line:col` instead of raw byte offsets
- **Parser error quality** — reserved keyword detection, struct literal detection, `::` vs `.` guidance

### When to Modify Which Crate

| Task | Crate |
|------|-------|
| New language syntax, AST nodes, type rules | `kain-core` |
| Stdlib loading, discovery, file reading | `kain-core/src/stdlib.rs` |
| Error span → file:line:col mapping | `kain-core/src/diagnostics.rs` |
| Actors, components, structs, enums, RPCs, replication | `ue5` |
| Vector ops, array methods, delegate codegen | `ue5/src/codegen_ue5.rs` |
| Slate widgets, details panels, viewports, toolbars | `ue5-editor` |
| Graph editors, graph runtime, node data | `ue5-graphs` |
| .usf shaders, FGlobalShader, dispatch helpers | `ue5-shaders` |
| KAIN→HLSL type mappings (validator + codegen) | `ue5-shaders/src/type_mapping.rs` |
| Material graphs, binary .uasset materials | `ue5-materials` |
| Blueprint .uasset, Kismet bytecode, UK2Node | `ue5-blueprints` |
| Build orchestration, .uplugin, Build.cs, module system | `cli` |
| Stdlib auto-discovery in UE5 pipeline | `cli/src/packager/ue5_pipeline.rs` |
| UE5 type database, widget registry, shader knowledge | `Kain/unreal/metadata/*.json` |
| Plugin extension support (MetaHuman, Niagara, etc.) | `Kain/unreal/metadata/extensions/` |
| Stdlib KAIN source files | `Kain/stdlib/ue5/*.kn` |

---

## Quality Journey — Battle-Tested Against 9 Marketplace Plugins

In Dec 2024, KAIN was battle-tested against 9 real UE5 marketplace plugins ($20-$300). This revealed critical gaps that have since been systematically fixed:

| Bug (Dec 2024) | Affected | Status (Feb 2026) |
|----------------|----------|--------------------|
| Empty Slate Construct() methods | 8/9 plugins | **FIXED** — full SNew() chain generation |
| Details panels missing data binding | 8/9 plugins | **FIXED** — IPropertyHandle + Value_Lambda |
| @component generated USTRUCT not UActorComponent | 6/9 plugins | **FIXED** — proper UCLASS generation |
| Component init missing (CreateDefaultSubobject) | 4/9 plugins | **FIXED** — auto root component + attachment |
| Shader permutations not implemented | 3/9 plugins | **FIXED** — CFG_*/ENABLE_* → SHADER_PERMUTATION_BOOL |
| No UWorldSubsystem generation | 3/9 plugins | **FIXED** — @subsystem + @tick |
| No UEdGraph integration | 1/9 plugins | **FIXED** — full graph editor codegen |
| Wrong IMPLEMENT_MODULE name | 3/9 plugins | **FIXED** — uses plugin name, not struct name |
| No component lifecycle (BeginPlay/Tick) | 3/9 plugins | **FIXED** — @tick, @beginplay |
| No HideCategories meta specifier | 3/9 plugins | **FIXED** — default HideCategories on actors |
| Slider ranges hardcoded | 3/9 plugins | **FIXED** — @slider(min, max) parsed |
| No shader directory mapping | 1/9 plugins | **FIXED** — conditional guard against duplicate assert |

**Quality Score:** 6.1/10 (Dec 2024) → **8.1/10** (Feb 2026)

**Scores by category:**
- Code Structure: 9/10
- UE5 Macro Generation: 9/10
- Networking/Replication: 8/10
- Shader Generation: 9/10 (was 8/10 — TypeMapper, array literals, cast expressions)
- Blueprint Integration: 8/10
- Editor UI: 8/10 (was 7/10 — vector ops, delegate codegen)
- Component Architecture: 8/10 (was 4/10)
- Subsystems: 8/10 (was 0/10)
- Graph Editors: 7/10 (was 0/10)
- Stdlib System: 9/10 (new — 200+ functions, auto-discovery, 1:20 compression)
- Error Diagnostics: 8/10 (new — file:line:col, parser error quality)

---

## Roadmap

**Recently Completed (Feb 2026):** Data-driven stdlib system (200+ functions, auto-discovery, 1:20 compression), vector operation codegen (component-wise floor/frac/abs on Vec2/Vec3/Vec4), UObject pointer detection (`.` vs `->`), array method translation (`.len()→.Num()`), delegate codegen (DECLARE_DYNAMIC_MULTICAST_DELEGATE), USF array literal support, USF cast expression support, TypeMapper (unified KAIN→HLSL), SpanMapper (file:line:col errors), parser error quality improvements, 5-plugin compilation push (VoxelForgePro, Cinema4DMograph, TemporalBlueprint, MetaFitter, Materialize regression).

**Previously Completed:** Details panel property binding, component lifecycle, actor polish, shared shader libraries (.ush), @subsystem + @tick, data-driven validation rules, metadata system (14 JSON files), binary asset pipeline, multi-module plugin system, graph editor codegen.

**In Progress:** Pattern database export, final regression suite across all 25 Factory plugins, GAS integration, Timeline Sequencer, Mesh Manipulation, AI Integration.

---

## Documentation

### Crate-Level References (each crate has a CRATE_REFERENCE.md)
- `Kain/crates/cli/CRATE_REFERENCE.md` — Full CLI command reference
- `Kain/crates/ue5/CRATE_REFERENCE.md` — Runtime codegen (actors, components, RPCs)
- `Kain/crates/ue5-editor/CRATE_REFERENCE.md` — Editor codegen (Slate, Details, Viewports)
- `Kain/crates/ue5-shaders/CRATE_REFERENCE.md` — Shader codegen
- `Kain/crates/ue5-materials/CRATE_REFERENCE.md` — Material graph codegen
- `Kain/crates/ue5-blueprints/CRATE_REFERENCE.md` — Blueprint codegen
- `Kain/docs/CRATE_INDEX.md` — Master index of all crate documentation

### Language & Patterns
- `Kain/docs/recent/README.MD` — V1 compiler documentation (interpreter, WASM, LLVM, SPIR-V, Rust backends)
- `.kiro/steering/kain-patterns.md` — Language patterns and best practices
- `.kiro/steering/llm-first-development.md` — LLM-first development philosophy
- `Kain/docs/recent/PARSER_AST_GUIDE.md` — Parser and AST deep-dive (27KB)
- `Kain/docs/recent/AI_PLUGIN_CREATION_GUIDE.md` — LLM guide for creating plugins (21KB)

### Stdlib
- `Kain/stdlib/ue5/` — 12 stdlib files (200+ functions)
- `Kain/stdlib/USAGE_GUIDE.md` — How to use stdlib in plugins
- `Kain/stdlib/PATTERN_EXTRACTION_GUIDE.md` — How to extract patterns into stdlib
- `Factory/_Docs/STDLIB_BACKEND_RUNDOWN.md` — Backend wiring deep-dive
- `Factory/_Docs/STDLIB_INSPECTION.md` — Current state analysis
- `Factory/_Docs/COMPRESSION_RATIO_ANALYSIS.md` — 1:20 compression methodology
- `Factory/_Docs/STDLIB_VALIDATION_REPORT.md` — Per-function validation results
- `Factory/Stdlib/DESIGN_DOC_STDLIB_EXPANSION.md` — Full expansion spec (200+ files, 24 domains)

### Plugin Compilation
- `Factory/_Docs/MATERIALIZE_BUILD_REPORT.md` — Reference build report (14 files → 415 generated)
- `Factory/_Docs/DESIGN_DOC_PLUGIN_COMPILATION.md` — 5-plugin compilation spec
- `.kiro/specs/plugin-compilation-pipeline/` — Full spec with 32 tasks
- `.kiro/specs/kain-stdlib-backend/` — Backend wiring implementation spec
- `.kiro/specs/kain-stdlib-enhancement/` — Stdlib expansion implementation spec

### Architecture & Research
- `Research/_docs/CODEGEN_ARCHITECTURE_ANALYSIS.md` — Codegen architecture deep-dive (25KB)
- `Research/_docs/FINALSUMMARY.md` — Marketplace battle analysis (33KB, historical)
- `Research/_docs/IMPLEMENTATION_TASKS.md` — Sprint history and quality tracking
- `Research/ReferencePatterns/` — 29 UE5 pattern taxonomies
- `.kiro/specs/` — 9 implementation specs with 2500+ completed tasks

### Systems
- `PACKAGER_MODULE_SYSTEM_SUMMARY.md` — Multi-module plugin system
- `Kain/unreal/metadata/extensions/README.md` — Extension system guide
- `Kain/docs/recent/BINARY_ASSET_PIPELINE.md` — Binary .uasset pipeline (20KB)
- `Kain/docs/recent/UE5_BUILD_SYSTEM.md` — UE5 build system integration (16KB)
- `Kain/docs/recent/METADATA_HOTRELOAD.md` — Metadata hot-reload system (14KB)
- `Kain/docs/recent/DATA_DRIVEN_PIPELINE.md` — Data-driven pipeline architecture (29KB)


## Note
Kain.exe is symbolically linked to the target/release folder in our directory. When working on the backend, as long as you run cargo build, the kain.exe will always be up to date !

-ALSO TODO`s, simplification, and shortcuts are not allowed. We need full implementations only. This is a hard rule and there will be no exceptions. The word TODO is not allowed along with "simplifying". Any TODO impedes progress on this codebase as it is hard to manage everything. There is only one human working on this codebase and he cannot keep up with TODO`s efficiently in a 100,000 LOC codebase.