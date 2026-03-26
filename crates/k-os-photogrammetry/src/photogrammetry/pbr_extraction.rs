//! PBR Map Extraction Module
//!
//! Extracts PBR maps (albedo, normal, roughness, metallic, AO, height) from textured mesh.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;

use super::{TextureAtlas, TriangleMesh};
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

/// PBR map extractor
pub struct PBRExtractor {
    _gpu_compute: Arc<GpuCompute>,
    config: PBRExtractionConfig,
}

/// Configurable extraction defaults and heuristic knobs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PBRExtractionConfig {
    /// Flat-space normal fallback used when geometric baking is unavailable.
    pub flat_normal_rgb: [u8; 3],
    /// Baseline roughness value in [0.0, 1.0].
    pub roughness_base: f32,
    /// Roughness boost based on texture luminance variance in [0.0, 1.0].
    pub roughness_variance_scale: f32,
    /// Metallic cutoff for bright low-saturation pixels in [0.0, 1.0].
    pub metallic_brightness_threshold: f32,
    /// Max saturation treated as potential bare metal in [0.0, 1.0].
    pub metallic_saturation_threshold: f32,
    /// Uniform AO fallback value in [0, 255].
    pub ao_default: u8,
    /// Uniform height fallback value in [0, 255].
    pub height_default: u8,
    /// Renderer-facing validation contract for extracted maps.
    pub validation_contract: PBRMapValidationContract,
}

impl Default for PBRExtractionConfig {
    fn default() -> Self {
        Self {
            flat_normal_rgb: [128, 128, 255],
            roughness_base: 0.45,
            roughness_variance_scale: 0.4,
            metallic_brightness_threshold: 0.55,
            metallic_saturation_threshold: 0.2,
            ao_default: 255,
            height_default: 128,
            validation_contract: PBRMapValidationContract::default(),
        }
    }
}

/// Stable map identifiers for validation rules.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum PBRMapKind {
    Albedo,
    Normal,
    Roughness,
    Metallic,
    Ao,
    Height,
}

impl PBRMapKind {
    fn label(self) -> &'static str {
        match self {
            PBRMapKind::Albedo => "albedo",
            PBRMapKind::Normal => "normal",
            PBRMapKind::Roughness => "roughness",
            PBRMapKind::Metallic => "metallic",
            PBRMapKind::Ao => "ao",
            PBRMapKind::Height => "height",
        }
    }
}

/// Per-map validation rule for renderer-facing expectations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureValidationRule {
    /// Expected number of channels for the map.
    pub channels: u32,
    /// Whether the map must contain more than one unique value.
    pub require_non_uniform: bool,
}

/// Data-driven validation contract for photogrammetry PBR outputs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PBRMapValidationContract {
    /// Validation rules keyed by map kind.
    pub rules: BTreeMap<PBRMapKind, TextureValidationRule>,
}

impl Default for PBRMapValidationContract {
    fn default() -> Self {
        let mut rules = BTreeMap::new();
        rules.insert(
            PBRMapKind::Albedo,
            TextureValidationRule {
                channels: 4,
                require_non_uniform: true,
            },
        );
        rules.insert(
            PBRMapKind::Normal,
            TextureValidationRule {
                channels: 3,
                require_non_uniform: false,
            },
        );
        rules.insert(
            PBRMapKind::Roughness,
            TextureValidationRule {
                channels: 1,
                require_non_uniform: false,
            },
        );
        rules.insert(
            PBRMapKind::Metallic,
            TextureValidationRule {
                channels: 1,
                require_non_uniform: false,
            },
        );
        rules.insert(
            PBRMapKind::Ao,
            TextureValidationRule {
                channels: 1,
                require_non_uniform: false,
            },
        );
        rules.insert(
            PBRMapKind::Height,
            TextureValidationRule {
                channels: 1,
                require_non_uniform: false,
            },
        );
        Self { rules }
    }
}

/// PBR maps extracted from mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PBRMaps {
    /// Albedo (base color) map
    pub albedo: TextureMap,
    /// Normal map
    pub normal: TextureMap,
    /// Roughness map
    pub roughness: TextureMap,
    /// Metallic map
    pub metallic: TextureMap,
    /// Ambient occlusion map
    pub ao: TextureMap,
    /// Height (displacement) map
    pub height: TextureMap,
}

