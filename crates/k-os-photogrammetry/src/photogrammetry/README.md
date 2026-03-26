# Photogrammetry Pipeline

Multi-angle photo reconstruction system for 3D capture and PBR material generation.

## Features

- **Feature Detection**: AKAZE algorithm for robust keypoint extraction
- **Feature Matching**: RANSAC-based outlier filtering
- **3D Reconstruction**: Structure from Motion (SfM) pipeline
- **Mesh Generation**: Poisson surface reconstruction via Open3D
- **Texture Projection**: GPU-accelerated multi-view blending
- **PBR Extraction**: Automatic generation of 6 PBR maps with renderer-facing contract validation

## Quick Start

### Enable Feature

Add to `Cargo.toml`:
```toml
[features]
default = ["photogrammetry"]
```

Or build with:
```bash
cargo build --features photogrammetry
```

### Basic Usage

```rust
use k_os_photogrammetry::{PhotogrammetryPipeline, PhotogrammetryInput};

let pipeline = PhotogrammetryPipeline::new(gpu_compute)?;

let input = PhotogrammetryInput {
    images: vec![/* ImageData */],
    camera_intrinsics: None,
    options: ReconstructionOptions::default(),
};

let output = pipeline.reconstruct(input)?;
```

### Python Integration

Install dependencies:
```bash
pip install open3d numpy
```

Use RPC functions:
```python
from kos.autopbr.photogrammetry_helper import poisson_surface_reconstruction

mesh = poisson_surface_reconstruction(
    points=point_cloud.points,
    normals=point_cloud.normals,
    colors=point_cloud.colors,
    depth=9
)
```

## Architecture

```
Input Images (2-500)
    ↓
Feature Detection (AKAZE)
    ↓
Feature Matching (RANSAC)
    ↓
Camera Pose Estimation (SfM)
    ↓
Point Cloud Generation (Triangulation)
    ↓
Mesh Generation (Poisson - Python/Open3D)
    ↓
Texture Projection (GPU Shader)
    ↓
PBR Map Extraction
    ↓
Output: Mesh + PBR Maps
```

## Configuration

```rust
ReconstructionOptions {
    use_gpu: true,              // Enable GPU acceleration
    max_features: 10000,        // Max features per image
    min_matches: 50,            // Min matches required
    mesh_quality: 0.8,          // Quality (0.0-1.0)
    texture_resolution: 4096,   // Output texture size
}
```

## Performance

- **Feature Detection**: ~100ms per image (parallel)
- **Feature Matching**: ~50ms per image pair
- **Mesh Generation**: ~2-5s for 1000 points (Python/Open3D)
- **Texture Projection**: ~100ms for 4K texture (GPU)

## Requirements

### Rust Dependencies
- `akaze` - Feature detection
- `kdtree` - Spatial indexing
- `svd` - Matrix decomposition
- `nalgebra` - Linear algebra
- `rayon` - Parallel processing

### Python Dependencies
- `open3d` - Mesh processing
- `numpy` - Numerical operations

## Limitations

Current implementation has simplified algorithms for:
- Bundle adjustment (TODO: iterative refinement)
- Mesh generation fallback still uses an interim compatibility path for sparse point clouds
- PBR maps still rely on heuristic generation for roughness/metallic and uniform defaults for AO/height
- Normal map extraction now uses geometry-informed UV baking with configured flat-normal fallback for unsampled texels

These are marked with TODO comments and will be implemented for production use.

## Testing

Run tests:
```bash
cargo test --features photogrammetry
```

Test Python functions:
```bash
python src-python/kos/autopbr/photogrammetry_helper.py
```

## See Also

- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Detailed implementation notes
- [PRODUCTIONIZATION_BACKLOG.md](./PRODUCTIONIZATION_BACKLOG.md) - Prioritized algorithm/integration/test backlog
- [Design Document](../../../.kiro/specs/kautopbr-substance-parity-plus/design.md)
- [Requirements](../../../.kiro/specs/kautopbr-substance-parity-plus/requirements.md)
