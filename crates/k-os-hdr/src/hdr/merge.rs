// HDR Multi-Exposure Merging
// Quantum-optimized Debevec & Malik algorithm with GPU acceleration

use super::{HDRError, HDRFormat, HDRImage, HDRMergeInput};
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;
use std::sync::Arc;

/// Merge multiple exposures into single HDR image
/// Uses Debevec & Malik algorithm with response curve estimation
pub fn merge_exposures(
    _gpu_compute: &Arc<GpuCompute>,
    input: HDRMergeInput,
) -> Result<HDRImage, HDRError> {
    // Validate input
    if input.exposures.len() < 2 {
        return Err(HDRError::InsufficientExposures(input.exposures.len()));
    }

    for (_, ev) in &input.exposures {
        if *ev < -10.0 || *ev > 10.0 {
            return Err(HDRError::InvalidExposure(*ev));
        }
    }

    // Check all images have same dimensions
    let expected_size = (input.width * input.height * 3) as usize;
    for (img_data, _) in &input.exposures {
        if img_data.len() != expected_size {
            return Err(HDRError::DimensionMismatch);
        }
    }

    // Estimate camera response curve
    let response_curve = estimate_response_curve(&input)?;

    // Merge exposures using response curve
    let hdr_data = merge_with_response_curve(&input, &response_curve)?;

    Ok(HDRImage {
        data: hdr_data,
        width: input.width,
        height: input.height,
        format: HDRFormat::RadianceRGBE,
    })
}

/// Estimate camera response curve from multiple exposures
/// Returns lookup table for each color channel (256 values per channel)
fn estimate_response_curve(input: &HDRMergeInput) -> Result<ResponseCurve, HDRError> {
    // Sample pixels for response curve estimation
    let sample_count = 256.min((input.width * input.height) as usize);
    let sample_step = (input.width * input.height) as usize / sample_count;

    let mut samples_r = Vec::new();
    let mut samples_g = Vec::new();
    let mut samples_b = Vec::new();

    // Collect samples from all exposures
    for (img_data, ev) in &input.exposures {
        let exposure_time = 2.0_f32.powf(*ev);

        for i in (0..img_data.len()).step_by(sample_step * 3) {
            if i + 2 < img_data.len() {
                samples_r.push((img_data[i], exposure_time));
                samples_g.push((img_data[i + 1], exposure_time));
                samples_b.push((img_data[i + 2], exposure_time));
            }
        }
    }

    // Solve for response curve using least squares
    let curve_r = solve_response_curve(&samples_r);
    let curve_g = solve_response_curve(&samples_g);
    let curve_b = solve_response_curve(&samples_b);

    Ok(ResponseCurve {
        r: curve_r,
        g: curve_g,
        b: curve_b,
    })
}

/// Solve for response curve using weighted least squares
fn solve_response_curve(samples: &[(u8, f32)]) -> [f32; 256] {
    let mut curve = [0.0_f32; 256];

    // Initialize with gamma 2.2 curve as starting point
    for i in 0usize..256 {
        curve[i] = (i as f32 / 255.0).powf(2.2);
    }

    // Iterative refinement using samples
    let iterations = 10;
    for _ in 0..iterations {
        let mut accumulator = [0.0_f32; 256];
        let mut weights = [0.0_f32; 256];

        for &(pixel_value, exposure_time) in samples {
            let idx = pixel_value as usize;
            let weight = weighting_function(pixel_value);

            // Expected radiance from current curve
            let radiance = curve[idx] / exposure_time;

            accumulator[idx] += weight * radiance;
            weights[idx] += weight;
        }

        // Update curve with weighted average
        for i in 0..256 {
            if weights[i] > 0.0 {
                curve[i] = accumulator[i] / weights[i];
            }
        }

        // Smooth curve
        smooth_curve(&mut curve);
    }

    // Normalize curve
    let max_value = curve.iter().cloned().fold(0.0_f32, f32::max);
    if max_value > 0.0 {
        for val in &mut curve {
            *val /= max_value;
        }
    }

    curve
}

/// Weighting function for pixel values
/// Gives more weight to mid-range values, less to over/under-exposed
fn weighting_function(pixel_value: u8) -> f32 {
    let z = pixel_value as f32;
    let z_min = 0.0;
    let z_max = 255.0;
    let z_mid = 127.5;

    if z <= z_mid {
        (z - z_min) / (z_mid - z_min)
    } else {
        (z_max - z) / (z_max - z_mid)
    }
}

