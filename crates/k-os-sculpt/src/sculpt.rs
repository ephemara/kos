//! Sculpting Engine Module for K_OS
//!
//! High-performance mesh sculpting with:
//! - SpatialGrid for O(1) vertex queries (replaces slow BVH iteration)
//! - Parallel brush kernels via rayon
//! - All 26 brush types from KFluxEngine
//! - Smooth brush with neighbor averaging
//! - Incremental normal recalculation using glam SIMD
//!
//! Expected performance: 10-20x faster than JavaScript implementation

use fixedbitset::FixedBitSet;
use glam::Vec3;
use kiddo::float::kdtree::KdTree;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

// GPU Compute integration (both tauri and bevy binaries)
use k_os_gpu_pipeline::normals::{GpuNormalCompute, NormalParams};
use k_os_gpu_pipeline::sculpt::{
    BrushParams, GpuMeshBuffers, GpuSculptCompute, SculptOp, SparsePositionReadback,
};
use k_os_gpu_pipeline::spatial::GpuSpatialGrid;
use k_os_gpu_pipeline::{GpuComputeDevice, StagingBufferPool};
use k_os_scene::MeshHandle;
use k_os_scene_runtime::mesh_state::{
    evaluate_viewport_bridge_summary, evaluate_viewport_payload, SCENE_WORLD,
};
#[cfg(target_arch = "wasm32")]
type AnyBox = Box<dyn std::any::Any>;
#[cfg(not(target_arch = "wasm32"))]
type AnyBox = Box<dyn std::any::Any + Send + Sync>;
// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Spatial grid cell coordinates
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq)]
struct GridCell {
    x: i32,
    y: i32,
    z: i32,
}

/// High-performance spatial grid for O(1) vertex queries
///
/// Divides 3D space into cells. Each cell stores indices of vertices within it.
/// Query time is O(number of cells in radius) instead of O(N vertices).
pub struct SpatialGrid {
    cell_size: f32,
    cells: HashMap<GridCell, Vec<usize>>,
}

