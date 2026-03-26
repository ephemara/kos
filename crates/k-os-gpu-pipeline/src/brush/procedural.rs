#![cfg(not(target_arch = "wasm32"))]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::alpha_pool::{AlphaHandle, AlphaInfo, AlphaSource, ALPHA_POOL};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProceduralType {
    Perlin,
    Voronoi,
    Bricks,
    Dots,
    Radial,
    Circle,
    Square,
    Diamond,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProceduralParams {
    pub proc_type: ProceduralType,
    pub size: u32,
    pub params: HashMap<String, f32>,
}

impl Default for ProceduralParams {
    fn default() -> Self {
        Self {
            proc_type: ProceduralType::Radial,
            size: 256,
            params: HashMap::new(),
        }
    }
}

pub fn generate_procedural(params: ProceduralParams) -> Result<AlphaHandle, String> {
    let size = params.size.clamp(16, 2048);
    let mut pixels = vec![0u8; (size * size) as usize];

    match params.proc_type {
        ProceduralType::Radial => generate_radial(&mut pixels, size, &params.params),
        ProceduralType::Circle => generate_circle(&mut pixels, size, &params.params),
        ProceduralType::Square => generate_square(&mut pixels, size, &params.params),
        ProceduralType::Diamond => generate_diamond(&mut pixels, size, &params.params),
        ProceduralType::Perlin => generate_perlin(&mut pixels, size, &params.params),
        ProceduralType::Voronoi => generate_voronoi(&mut pixels, size, &params.params),
        ProceduralType::Bricks => generate_bricks(&mut pixels, size, &params.params),
        ProceduralType::Dots => generate_dots(&mut pixels, size, &params.params),
    }

    let img = image::GrayImage::from_raw(size, size, pixels)
        .ok_or("Failed to create image from procedural data")?;
    let dynamic_img = image::DynamicImage::ImageLuma8(img);
    let name = format!("procedural_{:?}_{size}", params.proc_type);
    let source = AlphaSource::Procedural {
        generator: format!("{:?}", params.proc_type),
        params: params.params.clone(),
    };

    let mut pool = ALPHA_POOL.write();
    pool.load_from_image(dynamic_img, &name, source)
}

fn generate_radial(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    let falloff = params.get("falloff").copied().unwrap_or(2.0);
    let center = size as f32 / 2.0;
    let max_dist = center;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let dist = (dx * dx + dy * dy).sqrt();
            let t = (dist / max_dist).min(1.0);
            pixels[(y * size + x) as usize] = ((1.0 - t.powf(falloff)).max(0.0) * 255.0) as u8;
        }
    }
}

fn generate_circle(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    let edge_softness = params.get("softness").copied().unwrap_or(0.02);
    let center = size as f32 / 2.0;
    let radius = center * 0.95;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let dist = (dx * dx + dy * dy).sqrt();
            let edge = (radius - dist) / (radius * edge_softness);
            pixels[(y * size + x) as usize] = (edge.clamp(0.0, 1.0) * 255.0) as u8;
        }
    }
}

fn generate_square(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    let edge_softness = params.get("softness").copied().unwrap_or(0.02);
    let padding = (size as f32 * 0.05) as u32;
    for y in 0..size {
        for x in 0..size {
            let in_bounds =
                x >= padding && x < size - padding && y >= padding && y < size - padding;
            if in_bounds {
                let dx = (x - padding).min(size - padding - 1 - x) as f32;
                let dy = (y - padding).min(size - padding - 1 - y) as f32;
                let softness_pixels = (size as f32 * edge_softness).max(1.0);
                let value = (dx.min(dy) / softness_pixels).min(1.0);
                pixels[(y * size + x) as usize] = (value * 255.0) as u8;
            }
        }
    }
}

fn generate_diamond(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    let edge_softness = params.get("softness").copied().unwrap_or(0.05);
    let center = size as f32 / 2.0;
    let radius = center * 0.95;
    for y in 0..size {
        for x in 0..size {
            let dx = (x as f32 - center).abs();
            let dy = (y as f32 - center).abs();
            let edge = (radius - (dx + dy)) / (radius * edge_softness);
            pixels[(y * size + x) as usize] = (edge.clamp(0.0, 1.0) * 255.0) as u8;
        }
    }
}

