use noise::{NoiseFn, Perlin, Simplex};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NoiseType {
    Perlin,
    Simplex,
    Worley,
    Fbm,
    Ridged,
    Billowy,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProceduralParams {
    pub noise_type: NoiseType,
    pub width: u32,
    pub height: u32,
    pub scale: f32,
    pub octaves: u32,
    pub persistence: f32,
    pub lacunarity: f32,
    pub seed: u32,
    pub invert: bool,
    pub contrast: f32,
    pub brightness: f32,
    pub seamless: bool,
}

impl Default for ProceduralParams {
    fn default() -> Self {
        Self {
            noise_type: NoiseType::Perlin,
            width: 1024,
            height: 1024,
            scale: 4.0,
            octaves: 6,
            persistence: 0.5,
            lacunarity: 2.0,
            seed: 42,
            invert: false,
            contrast: 1.0,
            brightness: 0.0,
            seamless: false,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct VoronoiParams {
    pub width: u32,
    pub height: u32,
    pub cell_count: u32,
    pub seed: u32,
    pub distance_type: String,
    pub output_type: String,
    pub edge_thickness: f32,
    pub jitter: f32,
    pub invert: bool,
}

impl Default for VoronoiParams {
    fn default() -> Self {
        Self {
            width: 1024,
            height: 1024,
            cell_count: 50,
            seed: 42,
            distance_type: "euclidean".to_string(),
            output_type: "distance".to_string(),
            edge_thickness: 0.02,
            jitter: 1.0,
            invert: false,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ProceduralResult {
    pub image: String,
    pub time_ms: f64,
}

#[inline]
fn clamp_u8(val: f32) -> u8 {
    (val * 255.0).max(0.0).min(255.0) as u8
}

fn hash2d(x: i32, y: i32, seed: u32) -> f32 {
    let n = (x.wrapping_mul(374761393) ^ y.wrapping_mul(668265263) ^ seed as i32) as u32;
    let n = n.wrapping_mul(1103515245).wrapping_add(12345);
    n as f32 / u32::MAX as f32
}

fn encode_png_base64(data: &[u8], width: u32, height: u32) -> Option<String> {
    use image::{DynamicImage, ImageBuffer, Rgba};
    use std::io::Cursor;
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(width, height, data.to_vec())?;
    let dynamic_img = DynamicImage::ImageRgba8(img);
    let mut buffer: Vec<u8> = Vec::new();
    dynamic_img
        .write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
        .ok()?;
    use base64::Engine;
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&buffer)
    ))
}

fn worley_noise(x: f64, y: f64, seed: u32) -> f64 {
    let xi = x.floor() as i32;
    let yi = y.floor() as i32;
    let xf = x - x.floor();
    let yf = y - y.floor();
    let mut min_dist = f64::MAX;
    for dx in -1..=1 {
        for dy in -1..=1 {
            let cx = xi + dx;
            let cy = yi + dy;
            let px = dx as f64 + hash2d(cx, cy, seed) as f64 - xf;
            let py = dy as f64 + hash2d(cx, cy, seed.wrapping_add(1)) as f64 - yf;
            min_dist = min_dist.min((px * px + py * py).sqrt());
        }
    }
    min_dist.min(1.4) / 1.4
}

pub fn generate_procedural_texture(params: ProceduralParams) -> Result<ProceduralResult, String> {
    let start = std::time::Instant::now();
    let w = params.width as usize;
    let h = params.height as usize;
    let scale = params.scale as f64;
    let perlin = Perlin::new(params.seed);
    let simplex = Simplex::new(params.seed);
    let mut rgba = vec![0_u8; (params.width * params.height * 4) as usize];
    rgba.par_chunks_mut(4).enumerate().for_each(|(i, pixel)| {
        let x = (i % w) as f64 / w as f64 * scale;
        let y = (i / w) as f64 / h as f64 * scale;
        let raw = match params.noise_type {
            NoiseType::Perlin => ((perlin.get([x, y]) + 1.0) * 0.5) as f32,
            NoiseType::Simplex => ((simplex.get([x, y]) + 1.0) * 0.5) as f32,
            NoiseType::Worley => worley_noise(x, y, params.seed) as f32,
            _ => ((perlin.get([x, y]) + 1.0) * 0.5) as f32,
        };
        let mut v = (raw - 0.5) * params.contrast + 0.5 + params.brightness;
        if params.invert {
            v = 1.0 - v;
        }
        let u = clamp_u8(v.clamp(0.0, 1.0));
        pixel[0] = u;
        pixel[1] = u;
        pixel[2] = u;
        pixel[3] = 255;
    });
    let image = encode_png_base64(&rgba, params.width, params.height)
        .ok_or_else(|| "Failed to encode PNG".to_string())?;
    Ok(ProceduralResult {
        image,
        time_ms: start.elapsed().as_secs_f64() * 1000.0,
    })
}

pub fn generate_voronoi_texture(params: VoronoiParams) -> Result<ProceduralResult, String> {
    let start = std::time::Instant::now();
    let w = params.width as usize;
    let h = params.height as usize;
    let cells: Vec<(f32, f32, f32)> = (0..params.cell_count as usize)
        .map(|i| {
            (
                hash2d(i as i32, 0, params.seed),
                hash2d(i as i32, 1, params.seed),
                hash2d(i as i32, 2, params.seed),
            )
        })
        .collect();
    let mut rgba = vec![0_u8; (params.width * params.height * 4) as usize];
    rgba.par_chunks_mut(4).enumerate().for_each(|(i, pixel)| {
        let x = (i % w) as f32 / w as f32;
        let y = (i / w) as f32 / h as f32;
        let mut min_dist = f32::MAX;
        let mut second_min = f32::MAX;
        let mut cell_val = 0.0_f32;
        for &(cx, cy, cv) in &cells {
            let dist = match params.distance_type.as_str() {
                "manhattan" => (x - cx).abs() + (y - cy).abs(),
                "chebyshev" => (x - cx).abs().max((y - cy).abs()),
                _ => ((x - cx).powi(2) + (y - cy).powi(2)).sqrt(),
            };
            if dist < min_dist {
                second_min = min_dist;
                min_dist = dist;
                cell_val = cv;
            } else if dist < second_min {
                second_min = dist;
            }
        }
        let mut v = if params.output_type == "edges" {
            1.0 - ((second_min - min_dist) / params.edge_thickness).min(1.0)
        } else if params.output_type == "cell_value" {
            cell_val
        } else {
            (min_dist * 5.0).min(1.0)
        };
        if params.invert {
            v = 1.0 - v;
        }
        let u = clamp_u8(v);
        pixel[0] = u;
        pixel[1] = u;
        pixel[2] = u;
        pixel[3] = 255;
    });
    let image = encode_png_base64(&rgba, params.width, params.height)
        .ok_or_else(|| "Failed to encode PNG".to_string())?;
    Ok(ProceduralResult {
        image,
        time_ms: start.elapsed().as_secs_f64() * 1000.0,
    })
}

pub fn blend_textures(
    base_image: String,
    overlay_image: String,
    blend_mode: String,
    opacity: f32,
) -> Result<String, String> {
    use base64::Engine;
    let base_data = base_image
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(&base_image);
    let overlay_data = overlay_image
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(&overlay_image);
    let base_bytes = base64::engine::general_purpose::STANDARD
        .decode(base_data)
        .map_err(|e| format!("Failed to decode base: {}", e))?;
    let overlay_bytes = base64::engine::general_purpose::STANDARD
        .decode(overlay_data)
        .map_err(|e| format!("Failed to decode overlay: {}", e))?;
    let base_img = image::load_from_memory(&base_bytes)
        .map_err(|e| format!("Failed to load base: {}", e))?
        .to_rgba8();
    let overlay_img = image::load_from_memory(&overlay_bytes)
        .map_err(|e| format!("Failed to load overlay: {}", e))?
        .to_rgba8();
    let width = base_img.width();
    let height = base_img.height();
    let mut base_raw = base_img.into_raw();
    let overlay_raw = overlay_img.into_raw();
    base_raw
        .par_chunks_mut(4)
        .zip(overlay_raw.par_chunks(4))
        .for_each(|(base, overlay)| {
            let b = [
                base[0] as f32 / 255.0,
                base[1] as f32 / 255.0,
                base[2] as f32 / 255.0,
            ];
            let o = [
                overlay[0] as f32 / 255.0,
                overlay[1] as f32 / 255.0,
                overlay[2] as f32 / 255.0,
            ];
            let result = match blend_mode.as_str() {
                "multiply" => [b[0] * o[0], b[1] * o[1], b[2] * o[2]],
                "screen" => [
                    1.0 - (1.0 - b[0]) * (1.0 - o[0]),
                    1.0 - (1.0 - b[1]) * (1.0 - o[1]),
                    1.0 - (1.0 - b[2]) * (1.0 - o[2]),
                ],
                _ => o,
            };
            base[0] = ((b[0] * (1.0 - opacity) + result[0] * opacity) * 255.0) as u8;
            base[1] = ((b[1] * (1.0 - opacity) + result[1] * opacity) * 255.0) as u8;
            base[2] = ((b[2] * (1.0 - opacity) + result[2] * opacity) * 255.0) as u8;
        });
    encode_png_base64(&base_raw, width, height).ok_or_else(|| "Failed to encode result".to_string())
}
