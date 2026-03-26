//! GPU Brush Parameters
//!
//! Integration layer between KBrushAsset (data-driven) and GPU pipeline.
//! Converts brush assets to GPU-ready uniform buffer data.

use crate::{BrushKernel, KBrushAsset};
use bytemuck::{Pod, Zeroable};

/// Extended GPU brush params for data-driven brushes
/// This struct is LARGER than the legacy BrushParams to support all features
/// Layout must match WGSL struct exactly (16-byte aligned)
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct BrushParamsGpu {
    // === Position (16 bytes) ===
    pub center: [f32; 4], // xyz + w (unused)

    // === Direction (16 bytes) ===
    pub normal: [f32; 4], // xyz + w (unused)

    // === Core Params (16 bytes) ===
    pub radius: f32,
    pub strength: f32, // Was "intensity"
    pub hardness: f32, // Was "falloff" (inverted semantics)
    pub spacing: f32,

    // === Mode Flags (16 bytes) ===
    pub kernel: u32,           // Kernel family (0=stamp, 1=smooth, etc.)
    pub subtract: u32,         // 0 = add, 1 = subtract
    pub front_faces_only: u32, // 1 = cull backfaces
    pub accumulate: u32,       // 1 = accumulate on same spot

    // === Counts (16 bytes) ===
    pub vertex_count: u32,
    pub candidate_count: u32,
    pub alpha_enabled: u32,
    pub alpha_scale: f32,

    // === Jitter (16 bytes) ===
    pub jitter_position: f32,
    pub jitter_rotation: f32,
    pub jitter_strength: f32,
    pub random_seed: f32, // For noise

    // === Extra Params (16 bytes) ===
    pub extra0: f32, // Kernel-specific
    pub extra1: f32,
    pub extra2: f32,
    pub extra3: f32,

    // === Curve LUT indices (16 bytes) ===
    pub pressure_curve_idx: u32, // Index into curve LUT texture array
    pub speed_curve_idx: u32,
    pub tilt_curve_idx: u32,
    pub _pad: u32,
}

impl BrushParamsGpu {
    pub const SIZE: usize = std::mem::size_of::<Self>();

    /// Create GPU params from a brush asset and current stroke state
    pub fn from_asset(
        asset: &KBrushAsset,
        center: [f32; 3],
        normal: [f32; 3],
        pressure: f32,  // 0.0-1.0 from pen tablet
        _velocity: f32, // Stroke speed
    ) -> Self {
        let params = &asset.params;

        // Map kernel enum to u32
        let kernel = match &asset.kernel {
            BrushKernel::Stamp => 0,
            BrushKernel::Smooth => 1,
            BrushKernel::Pinch => 2,
            BrushKernel::Grab => 3,
            BrushKernel::Flatten => 4,
            BrushKernel::Physics => 5,
            BrushKernel::SimCloth => 10,
            BrushKernel::SimGravity => 11,
            BrushKernel::SimInflate => 12,
            BrushKernel::PaintColor => 20,
            BrushKernel::PaintMask => 21,
            // Experimental kernels (use stamp behavior for now)
            BrushKernel::CrystalGrowth => 30,
            BrushKernel::CrystalBismuth => 31,
            BrushKernel::VoronoiShatter => 32,
            BrushKernel::Custom(_) => 100,
        };

        // Apply pressure to strength (TODO: curve lookup)
        let effective_strength = params.strength * pressure;

        Self {
            center: [center[0], center[1], center[2], 1.0],
            normal: [normal[0], normal[1], normal[2], 0.0],
            radius: params.radius,
            strength: effective_strength,
            hardness: params.hardness,
            spacing: params.spacing,
            kernel,
            subtract: if params.subtract { 1 } else { 0 },
            front_faces_only: if params.front_faces_only { 1 } else { 0 },
            accumulate: if params.accumulate { 1 } else { 0 },
            vertex_count: 0,
            candidate_count: 0,
            alpha_enabled: if asset.textures.alpha.is_some() { 1 } else { 0 },
            alpha_scale: 1.0,
            jitter_position: params.jitter_position,
            jitter_rotation: params.jitter_rotation,
            jitter_strength: params.jitter_strength,
            random_seed: rand::random::<f32>(),
            extra0: *params.extras.get("extra0").unwrap_or(&0.0),
            extra1: *params.extras.get("extra1").unwrap_or(&0.0),
            extra2: *params.extras.get("extra2").unwrap_or(&0.0),
            extra3: *params.extras.get("extra3").unwrap_or(&0.0),
            pressure_curve_idx: 0,
            speed_curve_idx: 0,
            tilt_curve_idx: 0,
            _pad: 0,
        }
    }

    /// Create basic params without an asset (for legacy compatibility)
    pub fn basic(center: [f32; 3], normal: [f32; 3], radius: f32, strength: f32) -> Self {
        Self {
            center: [center[0], center[1], center[2], 1.0],
            normal: [normal[0], normal[1], normal[2], 0.0],
            radius,
            strength,
            hardness: 0.5,
            spacing: 0.1,
            kernel: 0,
            subtract: 0,
            front_faces_only: 1,
            accumulate: 0,
            vertex_count: 0,
            candidate_count: 0,
            alpha_enabled: 0,
            alpha_scale: 1.0,
            jitter_position: 0.0,
            jitter_rotation: 0.0,
            jitter_strength: 0.0,
            random_seed: 0.0,
            extra0: 0.0,
            extra1: 0.0,
            extra2: 0.0,
            extra3: 0.0,
            pressure_curve_idx: 0,
            speed_curve_idx: 0,
            tilt_curve_idx: 0,
            _pad: 0,
        }
    }
}

/// Kernel constants matching WGSL
pub mod kernel {
    pub const STAMP: u32 = 0;
    pub const SMOOTH: u32 = 1;
    pub const PINCH: u32 = 2;
    pub const GRAB: u32 = 3;
    pub const FLATTEN: u32 = 4;
    pub const PHYSICS: u32 = 5;
    pub const SIM_CLOTH: u32 = 10;
    pub const SIM_GRAVITY: u32 = 11;
    pub const SIM_INFLATE: u32 = 12;
    pub const PAINT_COLOR: u32 = 20;
    pub const PAINT_MASK: u32 = 21;
}