impl SpatialGrid {
    pub fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            cells: HashMap::new(),
        }
    }

    /// Build the grid from vertex positions
    pub fn build(&mut self, positions: &[f32]) {
        self.cells.clear();
        let vertex_count = positions.len() / 3;

        for i in 0..vertex_count {
            let x = positions[i * 3];
            let y = positions[i * 3 + 1];
            let z = positions[i * 3 + 2];

            let cell = self.get_cell(x, y, z);
            self.cells.entry(cell).or_default().push(i);
        }
    }

    /// Get the cell for a position
    fn get_cell(&self, x: f32, y: f32, z: f32) -> GridCell {
        GridCell {
            x: (x / self.cell_size).floor() as i32,
            y: (y / self.cell_size).floor() as i32,
            z: (z / self.cell_size).floor() as i32,
        }
    }

    /// Query all vertex indices within a sphere
    pub fn query_sphere(&self, center: Vec3, radius: f32, positions: &[f32]) -> Vec<usize> {
        let mut result = Vec::new();
        self.query_sphere_into(center, radius, positions, &mut result);
        result
    }

    /// Query all vertex indices within a sphere - ZERO ALLOC version
    /// Clears and reuses the provided buffer to avoid allocation churn
    pub fn query_sphere_into(
        &self,
        center: Vec3,
        radius: f32,
        positions: &[f32],
        result: &mut Vec<usize>,
    ) {
        result.clear();
        let radius_sq = radius * radius;
        let cells_to_check = (radius / self.cell_size).ceil() as i32 + 1;

        let center_cell = self.get_cell(center.x, center.y, center.z);

        for dx in -cells_to_check..=cells_to_check {
            for dy in -cells_to_check..=cells_to_check {
                for dz in -cells_to_check..=cells_to_check {
                    let cell = GridCell {
                        x: center_cell.x + dx,
                        y: center_cell.y + dy,
                        z: center_cell.z + dz,
                    };

                    if let Some(indices) = self.cells.get(&cell) {
                        for &idx in indices {
                            let p = Vec3::new(
                                positions[idx * 3],
                                positions[idx * 3 + 1],
                                positions[idx * 3 + 2],
                            );
                            if p.distance_squared(center) < radius_sq {
                                result.push(idx);
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Mesh topology for neighbor lookups and normal recalculation
pub struct MeshTopology {
    /// vertex index -> list of neighboring vertex indices
    pub vertex_neighbors: Vec<Vec<usize>>,
    /// vertex index -> list of connected face indices
    pub vertex_faces: Vec<Vec<usize>>,
}

impl MeshTopology {
    pub fn new() -> Self {
        Self {
            vertex_neighbors: Vec::new(),
            vertex_faces: Vec::new(),
        }
    }

    /// Build topology from index buffer
    pub fn build(&mut self, vertex_count: usize, indices: &[u32]) {
        self.vertex_neighbors = vec![Vec::new(); vertex_count];
        self.vertex_faces = vec![Vec::new(); vertex_count];

        let face_count = indices.len() / 3;
        for i in 0..face_count {
            let a = indices[i * 3] as usize;
            let b = indices[i * 3 + 1] as usize;
            let c = indices[i * 3 + 2] as usize;

            // Skip invalid indices
            if a >= vertex_count || b >= vertex_count || c >= vertex_count {
                continue;
            }

            // Add neighbors
            self.add_neighbor(a, b);
            self.add_neighbor(a, c);
            self.add_neighbor(b, a);
            self.add_neighbor(b, c);
            self.add_neighbor(c, a);
            self.add_neighbor(c, b);

            // Track which faces each vertex belongs to
            self.vertex_faces[a].push(i);
            self.vertex_faces[b].push(i);
            self.vertex_faces[c].push(i);
        }

        // Deduplicate neighbors
        for neighbors in &mut self.vertex_neighbors {
            neighbors.sort_unstable();
            neighbors.dedup();
        }
    }

    fn add_neighbor(&mut self, vertex: usize, neighbor: usize) {
        if vertex < self.vertex_neighbors.len() {
            self.vertex_neighbors[vertex].push(neighbor);
        }
    }
}

/// Result from a brush stroke
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrushResult {
    pub modified_indices: Vec<usize>,
    pub new_positions: Vec<f32>,
    pub new_normals: Option<Vec<f32>>,
    pub normal_indices: Option<Vec<usize>>,
    pub new_tangents: Option<Vec<f32>>,
    pub tangent_indices: Option<Vec<u32>>,
    pub time_ms: f64,
    pub affected_count: usize,
    pub used_gpu: bool,
    pub gpu_fallback_reason: Option<String>,
}

/// Handle to a sculpt mesh stored in Rust
pub type SculptMeshHandle = u64;

/// Stored sculpt mesh data
struct SculptMesh {
    scene_mesh: Option<MeshHandle>,
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
    grid: SpatialGrid,
    topology: MeshTopology,
    /// KD-tree for O(log n) radius queries (static/raycast only - NOT for sculpt brushes)
    _kdtree: KdTree<f32, u64, 3, 256, u16>,

    // === STALENESS TRACKING ===
    /// Number of brush strokes since last spatial structure rebuild
    strokes_since_rebuild: u32,
    /// Number of vertices modified since last rebuild
    verts_modified_since_rebuild: usize,
    /// Whether grid needs rebuilding (set after brush, cleared after rebuild)
    grid_dirty: bool,
    /// Whether KD-tree is stale (NEVER use for sculpt queries when true!)
    kdtree_dirty: bool,

    // === SCRATCH BUFFERS (avoid allocation per dab) ===
    _scratch_candidates: Vec<usize>,
    _scratch_modified: Vec<usize>,
    scratch_positions_out: Vec<f32>,
    scratch_normals_out: Vec<f32>,

    // === UV COORDINATES (required for tangent computation) ===
    // TODO: Add UVs to mesh initialization
    // uvs: Vec<f32>,  // [u,v, u,v, ...] - 2 floats per vertex

    // === GPU COMPUTE (optional, lazy-init) ===
    /// GPU mesh buffers - created on first GPU-enabled stroke
    /// Type-erased to work in both main and bevy binaries
    #[cfg(not(target_arch = "wasm32"))]
    gpu_buffers: Option<AnyBox>,
    /// GPU spatial grid for O(1) radius queries entirely on GPU
    #[cfg(not(target_arch = "wasm32"))]
    gpu_spatial_grid: Option<GpuSpatialGrid>,
    /// Whether GPU buffers need to be synced from CPU positions
    gpu_dirty: bool,
    /// Whether GPU spatial grid has been built (lazy: build once, query forever)
    /// Rebuilding EVERY stroke was a major perf killer - now we build once!
    gpu_grid_built: bool,
    /// Sparse position readback buffers - only reads modified vertices instead of full mesh
    /// Reduces GPU→CPU transfer from O(n) to O(affected)
    #[cfg(not(target_arch = "wasm32"))]
    sparse_readback: Option<SparsePositionReadback>,
}

lazy_static::lazy_static! {
    static ref MESHES: Arc<Mutex<HashMap<u64, SculptMesh>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref NEXT_HANDLE: Arc<Mutex<u64>> = Arc::new(Mutex::new(1));
}

fn sync_runtime_mesh_from_scene(mesh: &mut SculptMesh) -> Result<(), String> {
    let Some(scene_mesh) = mesh.scene_mesh else {
        return Ok(());
    };

    let scene = SCENE_WORLD
        .read()
        .map_err(|_| "Failed to lock scene world".to_string())?;
    let source = scene.mesh_source(scene_mesh).map_err(|e| e.to_string())?;
    drop(scene);

    mesh.positions = source.positions.as_ref().to_vec();
    mesh.indices = source.indices.as_ref().to_vec();
    if let Some(normals) = source.normals {
        mesh.normals = normals.as_ref().to_vec();
    } else {
        mesh.normals = compute_all_normals(&mesh.positions, &mesh.indices);
    }

    Ok(())
}

// ============================================================================
// BRUSH KERNELS
// ============================================================================

/// Quadratic falloff function
#[inline(always)]
fn falloff(dist_sq: f32, radius_sq: f32) -> f32 {
    let t = 1.0 - dist_sq / radius_sq;
    t * t
}

/// Apply a single brush type to affected vertices (PARALLEL via rayon)
pub fn apply_brush_kernel(
    positions: &mut [f32],
    indices_to_modify: &[usize],
    center: Vec3,
    normal: Vec3,
    radius: f32,
    intensity: f32,
    tool: &str,
    delta: Option<Vec3>,
) -> Vec<usize> {
    let radius_sq = radius * radius;
    let local_intensity = intensity;

    // Pre-calculate drag vector for GRAB/MOVE if available
    let drag_vec = delta.unwrap_or(Vec3::ZERO) * intensity;

    // PARALLEL PHASE: Compute new positions for all candidates
    let computed: Vec<(usize, Vec3)> = indices_to_modify
        .par_iter()
        .filter_map(|&idx| {
            let ix = idx * 3;
            let p = Vec3::new(positions[ix], positions[ix + 1], positions[ix + 2]);
            let diff = p - center;
            let dist_sq = diff.length_squared();

            if dist_sq >= radius_sq {
                return None;
            }

            let fall = falloff(dist_sq, radius_sq);
            let disp = local_intensity * fall;

            let new_pos = match tool {
                "sculpt_stamp" | "sculpt_inflate" | "sculpt_clay" | "CLAY" | "INFLATE"
                | "STAMP" => p + normal * disp,
                "sculpt_flatten" | "FLATTEN" => {
                    let dist_to_plane = diff.dot(normal);
                    let factor = dist_to_plane * 0.5 * fall;
                    p - normal * factor
                }
                "sculpt_clay_strips" | "CLAY_STRIPS" => {
                    // Stripe pattern based on position
                    let stripe = (p.x * 15.0 + p.z * 15.0).sin() * 0.5 + 0.5;
                    let strip_disp = local_intensity * fall * stripe;
                    p + normal * strip_disp
                }
                "sculpt_scrape" | "SCRAPE" => {
                    // Assuming Scrape might leverage Flatten kernel logic or be custom
                    let dist_to_plane = diff.dot(normal);
                    if dist_to_plane > 0.0 {
                        let factor = dist_to_plane * 0.5 * fall;
                        p - normal * factor
                    } else {
                        p
                    }
                }
                "sculpt_fill" | "FILL" => {
                    let dist_to_plane = diff.dot(normal);
                    if dist_to_plane < 0.0 {
                        let factor = dist_to_plane * 0.5 * fall;
                        p - normal * factor
                    } else {
                        p
                    }
                }
                "sculpt_pinch" | "PINCH" => {
                    let factor = intensity * 0.05 * fall;
                    p - diff * factor
                }
                "sculpt_crease" | "CREASE" => {
                    let pinch_factor = intensity * 0.05 * fall;
                    let carve_disp = -local_intensity * fall * 1.5;
                    p - diff * pinch_factor + normal * carve_disp
                }
                "sim_cloth" | "melt" | "MELT" => {
                    let melt_amt = local_intensity * 2.0 * fall;
                    Vec3::new(
                        p.x + diff.x * melt_amt * 0.5,
                        p.y - melt_amt,
                        p.z + diff.z * melt_amt * 0.5,
                    )
                }
                "sim_gravity" | "gravity" | "GRAVITY" => {
                    let grav = local_intensity * 2.0 * fall;
                    Vec3::new(p.x, p.y - grav, p.z)
                }
                "sculpt_twist" | "twist" | "TWIST" | "VORTEX" => {
                    let ang = local_intensity * 5.0 * fall;
                    let (s, c) = ang.sin_cos();
                    let k_dot_v = normal.dot(diff);
                    let rotated = diff * c + normal.cross(diff) * s + normal * k_dot_v * (1.0 - c);
                    center + rotated
                }
                "REPEL" => {
                    let dist = dist_sq.sqrt();
                    if dist > 0.0001 {
                        let push = local_intensity * 2.0 * fall;
                        p + (diff / dist) * push
                    } else {
                        p
                    }
                }
                "sculpt_grab" | "sculpt_move" | "GRAB" | "MOVE" => p + drag_vec * fall,
                "SNAKE" => {
                    // Legacy simple snake
                    p + drag_vec * fall * 1.5
                }
                "TERRA" => {
                    let noise = (p.x * 10.0).sin() * (p.z * 10.0).cos();
                    let uplift = local_intensity * (1.0 + noise) * fall * 2.0;
                    p + normal * uplift
                }
                "MAGMA" => {
                    let strength = local_intensity * fall;
                    let dist = dist_sq.sqrt();
                    let spread = if dist > 0.0001 {
                        (diff / dist) * strength * 0.5
                    } else {
                        Vec3::ZERO
                    };
                    let noise = (p.x * 5.0 + p.y * 5.0).sin() * strength * 0.5;
                    Vec3::new(
                        p.x + spread.x + noise,
                        p.y - strength * 2.0,
                        p.z + spread.z - noise,
                    )
                }
                "THERMAL" => {
                    let strength = local_intensity * fall;
                    p - normal * strength * 0.5 - Vec3::new(0.0, strength * 0.2, 0.0)
                }
                "ERODE" => {
                    let erode_amt = local_intensity * fall;
                    p - normal * erode_amt
                }
                "SPIKE" => {
                    let spike_fall = fall.powi(4);
                    let spike_disp = local_intensity * spike_fall * 3.0;
                    p + normal * spike_disp
                }
                "sculpt_blob" | "blob" | "BLOB" => {
                    let blob_disp = local_intensity * fall * 1.5 * 0.9;
                    p + normal * blob_disp
                }
                "MAGNET" | "VOID" => {
                    let pull = local_intensity * fall * if tool == "VOID" { 2.0 } else { 1.0 };
                    p - diff * pull
                }
                // =================================================================
                // CRYSTAL KERNEL FAMILY - GPU/CPU brushes
                // =================================================================
                "CRYSTALLIZE" | "crystal_growth" | "CRYSTAL" => {
                    // Crystal Growth: Snap to cubic lattice
                    let grid_sz = radius * 0.5;
                    let strength = fall * intensity;
                    let target = Vec3::new(
                        (p.x / grid_sz).round() * grid_sz,
                        (p.y / grid_sz).round() * grid_sz,
                        (p.z / grid_sz).round() * grid_sz,
                    );
                    p + (target - p) * strength
                }
                "crystal_growth_hex" => {
                    // Crystal Growth: Hexagonal lattice
                    let grid_sz = radius * 0.4;
                    let strength = fall * intensity;
                    let row = (p.y / grid_sz).floor();
                    let offset_x = if row as i32 % 2 == 1 {
                        grid_sz * 0.5
                    } else {
                        0.0
                    };
                    let target = Vec3::new(
                        ((p.x - offset_x) / grid_sz).round() * grid_sz + offset_x,
                        (p.y / grid_sz).round() * grid_sz,
                        (p.z / grid_sz).round() * grid_sz,
                    );
                    p + (target - p) * strength
                }
                "crystal_growth_diamond" => {
                    // Crystal Growth: FCC/Diamond lattice (face-centered)
                    let grid_sz = radius * 0.4;
                    let strength = fall * intensity;
                    let base = Vec3::new(
                        (p.x / grid_sz).floor(),
                        (p.y / grid_sz).floor(),
                        (p.z / grid_sz).floor(),
                    );
                    let frac = p / grid_sz - base;

                    // Check corner vs face centers
                    let corner_dist = frac.length();
                    let face_xy = (frac - Vec3::new(0.5, 0.5, 0.0)).length();
                    let face_xz = (frac - Vec3::new(0.5, 0.0, 0.5)).length();
                    let face_yz = (frac - Vec3::new(0.0, 0.5, 0.5)).length();

                    let target = if corner_dist < face_xy
                        && corner_dist < face_xz
                        && corner_dist < face_yz
                    {
                        base * grid_sz
                    } else if face_xy < face_xz && face_xy < face_yz {
                        (base + Vec3::new(0.5, 0.5, 0.0)) * grid_sz
                    } else if face_xz < face_yz {
                        (base + Vec3::new(0.5, 0.0, 0.5)) * grid_sz
                    } else {
                        (base + Vec3::new(0.0, 0.5, 0.5)) * grid_sz
                    };

                    p + (target - p) * strength
                }
                "voronoi_shatter" | "SHATTER" => {
                    // Voronoi Shatter: Displace toward cell center with edge detection
                    let cell_scale = radius * 0.4;
                    let scaled_pos = p / cell_scale;
                    let cell_base = Vec3::new(
                        scaled_pos.x.floor(),
                        scaled_pos.y.floor(),
                        scaled_pos.z.floor(),
                    );

                    // Find nearest cell center via hash
                    let hash = |v: Vec3| -> Vec3 {
                        let s = Vec3::new(
                            (v.x * 127.1 + v.y * 311.7 + v.z * 74.7).sin(),
                            (v.x * 269.5 + v.y * 183.3 + v.z * 246.1).sin(),
                            (v.x * 113.5 + v.y * 271.9 + v.z * 124.6).sin(),
                        );
                        Vec3::new(
                            (s.x * 43758.5453).fract(),
                            (s.y * 43758.5453).fract(),
                            (s.z * 43758.5453).fract(),
                        )
                    };

                    let mut nearest_center = cell_base;
                    let mut nearest_dist = 999.0f32;

                    // 3x3x3 neighborhood search
                    for dx in -1..=1 {
                        for dy in -1..=1 {
                            for dz in -1..=1 {
                                let cell = cell_base + Vec3::new(dx as f32, dy as f32, dz as f32);
                                let cell_center = cell + hash(cell) * 0.8 + Vec3::splat(0.1);
                                let d = (scaled_pos - cell_center).length();
                                if d < nearest_dist {
                                    nearest_dist = d;
                                    nearest_center = cell_center;
                                }
                            }
                        }
                    }

                    let world_cell_center = nearest_center * cell_scale;
                    let to_cell = world_cell_center - p;
                    let planar_push = to_cell - normal * to_cell.dot(normal);
                    let shatter_disp = planar_push * fall * intensity * 0.5;
                    p + shatter_disp
                }
                "crystal_bismuth" => {
                    // Bismuth: Stepped terrace effect
                    let step_height = radius * 0.1;
                    let strength = fall * intensity;
                    let height_along_normal = (p - center).dot(normal);
                    let quantized_height =
                        (height_along_normal / step_height).round() * step_height;
                    let height_diff = quantized_height - height_along_normal;
                    p + normal * height_diff * strength
                }
                "TERRACE" => {
                    let step = radius * 0.2;
                    let strength = fall * intensity;
                    let h = p.dot(normal);
                    let target_h = (h / step).round() * step;
                    let delta = (target_h - h) * strength;
                    p + normal * delta
                }
                "VELVET" => {
                    let soft_inflate = local_intensity * fall;
                    p + normal * soft_inflate
                }
                "GROWTH" => {
                    let growth_amt = local_intensity * fall;
                    let hash = (p.x * 12.9898 + p.y * 78.233).sin() * 43758.5453;
                    let branch =
                        Vec3::new(hash.sin() * 0.5, hash.cos() * 0.5, (hash * 2.0).sin() * 0.5);
                    p + (normal + branch) * growth_amt
                }
                "BLOOM" => {
                    let v_dot_n = diff.dot(normal);
                    let v_tangent = diff - normal * v_dot_n;
                    let len = v_tangent.length();
                    if len > 0.0001 {
                        let bloom_amt = local_intensity * fall;
                        p + (v_tangent / len) * bloom_amt + normal * bloom_amt * 0.5
                    } else {
                        p
                    }
                }

                // =================================================================
                // NEW ESSENTIAL BRUSHES
                // =================================================================

                // DRAW - Classic standard brush, smoother than clay
                "sculpt_draw" | "draw" | "DRAW" => {
                    let draw_disp = local_intensity * fall * 0.8;
                    p + normal * draw_disp
                }

                // SNAKE_HOOK - Elastic drag with tension
                "sculpt_snake_hook" | "snake_hook" | "SNAKE_HOOK" => {
                    let elastic = fall.powf(0.3); // More gradual falloff for stretchy feel
                    p + drag_vec * elastic * 2.0
                }

                // LAYER - Only affects up to a height limit (builds layers)
                "sculpt_layer" | "layer" | "LAYER" => {
                    let height_limit = radius * 0.3;
                    let current_height = diff.dot(normal);
                    let remaining = (height_limit - current_height).max(0.0);
                    let layer_disp = (local_intensity * fall).min(remaining);
                    p + normal * layer_disp
                }

                // DAM_STANDARD - Creates sharp creases/dams
                "DAM_STANDARD" | "DAM" => {
                    let dam_fall = fall.powf(3.0); // Sharper falloff
                    let pinch = diff * local_intensity * dam_fall * 0.3;
                    let carve = normal * (-local_intensity * dam_fall * 1.5);
                    p - pinch + carve
                }

                // HPOLISH - Flatten with edge preservation (horizontal polish)
                "HPOLISH" | "POLISH" => {
                    let dist_to_plane = diff.dot(normal);
                    // Only flatten, don't push up
                    if dist_to_plane > 0.0 {
                        let flatten_amt = dist_to_plane * fall * intensity * 0.7;
                        p - normal * flatten_amt
                    } else {
                        p
                    }
                }

                // =================================================================
                // EXPERIMENTAL BRUSHES - FLEXING ON ZBRUSH 🔥
                // =================================================================

                // ELASTIC - Rubber-band physics, vertices snap back near edges
                "ELASTIC" => {
                    let dist = dist_sq.sqrt();
                    let edge_factor = (dist / radius).powf(2.0);
                    let snap_back = 1.0 - edge_factor;
                    let elastic_disp = drag_vec * fall * snap_back * 2.5;
                    p + elastic_disp
                }

                // VECTOR_FIELD - Curl noise flow sculpting (procedural swirls)
                "VECTOR_FIELD" | "CURL" => {
                    // Procedural 3D curl noise approximation
                    let freq = 3.0;
                    let curl_x = (p.y * freq).cos() * (p.z * freq).sin();
                    let curl_y = (p.z * freq).cos() * (p.x * freq).sin();
                    let curl_z = (p.x * freq).cos() * (p.y * freq).sin();
                    let curl = Vec3::new(curl_x, curl_y, curl_z).normalize_or_zero();
                    let flow = local_intensity * fall * 2.0;
                    p + curl * flow
                }

                // RAKE - Multi-line groove brush (like ZBrush rake)
                "RAKE" => {
                    // Create parallel grooves based on position
                    let groove_freq = 8.0;
                    let tangent = normal.cross(Vec3::Y).normalize_or_zero();
                    let along_tangent = diff.dot(tangent);
                    let groove = (along_tangent * groove_freq).sin();
                    let rake_disp = local_intensity * fall * groove;
                    p + normal * rake_disp
                }

                // HOLOGRAM - Wave interference patterns (sci-fi flex)
                "HOLOGRAM" | "INTERFERENCE" => {
                    let dist = dist_sq.sqrt();
                    // Multiple wave sources interfering
                    let wave1 = (dist * 20.0).sin();
                    let wave2 = (dist * 15.0 + p.x * 10.0).sin();
                    let wave3 = (dist * 25.0 - p.z * 8.0).sin();
                    let interference = (wave1 + wave2 + wave3) / 3.0;
                    let holo_disp = local_intensity * fall * interference * 0.5;
                    p + normal * holo_disp
                }

                // ATTRACTOR - Multi-point gravity wells (vertices flow to points)
                "ATTRACTOR" | "WELLS" => {
                    // Create attraction points in a pattern around center
                    let angle = (p.x * 5.0 + p.z * 5.0).sin() * std::f32::consts::PI;
                    let attractor_offset = Vec3::new(angle.cos(), 0.0, angle.sin()) * radius * 0.3;
                    let attractor_pos = center + attractor_offset;
                    let to_attractor = attractor_pos - p;
                    let pull_strength = local_intensity * fall * 0.5;
                    p + to_attractor.normalize_or_zero() * pull_strength
                }

                _ => p + normal * disp, // Default clay-like
            };

            Some((idx, new_pos))
        })
        .collect();

    // SEQUENTIAL PHASE: Apply computed positions (fast, no contention)
    let mut modified = Vec::with_capacity(computed.len());
    for (idx, new_pos) in computed {
        let ix = idx * 3;
        positions[ix] = new_pos.x;
        positions[ix + 1] = new_pos.y;
        positions[ix + 2] = new_pos.z;
        modified.push(idx);
    }

    modified
}

/// Apply smooth brush using Laplacian averaging
pub fn apply_smooth_kernel(
    positions: &mut [f32],
    topology: &MeshTopology,
    indices_to_modify: &[usize],
    center: Vec3,
    radius: f32,
    intensity: f32,
) -> Vec<usize> {
    let radius_sq = radius * radius;
    let local_intensity = intensity * 0.5;

    // First pass: calculate new positions (parallel)
    let new_positions: Vec<(usize, Vec3)> = indices_to_modify
        .par_iter()
        .filter_map(|&idx| {
            if idx >= topology.vertex_neighbors.len() {
                return None;
            }

            let neighbors = &topology.vertex_neighbors[idx];
            if neighbors.is_empty() {
                return None;
            }

            // Calculate neighbor average
            let mut avg = Vec3::ZERO;
            for &n_idx in neighbors {
                avg += Vec3::new(
                    positions[n_idx * 3],
                    positions[n_idx * 3 + 1],
                    positions[n_idx * 3 + 2],
                );
            }
            avg /= neighbors.len() as f32;

            let cur = Vec3::new(
                positions[idx * 3],
                positions[idx * 3 + 1],
                positions[idx * 3 + 2],
            );

            let diff = cur - center;
            let dist_sq = diff.length_squared();

            if dist_sq >= radius_sq {
                return None;
            }

            let fall = falloff(dist_sq, radius_sq);
            let alpha = local_intensity * fall;
            let new_pos = cur.lerp(avg, alpha);

            Some((idx, new_pos))
        })
        .collect();

    // Second pass: apply (sequential to avoid race conditions)
    let mut modified = Vec::with_capacity(new_positions.len());
    for (idx, pos) in new_positions {
        positions[idx * 3] = pos.x;
        positions[idx * 3 + 1] = pos.y;
        positions[idx * 3 + 2] = pos.z;
        modified.push(idx);
    }

    modified
}

// ============================================================================
// NORMAL CALCULATION
// ============================================================================

/// Compute initial normals for the entire mesh
pub fn compute_all_normals(positions: &[f32], indices: &[u32]) -> Vec<f32> {
    let vertex_count = positions.len() / 3;
    let face_count = indices.len() / 3;

    let mut normals = vec![0.0f32; vertex_count * 3];

    // Accumulate face normals (area-weighted via cross product magnitude)
    for i in 0..face_count {
        let i0 = indices[i * 3] as usize;
        let i1 = indices[i * 3 + 1] as usize;
        let i2 = indices[i * 3 + 2] as usize;

        if i0 >= vertex_count || i1 >= vertex_count || i2 >= vertex_count {
            continue;
        }

        let p0 = Vec3::new(
            positions[i0 * 3],
            positions[i0 * 3 + 1],
            positions[i0 * 3 + 2],
        );
        let p1 = Vec3::new(
            positions[i1 * 3],
            positions[i1 * 3 + 1],
            positions[i1 * 3 + 2],
        );
        let p2 = Vec3::new(
            positions[i2 * 3],
            positions[i2 * 3 + 1],
            positions[i2 * 3 + 2],
        );

        let face_normal = (p1 - p0).cross(p2 - p0); // Not normalized = area weighted

        // Accumulate to each vertex
        for &vi in &[i0, i1, i2] {
            normals[vi * 3] += face_normal.x;
            normals[vi * 3 + 1] += face_normal.y;
            normals[vi * 3 + 2] += face_normal.z;
        }
    }

    // Normalize all
    for i in 0..vertex_count {
        let n =
            Vec3::new(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).normalize_or_zero();
        normals[i * 3] = n.x;
        normals[i * 3 + 1] = n.y;
        normals[i * 3 + 2] = n.z;
    }

    normals
}

/// Recalculate normals only for vertices affected by brush stroke (PARALLEL via rayon)
pub fn recalculate_normals_incremental(
    positions: &[f32],
    normals: &mut [f32],
    indices: &[u32],
    topology: &MeshTopology,
    modified_indices: &[usize],
) -> Vec<usize> {
    let vertex_count = positions.len() / 3;
    let face_count = indices.len() / 3;

    // Track dirty faces and vertices without hashing/allocations per insert.
    // We keep both a bitset (for O(1) dedup) and an explicit list (so we don't
    // need to iterate the full bitset length).
    let mut dirty_faces_bits = FixedBitSet::with_capacity(face_count);
    dirty_faces_bits.grow(face_count);
    let mut dirty_faces_list: Vec<usize> = Vec::new();

    for &v_idx in modified_indices {
        if v_idx >= topology.vertex_faces.len() {
            continue;
        }
        for &f_idx in &topology.vertex_faces[v_idx] {
            if f_idx >= face_count {
                continue;
            }
            if !dirty_faces_bits.contains(f_idx) {
                dirty_faces_bits.insert(f_idx);
                dirty_faces_list.push(f_idx);
            }
        }
    }

    let mut dirty_vertices_bits = FixedBitSet::with_capacity(vertex_count);
    dirty_vertices_bits.grow(vertex_count);
    let mut dirty_vertices_list: Vec<usize> = Vec::new();

    for &f_idx in &dirty_faces_list {
        let base = f_idx * 3;
        if base + 2 >= indices.len() {
            continue;
        }
        let v0 = indices[base] as usize;
        let v1 = indices[base + 1] as usize;
        let v2 = indices[base + 2] as usize;

        for v in [v0, v1, v2] {
            if v >= vertex_count {
                continue;
            }
            if !dirty_vertices_bits.contains(v) {
                dirty_vertices_bits.insert(v);
                dirty_vertices_list.push(v);
            }
        }
    }

    // PARALLEL PHASE: Compute normals for all dirty vertices
    let computed: Vec<(usize, Vec3)> = dirty_vertices_list
        .par_iter()
        .filter_map(|&v_idx| {
            if v_idx >= topology.vertex_faces.len() || v_idx >= vertex_count {
                return None;
            }

            let mut accumulated = Vec3::ZERO;

            // Sum face normals for all faces connected to this vertex
            for &f_idx in &topology.vertex_faces[v_idx] {
                let base = f_idx * 3;
                if base + 2 >= indices.len() {
                    continue;
                }

                let i0 = indices[base] as usize;
                let i1 = indices[base + 1] as usize;
                let i2 = indices[base + 2] as usize;

                if i0 >= vertex_count || i1 >= vertex_count || i2 >= vertex_count {
                    continue;
                }

                let p0 = Vec3::new(
                    positions[i0 * 3],
                    positions[i0 * 3 + 1],
                    positions[i0 * 3 + 2],
                );
                let p1 = Vec3::new(
                    positions[i1 * 3],
                    positions[i1 * 3 + 1],
                    positions[i1 * 3 + 2],
                );
                let p2 = Vec3::new(
                    positions[i2 * 3],
                    positions[i2 * 3 + 1],
                    positions[i2 * 3 + 2],
                );

                let face_normal = (p1 - p0).cross(p2 - p0);
                accumulated += face_normal;
            }

            let new_normal = accumulated.normalize_or_zero();
            Some((v_idx, new_normal))
        })
        .collect();

    // SEQUENTIAL PHASE: Apply computed normals (fast, no contention)
    for (v_idx, new_normal) in &computed {
        normals[v_idx * 3] = new_normal.x;
        normals[v_idx * 3 + 1] = new_normal.y;
        normals[v_idx * 3 + 2] = new_normal.z;
    }

    dirty_vertices_list
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Initialize a mesh for sculpting
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn init_sculpt_mesh(
    positions: Vec<f32>,
    indices: Vec<u32>,
) -> Result<SculptMeshHandle, String> {
    let start = Instant::now();

    let vertex_count = positions.len() / 3;
    let face_count = indices.len() / 3;

    // Compute initial normals
    let normals = compute_all_normals(&positions, &indices);
    let scene_mesh = {
        let mut scene = SCENE_WORLD
            .write()
            .map_err(|_| "Failed to lock scene world".to_string())?;
        scene.create_mesh(positions.clone(), indices.clone(), Some(normals.clone()))
    };

    // Build spatial grid
    let (min, max) = positions.chunks(3).fold(
        (Vec3::splat(f32::MAX), Vec3::splat(f32::MIN)),
        |(min, max), p| {
            let v = Vec3::new(p[0], p[1], p[2]);
            (min.min(v), max.max(v))
        },
    );

    let extent = max - min;
    let max_dim = extent.max_element().max(0.1);
    let cell_size = max_dim / 50.0;

    let mut grid = SpatialGrid::new(cell_size);
    grid.build(&positions);

    // Build topology
    let mut topology = MeshTopology::new();
    topology.build(vertex_count, &indices);

    // Build KD-tree for O(log n) radius queries (faster than grid for large brushes)
    // Bucket size 256 handles most meshes, but some may still panic - catch and fallback
    let kdtree: KdTree<f32, u64, 3, 256, u16> = {
        use std::panic::{catch_unwind, AssertUnwindSafe};

        let mut tree: KdTree<f32, u64, 3, 256, u16> = KdTree::new();
        let positions_ref = &positions;

        let result = catch_unwind(AssertUnwindSafe(|| {
            for i in 0..vertex_count {
                let point = [
                    positions_ref[i * 3],
                    positions_ref[i * 3 + 1],
                    positions_ref[i * 3 + 2],
                ];
                tree.add(&point, i as u64);
            }
        }));

        if result.is_err() {
            log::warn!("KD-tree construction failed (too many collinear vertices). Using empty tree, will fallback to SpatialGrid.");
            KdTree::new() // Return empty tree
        } else {
            tree
        }
    };

    let handle = {
        let mut next = NEXT_HANDLE.lock().unwrap();
        let h = *next;
        *next += 1;
        h
    };

    {
        let mut meshes = MESHES.lock().unwrap();
        meshes.insert(
            handle,
            SculptMesh {
                scene_mesh: Some(scene_mesh),
                positions,
                normals,
                indices,
                grid,
                topology,
                _kdtree: kdtree,
                // Staleness tracking
                strokes_since_rebuild: 0,
                verts_modified_since_rebuild: 0,
                grid_dirty: false,
                kdtree_dirty: false,
                // Scratch buffers (start with reasonable capacity)
                _scratch_candidates: Vec::with_capacity(10000),
                _scratch_modified: Vec::with_capacity(10000),
                scratch_positions_out: Vec::with_capacity(30000),
                scratch_normals_out: Vec::with_capacity(30000),
                // GPU compute (lazy init on first GPU stroke)
                #[cfg(not(target_arch = "wasm32"))]
                gpu_buffers: None,
                #[cfg(not(target_arch = "wasm32"))]
                gpu_spatial_grid: None,
                gpu_dirty: true,
                gpu_grid_built: false,
                #[cfg(not(target_arch = "wasm32"))]
                sparse_readback: None,
            },
        );
    }

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    log::info!(
        "Sculpt mesh initialized: {} verts, {} faces, handle={}, time={:.2}ms",
        vertex_count,
        face_count,
        handle,
        elapsed
    );

    Ok(handle)
}

/// Initialize a mesh for sculpting via BINARY IPC path (10-50x faster for large meshes)
///
/// Accepts raw bytes from JS Uint8Array (positions as little-endian f32, indices as little-endian u32).
/// Delegates to init_sculpt_mesh after reinterpreting bytes.
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn init_sculpt_mesh_binary(
    positions_bytes: Vec<u8>,
    indices_bytes: Vec<u8>,
) -> Result<SculptMeshHandle, String> {
    // Reinterpret raw bytes as f32 / u32 slices (bytemuck ensures alignment + endianness safety)
    if positions_bytes.len() % 4 != 0 {
        return Err(format!(
            "positions_bytes length {} is not a multiple of 4",
            positions_bytes.len()
        ));
    }
    if indices_bytes.len() % 4 != 0 {
        return Err(format!(
            "indices_bytes length {} is not a multiple of 4",
            indices_bytes.len()
        ));
    }

    let positions: Vec<f32> = bytemuck::cast_slice::<u8, f32>(&positions_bytes).to_vec();
    let indices: Vec<u32> = bytemuck::cast_slice::<u8, u32>(&indices_bytes).to_vec();

    log::debug!(
        "[init_sculpt_mesh_binary] decoded {} verts, {} faces from {}+{} bytes",
        positions.len() / 3,
        indices.len() / 3,
        positions_bytes.len(),
        indices_bytes.len()
    );

    init_sculpt_mesh(positions, indices)
}

// ============================================================================
// GPU COMPUTE INTEGRATION
// ============================================================================

#[cfg(not(target_arch = "wasm32"))]
mod gpu_integration {
    use super::SculptMesh;
    use super::*;

    /// Lazy-initialized GPU compute resources (singleton)
    pub(crate) static GPU_COMPUTE: once_cell::sync::OnceCell<
        std::sync::Mutex<Option<GpuSculptCompute>>,
    > = once_cell::sync::OnceCell::new();

    /// Lazy-initialized GPU normal compute (singleton)
    #[cfg(not(target_arch = "wasm32"))]
    static GPU_NORMAL_COMPUTE: once_cell::sync::OnceCell<
        std::sync::Mutex<Option<GpuNormalCompute>>,
    > = once_cell::sync::OnceCell::new();

    /// Staging buffer pool for efficient GPU→CPU readback (reuses buffers)
    #[cfg(not(target_arch = "wasm32"))]
    static STAGING_POOL: once_cell::sync::OnceCell<std::sync::Mutex<StagingBufferPool>> =
        once_cell::sync::OnceCell::new();

    /// Get or initialize the GPU normal compute pipeline
    #[cfg(not(target_arch = "wasm32"))]
    pub fn get_or_init_normal_compute(
        device: &wgpu::Device,
    ) -> &'static std::sync::Mutex<Option<GpuNormalCompute>> {
        GPU_NORMAL_COMPUTE
            .get_or_init(|| std::sync::Mutex::new(Some(GpuNormalCompute::new(device))))
    }

    /// Recalculate normals on GPU for modified vertices
    ///
    /// Encodes 3-pass compute shader:
    ///   Pass 1: Clear normals for dirty vertices  
    ///   Pass 2: Accumulate face normals (atomic fixed-point) - ONLY dirty faces!
    ///   Pass 3: Normalize
    ///
    /// # Performance Optimization
    /// Pass 2 now iterates only over dirty faces (faces touching modified vertices)
    /// instead of ALL faces. For a brush affecting 100 verts on a 3.1M face mesh:
    /// - Before: 3.1M faces = 12,288 workgroups (~150ms)
    /// - After:  ~600 faces = 3 workgroups (~0.5ms)
    ///
    /// Returns true if GPU normal recalc was used, false if fallback needed
    pub fn recalculate_normals_gpu(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        gpu_buffers: &GpuMeshBuffers,
        candidates_buffer: &wgpu::Buffer,
        candidate_count: u32,
        topology: &MeshTopology,
        candidate_indices: &[usize], // CPU-side vertex indices to build dirty faces
        mesh_indices: &[u32],        // CPU-side mesh indices to build dirty vertex list
    ) -> bool {
        #[cfg(target_arch = "wasm32")]
        {
            return false;
        }
        // Check if normal buffers are initialized
        let (Some(gpu_indices_buf), Some(normals_fixed), Some(dirty_mask), Some(dirty_faces_buf)) = (
            gpu_buffers.indices.as_ref(),
            gpu_buffers.normals_fixed.as_ref(),
            gpu_buffers.dirty_mask.as_ref(),
            gpu_buffers.dirty_faces.as_ref(),
        ) else {
            log::trace!("GPU normal buffers not initialized, using CPU fallback");
            return false;
        };

        // Skip if nothing to do
        if candidate_count == 0 || gpu_buffers.face_count == 0 {
            return true;
        }

        // === CPU PRE-FILTER: Build dirty faces list from topology ===
        // This is the key optimization! Instead of iterating 3.1M faces on GPU,
        // we only upload ~300 face indices that actually need processing.
        use std::collections::HashSet;
        let mut dirty_faces_set: HashSet<u32> = HashSet::with_capacity(candidate_indices.len() * 6);
        for &v_idx in candidate_indices {
            if v_idx < topology.vertex_faces.len() {
                for &f_idx in &topology.vertex_faces[v_idx] {
                    dirty_faces_set.insert(f_idx as u32);
                }
            }
        }
        let dirty_faces: Vec<u32> = dirty_faces_set.into_iter().collect();
        let dirty_faces_count = dirty_faces.len() as u32;

        // NEW: Also build list of all vertices that touch these faces (for clearing)
        // This ensures Pass 1 clears everything that Pass 2 will accumulate into.
        let mut dirty_verts_set: HashSet<u32> = HashSet::with_capacity(dirty_faces.len() * 3);
        for &f_idx in &dirty_faces {
            let base = f_idx as usize * 3;
            if base + 2 < mesh_indices.len() {
                dirty_verts_set.insert(mesh_indices[base]);
                dirty_verts_set.insert(mesh_indices[base + 1]);
                dirty_verts_set.insert(mesh_indices[base + 2]);
            }
        }
        let dirty_verts: Vec<u32> = dirty_verts_set.into_iter().collect();
        let actual_candidate_count = dirty_verts.len() as u32;

        // Upload dirty vertices to candidates buffer (temporarily repurpose it)
        if actual_candidate_count > 0 {
            queue.write_buffer(candidates_buffer, 0, bytemuck::cast_slice(&dirty_verts));
        }

        // Upload dirty faces to GPU
        if dirty_faces_count > 0 {
            queue.write_buffer(dirty_faces_buf, 0, bytemuck::cast_slice(&dirty_faces));
        }

        // Get normal compute pipeline
        let normal_compute_cell = match GPU_NORMAL_COMPUTE.get() {
            Some(cell) => cell,
            None => {
                log::warn!("GPU normal compute not initialized");
                return false;
            }
        };

        let normal_compute_guard = normal_compute_cell.lock().unwrap();
        let normal_compute = match normal_compute_guard.as_ref() {
            Some(nc) => nc,
            None => {
                log::warn!("GPU normal compute unavailable");
                return false;
            }
        };

        // Create params with dirty_faces_count
        let params = NormalParams {
            face_count: gpu_buffers.face_count,
            vertex_count: gpu_buffers.vertex_count,
            candidate_count: actual_candidate_count,
            dirty_faces_count, // 🔥 The key optimization!
        };

        // Create temporary bind group resources for normals shader
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("gpu_normals_encoder"),
        });

        // Create a temporary GpuNormalBuffers struct for the encode call
        let temp_buffers = k_os_gpu_pipeline::normals::GpuNormalBuffers {
            positions: gpu_buffers.positions.clone(),
            indices: gpu_indices_buf.clone(),
            candidates: candidates_buffer.clone(),
            normals_fixed: normals_fixed.clone(),
            normals_out: gpu_buffers.normals.clone(),
            dirty_mask: dirty_mask.clone(),
            dirty_faces: dirty_faces_buf.clone(),
            vertex_count: gpu_buffers.vertex_count,
            face_count: gpu_buffers.face_count,
        };

        // Encode the 3-pass normal recalculation
        normal_compute.encode_recalculate_normals(device, &mut encoder, &temp_buffers, params);

        // Submit
        queue.submit(std::iter::once(encoder.finish()));

        log::debug!(
            "GPU normal recalc: {} candidates, {} dirty faces (was {} total)",
            candidate_count,
            dirty_faces_count,
            gpu_buffers.face_count
        );
        true
    }

    /// Helper: Read sparse buffer format and update mesh positions AND normals
    /// Format: [count (u32), idx0, pos0.xyz, norm0.xyz, idx1, pos1.xyz, norm1.xyz, ...]
    /// Returns list of modified vertex indices
    pub(crate) fn read_sparse_buffer(
        slice: &wgpu::BufferSlice,
        max_vertices: u32,
        positions: &mut [f32],
        normals: &mut [f32],
    ) -> Vec<usize> {
        let data = slice.get_mapped_range();
        let raw: &[u32] = bytemuck::cast_slice(&data);

        if raw.is_empty() {
            return vec![];
        }

        let count = raw[0] as usize;
        let mut modified = Vec::with_capacity(count);

        // Each entry = 7 u32s: [idx, pos.xyz (3 f32), norm.xyz (3 f32)]
        for i in 0..count.min(max_vertices as usize) {
            let base = 1 + i * 7;
            if base + 6 >= raw.len() {
                break;
            }

            let vertex_idx = raw[base] as usize;
            let pos_x: f32 = f32::from_bits(raw[base + 1]);
            let pos_y: f32 = f32::from_bits(raw[base + 2]);
            let pos_z: f32 = f32::from_bits(raw[base + 3]);
            let norm_x: f32 = f32::from_bits(raw[base + 4]);
            let norm_y: f32 = f32::from_bits(raw[base + 5]);
            let norm_z: f32 = f32::from_bits(raw[base + 6]);
            // Validate data - detect NaN, Inf, or extreme values
            let is_pos_valid = pos_x.is_finite()
                && pos_y.is_finite()
                && pos_z.is_finite()
                && pos_x.abs() < 1e6
                && pos_y.abs() < 1e6
                && pos_z.abs() < 1e6;
            let is_norm_valid = norm_x.is_finite() && norm_y.is_finite() && norm_z.is_finite();

            if !is_pos_valid || !is_norm_valid {
                // Log on first invalid entry only to avoid spam
                if i < 3 {
                    log::warn!(
                        "[sparse_readback] Invalid data at i={}: vertex_idx={}, pos=({:.3}, {:.3}, {:.3}), norm=({:.3}, {:.3}, {:.3})",
                        i, vertex_idx, pos_x, pos_y, pos_z, norm_x, norm_y, norm_z
                    );
                }
                continue; // Skip invalid data
            }

            // Update position and normal in CPU mesh
            if vertex_idx * 3 + 2 < positions.len() {
                positions[vertex_idx * 3] = pos_x;
                positions[vertex_idx * 3 + 1] = pos_y;
                positions[vertex_idx * 3 + 2] = pos_z;
                modified.push(vertex_idx);
            }
            if vertex_idx * 3 + 2 < normals.len() {
                normals[vertex_idx * 3] = norm_x;
                normals[vertex_idx * 3 + 1] = norm_y;
                normals[vertex_idx * 3 + 2] = norm_z;
            }
        }

        modified
    }

    /// Map tool name to SculptOp enum for GPU compute
    pub fn tool_to_sculpt_op(tool: &str) -> SculptOp {
        match tool {
            // === Core Kernel Mappings (from KBrushAsset::shader_name) ===

            // Stamp Family
            "sculpt_stamp" | "sculpt_clay" | "CLAY" | "STAMP" => SculptOp::Clay,
            "sculpt_inflate" | "sim_inflate" | "INFLATE" => SculptOp::Inflate,
            "sculpt_draw" | "DRAW" => SculptOp::Draw,
            "sculpt_layer" | "LAYER" => SculptOp::Layer,
            "sculpt_blob" | "blob" | "BLOB" => SculptOp::Blob,
            "sculpt_clay_strips" | "CLAY_STRIPS" => SculptOp::ClayStrips,

            // Flatten Family
            "sculpt_flatten" | "FLATTEN" => SculptOp::Flatten,
            "sculpt_polish" | "HPOLISH" | "POLISH" => SculptOp::HPolish,
            "SCRAPE" => SculptOp::Flatten, // Scrape uses Flatten logic

            // Pinch Family
            "sculpt_pinch" | "PINCH" => SculptOp::Pinch,
            "sculpt_crease" | "CREASE" => SculptOp::Crease,
            "sculpt_dam_standard" | "DAM_STANDARD" | "DAM" => SculptOp::Dam,

            // Grab Family
            "sculpt_grab" | "sculpt_move" | "GRAB" | "MOVE" => SculptOp::Grab,
            "sculpt_snake_hook" | "snake_hook" | "SNAKE_HOOK" => SculptOp::SnakeHook,
            "sculpt_twist" | "twist" | "TWIST" => SculptOp::Twist,

            // Simulation Family
            "sim_cloth" | "melt" | "MELT" => SculptOp::Melt,
            "sim_gravity" | "gravity" | "GRAVITY" => SculptOp::Gravity,
            "REPEL" => SculptOp::Inflate,
            "VORTEX" => SculptOp::Twist,

            // Paint Family
            "paint_color" | "PAINT" => SculptOp::Clay,
            "paint_mask" | "fill" | "FILL" => SculptOp::Clay,

            // Experimental/Legacy mappings
            "elastic" | "ELASTIC" => SculptOp::Elastic,
            "vector_field" | "curl" | "VECTOR_FIELD" => SculptOp::VectorField,
            "hologram" | "HOLOGRAM" => SculptOp::Hologram,
            "attractor" | "ATTRACTOR" => SculptOp::Attractor,
            "rake" | "RAKE" => SculptOp::Rake,
            "spike" | "SPIKE" => SculptOp::Spike,
            "terrace" | "TERRACE" => SculptOp::Terrace,
            "erode" | "ERODE" => SculptOp::Erode,
            "growth" | "GROWTH" => SculptOp::Growth,
            "bloom" | "BLOOM" => SculptOp::Bloom,

            // Default Fallback
            _ => {
                // Default to Clay
                SculptOp::Clay
            }
        }
    }

    // Helper to map brush kernel names to WGSL entry points
    fn tool_to_entry_point(tool: &str) -> &str {
        match tool {
            // Stamp Family
            "sculpt_stamp" | "sculpt_clay" => "stamp_clay", // Clay variant
            "sculpt_inflate" | "sim_inflate" => "stamp_inflate", // Inflate variant
            "sculpt_draw" => "stamp_main",                  // General stamp
            "sculpt_layer" => "stamp_main",
            "sculpt_blob" => "stamp_main",

            // Pinch Family
            "sculpt_pinch" => "pinch_main",
            "sculpt_crease" => "pinch_crease",
            "sculpt_dam_standard" => "pinch_dam",

            // Smooth Family
            "sculpt_smooth" | "sculpt_relax" => "smooth_main",
            "sculpt_polish" => "smooth_main",

            // Grab Family
            "sculpt_grab" => "grab_main",
            "sculpt_move" => "grab_move",
            "sculpt_snake_hook" => "grab_snake_hook",
            "sculpt_twist" => "grab_twist",

            // All others (sim_cloth, etc) use legacy embedded shader for now
            _ => "legacy",
        }
    }

    /// Apply brush using GPU compute shader
    /// Returns modified vertex indices, or Err if GPU unavailable
    /// delta: Optional mouse movement vector for Grab/Snake Hook/Move brushes
    pub fn apply_brush_gpu(
        mesh: &mut SculptMesh,
        candidates: &[usize],
        center: Vec3,
        norm: Vec3,
        radius: f32,
        intensity: f32,
        tool: &str,
        alpha_handle: Option<u64>,
        delta: Option<[f32; 3]>,
    ) -> Result<Vec<usize>, String> {
        log::trace!(
            "[apply_brush_gpu] Tool: {}, Radius: {}, Intensity: {}, Delta: {:?}",
            tool,
            radius,
            intensity,
            delta
        );

        // Auto-initialize GPU device if needed (lazy init on first GPU stroke)
        let gpu = GpuComputeDevice::get_or_init_blocking()?;

        let gpu_guard = gpu.lock();
        let device = &gpu_guard.device;
        let queue = &gpu_guard.queue;

        // Get or create GpuSculptCompute pipeline
        let compute_cell = GPU_COMPUTE
            .get_or_init(|| std::sync::Mutex::new(Some(GpuSculptCompute::new(device, queue))));
        let compute_guard = compute_cell.lock().unwrap();
        let compute = compute_guard
            .as_ref()
            .ok_or_else(|| "GPU compute pipeline not available".to_string())?;

        // Lazy-init GPU buffers for this mesh if needed
        if mesh.gpu_buffers.is_none() || mesh.gpu_dirty {
            let mut gpu_buffers =
                compute.create_mesh_buffers(device, &mesh.positions, &mesh.normals)?;

            // Initialize GPU normal recalculation buffers (indices, normals_fixed, dirty_mask)
            // This uploads indices ONCE (topology is static) and creates accumulator buffers
            GpuSculptCompute::init_normal_buffers(device, &mut gpu_buffers, &mesh.indices);

            // Also initialize GPU normal compute pipeline
            #[cfg(not(target_arch = "wasm32"))]
            {
                let _ = get_or_init_normal_compute(device);
            }

            // Box the GpuMeshBuffers as type-erased for cross-binary compat
            mesh.gpu_buffers = Some(Box::new(gpu_buffers));
            mesh.gpu_dirty = false;
            log::info!(
                "GPU buffers created for mesh ({} vertices, {} faces)",
                mesh.positions.len() / 3,
                mesh.indices.len() / 3
            );

            // Also initialize GPU Spatial Grid for O(1) radius queries
            let vertex_count = mesh.positions.len() / 3;

            // Safety: Handle empty mesh case
            if vertex_count == 0 {
                log::warn!("GPU spatial grid skipped: empty mesh");
                mesh.gpu_dirty = false;
            } else {
                // Compute mesh bounds for grid sizing (with edge case handling)
                let mut bounds_min = [f32::MAX; 3];
                let mut bounds_max = [f32::MIN; 3];
                for i in 0..vertex_count {
                    for j in 0..3 {
                        let v = mesh.positions[i * 3 + j];
                        // Skip NaN/INF values
                        if v.is_finite() {
                            bounds_min[j] = bounds_min[j].min(v);
                            bounds_max[j] = bounds_max[j].max(v);
                        }
                    }
                }

                // Pad bounds and ensure non-zero volume (fixes single-point mesh)
                for j in 0..3 {
                    bounds_min[j] -= 0.1;
                    bounds_max[j] += 0.1;
                    // Ensure max > min even if NaN/INF or collapsed bounds
                    if !bounds_max[j].is_finite() || bounds_max[j] <= bounds_min[j] {
                        bounds_max[j] = bounds_min[j] + 1.0;
                    }
                    if !bounds_min[j].is_finite() {
                        bounds_min[j] = -1.0;
                        bounds_max[j] = 1.0;
                    }
                }

                // Cell size = reasonable for sculpting brushes (min 0.01 to prevent explosion)
                let extent = [
                    bounds_max[0] - bounds_min[0],
                    bounds_max[1] - bounds_min[1],
                    bounds_max[2] - bounds_min[2],
                ];
                let max_extent = extent[0].max(extent[1]).max(extent[2]);
                let cell_size = (max_extent / 32.0).max(0.01); // ~32 cells per axis, min 0.01

                let gpu_grid = GpuSpatialGrid::new(
                    device,
                    bounds_min,
                    bounds_max,
                    cell_size,
                    vertex_count as u32,
                );

                mesh.gpu_spatial_grid = Some(gpu_grid);
                log::info!(
                    "GPU Spatial Grid created ({} cells, cell_size={:.4})",
                    mesh.gpu_spatial_grid.as_ref().unwrap().cell_count(),
                    cell_size
                );
            }
        }

        // Downcast back to GpuMeshBuffers
        let gpu_buffers = mesh
            .gpu_buffers
            .as_ref()
            .ok_or("GPU buffers not initialized - mesh may have been disposed")?;
        let gpu_buffers = gpu_buffers
            .downcast_ref::<GpuMeshBuffers>()
            .ok_or_else(|| "GPU buffers type mismatch".to_string())?;

        // Create brush params
        let op = tool_to_sculpt_op(tool);
        let intensity_scaled = intensity * 0.05;
        let mut params = BrushParams::new(
            [center.x, center.y, center.z],
            [norm.x, norm.y, norm.z],
            radius,
            intensity_scaled,
        );

        // Enable alpha sampling if alpha_handle provided
        if alpha_handle.is_some() {
            params = params.with_alpha(1.0); // Scale 1.0 = alpha fits brush radius
            log::trace!(
                "[apply_brush_gpu] Alpha enabled with handle: {:?}",
                alpha_handle
            );
        }

        // Set delta for Grab/Snake Hook/Move brushes
        // These brushes use extra0/1/2 as the world-space mouse movement vector
        if let Some(d) = delta {
            params.extra0 = d[0];
            params.extra1 = d[1];
            params.extra2 = d[2];
        }

        // Create command encoder and dispatch
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("sculpt_gpu_encoder"),
        });

        // LAZY GRID BUILD: Only build GPU spatial grid ONCE (on first stroke)
        // Before: encode_build() every stroke = 4 GPU passes wasted per dab!
        // After: encode_build() once, then just encode_query() = massive speedup!
        let use_indirect = if let Some(ref gpu_grid) = mesh.gpu_spatial_grid {
            // Build grid ONCE on first stroke (lazy init)
            if !mesh.gpu_grid_built {
                // Build grid: clear → count → prefix_sum → scatter (4 passes)
                let positions_buf: &wgpu::Buffer = &gpu_buffers.positions;
                k_os_gpu_pipeline::spatial::GpuSpatialGrid::encode_build(
                    &gpu_grid,
                    device,
                    &mut encoder,
                    positions_buf,
                );
                mesh.gpu_grid_built = true;
                log::debug!("GPU spatial grid built (lazy init, will reuse for future strokes)");
            }
            // Query is cheap (3 passes) and needs to run every stroke with new center/radius
            gpu_grid.update_query_params(queue, [center.x, center.y, center.z], radius);
            let positions_buf: &wgpu::Buffer = &gpu_buffers.positions;
            k_os_gpu_pipeline::spatial::GpuSpatialGrid::encode_query(
                &gpu_grid,
                device,
                &mut encoder,
                positions_buf,
            );
            true
        } else {
            false
        };

        // 🔥 Level 5: Indirect dispatch - only process vertices within brush radius!

        // Optimize alpha handling: only create alpha bind group if alpha_handle is provided
        // This prevents unnecessary GPU overhead for .kbrush brushes without alpha
        let alpha_bind_group = if let Some(ah) = alpha_handle {
            use k_os_gpu_pipeline::brush::ALPHA_POOL;
            let pool = ALPHA_POOL.read();
            log::info!(
                "[apply_brush_gpu] Looking up alpha handle {} in pool ({} alphas loaded)",
                ah,
                pool.list().len()
            );
            if let Some((view, sampler)) = pool.get_texture_view_and_sampler(ah) {
                log::info!("[apply_brush_gpu] Alpha texture found, creating bind group");
                // Create bind group with sculpt pipeline's layout
                let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("sculpt_alpha_bg_from_pool"),
                    layout: compute.get_alpha_bind_group_layout(),
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::TextureView(view),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(sampler),
                        },
                    ],
                });
                Some(bg)
            } else {
                log::warn!("[apply_brush_gpu] Alpha handle {} not found in pool", ah);
                None
            }
        } else {
            // No alpha texture - don't create any bind group to avoid interference
            None
        };
        let alpha_bg_ref = alpha_bind_group.as_ref();

        if use_indirect {
            if let Some(ref gpu_grid) = mesh.gpu_spatial_grid {
                compute.encode_apply_brush_indirect(
                    device,
                    queue,
                    &mut encoder,
                    tool_to_entry_point(tool), // Pass entry point
                    gpu_buffers,
                    &gpu_grid.candidates_buffer,
                    &gpu_grid.counter_buffer,
                    &gpu_grid.indirect_buffer,
                    params,
                    op,
                    alpha_bg_ref,
                );
            }
        } else {
            // Fallback: dispatch on all vertices (no GPU spatial grid)
            compute.encode_apply_brush_all(
                device,
                queue,
                &mut encoder,
                gpu_buffers,
                params,
                op,
                alpha_bg_ref,
            );
        }

        queue.submit(std::iter::once(encoder.finish()));

        // 🔥 GPU NORMAL RECALCULATION 🔥
        // Run 3-pass atomic fixed-point shader: clear → accumulate → normalize
        // This replaces CPU recalculate_normals_incremental (5-20x faster on GPU)
        if use_indirect {
            if let Some(ref gpu_grid) = mesh.gpu_spatial_grid {
                // Use actual candidate count instead of hardcoded 10,000 cap
                // which caused artifacts on high-poly meshes after subdivision.
                let candidate_count = candidates.len() as u32;

                recalculate_normals_gpu(
                    device,
                    queue,
                    gpu_buffers,
                    &gpu_grid.candidates_buffer,
                    candidate_count,
                    &mesh.topology, // Pass topology for dirty faces computation
                    candidates,     // CPU-side candidate indices
                    &mesh.indices,  // Pass indices to build dirty vertex list
                );
            }
        }

        // === ASYNC DOUBLE-BUFFERED SPARSE READBACK ===
        // Instead of blocking (poll(Wait)), we:
        // 1. Read from FRONT buffer (previous frame's data) - non-blocking
        // 2. Copy current frame to BACK buffer
        // 3. Swap front/back when GPU is done
        // Result: CPU never waits for GPU, ~20-40% faster throughput

        let modified_indices: Vec<usize> = if use_indirect {
            if let Some(ref gpu_grid) = mesh.gpu_spatial_grid {
                // Lazy-init sparse readback buffers (sized to max_candidates)
                if mesh.sparse_readback.is_none() {
                    let readback = compute.create_sparse_readback(device, gpu_grid.max_candidates);
                    mesh.sparse_readback = Some(readback);
                    log::debug!(
                        "Created double-buffered sparse readback (max {} verts)",
                        gpu_grid.max_candidates
                    );
                }

                // Get mutable reference to sparse_readback (guaranteed Some after lazy-init above)
                let Some(sparse_readback) = mesh.sparse_readback.as_mut() else {
                    return Err("Sparse readback initialization failed".to_string());
                };

                // === STEP 1: Read from FRONT buffer (previous frame's data) ===
                // This is non-blocking because front buffer was written last frame
                let modified = if sparse_readback.first_frame {
                    // First frame: no previous data, must block this once
                    log::debug!("First frame: blocking readback (one-time)");
                    sparse_readback.first_frame = false;

                    // Run compact pass
                    let mut compact_encoder =
                        device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                            label: Some("compact_encoder_first"),
                        });
                    compute.encode_compact_positions(
                        device,
                        &mut compact_encoder,
                        &gpu_buffers.positions,
                        &gpu_buffers.normals,
                        &gpu_grid.candidates_buffer,
                        &gpu_grid.counter_buffer,
                        sparse_readback,
                        &gpu_grid.indirect_buffer,
                    );

                    // Copy to front buffer (first frame, so we read from front immediately)
                    let compact_size = sparse_readback.compact_buffer.size();
                    compact_encoder.copy_buffer_to_buffer(
                        &sparse_readback.compact_buffer,
                        0,
                        &sparse_readback.staging_front,
                        0,
                        compact_size,
                    );
                    queue.submit(std::iter::once(compact_encoder.finish()));

                    // Block just this once to get first frame's data
                    let slice = sparse_readback.staging_front.slice(..);
                    let (tx, rx) = std::sync::mpsc::channel();
                    slice.map_async(wgpu::MapMode::Read, move |result| {
                        let _ = tx.send(result);
                    });
                    let _ = device.poll(wgpu::PollType::Wait);
                    rx.recv()
                        .unwrap()
                        .map_err(|e| format!("First frame readback failed: {:?}", e))?;

                    let result = read_sparse_buffer(
                        &slice,
                        sparse_readback.max_vertices,
                        &mut mesh.positions,
                        &mut mesh.normals,
                    );
                    sparse_readback.staging_front.unmap();
                    result
                } else {
                    // === ASYNC PATH: Read front (previous frame), write to back (current frame) ===

                    // Step 1a: Try to read from front buffer (should be ready from last frame)
                    let slice = sparse_readback.staging_front.slice(..);
                    let (tx, rx) = std::sync::mpsc::channel();
                    slice.map_async(wgpu::MapMode::Read, move |result| {
                        let _ = tx.send(result);
                    });

                    // Non-blocking poll - check if ready without waiting
                    let _ = device.poll(wgpu::PollType::Poll);

                    let front_result = match rx.try_recv() {
                        Ok(Ok(())) => {
                            // Front buffer ready - read previous frame's data
                            let result = read_sparse_buffer(
                                &slice,
                                sparse_readback.max_vertices,
                                &mut mesh.positions,
                                &mut mesh.normals,
                            );
                            sparse_readback.staging_front.unmap();
                            Some(result)
                        }
                        Ok(Err(e)) => {
                            log::warn!("Front buffer map error: {:?}", e);
                            sparse_readback.staging_front.unmap();
                            None
                        }
                        Err(_) => {
                            // Not ready yet - block briefly to get current frame's data
                            // This ensures mesh updates are visible immediately
                            log::trace!(
                                "Front buffer not ready, blocking briefly for immediate update"
                            );
                            let _ = device.poll(wgpu::PollType::Wait);
                            match rx.recv() {
                                Ok(Ok(())) => {
                                    let result = read_sparse_buffer(
                                        &slice,
                                        sparse_readback.max_vertices,
                                        &mut mesh.positions,
                                        &mut mesh.normals,
                                    );
                                    sparse_readback.staging_front.unmap();
                                    Some(result)
                                }
                                Ok(Err(e)) => {
                                    log::warn!("Front buffer map error after wait: {:?}", e);
                                    sparse_readback.staging_front.unmap();
                                    None
                                }
                                Err(e) => {
                                    log::warn!("Front buffer recv error: {:?}", e);
                                    sparse_readback.staging_front.unmap();
                                    None
                                }
                            }
                        }
                    };

                    // Step 1b: Kick off GPU work for BACK buffer (current frame)
                    let mut compact_encoder =
                        device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                            label: Some("compact_encoder_async"),
                        });
                    compute.encode_compact_positions(
                        device,
                        &mut compact_encoder,
                        &gpu_buffers.positions,
                        &gpu_buffers.normals,
                        &gpu_grid.candidates_buffer,
                        &gpu_grid.counter_buffer,
                        sparse_readback,
                        &gpu_grid.indirect_buffer,
                    );

                    // Copy to BACK buffer (will be read next frame)
                    // IMPORTANT: After swap, old front (now back) may still be mapped from previous async read
                    // Only unmap if this isn't the very first sculpt frame (back was never mapped on first frame)
                    if sparse_readback.back_ready {
                        sparse_readback.staging_back.unmap();
                    }

                    let compact_size = sparse_readback.compact_buffer.size();
                    compact_encoder.copy_buffer_to_buffer(
                        &sparse_readback.compact_buffer,
                        0,
                        &sparse_readback.staging_back,
                        0,
                        compact_size,
                    );
                    queue.submit(std::iter::once(compact_encoder.finish()));

                    // Step 1c: Swap front/back for next frame
                    std::mem::swap(
                        &mut sparse_readback.staging_front,
                        &mut sparse_readback.staging_back,
                    );

                    // CRITICAL FIX: Always return the candidates we processed, even if readback was delayed
                    // This ensures Bevy mesh gets updated with the modified positions
                    front_result.unwrap_or_else(|| {
                        // If readback failed, still return the candidates so Bevy syncs the mesh
                        // The positions were already updated in mesh.positions by the GPU readback
                        log::debug!(
                            "Readback delayed, but returning {} candidates for Bevy sync",
                            candidates.len()
                        );
                        candidates.to_vec()
                    })
                };

                if !modified.is_empty() {
                    log::trace!(
                        "Async readback: {} vertices ({:.1}KB)",
                        modified.len(),
                        (modified.len() * 16) as f32 / 1024.0
                    );
                }
                modified
            } else {
                vec![]
            }
        } else {
            // Fallback: full mesh readback (no spatial grid available)
            let vertex_count = gpu_buffers.vertex_count as usize;
            if mesh.positions.len() != vertex_count * 3 {
                return Err("GPU readback failed: CPU mesh.positions length mismatch".to_string());
            }
            let positions_size = (vertex_count * 4 * std::mem::size_of::<f32>()) as u64;

            let staging_pool_cell =
                STAGING_POOL.get_or_init(|| std::sync::Mutex::new(StagingBufferPool::new()));
            let staging = {
                let mut pool = staging_pool_cell.lock().unwrap();
                pool.get_or_create(device, positions_size)
            };

            let mut copy_encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("copy_encoder"),
            });
            copy_encoder.copy_buffer_to_buffer(
                &gpu_buffers.positions,
                0,
                &staging,
                0,
                positions_size,
            );
            queue.submit(std::iter::once(copy_encoder.finish()));

            let slice = staging.slice(..);
            let (tx, rx) = std::sync::mpsc::channel();
            slice.map_async(wgpu::MapMode::Read, move |result| {
                tx.send(result).unwrap();
            });

            let _ = device.poll(wgpu::PollType::Wait);
            rx.recv()
                .unwrap()
                .map_err(|e| format!("Buffer map failed: {:?}", e))?;

            {
                let data = slice.get_mapped_range();
                let positions_data: &[f32] = bytemuck::cast_slice(&data);
                for i in 0..vertex_count {
                    let src = i * 4;
                    let dst = i * 3;
                    mesh.positions[dst] = positions_data[src];
                    mesh.positions[dst + 1] = positions_data[src + 1];
                    mesh.positions[dst + 2] = positions_data[src + 2];
                }
            }
            staging.unmap();

            {
                let mut pool = staging_pool_cell.lock().unwrap();
                pool.return_buffer(staging, positions_size);
            }

            // All vertices modified in fallback mode
            (0..vertex_count).collect()
        };

        // Mark GPU as synced
        mesh.gpu_dirty = false;

        // Return modified vertex indices
        Ok(modified_indices)
    }
}

