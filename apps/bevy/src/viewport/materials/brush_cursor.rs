//! Brush Cursor Material (placeholder for future custom shader support)
//!
//! Currently using StandardMaterial with unlit mode for brush cursor.
//! This module is reserved for future advanced brush cursor rendering.

use bevy::prelude::*;
use bevy::render::render_resource::*;

// Brush cursor material with dynamic properties
#[derive(Clone, Copy, Debug, ShaderType, Reflect)]
pub struct BrushCursorData {
    pub color: Vec4,
    pub radius: f32,
    pub falloff: f32,
    pub alpha: f32,
    // For grab brush delta visualization
    pub show_delta: f32,
    pub delta_start: Vec3,
    pub delta_end: Vec3,
    pub _padding: f32,
}

impl Default for BrushCursorData {
    fn default() -> Self {
        Self {
            color: Vec4::new(0.0, 1.0, 1.0, 1.0), // Cyan color
            radius: 0.1,
            falloff: 0.3,
            alpha: 0.8,
            show_delta: 0.0,
            delta_start: Vec3::ZERO,
            delta_end: Vec3::ZERO,
            _padding: 0.0,
        }
    }
}

/// Helper to create a brush cursor StandardMaterial
pub fn create_brush_cursor_material() -> StandardMaterial {
    StandardMaterial {
        base_color: Color::srgba(0.0, 1.0, 1.0, 0.8),
        unlit: true,
        alpha_mode: AlphaMode::Blend,
        ..default()
    }
}
