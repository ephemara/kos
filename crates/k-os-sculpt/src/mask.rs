#![cfg(not(target_arch = "wasm32"))]
//! Mask Module - Shared masking system for KSculpt and Bevy sculpt
//!
//! Provides vertex masking functionality that both Simple mode (KSculpt via IPC)
//! and Advanced mode (Bevy direct call) can use.
//!
//! Mask values range from 0.0 (unmasked) to 1.0 (fully masked).
//! Masked vertices receive reduced/no brush displacement.

use lazy_static::lazy_static;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

// ============================================================================
// MASK STORAGE (per sculpt mesh handle)
// ============================================================================

lazy_static! {
    /// Global mask storage, keyed by mesh handle
    static ref MASK_STORAGE: Mutex<HashMap<u64, Vec<f32>>> = Mutex::new(HashMap::new());
}

/// Initialize mask for a mesh (call after init_sculpt_mesh)
pub fn init_mask_for_mesh(handle: u64, vertex_count: usize) {
    if let Ok(mut storage) = MASK_STORAGE.lock() {
        storage.insert(handle, vec![0.0; vertex_count]);
    }
}

/// Get mask array for a mesh handle
pub fn get_mask_mut(handle: u64) -> Option<Vec<f32>> {
    MASK_STORAGE.lock().ok()?.get(&handle).cloned()
}

/// Update mask array for a mesh handle
pub fn set_mask(handle: u64, mask: Vec<f32>) {
    if let Ok(mut storage) = MASK_STORAGE.lock() {
        storage.insert(handle, mask);
    }
}

/// Dispose mask when mesh is disposed
pub fn dispose_mask(handle: u64) {
    if let Ok(mut storage) = MASK_STORAGE.lock() {
        storage.remove(&handle);
    }
}

// ============================================================================
// TAURI COMMANDS (IPC for KSculpt)
// ============================================================================

/// Paint mask at position - Tauri command wrapper
#[tauri::command]
pub fn paint_mask_cmd(
    handle: u64,
    positions: Vec<f32>,
    center: [f32; 3],
    radius: f32,
    intensity: f32,
    falloff: f32,
) -> Result<MaskPaintResult, String> {
    let mut storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    let mask = storage
        .get_mut(&handle)
        .ok_or_else(|| format!("Mask not found for handle {}", handle))?;

    // Ensure mask size matches positions
    let expected_len = positions.len() / 3;
    if mask.len() != expected_len {
        mask.resize(expected_len, 0.0);
    }

    Ok(paint_mask(
        mask, &positions, center, radius, intensity, falloff,
    ))
}

/// Clear mask - Tauri command wrapper
#[tauri::command]
pub fn clear_mask_cmd(handle: u64) -> Result<(), String> {
    let mut storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    let mask = storage
        .get_mut(&handle)
        .ok_or_else(|| format!("Mask not found for handle {}", handle))?;

    clear_mask(mask);
    Ok(())
}

/// Invert mask - Tauri command wrapper
#[tauri::command]
pub fn invert_mask_cmd(handle: u64) -> Result<(), String> {
    let mut storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    let mask = storage
        .get_mut(&handle)
        .ok_or_else(|| format!("Mask not found for handle {}", handle))?;

    invert_mask(mask);
    Ok(())
}

/// Grow mask - Tauri command wrapper
#[tauri::command]
pub fn grow_mask_cmd(handle: u64, indices: Vec<u32>, iterations: u32) -> Result<(), String> {
    let mut storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    let mask = storage
        .get_mut(&handle)
        .ok_or_else(|| format!("Mask not found for handle {}", handle))?;

    grow_mask(mask, &indices, iterations);
    Ok(())
}