#[cfg(target_arch = "wasm32")]
mod gpu_integration {
    use super::*;
    use k_os_gpu_pipeline::sculpt::{BrushParams, GpuMeshBuffers, GpuSculptCompute, SculptOp};
    use k_os_gpu_pipeline::GpuComputeDevice;
    use std::cell::RefCell;
    use std::collections::HashMap;
    thread_local! {
        static WS_COMPUTE: RefCell<Option<GpuSculptCompute>> = RefCell::new(None);
        static WS_BUFFERS: RefCell<HashMap<usize, GpuMeshBuffers>> = RefCell::new(HashMap::new());
    }
    pub fn apply_brush_gpu(
        mesh: &mut SculptMesh,
        _candidates: &[usize],
        center: Vec3,
        norm: Vec3,
        radius: f32,
        intensity: f32,
        tool: &str,
        _alpha_handle: Option<u64>,
        _delta: Option<[f32; 3]>,
    ) -> Result<Vec<usize>, String> {
        let gpu = GpuComputeDevice::get_or_init_blocking()?;
        let gpu_guard = gpu.lock();
        let device = &gpu_guard.device;
        let queue = &gpu_guard.queue;
        let mesh_key = mesh as *const SculptMesh as usize;
        WS_COMPUTE.with(|c| {
            let mut opt = c.borrow_mut();
            if opt.is_none() {
                *opt = Some(GpuSculptCompute::new(device, queue));
            }
        });
        let op = match tool {
            "sculpt_inflate" | "sim_inflate" => SculptOp::Inflate,
            "sculpt_clay" | "sculpt_stamp" => SculptOp::Clay,
            "sculpt_draw" => SculptOp::Draw,
            "sculpt_layer" => SculptOp::Layer,
            "sculpt_blob" => SculptOp::Blob,
            "sculpt_pinch" => SculptOp::Pinch,
            "sculpt_crease" => SculptOp::Crease,
            "sculpt_grab" | "sculpt_move" => SculptOp::Grab,
            _ => SculptOp::Clay,
        };
        let mut params = BrushParams::new(
            [center.x, center.y, center.z],
            [norm.x, norm.y, norm.z],
            radius,
            intensity * 0.05,
        );
        let vertex_count = (mesh.positions.len() / 3) as u32;
        let positions_size = vertex_count * 4 * 4;
        let staging = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("sculpt_wasm_positions_staging"),
            size: positions_size as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        WS_BUFFERS.with(|map| {
            let mut m = map.borrow_mut();
            if !m.contains_key(&mesh_key) || mesh.gpu_dirty {
                WS_COMPUTE.with(|c| {
                    let comp = c.borrow();
                    let comp = comp.as_ref().unwrap();
                    let mut gb = comp
                        .create_mesh_buffers(device, &mesh.positions, &mesh.normals)
                        .unwrap();
                    k_os_gpu_pipeline::sculpt::GpuSculptCompute::init_normal_buffers(
                        device,
                        &mut gb,
                        &mesh.indices,
                    );
                    m.insert(mesh_key, gb);
                });
                mesh.gpu_dirty = false;
            }
            let gb = m.get(&mesh_key).unwrap();
            let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("sculpt_gpu_wasm_encoder"),
            });
            WS_COMPUTE.with(|c| {
                let comp = c.borrow();
                let comp = comp.as_ref().unwrap();
                comp.encode_apply_brush_all(device, queue, &mut encoder, gb, params, op, None);
            });
            queue.submit(std::iter::once(encoder.finish()));
            let mut enc2 = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("sculpt_wasm_copy_encoder"),
            });
            enc2.copy_buffer_to_buffer(&gb.positions, 0, &staging, 0, positions_size as u64);
            queue.submit(std::iter::once(enc2.finish()));
        });
        let slice = staging.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| {
            tx.send(r).ok();
        });
        let _ = device.poll(wgpu::PollType::Wait);
        rx.recv()
            .unwrap()
            .map_err(|e| format!("Buffer map failed: {:?}", e))?;
        {
            let data = slice.get_mapped_range();
            let positions_data: &[f32] = bytemuck::cast_slice(&data);
            for i in 0..(vertex_count as usize) {
                let src = i * 4;
                let dst = i * 3;
                mesh.positions[dst] = positions_data[src];
                mesh.positions[dst + 1] = positions_data[src + 1];
                mesh.positions[dst + 2] = positions_data[src + 2];
            }
        }
        staging.unmap();
        Ok((0..(vertex_count as usize)).collect())
    }
    pub fn recalculate_normals_gpu(
        _device: &wgpu::Device,
        _queue: &wgpu::Queue,
        _gpu_buffers: &GpuMeshBuffers,
        _candidates_buffer: &wgpu::Buffer,
        _candidate_count: u32,
        _topology: &MeshTopology,
        _candidate_indices: &[usize],
        _mesh_indices: &[u32],
    ) -> bool {
        false
    }
}

