//! Tauri Commands for GPU Atlas
//!
//! Handle-based API for GPU-accelerated UV unwrapping.

use serde::Serialize;
use tauri::command;

use super::packer;
use super::projector;

/// Result of atlas initialization
#[derive(Serialize)]
pub struct AtlasInitResult {
    pub handle: u64,
    pub vertex_count: usize,
}

/// Result of projection operation
#[derive(Serialize)]
pub struct AtlasProjectResult {
    pub uvs: Vec<f32>,
    pub time_ms: f64,
}

/// Result of packing operation
#[derive(Serialize)]
pub struct AtlasPackResult {
    pub uvs: Vec<f32>,
    pub island_count: usize,
    pub time_ms: f64,
}

/// Initialize GPU atlas for a mesh
/// Returns a handle for subsequent operations
#[command]
pub fn gpu_atlas_init(positions: Vec<f32>, normals: Vec<f32>) -> Result<AtlasInitResult, String> {
    let vertex_count = positions.len() / 3;

    // Generate normals if not provided
    let normals = if normals.is_empty() {
        generate_flat_normals(&positions)
    } else {
        normals
    };

    let handle = projector::create_instance(&positions, &normals)?;

    Ok(AtlasInitResult {
        handle,
        vertex_count,
    })
}

/// Project UVs using GPU compute
#[command]
pub fn gpu_atlas_project(
    handle: u64,
    mode: String,
    scale: Option<f32>,
    offset_u: Option<f32>,
    offset_v: Option<f32>,
) -> Result<AtlasProjectResult, String> {
    let start = std::time::Instant::now();

    let uvs = projector::project_instance(
        handle,
        &mode,
        scale.unwrap_or(1.0),
        offset_u.unwrap_or(0.0),
        offset_v.unwrap_or(0.0),
    )?;

    let time_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(AtlasProjectResult { uvs, time_ms })
}

/// Dispose of an atlas instance
#[command]
pub fn gpu_atlas_dispose(handle: u64) -> Result<(), String> {
    projector::dispose_instance(handle)
}

/// One-shot projection without handle management
/// Convenience function for simple use cases
#[command]
pub fn gpu_atlas_project_oneshot(
    positions: Vec<f32>,
    normals: Vec<f32>,
    mode: String,
    scale: Option<f32>,
    offset_u: Option<f32>,
    offset_v: Option<f32>,
) -> Result<AtlasProjectResult, String> {
    let start = std::time::Instant::now();

    // Generate normals if not provided
    let normals = if normals.is_empty() {
        generate_flat_normals(&positions)
    } else {
        normals
    };

    // Create, project, dispose in one call
    let handle = projector::create_instance(&positions, &normals)?;

    let uvs = projector::project_instance(
        handle,
        &mode,
        scale.unwrap_or(1.0),
        offset_u.unwrap_or(0.0),
        offset_v.unwrap_or(0.0),
    )?;

    projector::dispose_instance(handle)?;

    let time_ms = start.elapsed().as_secs_f64() * 1000.0;

    log::info!(
        "[GpuAtlas] One-shot projection: {} verts in {:.2}ms",
        positions.len() / 3,
        time_ms
    );

    Ok(AtlasProjectResult { uvs, time_ms })
}

/// Pack UV islands using GPU compute
/// Takes existing UVs and packs them efficiently into 0-1 space
#[command]
pub fn gpu_atlas_pack(
    uvs: Vec<f32>,
    indices: Vec<u32>,
    padding: Option<f32>,
) -> Result<AtlasPackResult, String> {
    let start = std::time::Instant::now();

    // Detect islands first (CPU)
    let (_island_ids, islands) = packer::detect_islands(&uvs, &indices);
    let island_count = islands.len();

    // Pack on GPU
    let packed_uvs = packer::pack_islands_gpu(&uvs, &indices, padding.unwrap_or(0.01))?;

    let time_ms = start.elapsed().as_secs_f64() * 1000.0;

    log::info!(
        "[GpuAtlas] Packed {} islands in {:.2}ms",
        island_count,
        time_ms
    );

    Ok(AtlasPackResult {
        uvs: packed_uvs,
        island_count,
        time_ms,
    })
}

/// Generate flat normals from positions (for meshes without normals)
fn generate_flat_normals(positions: &[f32]) -> Vec<f32> {
    // For now, just generate up-facing normals
    // TODO: Compute proper face normals and average at vertices
    let vertex_count = positions.len() / 3;
    let mut normals = Vec::with_capacity(vertex_count * 3);

    for _ in 0..vertex_count {
        normals.push(0.0);
        normals.push(1.0);
        normals.push(0.0);
    }

    normals
}