/// Shrink mask - Tauri command wrapper
#[tauri::command]
pub fn shrink_mask_cmd(handle: u64, indices: Vec<u32>, iterations: u32) -> Result<(), String> {
    let mut storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    let mask = storage
        .get_mut(&handle)
        .ok_or_else(|| format!("Mask not found for handle {}", handle))?;

    shrink_mask(mask, &indices, iterations);
    Ok(())
}

/// Blur mask - Tauri command wrapper
#[tauri::command]
pub fn blur_mask_cmd(handle: u64, indices: Vec<u32>, iterations: u32) -> Result<(), String> {
    let mut storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    let mask = storage
        .get_mut(&handle)
        .ok_or_else(|| format!("Mask not found for handle {}", handle))?;

    blur_mask(mask, &indices, iterations);
    Ok(())
}

/// Get mask values - Tauri command wrapper
#[tauri::command]
pub fn get_mask_cmd(handle: u64) -> Result<Vec<f32>, String> {
    let storage = MASK_STORAGE.lock().map_err(|e| e.to_string())?;

    storage
        .get(&handle)
        .cloned()
        .ok_or_else(|| format!("Mask not found for handle {}", handle))
}

/// Result from a mask paint operation
#[derive(Debug, Clone, serde::Serialize)]
pub struct MaskPaintResult {
    /// Indices of vertices that were modified
    pub modified_indices: Vec<u32>,
    /// New mask values for modified vertices
    pub new_values: Vec<f32>,
    /// Time taken in milliseconds
    pub time_ms: f64,
}

/// Result from a mask extraction operation  
#[derive(Debug, Clone, serde::Serialize)]
pub struct MaskExtractResult {
    /// Indices of triangles to keep (each triplet of indices)
    pub kept_face_indices: Vec<u32>,
    /// Number of faces kept
    pub face_count: usize,
}

// ============================================================================
// CORE MASK OPERATIONS
// ============================================================================

/// Paint mask values onto vertices within radius
///
/// # Arguments
/// * `mask` - Mutable mask array (one value per vertex)
/// * `positions` - Flat vertex positions [x0,y0,z0, x1,y1,z1, ...]
/// * `center` - Brush center point [x, y, z]
/// * `radius` - Brush radius
/// * `intensity` - Mask intensity per stroke (+1.0 to add mask, -1.0 to remove)
/// * `falloff` - Falloff curve (0.0 = hard edge, 1.0 = smooth)
pub fn paint_mask(
    mask: &mut [f32],
    positions: &[f32],
    center: [f32; 3],
    radius: f32,
    intensity: f32,
    falloff: f32,
) -> MaskPaintResult {
    let start = std::time::Instant::now();

    let vertex_count = positions.len() / 3;
    let radius_sq = radius * radius;
    let cx = center[0];
    let cy = center[1];
    let cz = center[2];

    let mut modified_indices = Vec::new();
    let mut new_values = Vec::new();

    for i in 0..vertex_count {
        let px = positions[i * 3];
        let py = positions[i * 3 + 1];
        let pz = positions[i * 3 + 2];

        let dx = px - cx;
        let dy = py - cy;
        let dz = pz - cz;
        let dist_sq = dx * dx + dy * dy + dz * dz;

        if dist_sq < radius_sq {
            let dist = dist_sq.sqrt();
            let t = dist / radius; // 0 at center, 1 at edge

            // Falloff: smooth or hard edge
            let weight = if falloff > 0.0 {
                let smooth = 1.0 - t.powf(2.0 / falloff.max(0.01));
                smooth.max(0.0)
            } else {
                1.0 // Hard edge
            };

            // Apply intensity with weight
            let delta = intensity * weight;
            let old_val = mask[i];
            let new_val = (old_val + delta).clamp(0.0, 1.0);

            if (new_val - old_val).abs() > 0.001 {
                mask[i] = new_val;
                modified_indices.push(i as u32);
                new_values.push(new_val);
            }
        }
    }

    MaskPaintResult {
        modified_indices,
        new_values,
        time_ms: start.elapsed().as_secs_f64() * 1000.0,
    }
}