fn generate_perlin(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    use noise::{NoiseFn, Perlin};

    let scale = params.get("scale").copied().unwrap_or(4.0);
    let octaves = params.get("octaves").copied().unwrap_or(4.0) as u32;
    let seed = params.get("seed").copied().unwrap_or(0.0) as u32;
    let perlin = Perlin::new(seed);

    for y in 0..size {
        for x in 0..size {
            let mut value = 0.0f32;
            let mut amplitude = 1.0f32;
            let mut frequency = scale / size as f32;
            for _ in 0..octaves {
                value += perlin.get([x as f64 * frequency as f64, y as f64 * frequency as f64])
                    as f32
                    * amplitude;
                amplitude *= 0.5;
                frequency *= 2.0;
            }
            pixels[(y * size + x) as usize] = (((value + 1.0) / 2.0).clamp(0.0, 1.0) * 255.0) as u8;
        }
    }
}

fn generate_voronoi(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    use fastrand::Rng;

    let cell_count = params.get("cells").copied().unwrap_or(16.0) as usize;
    let edge_width = params.get("edge_width").copied().unwrap_or(0.1);
    let seed = params.get("seed").copied().unwrap_or(42.0) as u64;
    let mut rng = Rng::with_seed(seed);
    let centers: Vec<(f32, f32)> = (0..cell_count)
        .map(|_| (rng.f32() * size as f32, rng.f32() * size as f32))
        .collect();

    for y in 0..size {
        for x in 0..size {
            let px = x as f32;
            let py = y as f32;
            let mut dists: Vec<f32> = centers
                .iter()
                .map(|(cx, cy)| ((px - cx).powi(2) + (py - cy).powi(2)).sqrt())
                .collect();
            dists.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let edge = (dists[1] - dists[0]) / (size as f32 * edge_width);
            pixels[(y * size + x) as usize] = (edge.clamp(0.0, 1.0) * 255.0) as u8;
        }
    }
}

fn generate_bricks(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    let brick_width = params.get("width").copied().unwrap_or(0.25);
    let brick_height = params.get("height").copied().unwrap_or(0.1);
    let mortar = params.get("mortar").copied().unwrap_or(0.02);
    let bw = (size as f32 * brick_width) as u32;
    let bh = (size as f32 * brick_height) as u32;
    let mw = (size as f32 * mortar) as u32;

    for y in 0..size {
        for x in 0..size {
            let row = y / (bh + mw);
            let offset = if row % 2 == 1 { bw / 2 } else { 0 };
            let bx = (x + offset) % (bw + mw);
            let by = y % (bh + mw);
            if bx < bw && by < bh {
                let edge_x =
                    bx.min(bw.saturating_sub(1).saturating_sub(bx)) as f32 / mw.max(1) as f32;
                let edge_y =
                    by.min(bh.saturating_sub(1).saturating_sub(by)) as f32 / mw.max(1) as f32;
                pixels[(y * size + x) as usize] = (edge_x.min(edge_y).min(1.0) * 255.0) as u8;
            }
        }
    }
}

fn generate_dots(pixels: &mut [u8], size: u32, params: &HashMap<String, f32>) {
    let dot_size = params.get("dot_size").copied().unwrap_or(0.08);
    let spacing = params.get("spacing").copied().unwrap_or(0.15);
    let dot_radius = size as f32 * dot_size / 2.0;
    let cell_size = size as f32 * spacing;
    for y in 0..size {
        for x in 0..size {
            let cell_x = ((x as f32 / cell_size).floor() + 0.5) * cell_size;
            let cell_y = ((y as f32 / cell_size).floor() + 0.5) * cell_size;
            let dx = x as f32 - cell_x;
            let dy = y as f32 - cell_y;
            let dist = (dx * dx + dy * dy).sqrt();
            pixels[(y * size + x) as usize] = ((1.0 - dist / dot_radius).max(0.0) * 255.0) as u8;
        }
    }
}

pub fn generate_procedural_alpha(
    proc_type: String,
    size: u32,
    params: Option<HashMap<String, f32>>,
) -> Result<AlphaInfo, String> {
    let ptype = match proc_type.to_lowercase().as_str() {
        "radial" => ProceduralType::Radial,
        "circle" => ProceduralType::Circle,
        "square" => ProceduralType::Square,
        "diamond" => ProceduralType::Diamond,
        "perlin" | "noise" => ProceduralType::Perlin,
        "voronoi" | "cells" => ProceduralType::Voronoi,
        "bricks" | "tiles" => ProceduralType::Bricks,
        "dots" => ProceduralType::Dots,
        _ => return Err(format!("Unknown procedural type: {proc_type}")),
    };

    let handle = generate_procedural(ProceduralParams {
        proc_type: ptype,
        size,
        params: params.unwrap_or_default(),
    })?;

    ALPHA_POOL
        .read()
        .get_info(handle)
        .cloned()
        .ok_or("Failed to get generated alpha info".to_string())
}