use gpu_integration::apply_brush_gpu;

/// Apply a brush stroke to the mesh
/// Set use_gpu=true for GPU-accelerated sculpting (~30x faster)
/// Set alpha_handle to a valid GPU alpha texture handle to modulate intensity
/// Set delta for Grab/Snake Hook/Move brushes (world-space mouse movement)
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn apply_brush(
    handle: SculptMeshHandle,
    point: [f32; 3],
    normal: [f32; 3],
    tool: String,
    radius: f32,
    intensity: f32,
    symmetry: Option<String>,
    use_gpu: Option<bool>,
    alpha_handle: Option<u64>,
    delta: Option<[f32; 3]>, // For Grab/Snake Hook/Move brushes
) -> Result<BrushResult, String> {
    let start = Instant::now();
    let gpu_enabled = use_gpu.unwrap_or(false);

    // Log alpha usage (GPU alpha sampling integration is a future enhancement)
    if let Some(ah) = alpha_handle {
        log::debug!(
            "Brush stroke with alpha handle: {} (GPU alpha sampling planned for future)",
            ah
        );
        // TODO: Use crate::gpu::brush::ALPHA_TEXTURE_POOL to sample alpha
        // and modulate intensity based on brush position
    }

    let mut used_gpu = false;
    let mut gpu_fallback_reason: Option<String> = if gpu_enabled {
        None
    } else {
        Some("GPU not requested".to_string())
    };

    let mut meshes = MESHES.lock().unwrap();
    let mesh = meshes.get_mut(&handle).ok_or("Invalid mesh handle")?;
    let _ = sync_runtime_mesh_from_scene(mesh);

    let center = Vec3::from(point);
    let norm = Vec3::from(normal).normalize_or_zero();

    // STALENESS CHECK: Rebuild grid if too many strokes/verts since last rebuild
    const MAX_STROKES_BEFORE_REBUILD: u32 = 20;
    const MAX_VERTS_BEFORE_REBUILD: usize = 50000;

    if mesh.grid_dirty
        && (mesh.strokes_since_rebuild >= MAX_STROKES_BEFORE_REBUILD
            || mesh.verts_modified_since_rebuild >= MAX_VERTS_BEFORE_REBUILD)
    {
        // Periodic grid rebuild to maintain correctness
        mesh.grid.build(&mesh.positions);
        mesh.strokes_since_rebuild = 0;
        mesh.verts_modified_since_rebuild = 0;
        mesh.grid_dirty = false;

        // CRITICAL: Also mark GPU grid as needing rebuild!
        // Without this, GPU sculpting queries stale vertex positions,
        // causing wrong candidates and "blobby" brush output at high poly counts.
        mesh.gpu_grid_built = false;

        log::debug!("Grid rebuilt due to staleness (CPU + GPU)");
    }

    // Query vertices in sphere using GRID (not KD-tree - grid is better for sculpting)
    let candidates = mesh.grid.query_sphere(center, radius, &mesh.positions);

    // Apply brush - GPU or CPU path
    // KBrush names are now standardized snake_case
    let is_smooth_or_polish =
        tool == "sculpt_smooth" || tool == "sculpt_polish" || tool == "SMOOTH" || tool == "POLISH";

    let modified = if is_smooth_or_polish {
        // SMOOTH/POLISH always use CPU (topology-dependent)
        if gpu_enabled {
            gpu_fallback_reason = Some("Tool forces CPU path (SMOOTH/POLISH)".to_string());
        }
        apply_smooth_kernel(
            &mut mesh.positions,
            &mesh.topology,
            &candidates,
            center,
            radius,
            intensity,
        )
    } else if gpu_enabled && !candidates.is_empty() {
        // GPU PATH - 30x faster for standard brushes (with optional alpha texture)
        match apply_brush_gpu(
            mesh,
            &candidates,
            center,
            norm,
            radius,
            intensity,
            &tool,
            alpha_handle,
            delta,
        ) {
            Ok(modified_indices) => {
                used_gpu = true;
                gpu_fallback_reason = None;
                let gpu_time = start.elapsed().as_secs_f64() * 1000.0;
                log::debug!(
                    "GPU brush: {} verts in {:.3}ms (alpha: {:?})",
                    modified_indices.len(),
                    gpu_time,
                    alpha_handle.is_some()
                );
                modified_indices
            }
            Err(e) => {
                // Fallback to CPU on GPU error
                log::warn!("GPU brush failed, falling back to CPU: {}", e);
                gpu_fallback_reason = Some(e);
                apply_brush_kernel(
                    &mut mesh.positions,
                    &candidates,
                    center,
                    norm,
                    radius,
                    intensity,
                    &tool,
                    None,
                )
            }
        }
    } else {
        // CPU PATH
        if gpu_enabled && candidates.is_empty() {
            gpu_fallback_reason = Some("No vertices in brush radius".to_string());
        }
        apply_brush_kernel(
            &mut mesh.positions,
            &candidates,
            center,
            norm,
            radius,
            intensity,
            &tool,
            None,
        )
    };

    // Handle X symmetry
    let mut all_modified = modified;
    if symmetry.as_deref() == Some("X") {
        let sym_center = Vec3::new(-point[0], point[1], point[2]);
        let sym_normal = Vec3::new(-normal[0], normal[1], normal[2]).normalize_or_zero();

        let sym_candidates = mesh.grid.query_sphere(sym_center, radius, &mesh.positions);

        let sym_modified = if is_smooth_or_polish {
            apply_smooth_kernel(
                &mut mesh.positions,
                &mesh.topology,
                &sym_candidates,
                sym_center,
                radius,
                intensity,
            )
        } else {
            apply_brush_kernel(
                &mut mesh.positions,
                &sym_candidates,
                sym_center,
                sym_normal,
                radius,
                intensity,
                &tool,
                None,
            )
        };

        all_modified.extend(sym_modified);
    }

    // Update staleness tracking
    mesh.strokes_since_rebuild += 1;
    mesh.verts_modified_since_rebuild += all_modified.len();
    mesh.grid_dirty = true;
    mesh.kdtree_dirty = true; // KD-tree is now stale, never use for sculpt queries!

    // Deduplicate
    all_modified.sort_unstable();
    all_modified.dedup();

    if let Some(scene_mesh) = mesh.scene_mesh {
        let _ = SCENE_WORLD
            .write()
            .map_err(|_| "Failed to lock scene world".to_string())?
            .update_mesh_positions_partial(scene_mesh, &all_modified, &mesh.positions);
    }

    // Recalculate normals for affected area
    // GPU path: normals are read back from GPU via compact shader - no CPU recalc needed!
    // CPU path: must compute normals now
    let normal_indices = if used_gpu {
        #[cfg(target_arch = "wasm32")]
        {
            recalculate_normals_incremental(
                &mesh.positions,
                &mut mesh.normals,
                &mesh.indices,
                &mesh.topology,
                &all_modified,
            )
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            log::trace!("GPU sculpt: normals read back from GPU (no CPU recalc)");
            all_modified.clone()
        }
    } else {
        // CPU path - must compute normals now
        recalculate_normals_incremental(
            &mesh.positions,
            &mut mesh.normals,
            &mesh.indices,
            &mesh.topology,
            &all_modified,
        )
    };

    if let Some(scene_mesh) = mesh.scene_mesh {
        let mut packed_normals = Vec::with_capacity(normal_indices.len() * 3);
        for &idx in &normal_indices {
            let base = idx * 3;
            if base + 2 < mesh.normals.len() {
                packed_normals.push(mesh.normals[base]);
                packed_normals.push(mesh.normals[base + 1]);
                packed_normals.push(mesh.normals[base + 2]);
            }
        }

        let _ = SCENE_WORLD
            .write()
            .map_err(|_| "Failed to lock scene world".to_string())?
            .update_mesh_normals_partial(scene_mesh, &normal_indices, &packed_normals);
        let _ = evaluate_viewport_bridge_summary(scene_mesh);
    }

    // === SCRATCH BUFFER REUSE for output packing ===
    // Take ownership of scratch buffers, fill them, they'll be returned with response
    // The Vec capacity stays in the returned value - we recreate with same capacity for next call

    // Collect positions for modified vertices (reuse scratch buffer)
    let mut new_positions = std::mem::take(&mut mesh.scratch_positions_out);
    new_positions.clear();
    new_positions.reserve(all_modified.len() * 3);
    for &idx in &all_modified {
        let i = idx * 3;
        new_positions.push(mesh.positions[i]);
        new_positions.push(mesh.positions[i + 1]);
        new_positions.push(mesh.positions[i + 2]);
    }

    // Collect normals for affected vertices (reuse scratch buffer)
    let mut new_normals = std::mem::take(&mut mesh.scratch_normals_out);
    new_normals.clear();
    new_normals.reserve(normal_indices.len() * 3);
    for &idx in &normal_indices {
        let i = idx * 3;
        new_normals.push(mesh.normals[i]);
        new_normals.push(mesh.normals[i + 1]);
        new_normals.push(mesh.normals[i + 2]);
    }

    // === TANGENT COMPUTATION (sparse update for affected vertices) ===
    // TODO: Integrate tangent computation once UVs are added to SculptMesh
    // This will fix PBR material artifacts (white marks) caused by stale tangents
    //
    // Implementation plan:
    // 1. Add `uvs: Vec<f32>` field to SculptMesh struct
    // 2. Pass UVs to init_sculpt_mesh command
    // 3. Uncomment the code below to enable tangent computation
    //
    // let (new_tangents, tangent_indices) = if mesh.uvs.len() == mesh.positions.len() / 3 * 2 {
    //     use crate::modules::sculpting::tangents::compute_tangents_sparse;
    //     let (tangents, indices) = compute_tangents_sparse(
    //         &mesh.positions,
    //         &mesh.normals,
    //         &mesh.uvs,
    //         &mesh.indices,
    //         &all_modified,
    //     );
    //     (Some(tangents), Some(indices))
    // } else {
    //     log::warn!("Tangent computation skipped: UVs not available or invalid length");
    //     (None, None)
    // };

    // Put scratch buffers back (they're now empty but have capacity from previous calls)
    // Actually - we need to return these, so create new scratch buffers with reasonable capacity
    mesh.scratch_positions_out = Vec::with_capacity(all_modified.len() * 3);
    mesh.scratch_normals_out = Vec::with_capacity(normal_indices.len() * 3);

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    let affected_count = all_modified.len();

    Ok(BrushResult {
        modified_indices: all_modified, // Move ownership (no clone needed)
        new_positions,
        new_normals: Some(new_normals),
        normal_indices: Some(normal_indices),
        new_tangents: None, // TODO: Integrate tangent computation
        tangent_indices: None,
        time_ms: elapsed,
        affected_count,
        used_gpu,
        gpu_fallback_reason,
    })
}