/// A single texture map
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureMap {
    /// Texture pixels (format depends on map type)
    pub pixels: Vec<u8>,
    /// Texture width
    pub width: u32,
    /// Texture height
    pub height: u32,
    /// Number of channels (1, 3, or 4)
    pub channels: u32,
}

impl PBRMaps {
    /// Validate extracted maps against a renderer-facing contract.
    pub fn validate_against(
        &self,
        expected_width: u32,
        expected_height: u32,
        contract: &PBRMapValidationContract,
    ) -> Result<()> {
        for (kind, rule) in &contract.rules {
            let map = self.map_for(*kind);
            Self::validate_map(kind.label(), map, expected_width, expected_height, rule)?;
        }
        Ok(())
    }

    fn map_for(&self, kind: PBRMapKind) -> &TextureMap {
        match kind {
            PBRMapKind::Albedo => &self.albedo,
            PBRMapKind::Normal => &self.normal,
            PBRMapKind::Roughness => &self.roughness,
            PBRMapKind::Metallic => &self.metallic,
            PBRMapKind::Ao => &self.ao,
            PBRMapKind::Height => &self.height,
        }
    }

    fn validate_map(
        label: &str,
        map: &TextureMap,
        expected_width: u32,
        expected_height: u32,
        rule: &TextureValidationRule,
    ) -> Result<()> {
        anyhow::ensure!(
            map.width == expected_width && map.height == expected_height,
            "PBR map '{}' dimension mismatch: expected {}x{}, got {}x{}",
            label,
            expected_width,
            expected_height,
            map.width,
            map.height
        );
        anyhow::ensure!(
            map.channels == rule.channels,
            "PBR map '{}' channel mismatch: expected {}, got {}",
            label,
            rule.channels,
            map.channels
        );

        let expected_len = (map.width as usize)
            .saturating_mul(map.height as usize)
            .saturating_mul(map.channels as usize);
        anyhow::ensure!(
            map.pixels.len() == expected_len,
            "PBR map '{}' pixel length mismatch: expected {}, got {}",
            label,
            expected_len,
            map.pixels.len()
        );

        if rule.require_non_uniform {
            let texel_stride = map.channels.max(1) as usize;
            let mut texels = map.pixels.chunks_exact(texel_stride);
            let first_texel = texels.next().unwrap_or_default();
            anyhow::ensure!(
                texels.any(|texel| texel != first_texel),
                "PBR map '{}' is uniform but non-uniformity is required",
                label
            );
        }

        Ok(())
    }
}

impl PBRExtractor {
    /// Create a new PBR extractor
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Result<Self> {
        Ok(Self {
            _gpu_compute: gpu_compute,
            config: PBRExtractionConfig::default(),
        })
    }

    /// Create a PBR extractor with explicit extraction config.
    pub fn with_config(gpu_compute: Arc<GpuCompute>, config: PBRExtractionConfig) -> Result<Self> {
        Ok(Self {
            _gpu_compute: gpu_compute,
            config,
        })
    }

    /// Extract PBR maps from textured mesh
    pub fn extract(&self, mesh: &TriangleMesh, texture: &TextureAtlas) -> Result<PBRMaps> {
        log::info!("Extracting PBR maps from mesh");

        let width = texture.width;
        let height = texture.height;

        // Extract albedo from texture atlas
        let albedo = self.extract_albedo(texture)?;

        // Generate normal map from mesh geometry
        let normal = self.generate_normal_map(mesh, width, height)?;

        // Estimate roughness map
        let roughness = self.estimate_roughness(texture, width, height)?;

        // Estimate metallic map
        let metallic = self.estimate_metallic(texture, width, height)?;

        // Generate ambient occlusion map
        let ao = self.generate_ao_map(mesh, width, height)?;

        // Generate height map from mesh geometry
        let height_map = self.generate_height_map(mesh, width, height)?;

        log::info!("PBR map extraction complete");

        let maps = PBRMaps {
            albedo,
            normal,
            roughness,
            metallic,
            ao,
            height: height_map,
        };

        maps.validate_against(width, height, &self.config.validation_contract)?;
        Ok(maps)
    }

    /// Extract albedo map from texture
    fn extract_albedo(&self, texture: &TextureAtlas) -> Result<TextureMap> {
        let expected_len = (texture.width as usize)
            .saturating_mul(texture.height as usize)
            .saturating_mul(4);
        anyhow::ensure!(
            texture.pixels.len() == expected_len,
            "Texture atlas pixel buffer length mismatch: expected {}, got {}",
            expected_len,
            texture.pixels.len()
        );

        // Albedo is just the texture atlas
        Ok(TextureMap {
            pixels: texture.pixels.clone(),
            width: texture.width,
            height: texture.height,
            channels: 4, // RGBA
        })
    }

