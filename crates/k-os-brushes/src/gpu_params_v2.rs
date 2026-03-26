//! GPU Brush Parameters V2.1 - FINAL BOSS Edition
//!
//! This is the ultimate brush params system designed for ZBrush-level flexibility.
//! Supports multi-alpha, symmetry, blend modes, 24 kernel-specific extras,
//! pen rotation, stroke types, vertex colors, and more.
//!
//! Size: 464 bytes (29 × 16-byte aligned rows)

use bytemuck::{Pod, Zeroable};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Blend modes for brush application
pub mod blend_mode {
    pub const REPLACE: u32 = 0; // Direct overwrite
    pub const ADD: u32 = 1; // Additive (normal sculpting)
    pub const SUBTRACT: u32 = 2; // Subtractive
    pub const MULTIPLY: u32 = 3; // Multiplicative blend
    pub const OVERLAY: u32 = 4; // Photoshop-style overlay
    pub const SCREEN: u32 = 5; // Screen blend
    pub const SOFT_LIGHT: u32 = 6; // Soft light
    pub const MAX: u32 = 7; // Take maximum displacement
    pub const MIN: u32 = 8; // Take minimum displacement
}

/// Symmetry flags (bitfield)
pub mod symmetry {
    pub const NONE: u32 = 0;
    pub const MIRROR_X: u32 = 1 << 0;
    pub const MIRROR_Y: u32 = 1 << 1;
    pub const MIRROR_Z: u32 = 1 << 2;
    pub const RADIAL: u32 = 1 << 3; // Enable radial symmetry
    pub const LOCAL: u32 = 1 << 4; // Use local object space
    pub const TOPOLOGICAL: u32 = 1 << 5; // ZBrush-style topo symmetry
}

/// Brush flags (bitfield)
pub mod brush_flags {
    pub const SUBTRACT: u32 = 1 << 0;
    pub const FRONT_FACES_ONLY: u32 = 1 << 1;
    pub const ACCUMULATE: u32 = 1 << 2;
    pub const LOCK_PLANE: u32 = 1 << 3; // Lock to initial plane
    pub const LOCK_NORMAL: u32 = 1 << 4; // Lock to initial normal
    pub const IGNORE_BACKFACE: u32 = 1 << 5;
    pub const AUTO_MASKING: u32 = 1 << 6; // Enable automasking
    pub const LAZY_MOUSE: u32 = 1 << 7;
    pub const STABILIZE: u32 = 1 << 8; // Stroke stabilization
    pub const CONNECTED_ONLY: u32 = 1 << 9; // Only affect connected verts
    pub const DYNAMIC_TOPO: u32 = 1 << 10; // Trigger DynTopo
}

/// Alpha channel modes
pub mod alpha_mode {
    pub const DISABLED: u32 = 0;
    pub const STAMP: u32 = 1; // Standard stamp alpha
    pub const DRAG_RECT: u32 = 2; // ZBrush DragRect
    pub const STROKE: u32 = 3; // Seamless stroke tiling
    pub const SPRAY: u32 = 4; // Randomized spray
    pub const RADIAL: u32 = 5; // Radial from center
    pub const VDM: u32 = 6; // Vector Displacement Map
}

/// Stroke type modes
pub mod stroke_type {
    pub const FREEHAND: u32 = 0; // Normal freehand
    pub const DOTS: u32 = 1; // Single dabs only
    pub const DRAG_RECT: u32 = 2; // Drag rectangle
    pub const SPRAY: u32 = 3; // Spray pattern
    pub const LINE: u32 = 4; // Straight line
    pub const CURVE: u32 = 5; // Bezier curve
    pub const LASSO: u32 = 6; // Lasso fill
}

// ============================================================================
// ALPHA SLOT (32 bytes each)
// ============================================================================

/// Per-alpha slot configuration (matches WGSL struct)
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct AlphaSlot {
    /// Pool ID (index into global alpha texture array)
    pub pool_id: u32,
    /// Alpha application mode
    pub mode: u32,
    /// Scale factor
    pub scale: f32,
    /// Rotation in radians
    pub rotation: f32,
    /// UV offset
    pub offset: [f32; 2],
    /// Blend weight with other alphas
    pub blend_weight: f32,
    /// Mirror flags (1=X, 2=Y, 3=XY)
    pub mirror: u32,
}

