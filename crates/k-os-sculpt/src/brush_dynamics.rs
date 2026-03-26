#![cfg(not(target_arch = "wasm32"))]
//! Brush Dynamics Module for KPainter
//!
//! High-performance brush calculations offloaded from JS:
//! - Batch raycast interpolation
//! - SIMD symmetry calculations
//! - Velocity grid in RGBA format (no JS conversion)

use glam::Vec2;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

// ============================================================================
// BRUSH INTERPOLATION - Replace JS loop with parallel Rust
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterpolatedPoint {
    pub uv: [f32; 2],
    pub pressure: f32,
    pub t: f32, // Position along stroke (0-1)
}

/// Interpolate brush stroke between two UV positions
/// Returns all intermediate points for batch painting
#[tauri::command]
pub fn interpolate_brush_stroke(
    start_uv: [f32; 2],
    end_uv: [f32; 2],
    start_pressure: f32,
    end_pressure: f32,
    spacing: f32, // 0-1, fraction of brush size between dabs
    brush_size_uv: f32,
) -> Vec<InterpolatedPoint> {
    let start = Vec2::new(start_uv[0], start_uv[1]);
    let end = Vec2::new(end_uv[0], end_uv[1]);

    let dist = start.distance(end);
    let step_dist = (brush_size_uv * spacing).max(0.001);
    let steps = ((dist / step_dist) as usize).min(50); // Cap at 50 for performance

    if steps == 0 {
        return vec![InterpolatedPoint {
            uv: end_uv,
            pressure: end_pressure,
            t: 1.0,
        }];
    }

    (0..=steps)
        .map(|i| {
            let t = i as f32 / steps as f32;
            let uv = start.lerp(end, t);
            let pressure = start_pressure + (end_pressure - start_pressure) * t;
            InterpolatedPoint {
                uv: [uv.x, uv.y],
                pressure,
                t,
            }
        })
        .collect()
}

// ============================================================================
// SYMMETRY CALCULATIONS - SIMD-accelerated mirror/radial
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymmetryConfig {
    pub mirror_x: bool,
    pub mirror_y: bool,
    pub mirror_z: bool,
    pub radial_count: u32,
    pub center: [f32; 2], // UV center for radial symmetry
}

/// Generate all symmetry UVs for a single paint point
/// Replaces the triple JS loop with a single Rust call
#[tauri::command]
pub fn calculate_symmetry_uvs(uv: [f32; 2], config: SymmetryConfig) -> Vec<[f32; 2]> {
    let mut results = Vec::with_capacity(16);
    let center = Vec2::new(config.center[0], config.center[1]);
    let point = Vec2::new(uv[0], uv[1]);

    // Start with original point
    let mut base_points = vec![point];

    // Mirror X
    if config.mirror_x {
        let mirrored: Vec<_> = base_points
            .iter()
            .map(|p| Vec2::new(1.0 - p.x, p.y))
            .collect();
        base_points.extend(mirrored);
    }

    // Mirror Y
    if config.mirror_y {
        let mirrored: Vec<_> = base_points
            .iter()
            .map(|p| Vec2::new(p.x, 1.0 - p.y))
            .collect();
        base_points.extend(mirrored);
    }

    // Radial symmetry
    if config.radial_count > 1 {
        let angle_step = std::f32::consts::TAU / config.radial_count as f32;
        for base in &base_points.clone() {
            let offset = *base - center;
            for i in 1..config.radial_count {
                let angle = angle_step * i as f32;
                let cos_a = angle.cos();
                let sin_a = angle.sin();
                let rotated = Vec2::new(
                    offset.x * cos_a - offset.y * sin_a + center.x,
                    offset.x * sin_a + offset.y * cos_a + center.y,
                );
                base_points.push(rotated);
            }
        }
    }

    // Convert to output format, filtering out-of-bounds
    for p in base_points {
        if p.x >= 0.0 && p.x <= 1.0 && p.y >= 0.0 && p.y <= 1.0 {
            results.push([p.x, p.y]);
        }
    }

    results
}