    /// Generate normal map from mesh geometry
    fn generate_normal_map(
        &self,
        mesh: &TriangleMesh,
        width: u32,
        height: u32,
    ) -> Result<TextureMap> {
        let texel_count = (width as usize).saturating_mul(height as usize);
        let mut sum_x = vec![0.0_f32; texel_count];
        let mut sum_y = vec![0.0_f32; texel_count];
        let mut sum_z = vec![0.0_f32; texel_count];
        let mut sample_count = vec![0_u32; texel_count];

        // Minimal geometry-driven bake: splat each vertex normal into its UV texel.
        // Uses fallback flat-normal for texels without samples.
        for (uv, normal) in mesh.uvs.iter().zip(mesh.normals.iter()) {
            if !uv.x.is_finite() || !uv.y.is_finite() {
                continue;
            }
            if !normal.x.is_finite() || !normal.y.is_finite() || !normal.z.is_finite() {
                continue;
            }

            let n_len_sq = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
            if n_len_sq <= 1e-12 {
                continue;
            }
            let inv_len = n_len_sq.sqrt().recip();
            let nx = normal.x * inv_len;
            let ny = normal.y * inv_len;
            let nz = normal.z * inv_len;

            let u = uv.x.clamp(0.0, 1.0);
            let v = uv.y.clamp(0.0, 1.0);
            let x = (u * (width.saturating_sub(1)) as f32).round() as u32;
            let y = ((1.0 - v) * (height.saturating_sub(1)) as f32).round() as u32;
            let idx = (y as usize)
                .saturating_mul(width as usize)
                .saturating_add(x as usize);

            if idx >= texel_count {
                continue;
            }

            sum_x[idx] += nx;
            sum_y[idx] += ny;
            sum_z[idx] += nz;
            sample_count[idx] = sample_count[idx].saturating_add(1);
        }

        let mut pixels = vec![0u8; texel_count.saturating_mul(3)];
        let [flat_r, flat_g, flat_b] = self.config.flat_normal_rgb;

        for texel_idx in 0..texel_count {
            let px = texel_idx.saturating_mul(3);
            if sample_count[texel_idx] == 0 {
                pixels[px] = flat_r;
                pixels[px + 1] = flat_g;
                pixels[px + 2] = flat_b;
                continue;
            }

            let nx = sum_x[texel_idx];
            let ny = sum_y[texel_idx];
            let nz = sum_z[texel_idx];
            let len_sq = nx * nx + ny * ny + nz * nz;
            if len_sq <= 1e-12 {
                pixels[px] = flat_r;
                pixels[px + 1] = flat_g;
                pixels[px + 2] = flat_b;
                continue;
            }

            let inv_len = len_sq.sqrt().recip();
            let nx = nx * inv_len;
            let ny = ny * inv_len;
            let nz = nz * inv_len;

            pixels[px] = encode_normal_component(nx);
            pixels[px + 1] = encode_normal_component(ny);
            pixels[px + 2] = encode_normal_component(nz);
        }

        Ok(TextureMap {
            pixels,
            width,
            height,
            channels: 3, // RGB
        })
    }

    /// Estimate roughness map from texture
    fn estimate_roughness(
        &self,
        texture: &TextureAtlas,
        width: u32,
        height: u32,
    ) -> Result<TextureMap> {
        // TODO: Upgrade to geometric and frequency-domain roughness estimation.
        // Current heuristic uses texture luminance deviation to avoid uniform placeholders.
        let pixel_count = (width as usize).saturating_mul(height as usize);
        let mut luminance = Vec::with_capacity(pixel_count);

        let mut sum = 0.0_f32;
        for px in texture.pixels.chunks_exact(4).take(pixel_count) {
            let l = 0.2126 * (px[0] as f32 / 255.0)
                + 0.7152 * (px[1] as f32 / 255.0)
                + 0.0722 * (px[2] as f32 / 255.0);
            sum += l;
            luminance.push(l);
        }

        let mean = if pixel_count == 0 {
            0.0
        } else {
            sum / pixel_count as f32
        };

        let base = self.config.roughness_base.clamp(0.0, 1.0);
        let scale = self.config.roughness_variance_scale.clamp(0.0, 1.0);

        let mut pixels = Vec::with_capacity(pixel_count);
        for l in luminance {
            let deviation = (l - mean).abs();
            let roughness = (base + deviation * scale).clamp(0.0, 1.0);
            pixels.push((roughness * 255.0).round() as u8);
        }

        Ok(TextureMap {
            pixels,
            width,
            height,
            channels: 1, // Grayscale
        })
    }

