# Integration Registry

- Packages: 47
- Host API packages: 3
- Integration packages: 28
- Internal packages: 16

## Recommended Integration Surfaces
- `k-os-backend`: tier host-api, adapters [tauri], entrypoints []
- `k-os-bevy`: tier host-api, adapters [bevy], entrypoints [crate::ImportGltfEvent]
- `zen`: tier host-api, adapters [zen], entrypoints []
- `k-os-baking`: tier integration, adapters [external], entrypoints [crate::Aabb, crate::AoBaker, crate::BakeMesh, crate::BakeSettings, crate::BakingError, crate::BakingSystem]
- `k-os-brushes`: tier integration, adapters [external, tauri], entrypoints [crate::AlphaSlot, crate::BRUSH_LIBRARY, crate::BrushCurve, crate::BrushKernel, crate::BrushParams, crate::BrushParamsGpu]
- `k-os-config`: tier integration, adapters [external, tauri], entrypoints [crate::*]
- `k-os-external`: tier integration, adapters [external, tauri], entrypoints [crate::*]
- `k-os-game-runtime`: tier integration, adapters [bevy, external, tauri], entrypoints [crate::build_execution_plan, crate::execute_plan_with_builtin_adapters, crate::load_manifest_from_file, crate::run_preflight_checks]
- `k-os-gpu-pipeline`: tier integration, adapters [bevy, external, tauri, zen], entrypoints [crate::GpuComputeDevice, crate::GpuMeshBridge, crate::GpuNormalCompute, crate::GpuSculptCompute, crate::gpu]
- `k-os-hdr`: tier integration, adapters [external], entrypoints [crate::*]
- `k-os-io`: tier integration, adapters [external, tauri], entrypoints [crate::Asset, crate::AssetHandle, crate::AssetMetadata, crate::AssetQuery, crate::AssetType, crate::StorageBackend]
- `k-os-kain`: tier integration, adapters [external, tauri, zen], entrypoints [crate::build_file, crate::compile_source, crate::generated_runtime_app_by_id, crate::generated_spirv_by_id, crate::list_runtime_apps, crate::list_sources]
- `k-os-material`: tier integration, adapters [external], entrypoints [crate::AlphaMode, crate::ClearcoatExtension, crate::Material, crate::MaterialError, crate::MaterialLibrary, crate::MaterialPreset]
- `k-os-photogrammetry`: tier integration, adapters [external], entrypoints [crate::*]
- `k-os-renderer`: tier integration, adapters [external], entrypoints [crate::BridgeError, crate::CameraState, crate::DirectRendererUploadBridge, crate::DispatchTopology, crate::DrawPacket, crate::EvaluatedMeshSource]
- `k-os-scatter`: tier integration, adapters [external, tauri], entrypoints [crate::cluster_scatter, crate::fibonacci_spiral_scatter, crate::halton_scatter, crate::organic_scatter, crate::physics_drop_scatter, crate::poisson_disk_scatter]
