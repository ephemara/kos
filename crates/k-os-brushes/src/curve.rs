//! Brush Curve System
//!
//! Bezier curves for pressure/speed/tilt mapping.
//! Curves are baked to LUT textures for fast GPU sampling.

use serde::{Deserialize, Serialize};

/// A bezier curve control point
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CurvePoint {
    /// X position (0.0 - 1.0, e.g., pressure)
    pub x: f32,
    /// Y position (0.0 - 1.0, e.g., strength multiplier)
    pub y: f32,
    /// Left tangent handle (relative offset)
    pub handle_left: [f32; 2],
    /// Right tangent handle (relative offset)
    pub handle_right: [f32; 2],
}

impl CurvePoint {
    /// Simple point with no handles (linear)
    pub fn linear(x: f32, y: f32) -> Self {
        Self {
            x,
            y,
            handle_left: [-0.1, 0.0],
            handle_right: [0.1, 0.0],
        }
    }

    /// Point with symmetric bezier handles
    pub fn smooth(x: f32, y: f32, handle_length: f32) -> Self {
        Self {
            x,
            y,
            handle_left: [-handle_length, 0.0],
            handle_right: [handle_length, 0.0],
        }
    }
}

/// A complete brush curve definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrushCurve {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Control points (minimum 2)
    pub points: Vec<CurvePoint>,
}

impl Default for BrushCurve {
    fn default() -> Self {
        Self::linear()
    }
}

impl BrushCurve {
    /// Create a linear curve (no effect)
    pub fn linear() -> Self {
        Self {
            id: "linear".into(),
            name: "Linear".into(),
            points: vec![CurvePoint::linear(0.0, 0.0), CurvePoint::linear(1.0, 1.0)],
        }
    }

    /// Create a soft/ease-in curve
    pub fn soft() -> Self {
        Self {
            id: "soft".into(),
            name: "Soft".into(),
            points: vec![
                CurvePoint {
                    x: 0.0,
                    y: 0.0,
                    handle_left: [-0.1, 0.0],
                    handle_right: [0.3, 0.0],
                },
                CurvePoint {
                    x: 1.0,
                    y: 1.0,
                    handle_left: [-0.3, 0.0],
                    handle_right: [0.1, 0.0],
                },
            ],
        }
    }

    /// Create a hard/ease-out curve
    pub fn hard() -> Self {
        Self {
            id: "hard".into(),
            name: "Hard".into(),
            points: vec![
                CurvePoint {
                    x: 0.0,
                    y: 0.0,
                    handle_left: [-0.1, 0.0],
                    handle_right: [0.1, 0.3],
                },
                CurvePoint {
                    x: 1.0,
                    y: 1.0,
                    handle_left: [-0.1, 0.3],
                    handle_right: [0.1, 0.0],
                },
            ],
        }
    }

    /// Sample the curve at a given t value (0.0 - 1.0)
    pub fn sample(&self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);

        if self.points.len() < 2 {
            return t; // Fallback to linear
        }

        // Find the segment containing t
        for i in 0..self.points.len() - 1 {
            let p0 = &self.points[i];
            let p1 = &self.points[i + 1];

            if t >= p0.x && t <= p1.x {
                // Normalize t within this segment
                let segment_t = if (p1.x - p0.x).abs() < 0.0001 {
                    0.5
                } else {
                    (t - p0.x) / (p1.x - p0.x)
                };

                // Cubic bezier interpolation
                return cubic_bezier(
                    p0.y,
                    p0.y + p0.handle_right[1],
                    p1.y + p1.handle_left[1],
                    p1.y,
                    segment_t,
                );
            }
        }

        // Extrapolate
        if t < self.points[0].x {
            self.points[0].y
        } else {
            self.points.last().map(|p| p.y).unwrap_or(t)
        }
    }

    /// Bake the curve to a lookup table
    pub fn bake_lut(&self, samples: usize) -> CurveLut {
        let mut data = Vec::with_capacity(samples);
        for i in 0..samples {
            let t = i as f32 / (samples - 1) as f32;
            data.push(self.sample(t));
        }
        CurveLut {
            curve_id: self.id.clone(),
            samples: data,
        }
    }
}

/// Baked curve lookup table (for GPU upload)
#[derive(Debug, Clone)]
pub struct CurveLut {
    /// Source curve ID
    pub curve_id: String,
    /// Sampled values (typically 256 samples)
    pub samples: Vec<f32>,
}

impl CurveLut {
    /// Sample the LUT at a given t value
    pub fn sample(&self, t: f32) -> f32 {
        if self.samples.is_empty() {
            return t;
        }

        let t = t.clamp(0.0, 1.0);
        let idx = (t * (self.samples.len() - 1) as f32) as usize;
        self.samples[idx.min(self.samples.len() - 1)]
    }

    /// Get raw bytes for GPU upload (R32Float format)
    pub fn as_bytes(&self) -> &[u8] {
        bytemuck::cast_slice(&self.samples)
    }
}

/// Cubic bezier interpolation
fn cubic_bezier(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
    let t2 = t * t;
    let t3 = t2 * t;
    let mt = 1.0 - t;
    let mt2 = mt * mt;
    let mt3 = mt2 * mt;

    p0 * mt3 + 3.0 * p1 * mt2 * t + 3.0 * p2 * mt * t2 + p3 * t3
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linear_curve() {
        let curve = BrushCurve::linear();
        assert!((curve.sample(0.0) - 0.0).abs() < 0.01);
        assert!((curve.sample(0.5) - 0.5).abs() < 0.01);
        assert!((curve.sample(1.0) - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_lut_baking() {
        let curve = BrushCurve::linear();
        let lut = curve.bake_lut(256);
        assert_eq!(lut.samples.len(), 256);
        assert!((lut.sample(0.5) - 0.5).abs() < 0.01);
    }
}