    /// Estimate metallic map from texture
    fn estimate_metallic(
        &self,
        texture: &TextureAtlas,
        width: u32,
        height: u32,
    ) -> Result<TextureMap> {
        // TODO: Replace with classifier/regression model calibrated on scanned materials.
        // Current heuristic flags bright low-saturation pixels as potentially metallic.
        let pixel_count = (width as usize).saturating_mul(height as usize);
        let brightness_threshold = self.config.metallic_brightness_threshold.clamp(0.0, 1.0);
        let saturation_threshold = self.config.metallic_saturation_threshold.clamp(0.0, 1.0);

        let mut pixels = Vec::with_capacity(pixel_count);
        for px in texture.pixels.chunks_exact(4).take(pixel_count) {
            let r = px[0] as f32 / 255.0;
            let g = px[1] as f32 / 255.0;
            let b = px[2] as f32 / 255.0;
            let max_c = r.max(g).max(b);
            let min_c = r.min(g).min(b);
            let saturation = if max_c > 0.0 {
                (max_c - min_c) / max_c
            } else {
                0.0
            };

            let metallic = max_c >= brightness_threshold && saturation <= saturation_threshold;
            pixels.push(if metallic { 255 } else { 0 });
        }

        Ok(TextureMap {
            pixels,
            width,
            height,
            channels: 1, // Grayscale
        })
    }

    /// Generate ambient occlusion map
    fn generate_ao_map(&self, _mesh: &TriangleMesh, width: u32, height: u32) -> Result<TextureMap> {
        // TODO: Implement proper AO generation using ray tracing
        // For now, create a uniform AO map

        let pixels = vec![self.config.ao_default; (width * height) as usize]; // No occlusion

        Ok(TextureMap {
            pixels,
            width,
            height,
            channels: 1, // Grayscale
        })
    }

    /// Generate height map from mesh geometry
    fn generate_height_map(
        &self,
        _mesh: &TriangleMesh,
        width: u32,
        height: u32,
    ) -> Result<TextureMap> {
        // TODO: Implement proper height map generation from mesh displacement
        // For now, create a flat height map

        let pixels = vec![self.config.height_default; (width * height) as usize]; // Mid-height

        Ok(TextureMap {
            pixels,
            width,
            height,
            channels: 1, // Grayscale
        })
    }
}

