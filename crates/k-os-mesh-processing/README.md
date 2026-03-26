# k-os-mesh-processing

Advanced mesh processing operations for K_OS DCC Suite including decimation, smoothing, subdivision, repair, analysis, and UV unwrapping.

## Features

- **Mesh Decimation**: Reduce polygon count while preserving shape (edge collapse, vertex clustering)
- **Mesh Smoothing**: Laplacian, Taubin, and HC smoothing algorithms
- **Mesh Subdivision**: Catmull-Clark (quads) and Loop (triangles) subdivision
- **Mesh Repair**: Fix non-manifold geometry, fill holes, remove duplicates, weld vertices
- **Mesh Analysis**: Quality metrics, topology validation, manifold checking, self-intersection detection
- **UV Unwrapping**: Automatic UV generation using xatlas (conformal, angle-based)
- **Mesh Optimization**: Vertex cache optimization, overdraw reduction, index buffer generation
- **Spatial Queries**: KD-tree for nearest neighbor, BVH for ray tracing

## Usage

### Mesh Decimation

```rust
use k_os_mesh_processing::{Mesh, decimation};

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Decimate to 50% of original polygon count
let decimated = decimation::decimate(&mesh, 0.5)?;

// Decimate to target triangle count
let decimated = decimation::decimate_to_count(&mesh, 1000)?;

// Decimate with quality threshold
let decimated = decimation::decimate_adaptive(&mesh, 0.01)?;
```

### Mesh Smoothing

```rust
use k_os_mesh_processing::{Mesh, smoothing};

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Laplacian smoothing
let smoothed = smoothing::laplacian(&mesh, 5, 0.5)?;

// Taubin smoothing (better shape preservation)
let smoothed = smoothing::taubin(&mesh, 10, 0.5, -0.53)?;

// HC smoothing (high-quality)
let smoothed = smoothing::hc(&mesh, 5, 0.5, 0.5)?;
```

### Mesh Subdivision

```rust
use k_os_mesh_processing::{Mesh, subdivision};

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Catmull-Clark subdivision (for quads)
let subdivided = subdivision::catmull_clark(&mesh, 2)?;

// Loop subdivision (for triangles)
let subdivided = subdivision::loop_subdivision(&mesh, 2)?;

// Simple subdivision (midpoint)
let subdivided = subdivision::simple(&mesh, 1)?;
```

### Mesh Repair

```rust
use k_os_mesh_processing::{Mesh, repair};

let mut mesh = Mesh::from_vertices_indices(vertices, indices);

// Fix non-manifold edges
repair::fix_non_manifold(&mut mesh)?;

// Fill holes smaller than max_edges
repair::fill_holes(&mut mesh, 10)?;

// Remove duplicate vertices within threshold
repair::remove_duplicates(&mut mesh, 0.0001)?;

// Weld vertices within distance
repair::weld_vertices(&mut mesh, 0.001)?;

// Remove degenerate triangles
repair::remove_degenerate(&mut mesh)?;

// Complete repair pipeline
repair::repair_all(&mut mesh)?;
```

### Mesh Analysis

```rust
use k_os_mesh_processing::{Mesh, analysis};

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Check if mesh is manifold
let is_manifold = analysis::is_manifold(&mesh);

// Get topology report
let report = analysis::analyze_topology(&mesh);
println!("Vertices: {}", report.vertex_count);
println!("Triangles: {}", report.triangle_count);
println!("Edges: {}", report.edge_count);
println!("Boundary edges: {}", report.boundary_edge_count);
println!("Non-manifold edges: {}", report.non_manifold_edges.len());

// Detect self-intersections
let intersections = analysis::detect_self_intersections(&mesh);

// Calculate quality metrics
let metrics = analysis::quality_metrics(&mesh);
println!("Min triangle quality: {}", metrics.min_triangle_quality);
println!("Avg triangle quality: {}", metrics.avg_triangle_quality);
println!("Aspect ratio: {}", metrics.avg_aspect_ratio);
```

### UV Unwrapping

