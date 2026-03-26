#![cfg(not(target_arch = "wasm32"))]
//! Brush Stroke Processing - Professional Sculpting Dynamics
//!
//! Inspired by Dilay's stroke handling and ZBrush's lazy mouse.
//! This module provides:
//! - Lazy mouse / stroke stabilization
//! - Pressure curve mapping (linear, soft, hard, constant)
//! - Velocity-based intensity modulation
//! - Entry fade for smooth stroke starts
//! - Proper step width calculation

use glam::Vec3;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

// ============================================================================
// PRESSURE CURVES - Map tablet pressure to brush intensity
// ============================================================================

/// Pressure curve types matching ZBrush/Blender conventions
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PressureCurve {
    /// Linear: output = input (1:1 mapping)
    Linear,
    /// Soft: gentle start, strong finish (quadratic ease-in)
    Soft,
    /// Hard: strong start, gentle finish (quadratic ease-out)  
    Hard,
    /// Constant: always 1.0 regardless of pressure
    Constant,
    /// Custom: power curve with exponent
    Custom { exponent: f32 },
}

impl Default for PressureCurve {
    fn default() -> Self {
        PressureCurve::Linear
    }
}

impl PressureCurve {
    /// Apply the pressure curve to an input value [0, 1]
    pub fn apply(&self, input: f32) -> f32 {
        let t = input.clamp(0.0, 1.0);
        match self {
            PressureCurve::Linear => t,
            PressureCurve::Soft => t * t, // Quadratic ease-in
            PressureCurve::Hard => 1.0 - (1.0 - t) * (1.0 - t), // Quadratic ease-out
            PressureCurve::Constant => 1.0,
            PressureCurve::Custom { exponent } => t.powf(*exponent),
        }
    }

    /// Parse from string (for .kbrush files)
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "linear" => PressureCurve::Linear,
            "soft" => PressureCurve::Soft,
            "hard" => PressureCurve::Hard,
            "constant" => PressureCurve::Constant,
            _ => PressureCurve::Linear,
        }
    }
}

// ============================================================================
// FALLOFF TYPES - Control brush edge softness
// ============================================================================

/// Falloff curve types for brush edge
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FalloffType {
    /// Gaussian: smooth bell curve (default, best for organic sculpting)
    Gaussian,
    /// Smooth: cubic hermite, smooth start and end
    Smooth,
    /// Sharp: linear falloff, hard edges
    Sharp,
    /// Flat: constant 1.0 inside radius, 0 outside
    Flat,
    /// Sphere: spherical falloff (1 - d²/r²)
    Sphere,
}

impl Default for FalloffType {
    fn default() -> Self {
        FalloffType::Gaussian
    }
}

impl FalloffType {
    /// Calculate falloff weight for distance d at radius r
    /// hardness controls curve sharpness [0=soft, 1=hard]
    pub fn apply(&self, dist: f32, radius: f32, hardness: f32) -> f32 {
        if dist >= radius {
            return 0.0;
        }

        let t = dist / radius; // Normalized distance [0, 1]

        match self {
            FalloffType::Gaussian => {
                // Gaussian with hardness-controlled std_dev
                let std_dev = 0.8 - hardness * 0.6; // [0.8, 0.2]
                let normalized = t * 4.0;
                (-normalized * normalized / (2.0 * std_dev * std_dev)).exp()
            }
            FalloffType::Smooth => {
                // Smoothstep: 3t² - 2t³
                let s = 1.0 - t;
                let base = s * s * (3.0 - 2.0 * s);
                // Apply hardness
                base.powf(1.0 + hardness * 2.0)
            }
            FalloffType::Sharp => {
                // Linear with hardness exponent
                let base = 1.0 - t;
                base.powf(1.0 / (1.0 - hardness * 0.9 + 0.1))
            }
            FalloffType::Flat => {
                // Flat with soft edge controlled by hardness
                if t < hardness {
                    1.0
                } else {
                    let edge_t = (t - hardness) / (1.0 - hardness);
                    1.0 - edge_t
                }
            }
            FalloffType::Sphere => {
                // Spherical: (1 - t²)
                let base = 1.0 - t * t;
                base.powf(1.0 + hardness)
            }
        }
    }
}

// ============================================================================
// LAZY MOUSE - Stroke Stabilization
// ============================================================================

/// Lazy mouse state for stroke stabilization
#[derive(Debug, Clone)]
pub struct LazyMouse {
    /// Current stabilized position
    pub position: Vec3,
    /// Current stabilized normal
    pub normal: Vec3,
    /// Lazy radius (distance before brush catches up)
    pub lazy_radius: f32,
    /// Smoothing factor [0=no smooth, 1=maximum smooth]
    pub smoothing: f32,
    /// History of recent positions for averaging
    history: VecDeque<Vec3>,
    /// Maximum history size
    history_size: usize,
    /// Is the lazy mouse active (has received at least one point)?
    pub is_active: bool,
}