impl Default for AlphaSlot {
    fn default() -> Self {
        Self {
            pool_id: 0,
            mode: alpha_mode::DISABLED,
            scale: 1.0,
            rotation: 0.0,
            offset: [0.0, 0.0],
            blend_weight: 1.0,
            mirror: 0,
        }
    }
}

// ============================================================================
// MAIN GPU PARAMS STRUCT (464 bytes) - FINAL BOSS
// ============================================================================

/// Extended GPU brush params for maximum modularity
///
/// Layout: 464 bytes = 29 × 16-byte aligned rows
/// This supports everything ZBrush can do and more.
#[repr(C)]
#[derive(Copy, Clone, Debug, Zeroable, Pod)]
pub struct BrushParamsGpuV2 {
    // === ROW 0-1: POSITION & NORMAL (32 bytes) ===
    /// Brush center (xyz) + current pressure (w)
    pub center: [f32; 4],
    /// Brush normal/direction (xyz) + pen tilt angle (w)
    pub normal: [f32; 4],

    // === ROW 2: STROKE KINEMATICS (16 bytes) ===
    /// Stroke velocity vector (xyz) + speed magnitude (w)
    pub velocity: [f32; 4],

    // === ROW 3: PREVIOUS POSITION (16 bytes) ===
    /// Previous dab position (for smear/grab delta) + stroke distance
    pub prev_center: [f32; 3],
    pub stroke_distance: f32,

    // === ROW 4: CORE PARAMS (16 bytes) ===
    pub radius: f32,
    pub strength: f32,
    pub hardness: f32,
    pub spacing: f32,

    // === ROW 5: KERNEL SELECTION (16 bytes) ===
    /// Kernel family ID
    pub kernel_id: u32,
    /// Entry point ID within kernel (no more hacky extras!)
    pub entry_point_id: u32,
    /// Blend mode (see blend_mode module)
    pub blend_mode: u32,
    /// Brush flags bitfield (see brush_flags module)
    pub flags: u32,

    // === ROW 6: VERTEX INFO (16 bytes) ===
    pub vertex_count: u32,
    pub candidate_count: u32,
    /// Which dab number in current stroke
    pub dab_index: u32,
    /// Which stroke number in session
    pub stroke_index: u32,

    // === ROW 7-8: ALPHA SLOT 0 (32 bytes) ===
    pub alpha0: AlphaSlot,

    // === ROW 9-10: ALPHA SLOT 1 (32 bytes) ===
    pub alpha1: AlphaSlot,

    // === ROW 11-12: ALPHA SLOT 2 (32 bytes) ===
    /// Third alpha for VDM-style or noise overlay
    pub alpha2: AlphaSlot,

    // === ROW 13: JITTER (16 bytes) ===
    pub jitter_position: f32,
    pub jitter_rotation: f32,
    pub jitter_strength: f32,
    pub random_seed: f32,

    // === ROW 14: SYMMETRY (16 bytes) ===
    /// Symmetry flags bitfield (see symmetry module)
    pub symmetry_flags: u32,
    /// Radial symmetry count (2-32 typical)
    pub radial_count: u32,
    /// Symmetry center offset X
    pub symmetry_offset_x: f32,
    /// Symmetry center offset Y  
    pub symmetry_offset_y: f32,

    // === ROW 15: AUTOMASKING (16 bytes) ===
    /// Cavity automasking strength
    pub automask_cavity: f32,
    /// Angle-based automasking
    pub automask_angle: f32,
    /// Border/edge automasking
    pub automask_border: f32,
    /// Face set automasking (0 = off, >0 = only affect this face set)
    pub automask_face_set: u32,

