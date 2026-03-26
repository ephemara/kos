use rayon::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct PbrParams {
    pub normal_strength: f32,
    pub roughness_brightness: f32,
    pub roughness_contrast: f32,
    pub roughness_invert: bool,
    pub metal_bias: f32,
    pub metal_contrast: f32,
    pub dust: f32,
    pub grunge: f32,
    pub scratches: f32,
    pub noise: f32,
    pub edge_wear: f32,
    pub cavity_dirt: f32,
    pub brightness: f32,
    pub contrast: f32,
    pub gamma: f32,
    pub chromatic: f32,
    pub make_seamless: bool,
}

impl Default for PbrParams {
    fn default() -> Self {
        Self {
            normal_strength: 1.0,
            roughness_brightness: 0.0,
            roughness_contrast: 1.0,
            roughness_invert: false,
            metal_bias: 0.0,
            metal_contrast: 1.0,
            dust: 0.0,
            grunge: 0.0,
            scratches: 0.0,
            noise: 0.0,
            edge_wear: 0.0,
            cavity_dirt: 0.0,
            brightness: 1.0,
            contrast: 1.0,
            gamma: 1.0,
            chromatic: 0.0,
            make_seamless: false,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct PbrMapSet {
    pub base: Option<String>,
    pub normal: Option<String>,
    pub roughness: Option<String>,
    pub metallic: Option<String>,
    pub ao: Option<String>,
    pub height: Option<String>,
    pub emissive: Option<String>,
    pub time_ms: f64,
}

#[inline]
fn clamp_u8(val: f32) -> u8 {
    val.max(0.0).min(255.0) as u8
}

#[inline]
fn luminance(r: u8, g: u8, b: u8) -> f32 {
    r as f32 * 0.299 + g as f32 * 0.587 + b as f32 * 0.114
}

fn sobel_gradient(gray: &[f32], width: usize, height: usize, x: usize, y: usize) -> (f32, f32) {
    let get = |dx: isize, dy: isize| -> f32 {
        let nx = (x as isize + dx).rem_euclid(width as isize) as usize;
        let ny = (y as isize + dy).rem_euclid(height as isize) as usize;
        gray[ny * width + nx]
    };
    let tl = get(-1, -1);
    let t = get(0, -1);
    let tr = get(1, -1);
    let l = get(-1, 0);
    let r = get(1, 0);
    let bl = get(-1, 1);
    let b = get(0, 1);
    let br = get(1, 1);
    (
        (tr + 2.0 * r + br) - (tl + 2.0 * l + bl),
        (bl + 2.0 * b + br) - (tl + 2.0 * t + tr),
    )
}

fn to_grayscale(rgba: &[u8], width: usize, height: usize) -> Vec<f32> {
    let mut gray = vec![0.0_f32; width * height];
    gray.par_iter_mut().enumerate().for_each(|(i, g)| {
        let idx = i * 4;
        *g = luminance(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
    });
    gray
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

fn generate_normal_map_impl(gray: &[f32], width: usize, height: usize, strength: f32) -> Vec<u8> {
    let mut output = vec![0_u8; width * height * 4];
    let dz = 1.0 / strength.max(0.001);
    output.par_chunks_mut(4).enumerate().for_each(|(i, pixel)| {
        let x = i % width;
        let y = i / width;
        let (dx, dy) = sobel_gradient(gray, width, height, x, y);
        let len = (dx * dx + dy * dy + dz * dz).sqrt();
        pixel[0] = clamp_u8((dx / len * 0.5 + 0.5) * 255.0);
        pixel[1] = clamp_u8((dy / len * 0.5 + 0.5) * 255.0);
        pixel[2] = clamp_u8((dz / len * 0.5 + 0.5) * 255.0);
        pixel[3] = 255;
    });
    output
}

fn mono_map<F>(gray: &[f32], width: usize, height: usize, f: F) -> Vec<u8>
where
    F: Fn(usize, f32) -> u8 + Sync,
{
    let mut output = vec![0_u8; width * height * 4];
    output.par_chunks_mut(4).enumerate().for_each(|(i, pixel)| {
        let v = f(i, gray[i]);
        pixel[0] = v;
        pixel[1] = v;
        pixel[2] = v;
        pixel[3] = 255;
    });
    output
}

fn make_seamless_impl(rgba: Vec<u8>, width: usize, height: usize, blend_size: f32) -> Vec<u8> {
    let mut output = rgba.clone();
    let blend_w = (width as f32 * blend_size) as usize;
    let blend_h = (height as f32 * blend_size) as usize;
    output.par_chunks_mut(4).enumerate().for_each(|(i, pixel)| {
        let x = i % width;
        let y = i / width;
        if x < blend_w {
            let t = x as f32 / blend_w as f32;
            let src_idx = (y * width + (width - blend_w + x)) * 4;
            pixel[0] = (pixel[0] as f32 * t + rgba[src_idx] as f32 * (1.0 - t)) as u8;
            pixel[1] = (pixel[1] as f32 * t + rgba[src_idx + 1] as f32 * (1.0 - t)) as u8;
            pixel[2] = (pixel[2] as f32 * t + rgba[src_idx + 2] as f32 * (1.0 - t)) as u8;
        }
        if y < blend_h {
            let t = y as f32 / blend_h as f32;
            let src_idx = ((height - blend_h + y) * width + x) * 4;
            pixel[0] = (pixel[0] as f32 * t + rgba[src_idx] as f32 * (1.0 - t)) as u8;
            pixel[1] = (pixel[1] as f32 * t + rgba[src_idx + 1] as f32 * (1.0 - t)) as u8;
            pixel[2] = (pixel[2] as f32 * t + rgba[src_idx + 2] as f32 * (1.0 - t)) as u8;
        }
    });
    output
}

pub fn generate_pbr_maps(image_base64: String, params: PbrParams) -> Result<PbrMapSet, String> {
    use base64::Engine;
    let start = std::time::Instant::now();
    let image_data = image_base64
        .strip_prefix("data:image/png;base64,")
        .or_else(|| image_base64.strip_prefix("data:image/jpeg;base64,"))
        .unwrap_or(&image_base64);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    let img =
        image::load_from_memory(&bytes).map_err(|e| format!("Failed to decode image: {}", e))?;
    let rgba = img.to_rgba8();
    let width = rgba.width() as usize;
    let height = rgba.height() as usize;
    let mut raw = rgba.into_raw();
    if params.make_seamless {
        raw = make_seamless_impl(raw, width, height, 0.15);
    }
    let gray = to_grayscale(&raw, width, height);
    let normal = generate_normal_map_impl(&gray, width, height, params.normal_strength);
    let roughness = mono_map(&gray, width, height, |_, value| {
        let mut v =
            (value - 128.0) * params.roughness_contrast + 128.0 + params.roughness_brightness;
        if params.roughness_invert {
            v = 255.0 - v;
        }
        if params.noise > 0.0 {
            v += (fastrand::f32() - 0.5) * params.noise * 50.0;
        }
        clamp_u8(v)
    });
    let metallic = mono_map(&gray, width, height, |_, value| {
        let mut v = (value - 128.0) * params.metal_contrast + 128.0 + params.metal_bias;
        if params.grunge > 0.0 {
            v *= 1.0 - fastrand::f32() * params.grunge;
        }
        clamp_u8(v)
    });
    let ao = mono_map(&gray, width, height, |_, value| {
        clamp_u8(value * 0.8 + 255.0 * 0.2)
    });
    let height_map = mono_map(&gray, width, height, |_, value| {
        clamp_u8((value - 128.0) + 128.0)
    });
    let w = width as u32;
    let h = height as u32;
    Ok(PbrMapSet {
        base: encode_png_base64(&raw, w, h),
        normal: encode_png_base64(&normal, w, h),
        roughness: encode_png_base64(&roughness, w, h),
        metallic: encode_png_base64(&metallic, w, h),
        ao: encode_png_base64(&ao, w, h),
        height: encode_png_base64(&height_map, w, h),
        emissive: None,
        time_ms: start.elapsed().as_secs_f64() * 1000.0,
    })
}

pub fn generate_normal_map(image_base64: String, strength: f32) -> Result<String, String> {
    use base64::Engine;
    let image_data = image_base64
        .strip_prefix("data:image/png;base64,")
        .or_else(|| image_base64.strip_prefix("data:image/jpeg;base64,"))
        .unwrap_or(&image_base64);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    let img =
        image::load_from_memory(&bytes).map_err(|e| format!("Failed to decode image: {}", e))?;
    let rgba = img.to_rgba8();
    let width = rgba.width() as usize;
    let height = rgba.height() as usize;
    let gray = to_grayscale(&rgba, width, height);
    encode_png_base64(
        &generate_normal_map_impl(&gray, width, height, strength),
        width as u32,
        height as u32,
    )
    .ok_or_else(|| "Failed to encode PNG".to_string())
}
