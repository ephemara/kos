// HDR Tone Mapping Operators
// Future-grade implementations: Reinhard, Filmic, ACES, Uncharted2

use super::{HDRError, HDRImage, ToneMappingMethod};

/// Apply tone mapping to HDR image for LDR display
pub fn apply_tone_mapping(hdr: &HDRImage, method: ToneMappingMethod) -> Result<Vec<u8>, HDRError> {
    let pixel_count = (hdr.width * hdr.height) as usize;
    let mut ldr_data = vec![0u8; pixel_count * 3];

    match method {
        ToneMappingMethod::Reinhard => apply_reinhard(hdr, &mut ldr_data),
        ToneMappingMethod::Filmic => apply_filmic(hdr, &mut ldr_data),
        ToneMappingMethod::ACES => apply_aces(hdr, &mut ldr_data),
        ToneMappingMethod::Uncharted2 => apply_uncharted2(hdr, &mut ldr_data),
    }

    Ok(ldr_data)
}

/// Reinhard tone mapping operator
/// Simple and fast, preserves local contrast
fn apply_reinhard(hdr: &HDRImage, ldr_data: &mut [u8]) {
    // Calculate average luminance for key value
    let avg_luminance = calculate_average_luminance(hdr);
    let key = 0.18; // Middle grey key value
    let scale = key / avg_luminance.max(0.001);

    for pixel_idx in 0..(hdr.width * hdr.height) as usize {
        let idx = pixel_idx * 3;

        if idx + 2 < hdr.data.len() {
            let r = hdr.data[idx];
            let g = hdr.data[idx + 1];
            let b = hdr.data[idx + 2];

            // Scale by average luminance
            let r_scaled = r * scale;
            let g_scaled = g * scale;
            let b_scaled = b * scale;

            // Apply Reinhard operator: x / (1 + x)
            let r_mapped = r_scaled / (1.0 + r_scaled);
            let g_mapped = g_scaled / (1.0 + g_scaled);
            let b_mapped = b_scaled / (1.0 + b_scaled);

            // Gamma correction and convert to LDR
            ldr_data[idx] = linear_to_srgb(r_mapped);
            ldr_data[idx + 1] = linear_to_srgb(g_mapped);
            ldr_data[idx + 2] = linear_to_srgb(b_mapped);
        }
    }
}

/// Filmic tone mapping (John Hable's curve)
/// Provides cinematic look with shoulder and toe
fn apply_filmic(hdr: &HDRImage, ldr_data: &mut [u8]) {
    let exposure_bias = 2.0;

    for pixel_idx in 0..(hdr.width * hdr.height) as usize {
        let idx = pixel_idx * 3;

        if idx + 2 < hdr.data.len() {
            let r = hdr.data[idx] * exposure_bias;
            let g = hdr.data[idx + 1] * exposure_bias;
            let b = hdr.data[idx + 2] * exposure_bias;

            // Apply filmic curve
            let r_mapped = filmic_curve(r);
            let g_mapped = filmic_curve(g);
            let b_mapped = filmic_curve(b);

            // Gamma correction and convert to LDR
            ldr_data[idx] = linear_to_srgb(r_mapped);
            ldr_data[idx + 1] = linear_to_srgb(g_mapped);
            ldr_data[idx + 2] = linear_to_srgb(b_mapped);
        }
    }
}

/// Filmic curve function
fn filmic_curve(x: f32) -> f32 {
    let a = 0.22; // Shoulder strength
    let b = 0.30; // Linear strength
    let c = 0.10; // Linear angle
    let d = 0.20; // Toe strength
    let e = 0.01; // Toe numerator
    let f = 0.30; // Toe denominator

    ((x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f)) - e / f
}

/// ACES tone mapping (Academy Color Encoding System)
/// Industry standard for film and VFX
fn apply_aces(hdr: &HDRImage, ldr_data: &mut [u8]) {
    for pixel_idx in 0..(hdr.width * hdr.height) as usize {
        let idx = pixel_idx * 3;

        if idx + 2 < hdr.data.len() {
            let r = hdr.data[idx];
            let g = hdr.data[idx + 1];
            let b = hdr.data[idx + 2];

            // Apply ACES fitted curve
            let r_mapped = aces_fitted(r);
            let g_mapped = aces_fitted(g);
            let b_mapped = aces_fitted(b);

            // Gamma correction and convert to LDR
            ldr_data[idx] = linear_to_srgb(r_mapped);
            ldr_data[idx + 1] = linear_to_srgb(g_mapped);
            ldr_data[idx + 2] = linear_to_srgb(b_mapped);
        }
    }
}

/// ACES fitted curve (Narkowicz 2015)
fn aces_fitted(x: f32) -> f32 {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;

    ((x * (a * x + b)) / (x * (c * x + d) + e)).clamp(0.0, 1.0)
}

