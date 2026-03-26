//! Example: Clay Strips Brush
//!
//! A variation of the clay brush that creates strip-like patterns.

use glam::Vec3;
use rayon::prelude::*;

#[inline(always)]
fn falloff(dist_sq: f32, radius_sq: f32) -> f32 {
    let t = 1.0 - dist_sq / radius_sq;
    t * t
}

pub fn apply_clay_strips(
    positions: &mut [f32],
    indices_to_modify: &[usize],
    center: Vec3,
    normal: Vec3,
    radius: f32,
    intensity: f32,
    stroke_dir: Option<Vec3>,
) -> Vec<usize> {
    let radius_sq = radius * radius;
    let local_intensity = intensity;
    let dir = stroke_dir.unwrap_or(Vec3::X).normalize_or_zero();

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
            let along_stroke = diff.dot(dir);
            let stripe_factor = (along_stroke * 20.0).sin() * 0.5 + 0.5;
            let disp = local_intensity * fall * stripe_factor;
            let new_pos = p + normal * disp;

            Some((idx, new_pos))
        })
        .collect();

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clay_strips_basic() {
        let mut positions = vec![0.0, 0.0, 0.0, 0.5, 0.0, 0.0];
        let indices = vec![0, 1];
        let center = Vec3::new(0.25, 0.0, 0.0);
        let normal = Vec3::Y;

        let modified = apply_clay_strips(&mut positions, &indices, center, normal, 1.0, 0.5, None);

        assert!(!modified.is_empty());
    }
}
