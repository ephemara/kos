# K_OS/crates Flow Map

- Directory: `M:\K_OS\crates`
- Generated (UTC): `2026-03-27T20:00:27.321994+00:00`
- Languages: `JSON, Markdown, Rust, TOML`
- Entry files: `zen/src/main.rs, k-os-bevy/src/main.rs, k-os-bevy-lab/src/main.rs, zen-scene/src/lib.rs`
- Manifests: `cargo, cargo, cargo, cargo, cargo, cargo, cargo, cargo, cargo, cargo, cargo, cargo`
- Additional manifests omitted from markdown: `37`

```mermaid
flowchart LR
  dir_dir["K_OS/crates"]
  dir_k_os_gpu_pipeline["k-os-gpu-pipeline"]
  dir_k_os_asset_pipeline["k-os-asset-pipeline"]
  dir_k_os_baking["k-os-baking"]
  dir_k_os_kain["k-os-kain"]
  dir_k_os_material["k-os-material"]
  dir_k_os_bevy_lab["k-os-bevy-lab"]
  file_zen_src_main_rs["zen/src/main.rs"]
  file_k_os_bevy_src_main_rs["k-os-bevy/src/main.rs"]
  file_k_os_bevy_lab_src_main_rs["k-os-bevy-lab/src/main.rs"]
  file_zen_scene_src_lib_rs["zen-scene/src/lib.rs"]
  file_k_os_gizmo_src_prelude_rs["k-os-gizmo/src/prelude.rs"]
  file_k_os_bevy_src_leash_rs["k-os-bevy/src/leash.rs"]
  file_k_os_bevy_lab_src_leash_rs["k-os-bevy-lab/src/leash.rs"]
  file_k_os_bevy_src_asset_browser_rs["k-os-bevy/src/asset_browser.rs"]
  file_k_os_bevy_lab_src_asset_browser_rs["k-os-bevy-lab/src/asset_browser.rs"]
  file_k_os_bevy_src_camera_experimental_rs["k-os-bevy/src/camera_experimental.rs"]
  lane_gpu_shader_lane["GPU / shader lane"]
  lane_interop_ffi_lane["Interop / FFI lane"]
  lane_frontend_react_lane["Frontend / React lane"]
  lane_tauri_desktop_lane["Tauri desktop lane"]
  lane_node_ts_host_lane["Node / TS host lane"]
  lane_unreal_lane["Unreal lane"]
  dir_dir -->|entrypoint| file_k_os_bevy_lab_src_main_rs
  dir_dir -->|entrypoint| file_k_os_bevy_src_main_rs
  dir_dir -->|entrypoint| file_zen_scene_src_lib_rs
  dir_dir -->|entrypoint| file_zen_src_main_rs
  file_k_os_bevy_lab_src_asset_browser_rs -->|targets| lane_frontend_react_lane
  file_k_os_bevy_lab_src_asset_browser_rs -->|targets| lane_unreal_lane
  file_k_os_bevy_lab_src_leash_rs -->|targets| lane_frontend_react_lane
  file_k_os_bevy_lab_src_leash_rs -->|targets| lane_tauri_desktop_lane
  file_k_os_bevy_lab_src_main_rs -->|targets| lane_frontend_react_lane
  file_k_os_bevy_lab_src_main_rs -->|targets| lane_gpu_shader_lane
  file_k_os_bevy_lab_src_main_rs -->|targets| lane_node_ts_host_lane
  file_k_os_bevy_lab_src_main_rs -->|targets| lane_tauri_desktop_lane
  file_k_os_bevy_src_asset_browser_rs -->|targets| lane_frontend_react_lane
  file_k_os_bevy_src_asset_browser_rs -->|targets| lane_unreal_lane
  file_k_os_bevy_src_leash_rs -->|targets| lane_frontend_react_lane
  file_k_os_bevy_src_leash_rs -->|targets| lane_tauri_desktop_lane
  file_k_os_bevy_src_main_rs -->|targets| lane_frontend_react_lane
  file_k_os_bevy_src_main_rs -->|targets| lane_gpu_shader_lane
  file_k_os_bevy_src_main_rs -->|targets| lane_node_ts_host_lane
  file_k_os_bevy_src_main_rs -->|targets| lane_tauri_desktop_lane
  file_zen_scene_src_lib_rs -->|targets| lane_gpu_shader_lane
  file_zen_scene_src_lib_rs -->|targets| lane_node_ts_host_lane
  file_zen_src_main_rs -->|targets| lane_gpu_shader_lane
  file_zen_src_main_rs -->|targets| lane_interop_ffi_lane
  file_k_os_bevy_lab_src_asset_browser_rs -->|imports| file_k_os_gizmo_src_prelude_rs
  file_k_os_bevy_lab_src_main_rs -->|imports| file_k_os_bevy_src_asset_browser_rs
  file_k_os_bevy_lab_src_main_rs -->|imports| file_k_os_bevy_src_camera_experimental_rs
  file_k_os_bevy_lab_src_main_rs -->|imports| file_k_os_bevy_src_leash_rs
```

## Manifest Summary
- `k-os-animation/Cargo.toml`: cargo, deps: 1
- `k-os-asset-pipeline/Cargo.toml`: cargo, deps: 12
- `k-os-baking/Cargo.toml`: cargo, deps: 13
- `k-os-bevy/Cargo.toml`: cargo, deps: 29
- `k-os-bevy-lab/Cargo.toml`: cargo, deps: 30
- `k-os-brushes/Cargo.toml`: cargo, deps: 12
- `k-os-config/Cargo.toml`: cargo, deps: 11
- `k-os-eval/Cargo.toml`: cargo, deps: 9
- `k-os-external/Cargo.toml`: cargo, deps: 4
- `k-os-game-ai/Cargo.toml`: cargo, deps: 3
- `k-os-game-camera/Cargo.toml`: cargo, deps: 3
- `k-os-game-framework/Cargo.toml`: cargo, deps: 3

## Edge Legend
- `entrypoint`: root directory to a main entry file or manifest.
- `supports`: root or file contributes to a lane or helper surface.
- `imports`: file-to-file or file-to-subdir reference discovered from source text.
- `targets`: file participates in a platform lane such as Tauri, Unreal, GPU, or Python.
- `emits sidecar`: file materializes a named artifact or sidecar bundle.
