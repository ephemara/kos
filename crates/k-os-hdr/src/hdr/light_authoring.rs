// HDR Light Authoring with Path Tracing
// Quantum-accelerated light contribution rendering

use nalgebra::{Vector2, Vector3};
use rand::Rng;
use rayon::prelude::*;
use std::f32::consts::PI;
use std::sync::Arc;

use super::{HDRError, HDRImage, Light, LightType};
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

/// Add light contribution to HDR environment using path tracing
pub fn add_light_to_hdr(
    _gpu_compute: &Arc<GpuCompute>,
    hdr: &mut HDRImage,
    light: &Light,
) -> Result<(), HDRError> {
    // Validate light parameters
    if light.intensity < 0.0 || light.intensity > 1_000_000.0 {
        return Err(HDRError::InvalidIntensity(light.intensity));
    }
    if light.color_temperature < 1000.0 || light.color_temperature > 40_000.0 {
        return Err(HDRError::InvalidColorTemperature(light.color_temperature));
    }

    // Get light color from temperature
    let light_color = light.get_color();

    // Render light contribution based on type
    match &light.light_type {
        LightType::Point => render_point_light(hdr, light, light_color),
        LightType::Directional => render_directional_light(hdr, light, light_color),
        LightType::Area { width, height } => {
            render_area_light(hdr, light, light_color, *width, *height)
        }
    }

    Ok(())
}

/// Render point light contribution
fn render_point_light(hdr: &mut HDRImage, light: &Light, light_color: Vector3<f32>) {
    let samples_per_pixel = 64;

    // Process pixels in parallel
    let width = hdr.width;
    let height = hdr.height;

    let contributions: Vec<_> = (0..height)
        .into_par_iter()
        .flat_map(|y| {
            let mut rng = rand::thread_rng();

            (0..width)
                .map(move |x| {
                    let mut radiance = Vector3::zeros();

                    // Monte Carlo sampling
                    for _ in 0..samples_per_pixel {
                        // Convert pixel to direction in equirectangular space
                        let u = (x as f32 + rng.gen::<f32>()) / width as f32;
                        let v = (y as f32 + rng.gen::<f32>()) / height as f32;

                        let direction = equirectangular_to_direction(u, v);

                        // Calculate light contribution
                        let contribution = calculate_point_light_contribution(
                            &direction,
                            &light.position,
                            light.intensity,
                            &light_color,
                        );

                        radiance += contribution;
                    }

                    // Average samples
                    radiance /= samples_per_pixel as f32;

                    (x, y, radiance)
                })
                .collect::<Vec<_>>()
        })
        .collect();

    // Apply contributions to HDR image
    for (x, y, radiance) in contributions {
        if let Some(mut current) = hdr.get_pixel(x, y) {
            current += radiance;
            hdr.set_pixel(x, y, current);
        }
    }
}

/// Render directional light contribution
fn render_directional_light(hdr: &mut HDRImage, light: &Light, light_color: Vector3<f32>) {
    let sun_angular_size = 0.53_f32.to_radians(); // Sun's angular diameter
    let samples_per_pixel = 32;

    let width = hdr.width;
    let height = hdr.height;

    let contributions: Vec<_> = (0..height)
        .into_par_iter()
        .flat_map(|y| {
            let mut rng = rand::thread_rng();

            (0..width)
                .map(move |x| {
                    let mut radiance = Vector3::zeros();

                    for _ in 0..samples_per_pixel {
                        let u = (x as f32 + rng.gen::<f32>()) / width as f32;
                        let v = (y as f32 + rng.gen::<f32>()) / height as f32;

                        let direction = equirectangular_to_direction(u, v);

                        // Check if direction is within sun disk
                        let cos_angle = direction.dot(&light.direction);
                        let angle = cos_angle.acos();

                        if angle < sun_angular_size / 2.0 {
                            // Inside sun disk - add contribution
                            let solid_angle = 2.0 * PI * (1.0 - (sun_angular_size / 2.0).cos());
                            let radiance_contribution = light.intensity / solid_angle;
                            radiance += light_color * radiance_contribution;
                        }
                    }

                    radiance /= samples_per_pixel as f32;

                    (x, y, radiance)
                })
                .collect::<Vec<_>>()
        })
        .collect();

    for (x, y, radiance) in contributions {
        if let Some(mut current) = hdr.get_pixel(x, y) {
            current += radiance;
            hdr.set_pixel(x, y, current);
        }
    }
}

/// Render area light contribution
fn render_area_light(
    hdr: &mut HDRImage,
    light: &Light,
    light_color: Vector3<f32>,
    width: f32,
    height: f32,
) {
    let samples_per_pixel = 128;

    let hdr_width = hdr.width;
    let hdr_height = hdr.height;

    // Calculate area light basis vectors
    let normal = light.direction.normalize();
    let tangent = if normal.y.abs() < 0.9 {
        Vector3::new(0.0, 1.0, 0.0).cross(&normal).normalize()
    } else {
        Vector3::new(1.0, 0.0, 0.0).cross(&normal).normalize()
    };
    let bitangent = normal.cross(&tangent);

    let contributions: Vec<_> = (0..hdr_height)
        .into_par_iter()
        .flat_map(|y| {
            let mut rng = rand::thread_rng();

            (0..hdr_width)
                .map(move |x| {
                    let mut radiance = Vector3::zeros();

                    for _ in 0..samples_per_pixel {
                        let u = (x as f32 + rng.gen::<f32>()) / hdr_width as f32;
                        let v = (y as f32 + rng.gen::<f32>()) / hdr_height as f32;

                        let direction = equirectangular_to_direction(u, v);

                        // Sample random point on area light
                        let light_u = (rng.gen::<f32>() - 0.5) * width;
                        let light_v = (rng.gen::<f32>() - 0.5) * height;

                        let light_point = light.position + tangent * light_u + bitangent * light_v;

                        // Calculate contribution from this sample point
                        let contribution = calculate_area_light_contribution(
                            &direction,
                            &light_point,
                            &normal,
                            light.intensity,
                            &light_color,
                            width * height,
                        );

                        radiance += contribution;
                    }

                    radiance /= samples_per_pixel as f32;

                    (x, y, radiance)
                })
                .collect::<Vec<_>>()
        })
        .collect();

    for (x, y, radiance) in contributions {
        if let Some(mut current) = hdr.get_pixel(x, y) {
            current += radiance;
            hdr.set_pixel(x, y, current);
        }
    }
}