/// Uncharted 2 tone mapping (John Hable)
/// Used in Uncharted 2 game, provides good balance
fn apply_uncharted2(hdr: &HDRImage, ldr_data: &mut [u8]) {
    let exposure_bias = 2.0;
    let white_point = 11.2;

    // Calculate white scale
    let white_scale = 1.0 / uncharted2_tonemap(white_point);

    for pixel_idx in 0..(hdr.width * hdr.height) as usize {
        let idx = pixel_idx * 3;

        if idx + 2 < hdr.data.len() {
            let r = hdr.data[idx] * exposure_bias;
            let g = hdr.data[idx + 1] * exposure_bias;
            let b = hdr.data[idx + 2] * exposure_bias;

            // Apply Uncharted 2 curve
            let r_mapped = uncharted2_tonemap(r) * white_scale;
            let g_mapped = uncharted2_tonemap(g) * white_scale;
            let b_mapped = uncharted2_tonemap(b) * white_scale;

            // Gamma correction and convert to LDR
            ldr_data[idx] = linear_to_srgb(r_mapped);
            ldr_data[idx + 1] = linear_to_srgb(g_mapped);
            ldr_data[idx + 2] = linear_to_srgb(b_mapped);
        }
    }
}

/// Uncharted 2 tone mapping function
fn uncharted2_tonemap(x: f32) -> f32 {
    let a = 0.15; // Shoulder strength
    let b = 0.50; // Linear strength
    let c = 0.10; // Linear angle
    let d = 0.20; // Toe strength
    let e = 0.02; // Toe numerator
    let f = 0.30; // Toe denominator

    ((x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f)) - e / f
}

/// Calculate average luminance of HDR image
fn calculate_average_luminance(hdr: &HDRImage) -> f32 {
    let mut sum = 0.0;
    let mut count = 0;

    for pixel_idx in 0..(hdr.width * hdr.height) as usize {
        let idx = pixel_idx * 3;

        if idx + 2 < hdr.data.len() {
            let r = hdr.data[idx];
            let g = hdr.data[idx + 1];
            let b = hdr.data[idx + 2];

            // Rec. 709 luminance
            let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            // Use log average to avoid bias from very bright pixels
            if luminance > 0.0 {
                sum += luminance.ln();
                count += 1;
            }
        }
    }

    if count > 0 {
        (sum / count as f32).exp()
    } else {
        1.0
    }
}

/// Convert linear color to sRGB (with gamma correction)
fn linear_to_srgb(linear: f32) -> u8 {
    let clamped = linear.clamp(0.0, 1.0);

    let srgb = if clamped <= 0.0031308 {
        clamped * 12.92
    } else {
        1.055 * clamped.powf(1.0 / 2.4) - 0.055
    };

    (srgb * 255.0).round() as u8
}

/// Convert sRGB to linear color
#[allow(dead_code)]
fn srgb_to_linear(srgb: u8) -> f32 {
    let normalized = srgb as f32 / 255.0;

    if normalized <= 0.04045 {
        normalized / 12.92
    } else {
        ((normalized + 0.055) / 1.055).powf(2.4)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hdr::HDRFormat;

    #[test]
    fn test_linear_srgb_conversion() {
        // Test round-trip conversion
        for i in 0..=255 {
            let linear = srgb_to_linear(i);
            let back = linear_to_srgb(linear);
            assert!((back as i32 - i as i32).abs() <= 1);
        }
    }

    #[test]
    fn test_tone_mapping_methods() {
        // Create simple HDR image
        let mut hdr = HDRImage::new(2, 2, HDRFormat::RadianceRGBE);
        hdr.data = vec![
            1.0, 0.5, 0.25, // Pixel 1
            2.0, 1.0, 0.5, // Pixel 2
            4.0, 2.0, 1.0, // Pixel 3
            8.0, 4.0, 2.0, // Pixel 4
        ];

        // Test all tone mapping methods
        let methods = vec![
            ToneMappingMethod::Reinhard,
            ToneMappingMethod::Filmic,
            ToneMappingMethod::ACES,
            ToneMappingMethod::Uncharted2,
        ];

        for method in methods {
            let result = apply_tone_mapping(&hdr, method);
            assert!(result.is_ok());
            let ldr = result.unwrap();
            assert_eq!(ldr.len(), 12); // 4 pixels * 3 channels

            // All values should be in valid range
            for &val in &ldr {
                assert!(val <= 255);
            }
        }
    }

    #[test]
    fn test_filmic_curve() {
        // Curve should be monotonically increasing
        let mut prev = filmic_curve(0.0);
        for i in 1..100 {
            let x = i as f32 / 10.0;
            let y = filmic_curve(x);
            assert!(y >= prev);
            prev = y;
        }
    }

    #[test]
    fn test_aces_fitted() {
        // ACES should clamp to [0, 1]
        assert_eq!(aces_fitted(0.0), 0.0);
        assert!(aces_fitted(100.0) <= 1.0);

        // Should be monotonically increasing
        let mut prev = 0.0;
        for i in 0..100 {
            let x = i as f32 / 10.0;
            let y = aces_fitted(x);
            assert!(y >= prev);
            prev = y;
        }
    }

    #[test]
    fn test_average_luminance() {
        let mut hdr = HDRImage::new(2, 2, HDRFormat::RadianceRGBE);
        hdr.data = vec![1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

        let avg = calculate_average_luminance(&hdr);
        assert!(avg > 0.9 && avg < 1.1); // Should be close to 1.0
    }
}