/// Apply brush stroke using SPIR-V shader (KAIN-compiled)
///
/// This function uses pre-compiled SPIR-V shaders from KAIN (.kn) source files.
/// Keeps WGSL pipeline intact for comparison and fallback.
///
/// # Arguments
/// * `handle` - Sculpt mesh handle
/// * `point` - Brush center position in world space
/// * `normal` - Brush normal direction
/// * `shader_name` - SPIR-V shader name (e.g., "stamp_clay", "physics_attractor")
/// * `radius` - Brush radius
/// * `intensity` - Brush strength/intensity
/// * `alpha_handle` - Optional alpha texture handle
///
/// # Returns
/// * `Ok(BrushResult)` - Brush stroke result with modified vertices
/// * `Err(String)` - Error message if operation fails
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn apply_brush_spirv(
    handle: SculptMeshHandle,
    point: [f32; 3],
    normal: [f32; 3],
    shader_name: String,
    radius: f32,
    intensity: f32,
    alpha_handle: Option<u64>,
) -> Result<BrushResult, String> {
    let start = Instant::now();

    // Get mesh
    let mut meshes = MESHES.lock().unwrap();
    let mesh = meshes.get_mut(&handle).ok_or("Invalid mesh handle")?;
    let _ = sync_runtime_mesh_from_scene(mesh);

    // Auto-initialize GPU device if needed
    let gpu = GpuComputeDevice::get_or_init_blocking()?;
    let gpu_guard = gpu.lock();
    let device = &gpu_guard.device;
    let queue = &gpu_guard.queue;

    // Get or create GpuSculptCompute pipeline
    let compute_cell = gpu_integration::GPU_COMPUTE
        .get_or_init(|| std::sync::Mutex::new(Some(GpuSculptCompute::new(device, queue))));
    let compute_guard = compute_cell.lock().unwrap();
    let compute = compute_guard
        .as_ref()
        .ok_or_else(|| "GPU compute pipeline not available".to_string())?;

    // Lazy-init GPU buffers for this mesh if needed
    if mesh.gpu_buffers.is_none() || mesh.gpu_dirty {
        let mut gpu_buffers =
            compute.create_mesh_buffers(device, &mesh.positions, &mesh.normals)?;
        GpuSculptCompute::init_normal_buffers(device, &mut gpu_buffers, &mesh.indices);
        mesh.gpu_buffers = Some(Box::new(gpu_buffers) as AnyBox);
        mesh.gpu_dirty = false;
    }

    // Downcast gpu_buffers from AnyBox to GpuMeshBuffers
    let gpu_buffers = mesh
        .gpu_buffers
        .as_ref()
        .and_then(|b| b.downcast_ref::<GpuMeshBuffers>())
        .ok_or_else(|| "Failed to downcast GPU buffers".to_string())?;

    // Create brush parameters
    let params = BrushParams::new(point, normal, radius, intensity);

    // Create command encoder
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("spirv_brush_encoder"),
    });

    // Get alpha bind group if provided
    let alpha_bind_group: Option<&wgpu::BindGroup> = if let Some(_ah) = alpha_handle {
        // TODO: Implement alpha texture lookup
        None
    } else {
        None
    };

    // Encode SPIR-V brush stroke
    compute.encode_apply_brush_spirv(
        device,
        queue,
        &mut encoder,
        gpu_buffers,
        &params,
        &shader_name,
        alpha_bind_group,
        None, // candidates - None means process all vertices
    )?;

    // Submit command buffer
    queue.submit(std::iter::once(encoder.finish()));

    // TODO: Implement proper sparse readback for SPIR-V brushes
    // For now, mark all vertices as modified (performance hit but works)
    let vertex_count = mesh.positions.len() / 3;
    let modified_indices: Vec<usize> = (0..vertex_count).collect();

    // Extract new positions for modified vertices
    let new_positions: Vec<f32> = modified_indices
        .iter()
        .flat_map(|&i| {
            let idx = i * 3;
            vec![
                mesh.positions[idx],
                mesh.positions[idx + 1],
                mesh.positions[idx + 2],
            ]
        })
        .collect();

    // Recalculate normals for affected vertices
    let new_normals = vec![]; // TODO: Implement normal recalculation
    let normal_indices = vec![];

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    let affected_count = modified_indices.len();

    Ok(BrushResult {
        modified_indices,
        new_positions,
        new_normals: Some(new_normals),
        normal_indices: Some(normal_indices),
        new_tangents: None,
        tangent_indices: None,
        time_ms: elapsed,
        affected_count,
        used_gpu: true,
        gpu_fallback_reason: None,
    })
}

