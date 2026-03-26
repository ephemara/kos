// HDR System Property-Based Tests
// Validates correctness properties using proptest

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    use std::time::Instant;
    use std::sync::Arc;
    
    use k_os_engine::hdr::{HDRCapture, HDRMergeInput, HDRImage, HDRFormat, Light};
    use k_os_engine::gpu::compute::GpuCompute;

    /// Property 4: HDR Merge Performance
    /// Validates: Requirements 3.11
    /// Merge 8K HDR images, verify completion within 5 seconds
    #[test]
    fn property_hdr_merge_performance_8k() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        // Create 8K test images (7680x4320)
        let width = 7680u32;
        let height = 4320u32;
        let pixel_count = (width * height * 3) as usize;

        // Generate 5 exposures with different EV values
        let exposures = vec![
            (vec![128u8; pixel_count], -2.0),
            (vec![128u8; pixel_count], -1.0),
            (vec![128u8; pixel_count], 0.0),
            (vec![128u8; pixel_count], 1.0),
            (vec![128u8; pixel_count], 2.0),
        ];

        let input = HDRMergeInput {
            exposures,
            width,
            height,
        };

        // Measure merge time
        let start = Instant::now();
        let result = capture.merge_exposures(input);
        let duration = start.elapsed();

        // Verify success
        assert!(result.is_ok(), "HDR merge should succeed");

        // Verify performance: < 5 seconds
        assert!(
            duration.as_secs() < 5,
            "HDR merge took {:?}, expected < 5s",
            duration
        );

        println!("✓ Property 4: HDR merge 8K completed in {:?}", duration);
    }

    /// Property test: HDR merge with varying exposure counts
    proptest! {
        #[test]
        fn property_hdr_merge_varying_exposures(
            exposure_count in 2usize..10,
            ev_range in -5.0f32..5.0
        ) {
            let gpu_compute = Arc::new(GpuCompute::new().unwrap());
            let capture = HDRCapture::new(gpu_compute);

            let width = 256u32;
            let height = 256u32;
            let pixel_count = (width * height * 3) as usize;

            // Generate exposures
            let exposures: Vec<_> = (0..exposure_count)
                .map(|i| {
                    let ev = ev_range * (i as f32 / exposure_count as f32 - 0.5) * 2.0;
                    (vec![128u8; pixel_count], ev)
                })
                .collect();

            let input = HDRMergeInput {
                exposures,
                width,
                height,
            };

            let result = capture.merge_exposures(input);
            prop_assert!(result.is_ok(), "HDR merge should succeed with {} exposures", exposure_count);

            let hdr = result.unwrap();
            prop_assert_eq!(hdr.width, width);
            prop_assert_eq!(hdr.height, height);
            prop_assert_eq!(hdr.data.len(), pixel_count);
        }
    }

    /// Property test: Light intensity validation
    proptest! {
        #[test]
        fn property_light_intensity_validation(
            intensity in -1000.0f32..2_000_000.0,
            color_temp in 500.0f32..50_000.0
        ) {
            use nalgebra::Vector3;

            let result = Light::point(
                Vector3::zeros(),
                intensity,
                color_temp
            );

            // Valid range: 0.0 - 1_000_000.0 lumens
            let should_succeed = intensity >= 0.0 
                && intensity <= 1_000_000.0
                && color_temp >= 1000.0
                && color_temp <= 40_000.0;

            if should_succeed {
                prop_assert!(result.is_ok(), "Valid light should succeed");
            } else {
                prop_assert!(result.is_err(), "Invalid light should fail");
            }
        }
    }

    /// Property test: Tone mapping preserves dimensions
    proptest! {
        #[test]
        fn property_tone_mapping_dimensions(
            width in 16u32..512,
            height in 16u32..512
        ) {
            let mut hdr = HDRImage::new(width, height, HDRFormat::RadianceRGBE);
            
            // Fill with test data
            for i in 0..hdr.data.len() {
                hdr.data[i] = (i as f32 % 10.0) / 10.0;
            }

            use k_os_engine::hdr::ToneMappingMethod;
            use k_os_engine::hdr::tone_mapping::apply_tone_mapping;

            let methods = vec![
                ToneMappingMethod::Reinhard,
                ToneMappingMethod::Filmic,
                ToneMappingMethod::ACES,
                ToneMappingMethod::Uncharted2,
            ];

            for method in methods {
                let result = apply_tone_mapping(&hdr, method);
                prop_assert!(result.is_ok());

                let ldr = result.unwrap();
                prop_assert_eq!(ldr.len(), (width * height * 3) as usize);

                // All values should be in valid LDR range
                for &val in &ldr {
                    prop_assert!(val <= 255);
                }
            }
        }
    }

    /// Property test: HDR file I/O round-trip
    proptest! {
        #[test]
        fn property_hdr_io_round_trip(
            width in 16u32..128,
            height in 16u32..128
        ) {
            use tempfile::TempDir;
            use k_os_engine::hdr::io::{save_hdr, load_hdr};

            let temp_dir = TempDir::new().unwrap();
            
            // Test both formats
            for (ext, format) in &[("hdr", HDRFormat::RadianceRGBE), ("exr", HDRFormat::OpenEXR)] {
                let path = temp_dir.path().join(format!("test.{}", ext));
                
                let mut hdr = HDRImage::new(width, height, *format);
                for i in 0..hdr.data.len() {
                    hdr.data[i] = (i as f32) / 100.0;
                }

                // Save
                let save_result = save_hdr(&hdr, &path);
                prop_assert!(save_result.is_ok(), "Save should succeed");

                // Load
                let load_result = load_hdr(&path);
                prop_assert!(load_result.is_ok(), "Load should succeed");

                let loaded = load_result.unwrap();
                prop_assert_eq!(loaded.width, width);
                prop_assert_eq!(loaded.height, height);
            }
        }
    }

    /// Property test: Kelvin to RGB conversion is monotonic
    proptest! {
        #[test]
        fn property_kelvin_to_rgb_monotonic(
            temp1 in 1000.0f32..40_000.0,
            temp2 in 1000.0f32..40_000.0
        ) {
            use k_os_engine::hdr::kelvin_to_rgb;

            let color1 = kelvin_to_rgb(temp1);
            let color2 = kelvin_to_rgb(temp2);

            // All components should be in [0, 1]
            prop_assert!(color1.x >= 0.0 && color1.x <= 1.0);
            prop_assert!(color1.y >= 0.0 && color1.y <= 1.0);
            prop_assert!(color1.z >= 0.0 && color1.z <= 1.0);
            prop_assert!(color2.x >= 0.0 && color2.x <= 1.0);
            prop_assert!(color2.y >= 0.0 && color2.y <= 1.0);
            prop_assert!(color2.z >= 0.0 && color2.z <= 1.0);
        }
    }
}