    // === ROW 16: CURVES (16 bytes) ===
    /// Pressure → Strength curve LUT index
    pub curve_pressure: u32,
    /// Stroke Speed → Radius curve
    pub curve_speed: u32,
    /// Pen Tilt → Effect curve
    pub curve_tilt: u32,
    /// Direction/Angle curve
    pub curve_direction: u32,

    // === ROW 17-22: EXTRA PARAMS (96 bytes = 24 floats!) ===
    /// Kernel-specific parameters - 24 slots for maximum flexibility
    pub extras: [f32; 24],

    // === ROW 23: LOCKED PLANE (16 bytes) ===
    /// Locked plane normal (for flatten/trim with lock)
    pub locked_plane_normal: [f32; 3],
    /// Locked plane offset from origin
    pub locked_plane_offset: f32,

    // === ROW 22: LOCKED POSITION (16 bytes) ===
    /// Locked initial position (for rake direction, etc.)
    pub locked_position: [f32; 3],
    /// Locked initial radius
    pub locked_radius: f32,

    // === ROW 24: PEN & STROKE (16 bytes) ===
    /// Pen barrel rotation in radians
    pub pen_rotation: f32,
    /// Stroke type (see stroke_type module)
    pub stroke_type: u32,
    /// Backface threshold angle (radians, 0 = strict, PI = all)
    pub backface_threshold: f32,
    /// Maximum displacement per vertex per stroke (safety valve)
    pub accumulation_limit: f32,

    // === ROW 25: COLOR (16 bytes) ===
    /// RGBA color for paint brushes
    pub color: [f32; 4],

    // === ROW 26: GRAVITY & TIME (16 bytes) ===
    /// Custom gravity direction (not just -Y)
    pub gravity_direction: [f32; 3],
    /// Animation time for procedural effects
    pub time: f32,

    // === ROW 27: RESERVED (16 bytes) ===
    /// Reserved for future expansion
    pub _reserved: [f32; 4],
}

impl BrushParamsGpuV2 {
    pub const SIZE: usize = std::mem::size_of::<Self>();

    /// Verify struct is correctly sized (compile-time check)
    const _SIZE_CHECK: () = assert!(Self::SIZE == 464);

    /// Create default params
    pub fn new() -> Self {
        Self {
            center: [0.0, 0.0, 0.0, 1.0],
            normal: [0.0, 1.0, 0.0, 0.0],
            velocity: [0.0, 0.0, 0.0, 0.0],
            prev_center: [0.0, 0.0, 0.0],
            stroke_distance: 0.0,
            radius: 0.1,
            strength: 0.5,
            hardness: 0.5,
            spacing: 0.1,
            kernel_id: 0,
            entry_point_id: 0,
            blend_mode: blend_mode::ADD,
            flags: brush_flags::FRONT_FACES_ONLY,
            vertex_count: 0,
            candidate_count: 0,
            dab_index: 0,
            stroke_index: 0,
            alpha0: AlphaSlot::default(),
            alpha1: AlphaSlot::default(),
            alpha2: AlphaSlot::default(),
            jitter_position: 0.0,
            jitter_rotation: 0.0,
            jitter_strength: 0.0,
            random_seed: 0.0,
            symmetry_flags: symmetry::NONE,
            radial_count: 0,
            symmetry_offset_x: 0.0,
            symmetry_offset_y: 0.0,
            automask_cavity: 0.0,
            automask_angle: 0.0,
            automask_border: 0.0,
            automask_face_set: 0,
            curve_pressure: 0,
            curve_speed: 0,
            curve_tilt: 0,
            curve_direction: 0,
            extras: [0.0; 24],
            locked_plane_normal: [0.0, 1.0, 0.0],
            locked_plane_offset: 0.0,
            locked_position: [0.0, 0.0, 0.0],
            locked_radius: 0.1,
            pen_rotation: 0.0,
            stroke_type: 0,                      // FREEHAND
            backface_threshold: 1.57,            // ~90 degrees
            accumulation_limit: 10.0,            // Reasonable default
            color: [1.0, 1.0, 1.0, 1.0],         // White
            gravity_direction: [0.0, -1.0, 0.0], // Down
            time: 0.0,
            _reserved: [0.0; 4],
        }
    }

