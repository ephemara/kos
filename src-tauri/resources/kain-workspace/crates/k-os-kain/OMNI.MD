KAIN OMNI - Universal Multi-Target Build System
KAIN Omni is a manifest-based orchestration layer that lets you write ONE .kn file and compile to TypeScript, Rust, SPIR-V, C++, HLSL, USF, and more - all from a single KAIN.omni.toml config.

CLI Commands
# Initialize a new omni project
kain omni init
kain omni init ./my-project

# Build from manifest
kain omni build
kain omni build --manifest KAIN.omni.toml
kain omni build -m custom.omni.toml
Example 1: Multi-Target Material System
Create KAIN.omni.toml:

[project]
entry = "material_pbr_standard.kn"
build_dir = "material_bundle"

# Import TypeScript types
[[imports]]
path = "src/types.ts"
language = "typescript"
output = "material_bundle/staged/types.kn"

# Import Rust wgpu helpers
[[imports]]
path = "src/wgpu_helpers.rs"
language = "rust"
output = "material_bundle/staged/wgpu.kn"
flat = true

# Target 1: SPIR-V shader
[[targets]]
kind = "spirv"
output = "material_bundle/material_pbr_standard.spv"

# Target 2: Rust with GPU artifacts
[[targets]]
kind = "rust_bundle"
output = "material_bundle/material_pbr_standard.rs"

[targets.rust_bundle]
artifacts = ["source", "shader_host", "shader_reflection", "spirv"]

# Target 3: TypeScript bindings
[[targets]]
kind = "ts"
output = "material_bundle/material_pbr_standard.ts"

# Target 4: HLSL for DirectX
[[targets]]
kind = "hlsl"
output = "material_bundle/material_pbr_standard.hlsl"
Run:

kain omni build
Output:

material_pbr_standard.spv
 - SPIR-V binary
material_pbr_standard.rs
 - Rust source
material_pbr_standard.gpu.rs
 - GPU host wrappers
material_pbr_standard.reflect.json
 - Reflection metadata
material_pbr_standard.ts
 - TypeScript bindings
material_pbr_standard.hlsl
 - DirectX shader
Example 2: Full-Stack Web App
[project]
entry = "app.kn"
build_dir = "dist"

# Import existing TypeScript frontend
[[imports]]
path = "src/frontend"
language = "typescript"
recursive = true
flat = false

# Import Rust backend
[[imports]]
path = "src/backend"
language = "rust"
recursive = true

# Target 1: WASM for browser
[[targets]]
kind = "wasm"
output = "dist/app.wasm"

# Target 2: TypeScript for Node.js
[[targets]]
kind = "ts"
output = "dist/server.ts"

# Target 3: KainScript (no-compile JS)
[[targets]]
kind = "ks"
output = "dist/app.ks"
Example 3: UE5 Plugin with Shaders
[project]
entry = "ue5_plugin.kn"
build_dir = "Plugins/MyPlugin"

# Import C++ UE5 headers
[[imports]]
path = "Source/ThirdParty/include"
language = "c"
recursive = true
include_paths = ["C:/Program Files/Epic Games/UE_5.3/Engine/Source"]

# Target 1: UE5 C++ runtime
[[targets]]
kind = "ue5"
output = "Plugins/MyPlugin/Source/MyPlugin/Public/MyPlugin.h"

# Target 2: UE5 Editor tools
[[targets]]
kind = "ue5_editor"
output = "Plugins/MyPlugin/Source/MyPluginEditor/Public/MyPluginEditor.h"

# Target 3: USF shaders
[[targets]]
kind = "usf"
output = "Plugins/MyPlugin/Shaders/MyShader.usf"
Supported Import Languages
Language	Extensions	Options
kain-omni
.kn	Direct copy
rust	.rs	flat, recursive
typescript	.ts, .tsx, .mts, .cts	flat, recursive
kain-omni
.c, .h	include_paths, defines
asm	.asm	asm_format (gameboy, 6502, z80)
Supported Target Kinds
Kind	Output	Description
rust	.rs	Rust source code
js	.js	JavaScript (ES2022)
ts	.ts	TypeScript with types
ks	.ks	KainScript (no-compile JS with JSDoc)
cpp	.cpp	C++ source
hlsl	.hlsl	DirectX shaders
usf	.usf	Unreal Engine shaders
spirv	.spv	SPIR-V binary
gpu_artifacts	Multiple	SPIR-V + Rust host + reflection JSON
rust_bundle	Multiple	Rust + optional GPU artifacts
ue5	.h	UE5 C++ runtime plugin
ue5_editor	.h	UE5 editor tools
Advanced: Import Resolution
[import_resolution]
# Search paths for resolving KAIN imports
search_roots = ["./lib", "./vendor"]

# Inline all KAIN imports into single file (default: true)
inline_kain_imports = true
Advanced: Rust Bundle Configuration
[[targets]]
kind = "rust_bundle"
output = "dist/shader.rs"

[targets.rust_bundle]
output = "dist/shader_bundle"  # Override output directory
artifacts = ["source", "shader_host", "shader_reflection", "spirv"]
Artifacts:

source - Rust source (.rs)
shader_host - GPU dispatch helpers (.gpu.rs)
shader_reflection - Reflection metadata (.reflect.json)
spirv - SPIR-V binary (.spv)