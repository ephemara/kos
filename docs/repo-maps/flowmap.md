# K_OS Flow Map

- Directory: `M:\K_OS`
- Generated (UTC): `2026-04-07T04:00:08.926301+00:00`
- Languages: `JSON, Markdown, Python, Rust, TOML, TSX, TypeScript`
- Entry files: `src-frontend/App.tsx, src-tauri/src/main.rs, Cargo.toml, src-tauri/Cargo.toml`
- Manifests: `cargo, cargo, npm, cargo, npm, cargo, cargo, cargo, cargo, cargo, cargo, cargo`
- Additional manifests omitted from markdown: `41`

```mermaid
flowchart LR
  dir_dir["K_OS"]
  dir_crates["crates"]
  dir_src_mocap["src-mocap"]
  dir_src_frontend["src-frontend"]
  dir_src_python["src-python"]
  dir_kain["kain"]
  dir_test_docgen["test-docgen"]
  file_src_frontend_app_tsx["src-frontend/App.tsx"]
  file_src_tauri_src_main_rs["src-tauri/src/main.rs"]
  file_cargo_toml["Cargo.toml"]
  file_src_tauri_cargo_toml["src-tauri/Cargo.toml"]
  lane_frontend_react_lane["Frontend / React lane"]
  lane_tauri_desktop_lane["Tauri desktop lane"]
  lane_gpu_shader_lane["GPU / shader lane"]
  lane_unreal_lane["Unreal lane"]
  lane_interop_ffi_lane["Interop / FFI lane"]
  lane_web_wasm_lane["Web / WASM lane"]
  dir_dir -->|entrypoint| file_cargo_toml
  dir_dir -->|entrypoint| file_src_frontend_app_tsx
  dir_dir -->|entrypoint| file_src_tauri_cargo_toml
  dir_dir -->|entrypoint| file_src_tauri_src_main_rs
  file_cargo_toml -->|targets| lane_gpu_shader_lane
  file_cargo_toml -->|targets| lane_tauri_desktop_lane
  file_cargo_toml -->|targets| lane_web_wasm_lane
  file_src_frontend_app_tsx -->|targets| lane_frontend_react_lane
  file_src_frontend_app_tsx -->|targets| lane_gpu_shader_lane
  file_src_frontend_app_tsx -->|targets| lane_interop_ffi_lane
  file_src_frontend_app_tsx -->|targets| lane_tauri_desktop_lane
  file_src_frontend_app_tsx -->|targets| lane_unreal_lane
  file_src_tauri_cargo_toml -->|targets| lane_gpu_shader_lane
  file_src_tauri_cargo_toml -->|targets| lane_tauri_desktop_lane
  file_src_tauri_src_main_rs -->|targets| lane_frontend_react_lane
  file_src_tauri_src_main_rs -->|targets| lane_gpu_shader_lane
  file_src_tauri_src_main_rs -->|targets| lane_interop_ffi_lane
  file_src_tauri_src_main_rs -->|targets| lane_tauri_desktop_lane
  file_src_tauri_src_main_rs -->|targets| lane_web_wasm_lane
  dir_dir -->|supports| lane_web_wasm_lane
  dir_dir -->|contains| dir_crates
  dir_dir -->|contains| dir_kain
  dir_dir -->|contains| dir_src_frontend
  dir_dir -->|contains| dir_src_mocap
  dir_dir -->|contains| dir_src_python
  dir_dir -->|contains| dir_test_docgen
```

## Manifest Summary
- `Cargo.toml`: cargo, workspace members: 45, deps: 0
- `src-tauri/Cargo.toml`: cargo, deps: 42
- `package.json`: npm, deps: 152, scripts: 19
- `test-docgen/Cargo.toml`: cargo, deps: 3
- `public/wasm/package.json`: npm, deps: 0, scripts: 0
- `crates/k-os-animation/Cargo.toml`: cargo, deps: 1
- `crates/k-os-asset-pipeline/Cargo.toml`: cargo, deps: 12
- `crates/k-os-baking/Cargo.toml`: cargo, deps: 13
- `crates/k-os-bevy/Cargo.toml`: cargo, deps: 29
- `crates/k-os-bevy-lab/Cargo.toml`: cargo, deps: 30
- `crates/k-os-brushes/Cargo.toml`: cargo, deps: 12
- `crates/k-os-config/Cargo.toml`: cargo, deps: 11

## Edge Legend
- `entrypoint`: root directory to a main entry file or manifest.
- `supports`: root or file contributes to a lane or helper surface.
- `imports`: file-to-file or file-to-subdir reference discovered from source text.
- `targets`: file participates in a platform lane such as Tauri, Unreal, GPU, or Python.
- `emits sidecar`: file materializes a named artifact or sidecar bundle.