/// Clear all mask values to 0
pub fn clear_mask(mask: &mut [f32]) {
    mask.fill(0.0);
}

/// Invert mask: 1.0 - current value
pub fn invert_mask(mask: &mut [f32]) {
    for val in mask.iter_mut() {
        *val = 1.0 - *val;
    }
}

/// Expand mask by one edge ring
///
/// Any unmasked vertex adjacent to a masked vertex becomes masked.
pub fn grow_mask(mask: &mut [f32], indices: &[u32], iterations: u32) {
    let vertex_count = mask.len();

    // Build adjacency ONCE before all iterations (was O(faces * iterations), now O(faces))
    let mut neighbors: Vec<HashSet<usize>> = vec![HashSet::new(); vertex_count];
    for tri in indices.chunks(3) {
        if tri.len() < 3 {
            continue;
        }
        let a = tri[0] as usize;
        let b = tri[1] as usize;
        let c = tri[2] as usize;

        if a < vertex_count {
            neighbors[a].insert(b);
            neighbors[a].insert(c);
        }
        if b < vertex_count {
            neighbors[b].insert(a);
            neighbors[b].insert(c);
        }
        if c < vertex_count {
            neighbors[c].insert(a);
            neighbors[c].insert(b);
        }
    }

    for _ in 0..iterations {
        // Find vertices to mask (neighbors of currently masked)
        let mut to_mask = Vec::new();

        for i in 0..vertex_count {
            if mask[i] > 0.1 {
                for &neighbor in &neighbors[i] {
                    if neighbor < vertex_count && mask[neighbor] < 0.1 {
                        to_mask.push(neighbor);
                    }
                }
            }
        }

        // Apply
        for idx in to_mask {
            mask[idx] = 1.0;
        }
    }
}

/// Contract mask by one edge ring
///
/// Any masked vertex adjacent to an unmasked vertex becomes unmasked.
pub fn shrink_mask(mask: &mut [f32], indices: &[u32], iterations: u32) {
    let vertex_count = mask.len();

    // Build adjacency ONCE before all iterations (was O(faces * iterations), now O(faces))
    let mut neighbors: Vec<HashSet<usize>> = vec![HashSet::new(); vertex_count];
    for tri in indices.chunks(3) {
        if tri.len() < 3 {
            continue;
        }
        let a = tri[0] as usize;
        let b = tri[1] as usize;
        let c = tri[2] as usize;

        if a < vertex_count {
            neighbors[a].insert(b);
            neighbors[a].insert(c);
        }
        if b < vertex_count {
            neighbors[b].insert(a);
            neighbors[b].insert(c);
        }
        if c < vertex_count {
            neighbors[c].insert(a);
            neighbors[c].insert(b);
        }
    }

    for _ in 0..iterations {
        // Find vertices to unmask (masked vertices adjacent to unmasked)
        let mut to_unmask = Vec::new();

        for i in 0..vertex_count {
            if mask[i] > 0.1 {
                for &neighbor in &neighbors[i] {
                    if neighbor < vertex_count && mask[neighbor] < 0.1 {
                        to_unmask.push(i);
                        break;
                    }
                }
            }
        }

        // Apply
        for idx in to_unmask {
            mask[idx] = 0.0;
        }
    }
}

/// Get mask weight for brush operations
///
/// Returns inverted mask value so:
/// - Unmasked (0.0) → weight 1.0 (full brush effect)
/// - Fully masked (1.0) → weight 0.0 (no brush effect)
#[inline]
pub fn get_brush_weight(mask: &[f32], vertex_idx: usize) -> f32 {
    if vertex_idx < mask.len() {
        1.0 - mask[vertex_idx]
    } else {
        1.0
    }
}

