use noise::{Fbm, MultiFractal, NoiseFn, Perlin, Simplex, Worley};
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum NoiseType {
    Perlin,
    Simplex,
    Worley,
    Fbm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoiseParams {
    pub noise_type: String,
    pub frequency: f64,
    pub amplitude: f64,
    pub octaves: u32,
    pub lacunarity: f64,
    pub persistence: f64,
    pub seed: u32,
}

impl Default for NoiseParams {
    fn default() -> Self {
        Self {
            noise_type: "perlin".to_string(),
            frequency: 1.0,
            amplitude: 1.0,
            octaves: 4,
            lacunarity: 2.0,
            persistence: 0.5,
            seed: 0,
        }
    }
}

fn sample_noise(params: &NoiseParams, x: f64, y: f64, z: f64) -> f64 {
    let fx = x * params.frequency;
    let fy = y * params.frequency;
    let fz = z * params.frequency;

    let value = match params.noise_type.as_str() {
        "simplex" => Simplex::new(params.seed).get([fx, fy, fz]),
        "worley" => Worley::new(params.seed).get([fx, fy, fz]),
        "fbm" => Fbm::<Perlin>::new(params.seed)
            .set_octaves(params.octaves as usize)
            .set_lacunarity(params.lacunarity)
            .set_persistence(params.persistence)
            .get([fx, fy, fz]),
        _ => Perlin::new(params.seed).get([fx, fy, fz]),
    };

    value * params.amplitude
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoiseDisplacementResult {
    pub positions: Vec<f32>,
    pub time_ms: f64,
    pub vertex_count: usize,
}

pub fn apply_noise_displacement(
    positions: Vec<f32>,
    normals: Vec<f32>,
    params: NoiseParams,
) -> Result<NoiseDisplacementResult, String> {
    let start = Instant::now();
    let vertex_count = positions.len() / 3;
    let mut new_positions = positions.clone();

    for i in 0..vertex_count {
        let px = positions[i * 3] as f64;
        let py = positions[i * 3 + 1] as f64;
        let pz = positions[i * 3 + 2] as f64;
        let nx = normals.get(i * 3).copied().unwrap_or(0.0) as f64;
        let ny = normals.get(i * 3 + 1).copied().unwrap_or(0.0) as f64;
        let nz = normals.get(i * 3 + 2).copied().unwrap_or(1.0) as f64;
        let displacement = sample_noise(&params, px, py, pz);

        new_positions[i * 3] = (px + nx * displacement) as f32;
        new_positions[i * 3 + 1] = (py + ny * displacement) as f32;
        new_positions[i * 3 + 2] = (pz + nz * displacement) as f32;
    }

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    log::info!(
        "Noise displacement applied: {} verts in {:.2}ms",
        vertex_count,
        elapsed
    );

    Ok(NoiseDisplacementResult {
        positions: new_positions,
        time_ms: elapsed,
        vertex_count,
    })
}

pub fn sample_noise_point(x: f32, y: f32, z: f32, params: NoiseParams) -> f64 {
    sample_noise(&params, x as f64, y as f64, z as f64)
}

pub fn generate_noise_texture(
    width: u32,
    height: u32,
    params: NoiseParams,
) -> Result<Vec<f32>, String> {
    let start = Instant::now();
    let mut texture = Vec::with_capacity((width * height) as usize);

    for y in 0..height {
        for x in 0..width {
            let nx = x as f64 / width as f64;
            let ny = y as f64 / height as f64;
            let value = sample_noise(&params, nx, ny, 0.0);
            texture.push(((value + 1.0) * 0.5) as f32);
        }
    }

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    log::info!(
        "Noise texture generated: {}x{} in {:.2}ms",
        width,
        height,
        elapsed
    );
    Ok(texture)
}