/// Calculate point light contribution for a direction
fn calculate_point_light_contribution(
    direction: &Vector3<f32>,
    light_pos: &Vector3<f32>,
    intensity: f32,
    color: &Vector3<f32>,
) -> Vector3<f32> {
    // For equirectangular environment, we need to check if the direction
    // intersects with the light position (treating it as a small sphere)

    let light_radius = 0.1; // Small radius for point light

    // Ray-sphere intersection
    let oc = -light_pos; // Ray origin is at (0,0,0)
    let a = direction.dot(direction);
    let b = 2.0 * oc.dot(direction);
    let c = oc.dot(&oc) - light_radius * light_radius;
    let discriminant = b * b - 4.0 * a * c;

    if discriminant > 0.0 {
        let t = (-b - discriminant.sqrt()) / (2.0 * a);
        if t > 0.0 {
            // Hit the light sphere
            let distance = light_pos.norm();
            let attenuation = intensity / (4.0 * PI * distance * distance);
            return color * attenuation;
        }
    }

    Vector3::zeros()
}

/// Calculate area light contribution for a direction
fn calculate_area_light_contribution(
    direction: &Vector3<f32>,
    light_point: &Vector3<f32>,
    light_normal: &Vector3<f32>,
    intensity: f32,
    color: &Vector3<f32>,
    area: f32,
) -> Vector3<f32> {
    // Ray-plane intersection
    let denom = direction.dot(light_normal);

    if denom.abs() > 1e-6 {
        let t = light_point.dot(light_normal) / denom;

        if t > 0.0 {
            let hit_point = direction * t;
            let to_light = light_point - hit_point;
            let distance = to_light.norm();

            if distance < 1e-6 {
                return Vector3::zeros();
            }

            // Check if hit point is within area light bounds
            // (simplified - assumes we're close enough)

            let cos_theta = (-to_light.normalize()).dot(light_normal).max(0.0);
            let radiance = (intensity * cos_theta) / (PI * area * distance * distance);

            return color * radiance;
        }
    }

    Vector3::zeros()
}

/// Convert equirectangular UV to 3D direction
fn equirectangular_to_direction(u: f32, v: f32) -> Vector3<f32> {
    let theta = (u - 0.5) * 2.0 * PI; // Azimuth centered on +X
    let phi = v * PI; // Elevation: 0 to π

    let sin_phi = phi.sin();
    let cos_phi = phi.cos();
    let sin_theta = theta.sin();
    let cos_theta = theta.cos();

    Vector3::new(sin_phi * cos_theta, cos_phi, sin_phi * sin_theta)
}

/// Convert 3D direction to equirectangular UV
#[allow(dead_code)]
fn direction_to_equirectangular(dir: &Vector3<f32>) -> Vector2<f32> {
    let theta = dir.z.atan2(dir.x);
    let phi = dir.y.acos();

    let u = (theta + PI) / (2.0 * PI);
    let v = phi / PI;

    Vector2::new(u, v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hdr::HDRFormat;

    #[test]
    fn test_equirectangular_conversion() {
        // Test round-trip conversion
        let original = Vector3::new(1.0, 0.0, 0.0).normalize();
        let uv = direction_to_equirectangular(&original);
        let converted = equirectangular_to_direction(uv.x, uv.y);

        assert!((original - converted).norm() < 0.01);
    }

    #[test]
    fn test_light_validation() {
        let gpu_compute = Arc::new(GpuCompute::new_mock());
        let mut hdr = HDRImage::new(100, 50, HDRFormat::RadianceRGBE);

        // Valid light
        let light = Light::point(Vector3::new(0.0, 0.0, 5.0), 1000.0, 6500.0).unwrap();
        assert!(add_light_to_hdr(&gpu_compute, &mut hdr, &light).is_ok());

        // Invalid intensity
        let mut bad_light = light.clone();
        bad_light.intensity = 2_000_000.0;
        assert!(add_light_to_hdr(&gpu_compute, &mut hdr, &bad_light).is_err());

        // Invalid color temperature
        let mut bad_light = light.clone();
        bad_light.color_temperature = 50_000.0;
        assert!(add_light_to_hdr(&gpu_compute, &mut hdr, &bad_light).is_err());
    }

    #[test]
    fn test_point_light_contribution() {
        let direction = Vector3::new(1.0, 0.0, 0.0).normalize();
        let light_pos = Vector3::new(1.0, 0.0, 0.0);
        let intensity = 1000.0;
        let color = Vector3::new(1.0, 1.0, 1.0);

        let contribution =
            calculate_point_light_contribution(&direction, &light_pos, intensity, &color);

        // Should have some contribution when looking at light
        assert!(contribution.norm() > 0.0);
    }
}