impl LazyMouse {
    pub fn new(lazy_radius: f32, smoothing: f32) -> Self {
        Self {
            position: Vec3::ZERO,
            normal: Vec3::Y,
            lazy_radius,
            smoothing: smoothing.clamp(0.0, 1.0),
            history: VecDeque::with_capacity(8),
            history_size: 8,
            is_active: false,
        }
    }

    /// Update with new input position, returns stabilized position
    pub fn update(&mut self, input_pos: Vec3, input_normal: Vec3) -> (Vec3, Vec3) {
        if !self.is_active {
            // First point - snap to input
            self.position = input_pos;
            self.normal = input_normal;
            self.is_active = true;
            self.history.clear();
            self.history.push_back(input_pos);
            return (input_pos, input_normal);
        }

        // Calculate distance to input
        let delta = input_pos - self.position;
        let dist = delta.length();

        // Lazy mouse: only move if outside lazy radius
        if dist > self.lazy_radius && self.lazy_radius > 0.0 {
            // Move towards input, maintaining lazy_radius distance
            let move_dist = dist - self.lazy_radius;
            let direction = delta.normalize();
            self.position += direction * move_dist;
        } else if self.lazy_radius <= 0.0 {
            // No lazy mouse - direct follow with smoothing
            self.position = input_pos;
        }

        // Apply position history smoothing
        if self.smoothing > 0.0 {
            self.history.push_back(input_pos);
            if self.history.len() > self.history_size {
                self.history.pop_front();
            }

            // Weighted average of history
            let mut sum = Vec3::ZERO;
            let mut weight_sum = 0.0;
            for (i, pos) in self.history.iter().enumerate() {
                let weight = (i + 1) as f32; // Recent positions have more weight
                sum += *pos * weight;
                weight_sum += weight;
            }

            if weight_sum > 0.0 {
                let avg = sum / weight_sum;
                // Blend between direct and smoothed based on smoothing factor
                self.position = self.position.lerp(avg, self.smoothing * 0.5);
            }
        }

        // Smooth normal
        self.normal = self.normal.lerp(input_normal, 0.3).normalize();

        (self.position, self.normal)
    }

    /// Reset the lazy mouse state
    pub fn reset(&mut self) {
        self.is_active = false;
        self.history.clear();
    }
}

// ============================================================================
// STROKE STATE - Track stroke dynamics
// ============================================================================

/// Complete stroke state for professional brush behavior
#[derive(Debug, Clone)]
pub struct StrokeState {
    /// Lazy mouse for stabilization
    pub lazy_mouse: LazyMouse,
    /// Stroke start time (for entry fade)
    pub start_time: std::time::Instant,
    /// Number of dabs applied in this stroke
    pub dab_count: u32,
    /// Total distance traveled
    pub total_distance: f32,
    /// Last applied position
    pub last_position: Vec3,
    /// Last applied normal  
    pub last_normal: Vec3,
    /// Current velocity (units per second)
    pub velocity: f32,
    /// Accumulated residual distance (for proper spacing)
    pub residual_distance: f32,
    /// Is stroke active?
    pub is_active: bool,
}

impl StrokeState {
    pub fn new(lazy_radius: f32, smoothing: f32) -> Self {
        Self {
            lazy_mouse: LazyMouse::new(lazy_radius, smoothing),
            start_time: std::time::Instant::now(),
            dab_count: 0,
            total_distance: 0.0,
            last_position: Vec3::ZERO,
            last_normal: Vec3::Y,
            velocity: 0.0,
            residual_distance: 0.0,
            is_active: false,
        }
    }

    /// Start a new stroke
    pub fn begin(&mut self, position: Vec3, normal: Vec3) {
        self.lazy_mouse.reset();
        self.start_time = std::time::Instant::now();
        self.dab_count = 0;
        self.total_distance = 0.0;
        self.last_position = position;
        self.last_normal = normal;
        self.velocity = 0.0;
        self.residual_distance = 0.0;
        self.is_active = true;

        // Initialize lazy mouse
        self.lazy_mouse.update(position, normal);
    }

    /// Update stroke with new position, returns dab positions to apply
    pub fn update(
        &mut self,
        position: Vec3,
        normal: Vec3,
        spacing: f32,
        radius: f32,
        delta_time: f32,
    ) -> Vec<StrokeDab> {
        if !self.is_active {
            return vec![];
        }

        // Apply lazy mouse
        let (stabilized_pos, stabilized_normal) = self.lazy_mouse.update(position, normal);

        // Calculate distance and velocity
        let delta = stabilized_pos - self.last_position;
        let dist = delta.length();

        if delta_time > 0.0 {
            self.velocity = dist / delta_time;
        }

        self.total_distance += dist;

        // Calculate step width (Dilay-style: log-based for consistent density)
        let step_width = calculate_step_width(radius, spacing);

        // Generate dabs along the stroke
        let mut dabs = vec![];
        let accumulated = self.residual_distance + dist;

        if accumulated >= step_width {
            let direction = if dist > 0.0001 {
                delta / dist
            } else {
                Vec3::ZERO
            };
            let mut current_dist = step_width - self.residual_distance;

            while current_dist <= dist && dabs.len() < 50 {
                let t = current_dist / dist;
                let dab_pos = self.last_position + direction * current_dist;
                let dab_normal = self.last_normal.lerp(stabilized_normal, t).normalize();

                // Calculate entry fade (smooth start of stroke)
                let entry_fade = calculate_entry_fade(self.dab_count, 5);

                dabs.push(StrokeDab {
                    position: dab_pos.to_array(),
                    normal: dab_normal.to_array(),
                    pressure: 1.0, // Will be modulated by caller
                    entry_fade,
                    velocity_factor: velocity_to_factor(self.velocity, radius),
                });

                self.dab_count += 1;
                current_dist += step_width;
            }

            self.residual_distance = accumulated - (dabs.len() as f32 * step_width);
        } else {
            self.residual_distance = accumulated;
        }

        self.last_position = stabilized_pos;
        self.last_normal = stabilized_normal;

        dabs
    }