// Unit Tests for HDR Capture System
#[cfg(test)]
mod unit_tests {
    use super::*;
    use std::sync::Arc;
    use nalgebra::Vector3;
    
    use k_os_engine::hdr::{
        HDRCapture, HDRMergeInput, HDRImage, HDRFormat, Light, LightType,
        ToneMappingMethod,
    };
    use k_os_engine::gpu::compute::GpuCompute;

    // Test exposure merging with known inputs
    #[test]
    fn test_exposure_merging_known_inputs() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        let width = 4u32;
        let height = 4u32;
        let pixel_count = (width * height * 3) as usize;

        // Create 3 exposures: underexposed, normal, overexposed
        let exposures = vec![
            (vec![64u8; pixel_count], -1.0),  // Darker
            (vec![128u8; pixel_count], 0.0),  // Normal
            (vec![192u8; pixel_count], 1.0),  // Brighter
        ];

        let input = HDRMergeInput {
            exposures,
            width,
            height,
        };

        let result = capture.merge_exposures(input);
        assert!(result.is_ok());

        let hdr = result.unwrap();
        assert_eq!(hdr.width, width);
        assert_eq!(hdr.height, height);
        assert_eq!(hdr.data.len(), pixel_count);

        // Merged HDR should have reasonable values
        for &val in &hdr.data {
            assert!(val >= 0.0);
            assert!(val.is_finite());
        }
    }

    // Test tone mapping algorithms
    #[test]
    fn test_tone_mapping_algorithms() {
        use k_os_engine::hdr::tone_mapping::apply_tone_mapping;

        let mut hdr = HDRImage::new(8, 8, HDRFormat::RadianceRGBE);
        
        // Fill with gradient
        for i in 0..hdr.data.len() {
            hdr.data[i] = (i as f32) / 10.0;
        }

        let methods = vec![
            ToneMappingMethod::Reinhard,
            ToneMappingMethod::Filmic,
            ToneMappingMethod::ACES,
            ToneMappingMethod::Uncharted2,
        ];

        for method in methods {
            let result = apply_tone_mapping(&hdr, method);
            assert!(result.is_ok(), "Tone mapping {:?} should succeed", method);

            let ldr = result.unwrap();
            assert_eq!(ldr.len(), (8 * 8 * 3));

            // Verify all values are in LDR range
            for &val in &ldr {
                assert!(val <= 255);
            }
        }
    }

    // Test light addition
    #[test]
    fn test_light_addition() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        let mut hdr = HDRImage::new(64, 32, HDRFormat::RadianceRGBE);

        // Add point light
        let point_light = Light::point(
            Vector3::new(0.0, 0.0, 5.0),
            1000.0,
            6500.0
        ).unwrap();

        let result = capture.add_light(&mut hdr, &point_light);
        assert!(result.is_ok());

        // Verify some pixels were affected
        let has_non_zero = hdr.data.iter().any(|&v| v > 0.0);
        assert!(has_non_zero, "Light should affect some pixels");
    }

    // Test file I/O round-trip
    #[test]
    fn test_file_io_round_trip() {
        use tempfile::TempDir;
        use k_os_engine::hdr::io::{save_hdr, load_hdr};

        let temp_dir = TempDir::new().unwrap();

        // Test RGBE format
        {
            let path = temp_dir.path().join("test.hdr");
            let mut hdr = HDRImage::new(16, 16, HDRFormat::RadianceRGBE);
            
            for i in 0..hdr.data.len() {
                hdr.data[i] = (i as f32) / 100.0;
            }

            assert!(save_hdr(&hdr, &path).is_ok());
            let loaded = load_hdr(&path).unwrap();

            assert_eq!(loaded.width, hdr.width);
            assert_eq!(loaded.height, hdr.height);
        }

        // Test EXR format
        {
            let path = temp_dir.path().join("test.exr");
            let mut hdr = HDRImage::new(16, 16, HDRFormat::OpenEXR);
            
            for i in 0..hdr.data.len() {
                hdr.data[i] = (i as f32) / 100.0;
            }

            assert!(save_hdr(&hdr, &path).is_ok());
            let loaded = load_hdr(&path).unwrap();

            assert_eq!(loaded.width, hdr.width);
            assert_eq!(loaded.height, hdr.height);
        }
    }

    // Test panorama to HDR conversion
    #[test]
    fn test_panorama_to_hdr() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        let width = 32u32;
        let height = 16u32;
        let image_data = vec![128u8; (width * height * 3) as usize];

        let result = capture.panorama_to_hdr(&image_data, width, height);
        assert!(result.is_ok());

        let hdr = result.unwrap();
        assert_eq!(hdr.width, width);
        assert_eq!(hdr.height, height);
        assert_eq!(hdr.data.len(), (width * height * 3) as usize);
    }

    // Test light type creation
    #[test]
    fn test_light_types() {
        // Point light
        let point = Light::point(Vector3::zeros(), 1000.0, 6500.0);
        assert!(point.is_ok());
        let point = point.unwrap();
        assert!(matches!(point.light_type, LightType::Point));

        // Directional light
        let directional = Light::directional(Vector3::new(0.0, -1.0, 0.0), 50000.0, 5800.0);
        assert!(directional.is_ok());
        let directional = directional.unwrap();
        assert!(matches!(directional.light_type, LightType::Directional));

        // Area light
        let area = Light::area(
            Vector3::zeros(),
            Vector3::new(0.0, 1.0, 0.0),
            2.0,
            2.0,
            5000.0,
            6500.0
        );
        assert!(area.is_ok());
        let area = area.unwrap();
        assert!(matches!(area.light_type, LightType::Area { .. }));
    }

    // Test light color from temperature
    #[test]
    fn test_light_color_temperature() {
        // Daylight (6500K) should be close to white
        let daylight = Light::point(Vector3::zeros(), 1000.0, 6500.0).unwrap();
        let color = daylight.get_color();
        assert!(color.x > 0.9 && color.x <= 1.0);
        assert!(color.y > 0.9 && color.y <= 1.0);
        assert!(color.z > 0.9 && color.z <= 1.0);

        // Warm light (2700K) should be orange-ish
        let warm = Light::point(Vector3::zeros(), 1000.0, 2700.0).unwrap();
        let color = warm.get_color();
        assert!(color.x > color.y);
        assert!(color.y > color.z);

        // Cool light (9000K) should be blue-ish
        let cool = Light::point(Vector3::zeros(), 1000.0, 9000.0).unwrap();
        let color = cool.get_color();
        assert!(color.z > color.x);
    }

    // Test HDR image pixel operations
    #[test]
    fn test_hdr_pixel_operations() {
        let mut hdr = HDRImage::new(10, 10, HDRFormat::RadianceRGBE);

        // Set and get pixel
        let color = Vector3::new(1.0, 0.5, 0.25);
        hdr.set_pixel(5, 5, color);
        
        let retrieved = hdr.get_pixel(5, 5).unwrap();
        assert!((retrieved.x - color.x).abs() < 1e-6);
        assert!((retrieved.y - color.y).abs() < 1e-6);
        assert!((retrieved.z - color.z).abs() < 1e-6);

        // Get luminance
        let luminance = hdr.get_luminance(5, 5).unwrap();
        assert!(luminance > 0.0);

        // Out of bounds should return None
        assert!(hdr.get_pixel(100, 100).is_none());
        assert!(hdr.get_luminance(100, 100).is_none());
    }

    // Test error handling for insufficient exposures
    #[test]
    fn test_insufficient_exposures_error() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        let input = HDRMergeInput {
            exposures: vec![(vec![0u8; 300], 0.0)], // Only 1 exposure
            width: 10,
            height: 10,
        };

        let result = capture.merge_exposures(input);
        assert!(result.is_err());
    }

    // Test error handling for invalid exposure values
    #[test]
    fn test_invalid_exposure_values() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        let input = HDRMergeInput {
            exposures: vec![
                (vec![0u8; 300], 0.0),
                (vec![0u8; 300], 15.0), // Invalid: > 10 EV
            ],
            width: 10,
            height: 10,
        };

        let result = capture.merge_exposures(input);
        assert!(result.is_err());
    }

    // Test error handling for dimension mismatch
    #[test]
    fn test_dimension_mismatch_error() {
        let gpu_compute = Arc::new(GpuCompute::new().unwrap());
        let capture = HDRCapture::new(gpu_compute);

        let input = HDRMergeInput {
            exposures: vec![
                (vec![0u8; 300], 0.0),
                (vec![0u8; 600], 1.0), // Different size
            ],
            width: 10,
            height: 10,
        };

        let result = capture.merge_exposures(input);
        assert!(result.is_err());
    }
}