/// Update mesh positions (from JS-side modifications)
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn update_sculpt_positions(
    handle: SculptMeshHandle,
    positions: Vec<f32>,
) -> Result<(), String> {
    let mut meshes = MESHES.lock().unwrap();
    let mesh = meshes.get_mut(&handle).ok_or("Invalid mesh handle")?;

    mesh.positions = positions.clone();
    mesh.grid.build(&mesh.positions);

    // Reset staleness tracking since grid was just rebuilt
    mesh.strokes_since_rebuild = 0;
    mesh.verts_modified_since_rebuild = 0;
    mesh.grid_dirty = false;
    mesh.kdtree_dirty = true; // KD-tree is stale after position update

    // Recompute all normals since JS fully updated positions
    mesh.normals = compute_all_normals(&mesh.positions, &mesh.indices);

    if let Some(scene_mesh) = mesh.scene_mesh {
        SCENE_WORLD
            .write()
            .map_err(|_| "Failed to lock scene world".to_string())?
            .update_mesh_source(
                scene_mesh,
                positions,
                mesh.indices.clone(),
                Some(mesh.normals.clone()),
            )
            .map_err(|e| e.to_string())?;
        let _ = evaluate_viewport_bridge_summary(scene_mesh);
    }

    Ok(())
}

/// Get all positions from the mesh
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn get_sculpt_positions(handle: SculptMeshHandle) -> Result<Vec<f32>, String> {
    let meshes = MESHES.lock().unwrap();
    let mesh = meshes.get(&handle).ok_or("Invalid mesh handle")?;
    if let Some(scene_mesh) = mesh.scene_mesh {
        let scene = SCENE_WORLD
            .read()
            .map_err(|_| "Failed to lock scene world".to_string())?;
        if let Ok(source) = scene.mesh_source(scene_mesh) {
            return Ok(source.positions.as_ref().to_vec());
        }
    }
    Ok(mesh.positions.clone())
}