fn encode_normal_component(component: f32) -> u8 {
    ((component.clamp(-1.0, 1.0) * 0.5 + 0.5) * 255.0).round() as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_texture_rgba() -> TextureAtlas {
        TextureAtlas {
            pixels: vec![
                255, 255, 255, 255, 10, 10, 10, 255, 240, 200, 120, 255, 40, 180, 220, 255,
            ],
            width: 2,
            height: 2,
        }
    }

    fn sample_mesh() -> TriangleMesh {
        TriangleMesh {
            vertices: Vec::new(),
            normals: Vec::new(),
            uvs: Vec::new(),
            indices: Vec::new(),
        }
    }

    fn sample_mesh_with_uv_normals() -> TriangleMesh {
        TriangleMesh {
            vertices: vec![
                nalgebra::Point3::new(0.0, 0.0, 0.0),
                nalgebra::Point3::new(1.0, 0.0, 0.0),
                nalgebra::Point3::new(0.0, 1.0, 0.0),
                nalgebra::Point3::new(1.0, 1.0, 0.0),
            ],
            normals: vec![
                nalgebra::Vector3::new(0.0, 0.0, 1.0),
                nalgebra::Vector3::new(1.0, 0.0, 0.0),
                nalgebra::Vector3::new(0.0, 1.0, 0.0),
                nalgebra::Vector3::new(0.577, 0.577, 0.577),
            ],
            uvs: vec![
                nalgebra::Point2::new(0.0, 0.0),
                nalgebra::Point2::new(1.0, 0.0),
                nalgebra::Point2::new(0.0, 1.0),
                nalgebra::Point2::new(1.0, 1.0),
            ],
            indices: vec![0, 1, 2, 1, 3, 2],
        }
    }

    #[test]
    fn test_texture_map_creation() {
        let map = TextureMap {
            pixels: vec![255u8; 256 * 256 * 4],
            width: 256,
            height: 256,
            channels: 4,
        };

        assert_eq!(map.width, 256);
        assert_eq!(map.height, 256);
        assert_eq!(map.channels, 4);
    }

    #[test]
    fn test_roughness_estimation_uses_texture_signal() {
        let cfg = PBRExtractionConfig {
            roughness_base: 0.2,
            roughness_variance_scale: 0.7,
            ..PBRExtractionConfig::default()
        };
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config: cfg,
        };

        let texture = sample_texture_rgba();
        let roughness = extractor
            .estimate_roughness(&texture, texture.width, texture.height)
            .unwrap();

        assert_eq!(roughness.channels, 1);
        assert_eq!(roughness.pixels.len(), 4);
        assert!(roughness.pixels.iter().any(|v| *v != roughness.pixels[0]));
    }

    #[test]
    fn test_normal_map_generation_uses_mesh_uv_normals() {
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config: PBRExtractionConfig::default(),
        };
        let mesh = sample_mesh_with_uv_normals();

        let normal = extractor.generate_normal_map(&mesh, 2, 2).unwrap();

        assert_eq!(normal.channels, 3);
        assert_eq!(normal.pixels.len(), 12);
        let unique_texels = normal
            .pixels
            .chunks_exact(3)
            .collect::<std::collections::BTreeSet<_>>();
        assert!(
            unique_texels.len() > 1,
            "expected non-uniform normal map from varying normals"
        );
    }

    #[test]
    fn test_normal_map_generation_falls_back_when_mesh_samples_missing() {
        let cfg = PBRExtractionConfig {
            flat_normal_rgb: [11, 22, 33],
            ..PBRExtractionConfig::default()
        };
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config: cfg,
        };

        let normal = extractor.generate_normal_map(&sample_mesh(), 2, 2).unwrap();

        for px in normal.pixels.chunks_exact(3) {
            assert_eq!(px, &[11, 22, 33]);
        }
    }

    #[test]
    fn test_metallic_estimation_distinguishes_low_saturation_bright_pixels() {
        let cfg = PBRExtractionConfig {
            metallic_brightness_threshold: 0.5,
            metallic_saturation_threshold: 0.15,
            ..PBRExtractionConfig::default()
        };
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config: cfg,
        };

        let texture = sample_texture_rgba();
        let metallic = extractor
            .estimate_metallic(&texture, texture.width, texture.height)
            .unwrap();

        assert_eq!(metallic.channels, 1);
        assert_eq!(metallic.pixels.len(), 4);
        assert!(metallic.pixels.contains(&255));
        assert!(metallic.pixels.contains(&0));
    }

    #[test]
    fn test_extract_validates_renderer_contract_success_path() {
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config: PBRExtractionConfig::default(),
        };

        let texture = sample_texture_rgba();
        let maps = extractor.extract(&sample_mesh(), &texture).unwrap();
        maps.validate_against(
            texture.width,
            texture.height,
            &PBRMapValidationContract::default(),
        )
        .unwrap();
    }

    #[test]
    fn test_extract_fails_on_contract_channel_mismatch() {
        let mut config = PBRExtractionConfig::default();
        config.validation_contract.rules.insert(
            PBRMapKind::Albedo,
            TextureValidationRule {
                channels: 3,
                require_non_uniform: true,
            },
        );
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config,
        };

        let err = extractor
            .extract(&sample_mesh(), &sample_texture_rgba())
            .unwrap_err();
        assert!(err.to_string().contains("albedo"));
        assert!(err.to_string().contains("channel mismatch"));
    }

    #[test]
    fn test_extract_fails_on_required_non_uniformity() {
        let mut config = PBRExtractionConfig::default();
        config.validation_contract.rules.insert(
            PBRMapKind::Normal,
            TextureValidationRule {
                channels: 3,
                require_non_uniform: true,
            },
        );
        let extractor = PBRExtractor {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
            config,
        };

        let err = extractor
            .extract(&sample_mesh(), &sample_texture_rgba())
            .unwrap_err();
        assert!(err.to_string().contains("normal"));
        assert!(err.to_string().contains("non-uniformity"));
    }
}