```rust
use k_os_mesh_processing::{Mesh, uv};

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Automatic UV unwrapping with xatlas
let uvs = uv::unwrap(&mesh)?;

// UV unwrapping with custom settings
let settings = uv::UnwrapSettings {
    max_chart_size: 0,
    max_iterations: 1,
    texels_per_unit: 0.0,
    padding: 2,
    ..Default::default()
};
let uvs = uv::unwrap_with_settings(&mesh, &settings)?;

// Apply UVs to mesh
let mut mesh_with_uvs = mesh.clone();
mesh_with_uvs.set_uvs(uvs);
```

### Mesh Optimization

```rust
use k_os_mesh_processing::{Mesh, optimization};

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Optimize vertex cache for better GPU performance
let optimized = optimization::optimize_vertex_cache(&mesh)?;

// Optimize overdraw
let optimized = optimization::optimize_overdraw(&mesh, 1.05)?;

// Generate optimal index buffer
let optimized = optimization::optimize_vertex_fetch(&mesh)?;

// Complete optimization pipeline
let optimized = optimization::optimize_all(&mesh)?;
```

### Spatial Queries

```rust
use k_os_mesh_processing::{Mesh, spatial};
use glam::Vec3;

let mesh = Mesh::from_vertices_indices(vertices, indices);

// Build KD-tree for nearest neighbor queries
let kdtree = spatial::build_kdtree(&mesh);
let nearest = kdtree.nearest(&Vec3::new(1.0, 2.0, 3.0))?;

// Build BVH for ray tracing
let bvh = spatial::build_bvh(&mesh);
let ray_origin = Vec3::new(0.0, 0.0, 0.0);
let ray_dir = Vec3::new(0.0, 0.0, 1.0);
if let Some(hit) = bvh.raycast(ray_origin, ray_dir, 100.0) {
    println!("Hit at distance: {}", hit.distance);
    println!("Hit triangle: {}", hit.triangle_index);
}
```

## Mesh Data Structure

The crate uses a flexible half-edge mesh representation:

```rust
pub struct Mesh {
    pub vertices: Vec<Vertex>,
    pub indices: Vec<u32>,
    pub normals: Option<Vec<Vec3>>,
    pub uvs: Option<Vec<Vec2>>,
    pub colors: Option<Vec<Vec4>>,
}

pub struct Vertex {
    pub position: Vec3,
}
```

## Algorithms

### Decimation
- **Edge Collapse**: Iteratively collapse edges with minimal error
- **Vertex Clustering**: Spatial clustering with representative vertices
- **Quadric Error Metrics**: Preserve surface features during decimation

### Smoothing
- **Laplacian**: Simple averaging of neighbor positions
- **Taubin**: Two-step smoothing (inflate/deflate) to prevent shrinkage
- **HC**: High-quality smoothing with better feature preservation

### Subdivision
- **Catmull-Clark**: Smooth subdivision for quad meshes
- **Loop**: Smooth subdivision for triangle meshes
- **Simple**: Midpoint subdivision (no smoothing)

### Repair
- **Non-Manifold Fix**: Split non-manifold vertices and edges
- **Hole Filling**: Triangulate boundary loops
- **Duplicate Removal**: Merge vertices within threshold
- **Degenerate Removal**: Remove zero-area triangles

### Analysis
- **Manifold Check**: Verify each edge has exactly 2 adjacent faces
- **Self-Intersection**: BVH-accelerated triangle-triangle tests
- **Quality Metrics**: Triangle quality, aspect ratio, edge length stats

## Performance

- **Parallel Processing**: Uses Rayon for multi-threaded operations
- **Spatial Acceleration**: KD-tree and BVH for O(log n) queries
- **Memory Efficient**: Streaming algorithms for large meshes
- **GPU Ready**: Mesh format compatible with GPU buffers

## Integration with K_OS

This crate integrates with:
- **k-os-engine**: Core mesh types and GPU pipelines
- **k-os-asset-pipeline**: Mesh import/export
- **KSculpt**: Remeshing and optimization
- **KRetopo**: Auto-retopology and quad remeshing
- **KBake**: Mesh analysis for baking

## Dependencies

- `meshopt` - Industry-standard mesh optimization
- `xatlas-rs` - High-quality UV unwrapping
- `nalgebra` - Linear algebra and geometry
- `parry3d` - Collision detection and spatial queries
- `kiddo` - Fast KD-tree implementation
- `bvh` - Bounding volume hierarchy
- `rayon` - Parallel processing

## License

Part of the K_OS DCC Suite project.