/// Extract indices of faces where all vertices are masked above threshold
pub fn extract_masked_faces(mask: &[f32], indices: &[u32], threshold: f32) -> MaskExtractResult {
    let mut kept_face_indices = Vec::new();

    for (face_idx, tri) in indices.chunks(3).enumerate() {
        if tri.len() < 3 {
            continue;
        }

        let a = tri[0] as usize;
        let b = tri[1] as usize;
        let c = tri[2] as usize;

        // Keep face if ALL vertices are masked above threshold
        if mask.get(a).copied().unwrap_or(0.0) > threshold
            && mask.get(b).copied().unwrap_or(0.0) > threshold
            && mask.get(c).copied().unwrap_or(0.0) > threshold
        {
            kept_face_indices.push(face_idx as u32);
        }
    }

    let face_count = kept_face_indices.len();

    MaskExtractResult {
        kept_face_indices,
        face_count,
    }
}

/// Smooth mask values based on neighbor averaging
pub fn blur_mask(mask: &mut [f32], indices: &[u32], iterations: u32) {
    let vertex_count = mask.len();

    // Build adjacency once
    let mut neighbors: Vec<Vec<usize>> = vec![Vec::new(); vertex_count];

    for tri in indices.chunks(3) {
        if tri.len() < 3 {
            continue;
        }
        let a = tri[0] as usize;
        let b = tri[1] as usize;
        let c = tri[2] as usize;

        neighbors[a].push(b);
        neighbors[a].push(c);
        neighbors[b].push(a);
        neighbors[b].push(c);
        neighbors[c].push(a);
        neighbors[c].push(b);
    }

    // Deduplicate neighbors
    for n in neighbors.iter_mut() {
        n.sort();
        n.dedup();
    }

    // Iterate blur
    let mut temp = vec![0.0f32; vertex_count];

    for _ in 0..iterations {
        for i in 0..vertex_count {
            if neighbors[i].is_empty() {
                temp[i] = mask[i];
            } else {
                let mut sum = mask[i];
                for &n in &neighbors[i] {
                    sum += mask[n];
                }
                temp[i] = sum / (neighbors[i].len() + 1) as f32;
            }
        }
        mask.copy_from_slice(&temp);
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clear_mask() {
        let mut mask = vec![0.5, 1.0, 0.3, 0.8];
        clear_mask(&mut mask);
        assert!(mask.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn test_invert_mask() {
        let mut mask = vec![0.0, 0.5, 1.0];
        invert_mask(&mut mask);
        assert!((mask[0] - 1.0).abs() < 0.001);
        assert!((mask[1] - 0.5).abs() < 0.001);
        assert!((mask[2] - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_paint_mask_radius() {
        // Simple quad: 4 vertices at corners
        let positions = vec![
            0.0, 0.0, 0.0, // 0: at origin
            1.0, 0.0, 0.0, // 1: 1 unit away
            0.0, 1.0, 0.0, // 2: 1 unit away
            5.0, 5.0, 0.0, // 3: far away
        ];
        let mut mask = vec![0.0; 4];

        // Paint at origin with radius 1.5
        let result = paint_mask(&mut mask, &positions, [0.0, 0.0, 0.0], 1.5, 1.0, 1.0);

        // Vertices 0, 1, 2 should be affected (within radius)
        // Vertex 3 should not be affected (far away)
        assert!(mask[0] > 0.5); // At center, should be high
        assert!(mask[1] > 0.0); // Within radius
        assert!(mask[2] > 0.0); // Within radius
        assert!(mask[3] == 0.0); // Outside radius
    }

    #[test]
    fn test_get_brush_weight() {
        let mask = vec![0.0, 0.5, 1.0];
        assert!((get_brush_weight(&mask, 0) - 1.0).abs() < 0.001); // Unmasked = full
        assert!((get_brush_weight(&mask, 1) - 0.5).abs() < 0.001); // Half masked
        assert!((get_brush_weight(&mask, 2) - 0.0).abs() < 0.001); // Fully masked = none
    }
}