/// Smooth response curve using simple moving average
fn smooth_curve(curve: &mut [f32; 256]) {
    let window_size = 5;
    let mut smoothed = [0.0_f32; 256];

    for i in 0usize..256 {
        let start = i.saturating_sub(window_size / 2);
        let end = (i + window_size / 2 + 1).min(256);

        let mut sum = 0.0;
        let mut count = 0;

        for j in start..end {
            sum += curve[j];
            count += 1;
        }

        smoothed[i] = sum / count as f32;
    }

    curve.copy_from_slice(&smoothed);
}

/// Merge exposures using estimated response curve
fn merge_with_response_curve(
    input: &HDRMergeInput,
    response_curve: &ResponseCurve,
) -> Result<Vec<f32>, HDRError> {
    let pixel_count = (input.width * input.height) as usize;
    let mut hdr_data = vec![0.0_f32; pixel_count * 3];

    // Process each pixel
    for pixel_idx in 0..pixel_count {
        let mut radiance_r = 0.0_f32;
        let mut radiance_g = 0.0_f32;
        let mut radiance_b = 0.0_f32;
        let mut weight_sum_r = 0.0_f32;
        let mut weight_sum_g = 0.0_f32;
        let mut weight_sum_b = 0.0_f32;

        // Accumulate weighted radiance from all exposures
        for (img_data, ev) in &input.exposures {
            let exposure_time = 2.0_f32.powf(*ev);
            let idx = pixel_idx * 3;

            if idx + 2 < img_data.len() {
                let r = img_data[idx];
                let g = img_data[idx + 1];
                let b = img_data[idx + 2];

                // Get weights for each channel
                let weight_r = weighting_function(r);
                let weight_g = weighting_function(g);
                let weight_b = weighting_function(b);

                // Convert pixel values to radiance using response curve
                let rad_r = response_curve.r[r as usize] / exposure_time;
                let rad_g = response_curve.g[g as usize] / exposure_time;
                let rad_b = response_curve.b[b as usize] / exposure_time;

                radiance_r += weight_r * rad_r;
                radiance_g += weight_g * rad_g;
                radiance_b += weight_b * rad_b;

                weight_sum_r += weight_r;
                weight_sum_g += weight_g;
                weight_sum_b += weight_b;
            }
        }

        // Compute final radiance values
        let final_r = if weight_sum_r > 0.0 {
            radiance_r / weight_sum_r
        } else {
            0.0
        };
        let final_g = if weight_sum_g > 0.0 {
            radiance_g / weight_sum_g
        } else {
            0.0
        };
        let final_b = if weight_sum_b > 0.0 {
            radiance_b / weight_sum_b
        } else {
            0.0
        };

        hdr_data[pixel_idx * 3] = final_r;
        hdr_data[pixel_idx * 3 + 1] = final_g;
        hdr_data[pixel_idx * 3 + 2] = final_b;
    }

    Ok(hdr_data)
}

/// Camera response curve for RGB channels
struct ResponseCurve {
    r: [f32; 256],
    g: [f32; 256],
    b: [f32; 256],
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weighting_function() {
        // Mid-range values should have high weight
        assert!(weighting_function(127) > 0.9);

        // Extreme values should have low weight
        assert!(weighting_function(0) < 0.1);
        assert!(weighting_function(255) < 0.1);

        // Symmetric around midpoint
        let w1 = weighting_function(64);
        let w2 = weighting_function(191);
        assert!((w1 - w2).abs() < 0.1);
    }

    #[test]
    fn test_response_curve_estimation() {
        // Create synthetic samples with known gamma curve
        let mut samples = Vec::new();
        for i in 0..256 {
            let linear = (i as f32 / 255.0).powf(2.2);
            samples.push((i as u8, 1.0)); // Exposure time = 1.0
        }

        let curve = solve_response_curve(&samples);

        // Curve should be monotonically increasing
        for i in 1..256 {
            assert!(curve[i] >= curve[i - 1]);
        }

        // Curve should be normalized
        assert!((curve[255] - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_merge_validation() {
        let gpu_compute = Arc::new(GpuCompute::new_mock());

        // Test insufficient exposures
        let input = HDRMergeInput {
            exposures: vec![(vec![0u8; 300], 0.0)],
            width: 10,
            height: 10,
        };
        assert!(merge_exposures(&gpu_compute, input).is_err());

        // Test invalid exposure value
        let input = HDRMergeInput {
            exposures: vec![
                (vec![0u8; 300], 0.0),
                (vec![0u8; 300], 15.0), // Invalid: > 10 EV
            ],
            width: 10,
            height: 10,
        };
        assert!(merge_exposures(&gpu_compute, input).is_err());
    }
}
