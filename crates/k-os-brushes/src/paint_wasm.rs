use nalgebra::Vector2;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BrushParams {
    pub size: f32,
    pub spacing: f32,
    pub jitter_pos: f32,
    pub jitter_size: f32,
    pub jitter_angle: f32,
    pub symmetry: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SplatPoint {
    pub x: f32,
    pub y: f32,
    pub size: f32,
    pub angle: f32,
}

pub struct StrokeManager {
    last_pos: Option<Vector2<f32>>,
    accumulated_dist: f32,
}

impl StrokeManager {
    pub fn new() -> Self {
        Self {
            last_pos: None,
            accumulated_dist: 0.0,
        }
    }

    pub fn reset(&mut self) {
        self.last_pos = None;
        self.accumulated_dist = 0.0;
    }

    pub fn update(
        &mut self,
        pos: Vector2<f32>,
        pressure: f32,
        params: &BrushParams,
    ) -> Vec<SplatPoint> {
        let mut splats = Vec::new();
        if self.last_pos.is_none() {
            self.last_pos = Some(pos);
            self.add_points(&mut splats, pos, pressure, params);
            return splats;
        }

        let last = self.last_pos.unwrap();
        let dist = (pos - last).norm();
        let spacing_uv = (params.spacing * (params.size / 2048.0)).max(0.0001);
        let mut current_dist = spacing_uv - self.accumulated_dist;

        while current_dist <= dist {
            let t = if dist > 0.0 { current_dist / dist } else { 0.0 };
            let p = last.lerp(&pos, t);
            self.add_points(&mut splats, p, pressure, params);
            current_dist += spacing_uv;
        }

        self.accumulated_dist = (dist - (current_dist - spacing_uv)).max(0.0);
        self.last_pos = Some(pos);
        splats
    }

    fn add_points(
        &self,
        splats: &mut Vec<SplatPoint>,
        pos: Vector2<f32>,
        pressure: f32,
        params: &BrushParams,
    ) {
        self.push_splat(splats, pos, pressure, params);
        match params.symmetry.as_str() {
            "X" => self.push_splat(splats, Vector2::new(1.0 - pos.x, pos.y), pressure, params),
            "Y" => self.push_splat(splats, Vector2::new(pos.x, 1.0 - pos.y), pressure, params),
            "RADIAL" => {
                let center = Vector2::new(0.5, 0.5);
                let diff = pos - center;
                for i in 1..6 {
                    let angle = (std::f32::consts::PI * 2.0 * i as f32) / 6.0;
                    let (sin, cos) = angle.sin_cos();
                    let rotated =
                        Vector2::new(diff.x * cos - diff.y * sin, diff.x * sin + diff.y * cos)
                            + center;
                    self.push_splat(splats, rotated, pressure, params);
                }
            }
            _ => {}
        }
    }

    fn push_splat(
        &self,
        splats: &mut Vec<SplatPoint>,
        pos: Vector2<f32>,
        pressure: f32,
        params: &BrushParams,
    ) {
        let mut final_pos = pos;
        let mut final_size = params.size * pressure;
        let mut final_angle = 0.0;
        let pseudo_rand = (pos.x * 12.9898 + pos.y * 78.233).sin() * 43758.5453;
        let pseudo_rand = pseudo_rand - pseudo_rand.floor();

        if params.jitter_pos > 0.0 {
            let offset_x = (pseudo_rand * 2.0 - 1.0) * params.jitter_pos * (params.size / 2048.0);
            let offset_y = ((pseudo_rand * 1.5).fract() * 2.0 - 1.0)
                * params.jitter_pos
                * (params.size / 2048.0);
            final_pos.x += offset_x;
            final_pos.y += offset_y;
        }
        if params.jitter_size > 0.0 {
            final_size *= 1.0 + (pseudo_rand * 2.0 - 1.0) * params.jitter_size;
        }
        if params.jitter_angle > 0.0 {
            final_angle = (pseudo_rand * 2.0 - 1.0) * std::f32::consts::PI * params.jitter_angle;
        }

        splats.push(SplatPoint {
            x: final_pos.x,
            y: final_pos.y,
            size: final_size,
            angle: final_angle,
        });
    }
}