/// Batch calculate symmetry for multiple points (for stroke interpolation)
#[tauri::command]
pub fn batch_symmetry_uvs(uvs: Vec<[f32; 2]>, config: SymmetryConfig) -> Vec<Vec<[f32; 2]>> {
    uvs.into_par_iter()
        .map(|uv| calculate_symmetry_uvs(uv, config.clone()))
        .collect()
}

// ============================================================================
// VELOCITY GRID - Return RGBA directly (no JS conversion!)
// ============================================================================

use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static! {
    // Pre-allocated RGBA buffers per resolution to avoid allocations
    static ref RGBA_BUFFERS: Mutex<HashMap<usize, Vec<f32>>> = Mutex::new(HashMap::new());
}

/// Get velocity grid as RGBA (no JS conversion needed!)
/// Returns [R=vx, G=vy, B=0, A=1, ...] ready for WebGL upload
#[cfg(feature = "physics")]
#[tauri::command]
pub fn get_velocity_grid_rgba(sim_id: u64, resolution: usize) -> Result<Vec<f32>, String> {
    use k_os_sim::FLUID_SIMS;

    let sims = FLUID_SIMS.lock().map_err(|e| e.to_string())?;
    let sim = sims.get(&sim_id).ok_or("Simulation not found")?;

    // Get velocity grid [vx, vy, vx, vy, ...]
    let velocity = sim.get_velocity_grid(resolution);

    // Convert to RGBA in parallel
    let pixel_count = resolution * resolution;
    let rgba: Vec<f32> = (0..pixel_count)
        .into_par_iter()
        .flat_map(|i| {
            let vx = velocity.get(i * 2).copied().unwrap_or(0.0);
            let vy = velocity.get(i * 2 + 1).copied().unwrap_or(0.0);
            vec![vx, vy, 0.0, 1.0]
        })
        .collect();

    Ok(rgba)
}

// ============================================================================
// BATCH PAINT OPERATIONS - Full stroke processing in Rust
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaintOp {
    pub uv: [f32; 2],
    pub pressure: f32,
}

/// Process entire brush stroke: interpolate + symmetry in one call
/// Returns all paint operations ready for GPU batch
#[tauri::command]
pub fn process_brush_stroke(
    start_uv: [f32; 2],
    end_uv: [f32; 2],
    start_pressure: f32,
    end_pressure: f32,
    spacing: f32,
    brush_size_uv: f32,
    symmetry: Option<SymmetryConfig>,
) -> Vec<PaintOp> {
    // 1. Interpolate
    let points = interpolate_brush_stroke(
        start_uv,
        end_uv,
        start_pressure,
        end_pressure,
        spacing,
        brush_size_uv,
    );

    // 2. Apply symmetry if enabled
    let mut all_ops = Vec::with_capacity(points.len() * 8);

    if let Some(sym) = symmetry {
        for p in points {
            let sym_uvs = calculate_symmetry_uvs(p.uv, sym.clone());
            for uv in sym_uvs {
                all_ops.push(PaintOp {
                    uv,
                    pressure: p.pressure,
                });
            }
        }
    } else {
        for p in points {
            all_ops.push(PaintOp {
                uv: p.uv,
                pressure: p.pressure,
            });
        }
    }

    all_ops
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interpolation() {
        let points = interpolate_brush_stroke([0.0, 0.0], [1.0, 1.0], 1.0, 0.5, 0.1, 0.1);
        assert!(points.len() > 1);
        assert!(points.len() <= 51);
    }

    #[test]
    fn test_symmetry() {
        let config = SymmetryConfig {
            mirror_x: true,
            mirror_y: false,
            mirror_z: false,
            radial_count: 1,
            center: [0.5, 0.5],
        };
        let uvs = calculate_symmetry_uvs([0.25, 0.5], config);
        assert_eq!(uvs.len(), 2); // Original + X mirror
    }
}