    // === BUILDER METHODS ===

    pub fn with_center(mut self, center: [f32; 3], pressure: f32) -> Self {
        self.center = [center[0], center[1], center[2], pressure];
        self
    }

    pub fn with_normal(mut self, normal: [f32; 3], tilt: f32) -> Self {
        self.normal = [normal[0], normal[1], normal[2], tilt];
        self
    }

    pub fn with_radius(mut self, radius: f32) -> Self {
        self.radius = radius;
        self
    }

    pub fn with_strength(mut self, strength: f32) -> Self {
        self.strength = strength;
        self
    }

    pub fn with_hardness(mut self, hardness: f32) -> Self {
        self.hardness = hardness;
        self
    }

    pub fn with_kernel(mut self, kernel_id: u32, entry_point_id: u32) -> Self {
        self.kernel_id = kernel_id;
        self.entry_point_id = entry_point_id;
        self
    }

    pub fn with_alpha(mut self, slot: usize, alpha: AlphaSlot) -> Self {
        match slot {
            0 => self.alpha0 = alpha,
            1 => self.alpha1 = alpha,
            2 => self.alpha2 = alpha,
            _ => {}
        }
        self
    }

    pub fn with_symmetry(mut self, flags: u32, radial_count: u32) -> Self {
        self.symmetry_flags = flags;
        self.radial_count = radial_count;
        self
    }

    pub fn with_flag(mut self, flag: u32) -> Self {
        self.flags |= flag;
        self
    }

    pub fn without_flag(mut self, flag: u32) -> Self {
        self.flags &= !flag;
        self
    }

    pub fn with_extra(mut self, index: usize, value: f32) -> Self {
        if index < 24 {
            self.extras[index] = value;
        }
        self
    }

    pub fn with_extras(mut self, extras: &[f32]) -> Self {
        for (i, &v) in extras.iter().take(24).enumerate() {
            self.extras[i] = v;
        }
        self
    }

    pub fn with_velocity(mut self, velocity: [f32; 3]) -> Self {
        let speed = (velocity[0].powi(2) + velocity[1].powi(2) + velocity[2].powi(2)).sqrt();
        self.velocity = [velocity[0], velocity[1], velocity[2], speed];
        self
    }

    pub fn with_prev_center(mut self, prev: [f32; 3]) -> Self {
        self.prev_center = prev;
        self
    }

    /// Enable automasking with given parameters
    pub fn with_automasking(mut self, cavity: f32, angle: f32, border: f32) -> Self {
        self.automask_cavity = cavity;
        self.automask_angle = angle;
        self.automask_border = border;
        self.flags |= brush_flags::AUTO_MASKING;
        self
    }

    /// Lock the brush plane (for flatten/trim)
    pub fn with_locked_plane(mut self, normal: [f32; 3], offset: f32) -> Self {
        self.locked_plane_normal = normal;
        self.locked_plane_offset = offset;
        self.flags |= brush_flags::LOCK_PLANE;
        self
    }

    // === V2.1 BUILDER METHODS ===

    /// Set pen barrel rotation (radians)
    pub fn with_pen_rotation(mut self, rotation: f32) -> Self {
        self.pen_rotation = rotation;
        self
    }

    /// Set stroke type (see stroke_type module)
    pub fn with_stroke_type(mut self, stroke: u32) -> Self {
        self.stroke_type = stroke;
        self
    }

    /// Set backface threshold angle (radians)
    pub fn with_backface_threshold(mut self, threshold: f32) -> Self {
        self.backface_threshold = threshold;
        self
    }

    /// Set accumulation limit (max displacement per vertex)
    pub fn with_accumulation_limit(mut self, limit: f32) -> Self {
        self.accumulation_limit = limit;
        self
    }

    /// Set RGBA color for paint brushes
    pub fn with_color(mut self, r: f32, g: f32, b: f32, a: f32) -> Self {
        self.color = [r, g, b, a];
        self
    }

    /// Set custom gravity direction
    pub fn with_gravity(mut self, direction: [f32; 3]) -> Self {
        self.gravity_direction = direction;
        self
    }