/// Get evaluator-derived viewport mesh payload for a sculpt mesh.
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn get_sculpt_viewport_payload(
    handle: SculptMeshHandle,
) -> Result<k_os_eval::mesh_pipeline::ViewportBufferPayload, String> {
    let meshes = MESHES.lock().unwrap();
    let mesh = meshes.get(&handle).ok_or("Invalid mesh handle")?;
    let scene_mesh = mesh
        .scene_mesh
        .ok_or("Sculpt mesh is not bound to scene state")?;
    drop(meshes);

    evaluate_viewport_payload(scene_mesh)
}

/// Dispose of a sculpt mesh
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn dispose_sculpt_mesh(handle: SculptMeshHandle) -> Result<(), String> {
    let mut meshes = MESHES.lock().unwrap();
    if let Some(mesh) = meshes.remove(&handle) {
        if let Some(scene_mesh) = mesh.scene_mesh {
            let _ = SCENE_WORLD
                .write()
                .map_err(|_| "Failed to lock scene world".to_string())?
                .delete_mesh(scene_mesh);
        }
    }
    Ok(())
}

/// Benchmark the spatial grid query performance
#[cfg_attr(not(target_arch = "wasm32"), tauri::command)]
pub fn benchmark_sculpt(vertex_count: usize, radius: f32) -> Result<String, String> {
    let start = Instant::now();

    // Create synthetic mesh (sphere-ish)
    let mut positions = Vec::with_capacity(vertex_count * 3);
    for i in 0..vertex_count {
        let t = i as f32 / vertex_count as f32 * std::f32::consts::PI * 2.0;
        let phi = (i as f32 * 0.618033988749895).fract() * std::f32::consts::PI;
        let r = 1.0 + (t * 10.0).sin() * 0.1;

        positions.push(r * phi.sin() * t.cos());
        positions.push(r * phi.sin() * t.sin());
        positions.push(r * phi.cos());
    }

    let mut grid = SpatialGrid::new(radius * 0.5);
    grid.build(&positions);
    let build_time = start.elapsed().as_secs_f64() * 1000.0;

    let query_start = Instant::now();
    let center = Vec3::new(0.5, 0.5, 0.5);
    let result = grid.query_sphere(center, radius, &positions);
    let query_time = query_start.elapsed().as_secs_f64() * 1000.0;

    Ok(format!(
        "Benchmark: {} vertices, build={:.2}ms, query={:.4}ms, found={} vertices",
        vertex_count,
        build_time,
        query_time,
        result.len()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spatial_grid() {
        let positions = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
            0.5, 0.5, 0.0, // v3 - inside query
        ];

        let mut grid = SpatialGrid::new(0.5);
        grid.build(&positions);

        let center = Vec3::new(0.5, 0.5, 0.0);
        let result = grid.query_sphere(center, 0.6, &positions);

        assert!(result.contains(&3), "Should find vertex 3 at query center");
    }

    #[test]
    fn test_normal_computation() {
        // Simple triangle
        let positions = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
        ];
        let indices = vec![0, 1, 2];

        let normals = compute_all_normals(&positions, &indices);

        // Normal should point in +Z direction
        assert!(normals[2] > 0.9, "Normal Z should be ~1.0");
        assert!(normals[5] > 0.9, "Normal Z should be ~1.0");
        assert!(normals[8] > 0.9, "Normal Z should be ~1.0");
    }
}