    /// End the stroke
    pub fn end(&mut self) {
        self.is_active = false;
        self.lazy_mouse.reset();
    }
}

/// A single dab in a stroke
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeDab {
    pub position: [f32; 3],
    pub normal: [f32; 3],
    pub pressure: f32,
    pub entry_fade: f32,
    pub velocity_factor: f32,
}

impl StrokeDab {
    #[allow(dead_code)]
    fn new_internal(
        position: Vec3,
        normal: Vec3,
        pressure: f32,
        entry_fade: f32,
        velocity_factor: f32,
    ) -> Self {
        Self {
            position: position.to_array(),
            normal: normal.to_array(),
            pressure,
            entry_fade,
            velocity_factor,
        }
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Calculate step width using Dilay's log-based formula
/// This ensures consistent stroke density regardless of brush size
pub fn calculate_step_width(radius: f32, spacing: f32) -> f32 {
    // Dilay formula: stepWidth = spacing * log(radius + 1)
    // We use a modified version for better control
    let base_step = spacing * radius;
    let log_factor = (radius + 1.0).ln() * 0.4;
    (base_step * log_factor).max(0.001)
}

/// Calculate entry fade for smooth stroke starts
/// Fades in over the first N dabs
fn calculate_entry_fade(dab_index: u32, fade_dabs: u32) -> f32 {
    if dab_index >= fade_dabs {
        1.0
    } else {
        let t = dab_index as f32 / fade_dabs as f32;
        // Smooth hermite for nice fade-in
        t * t * (3.0 - 2.0 * t)
    }
}

/// Convert velocity to a modulation factor
/// Fast strokes = lighter touch, slow strokes = stronger
fn velocity_to_factor(velocity: f32, radius: f32) -> f32 {
    // Normalize velocity relative to brush size
    let normalized = velocity / (radius * 10.0);
    // Map to [0.5, 1.5] range - fast = 0.5, slow = 1.5
    (1.5 - normalized.clamp(0.0, 1.0)).clamp(0.5, 1.5)
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Process a stroke segment and return interpolated dabs
#[tauri::command]
pub fn process_stroke_segment(
    start_pos: [f32; 3],
    end_pos: [f32; 3],
    start_normal: [f32; 3],
    end_normal: [f32; 3],
    start_pressure: f32,
    end_pressure: f32,
    radius: f32,
    spacing: f32,
    pressure_curve: String,
    _lazy_radius: f32,
) -> Vec<StrokeDab> {
    let start = Vec3::from_array(start_pos);
    let end = Vec3::from_array(end_pos);
    let start_n = Vec3::from_array(start_normal);
    let end_n = Vec3::from_array(end_normal);

    let curve = PressureCurve::from_str(&pressure_curve);

    let dist = start.distance(end);
    let step_width = calculate_step_width(radius, spacing);
    let steps = ((dist / step_width) as usize).max(1).min(50);

    (0..steps)
        .map(|i| {
            let t = i as f32 / steps as f32;
            let pos = start.lerp(end, t);
            let normal = start_n.lerp(end_n, t).normalize();
            let raw_pressure = start_pressure + (end_pressure - start_pressure) * t;
            let pressure = curve.apply(raw_pressure);
            let entry_fade = calculate_entry_fade(i as u32, 5);

            StrokeDab {
                position: pos.to_array(),
                normal: normal.to_array(),
                pressure,
                entry_fade,
                velocity_factor: 1.0,
            }
        })
        .collect()
}

/// Apply lazy mouse stabilization to a position
#[tauri::command]
pub fn stabilize_position(
    current_pos: [f32; 3],
    input_pos: [f32; 3],
    lazy_radius: f32,
    smoothing: f32,
) -> [f32; 3] {
    let current = Vec3::from_array(current_pos);
    let input = Vec3::from_array(input_pos);

    let delta = input - current;
    let dist = delta.length();

    let result = if dist > lazy_radius && lazy_radius > 0.0 {
        let move_dist = dist - lazy_radius;
        let direction = delta.normalize();
        current + direction * move_dist
    } else if lazy_radius <= 0.0 {
        input.lerp(current, smoothing)
    } else {
        current
    };

    result.to_array()
}