    /// Set animation time for procedural effects
    pub fn with_time(mut self, time: f32) -> Self {
        self.time = time;
        self
    }
}

impl Default for BrushParamsGpuV2 {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// ENTRY POINT REGISTRY
// ============================================================================

/// Maps kernel family + entry point ID to WGSL function name
pub fn get_entry_point_name(kernel_id: u32, entry_point_id: u32) -> &'static str {
    match (kernel_id, entry_point_id) {
        // Stamp family (0)
        (0, 0) => "stamp_main",
        (0, 1) => "stamp_clay",
        (0, 2) => "stamp_inflate",
        (0, 3) => "stamp_flatten",
        (0, 4) => "stamp_crease",
        (0, 5) => "stamp_layer",
        (0, 6) => "stamp_blob",
        (0, 7) => "stamp_hpolish",
        (0, 8) => "stamp_scrape",
        (0, 9) => "stamp_fill",

        // Smooth family (1)
        (1, 0) => "smooth_main",
        (1, 1) => "smooth_relax",
        (1, 2) => "smooth_surface",
        (1, 3) => "smooth_sharpen",

        // Pinch family (2)
        (2, 0) => "pinch_main",
        (2, 1) => "pinch_crease",
        (2, 2) => "pinch_dam",
        (2, 3) => "pinch_inflate_pinch",

        // Grab family (3)
        (3, 0) => "grab_main",
        (3, 1) => "grab_snake_hook",
        (3, 2) => "grab_move",
        (3, 3) => "grab_twist",
        (3, 4) => "grab_rotate",
        (3, 5) => "grab_scale",

        // Physics family (5)
        (5, 0) => "physics_attractor",
        (5, 1) => "physics_magnet",
        (5, 2) => "physics_elastic",
        (5, 3) => "physics_inflate_pulse",
        (5, 4) => "physics_turbulence",
        (5, 5) => "physics_gravity_drop",

        // Crystal family (30)
        (30, 0) => "crystal_growth",
        (30, 1) => "voronoi_shatter",
        (30, 2) => "crystal_bismuth",

        // Fallback
        _ => "stamp_main",
    }
}

// ============================================================================
// CONVERSION FROM LEGACY
// ============================================================================

impl From<&k_os_gpu_pipeline::sculpt::BrushParams> for BrushParamsGpuV2 {
    fn from(legacy: &k_os_gpu_pipeline::sculpt::BrushParams) -> Self {
        Self {
            center: legacy.center,
            normal: legacy.normal,
            radius: legacy.radius,
            strength: legacy.strength,
            hardness: legacy.hardness,
            spacing: legacy.spacing,
            kernel_id: legacy.op,
            entry_point_id: 0,
            flags: {
                let mut f = 0u32;
                if legacy.subtract != 0 {
                    f |= brush_flags::SUBTRACT;
                }
                if legacy.front_faces_only != 0 {
                    f |= brush_flags::FRONT_FACES_ONLY;
                }
                if legacy.accumulate != 0 {
                    f |= brush_flags::ACCUMULATE;
                }
                f
            },
            blend_mode: if legacy.subtract != 0 {
                blend_mode::SUBTRACT
            } else {
                blend_mode::ADD
            },
            vertex_count: legacy.vertex_count,
            candidate_count: legacy.candidate_count,
            alpha0: AlphaSlot {
                pool_id: 0,
                mode: if legacy.alpha_enabled != 0 {
                    alpha_mode::STAMP
                } else {
                    alpha_mode::DISABLED
                },
                scale: legacy.alpha_scale,
                ..Default::default()
            },
            jitter_position: legacy.jitter_position,
            jitter_rotation: legacy.jitter_rotation,
            jitter_strength: legacy.jitter_strength,
            random_seed: legacy.random_seed,
            extras: {
                let mut e = [0.0f32; 24];
                e[0] = legacy.extra0;
                e[1] = legacy.extra1;
                e[2] = legacy.extra2;
                e[3] = legacy.extra3;
                e
            },
            ..Default::default()
        }
    }
}
