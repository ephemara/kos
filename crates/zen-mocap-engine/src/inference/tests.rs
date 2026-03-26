//! Tests for ONNX inference engine

use super::*;
use crate::models::{get_model, list_models, model_cache_path};

#[test]
fn test_model_manifest_parsing() {
    // Verify all models in manifest are parseable
    let models = list_models();
    assert!(!models.is_empty(), "Model manifest should not be empty");
    
    // Check YOLOv11 models
    let yolo_models = ["yolov11n_pose", "yolov11s_pose", "yolov11m_pose", "yolov11l_pose", "yolov11x_pose"];
    for model_id in &yolo_models {
        let model = get_model(model_id);
        assert!(model.is_some(), "Model {} should exist in manifest", model_id);
        let model = model.unwrap();
        assert_eq!(model.keypoints, 17, "YOLO models should have 17 keypoints");
        assert_eq!(model.input_shape[0], 1, "Batch size should be 1");
        assert_eq!(model.input_shape[1], 3, "Should have 3 channels (RGB)");
        assert_eq!(model.input_shape[2], 640, "YOLO input height should be 640");
        assert_eq!(model.input_shape[3], 640, "YOLO input width should be 640");
    }
    
    // Check RTMPose models
    let rtm_models = ["rtmw3d_l", "rtmw3d_x"];
    for model_id in &rtm_models {
        let model = get_model(model_id);
        assert!(model.is_some(), "Model {} should exist in manifest", model_id);
        let model = model.unwrap();
        assert_eq!(model.keypoints, 133, "RTMPose 3D models should have 133 keypoints");
        assert_eq!(model.input_shape[2], 384, "RTMPose input height should be 384");
        assert_eq!(model.input_shape[3], 288, "RTMPose input width should be 288");
    }
}

#[test]
fn test_model_cache_paths() {
    // Verify cache path generation
    let model = get_model("yolov11n_pose").expect("yolov11n_pose should exist");
    let cache_path = model_cache_path(model);
    
    assert!(cache_path.to_string_lossy().contains("ZenMocap"), "Cache path should contain ZenMocap");
    assert!(cache_path.to_string_lossy().contains("models"), "Cache path should contain models");
    assert!(cache_path.to_string_lossy().ends_with("yolov11n_pose.onnx"), "Cache path should end with model filename");
}

#[test]
fn test_sigmoid_function() {
    // Test sigmoid edge cases
    assert!((sigmoid(0.0) - 0.5).abs() < 1e-6, "sigmoid(0) should be 0.5");
    assert!(sigmoid(10.0) > 0.99, "sigmoid(10) should be close to 1");
    assert!(sigmoid(-10.0) < 0.01, "sigmoid(-10) should be close to 0");
    
    // Test monotonicity
    assert!(sigmoid(-1.0) < sigmoid(0.0), "sigmoid should be monotonic");
    assert!(sigmoid(0.0) < sigmoid(1.0), "sigmoid should be monotonic");
}

#[test]
fn test_argmax_function() {
    let vals = vec![0.1, 0.5, 0.3, 0.9, 0.2];
    let (idx, val) = argmax_f32(&vals);
    assert_eq!(idx, 3, "argmax should return index 3");
    assert!((val - 0.9).abs() < 1e-6, "argmax should return value 0.9");
    
    // Test with single element
    let single = vec![42.0];
    let (idx, val) = argmax_f32(&single);
    assert_eq!(idx, 0);
    assert!((val - 42.0).abs() < 1e-6);
    
    // Test with negative values
    let negatives = vec![-5.0, -2.0, -10.0];
    let (idx, val) = argmax_f32(&negatives);
    assert_eq!(idx, 1);
    assert!((val - (-2.0)).abs() < 1e-6);
}

#[test]
fn test_ort_dylib_discovery() {
    // Test that ORT dylib discovery doesn't panic
    let result = std::panic::catch_unwind(|| {
        discover_ort_dylib()
    });
    assert!(result.is_ok(), "ORT dylib discovery should not panic");
}

#[test]
fn test_imagenet_normalization_constants() {
    // Verify ImageNet normalization constants are reasonable
    for &mean in &IMAGENET_MEAN {
        assert!(mean >= 0.0 && mean <= 1.0, "ImageNet mean should be in [0,1]");
    }
    for &std in &IMAGENET_STD {
        assert!(std > 0.0 && std <= 1.0, "ImageNet std should be positive and <= 1");
    }
}

#[test]
fn test_decode_yolo_pose_handles_normalized_coords() {
    let num_keypoints = 17usize;
    let channels = 4 + 1 + num_keypoints * 3; // 56
    let anchors = 2usize;
    let mut data = vec![0.0f32; channels * anchors]; // shape [1, C, A]
    let set = |buf: &mut [f32], c: usize, a: usize, v: f32| {
        buf[c * anchors + a] = v;
    };

    // Anchor 0 should win score.
    set(&mut data, 4, 0, 8.0); // high objectness logit
    set(&mut data, 4, 1, -2.0);
    for k in 0..num_keypoints {
        let base = 5 + (k * 3);
        set(&mut data, base + 0, 0, 0.5);  // normalized x
        set(&mut data, base + 1, 0, 0.25); // normalized y
        set(&mut data, base + 2, 0, 6.0);  // high kp conf logit
    }

    let joints = decode_yolo_pose(&data, &[1, channels, anchors], num_keypoints, 640)
        .expect("decode_yolo_pose should succeed");
    assert_eq!(joints.len(), num_keypoints);
    for j in &joints {
        assert!((j.position[0] - 0.5).abs() < 1e-4, "x should stay normalized, got {}", j.position[0]);
        assert!((j.position[1] - 0.25).abs() < 1e-4, "y should stay normalized, got {}", j.position[1]);
    }
}

#[test]
fn test_decode_yolo_pose_handles_pixel_coords() {
    let num_keypoints = 17usize;
    let channels = 4 + 1 + num_keypoints * 3; // 56
    let anchors = 1usize;
    let mut data = vec![0.0f32; channels * anchors]; // shape [1, C, A]
    let set = |buf: &mut [f32], c: usize, v: f32| {
        buf[c * anchors] = v;
    };

    set(&mut data, 4, 8.0); // high objectness logit
    for k in 0..num_keypoints {
        let base = 5 + (k * 3);
        set(&mut data, base + 0, 320.0); // pixel x in 640 input
        set(&mut data, base + 1, 160.0); // pixel y in 640 input
        set(&mut data, base + 2, 5.0);
    }

    let joints = decode_yolo_pose(&data, &[1, channels, anchors], num_keypoints, 640)
        .expect("decode_yolo_pose should succeed");
    assert_eq!(joints.len(), num_keypoints);
    for j in &joints {
        assert!((j.position[0] - 0.5).abs() < 1e-4, "x should normalize from pixels, got {}", j.position[0]);
        assert!((j.position[1] - 0.25).abs() < 1e-4, "y should normalize from pixels, got {}", j.position[1]);
    }
}

#[test]
fn test_decode_yolo_pose_prefers_full_body_anchor_over_head_only() {
    let num_keypoints = 17usize;
    let channels = 4 + 1 + num_keypoints * 3; // 56
    let anchors = 2usize;
    let mut data = vec![0.0f32; channels * anchors]; // shape [1, C, A]
    let set = |buf: &mut [f32], c: usize, a: usize, v: f32| {
        buf[c * anchors + a] = v;
    };

    // Anchor 0: very high objectness, but effectively head-only.
    set(&mut data, 4, 0, 9.0);
    for k in 0..num_keypoints {
        let base = 5 + (k * 3);
        set(&mut data, base + 0, 0, 0.12);
        set(&mut data, base + 1, 0, 0.18);
        set(&mut data, base + 2, 0, -10.0);
    }
    // Nose high, everything else low.
    set(&mut data, 5 + 0, 0, 0.11);
    set(&mut data, 5 + 1, 0, 0.17);
    set(&mut data, 5 + 2, 0, 8.0);

    // Anchor 1: slightly lower objectness, but full-body confidence.
    set(&mut data, 4, 1, 7.0);
    for k in 0..num_keypoints {
        let base = 5 + (k * 3);
        set(&mut data, base + 0, 1, 0.80); // distinct x to detect chosen anchor
        set(&mut data, base + 1, 1, 0.30);
        set(&mut data, base + 2, 1, 5.0);
    }

    let joints = decode_yolo_pose(&data, &[1, channels, anchors], num_keypoints, 640)
        .expect("decode_yolo_pose should succeed");
    assert_eq!(joints.len(), num_keypoints);

    // Nose position should come from anchor 1, proving we chose full-body anchor.
    assert!((joints[0].position[0] - 0.80).abs() < 1e-4);

    // Most joints should be confidently visible.
    let visible = joints.iter().filter(|j| j.confidence >= 0.20).count();
    assert!(visible >= 12, "expected full-body anchor visibility, got {}", visible);
}

// Integration test - only runs if ONNX models are available
#[test]
#[ignore] // Run with: cargo test -- --ignored
fn test_load_yolov11n_model() {
    // This test requires the actual ONNX model file to be present
    let model = get_model("yolov11n_pose").expect("yolov11n_pose should exist");
    let model_path = model_cache_path(model);
    
    if !model_path.exists() {
        eprintln!("Skipping test: model file not found at {:?}", model_path);
        return;
    }
    
    let result = InferenceEngine::load(
        &model_path,
        model.input_height(),
        model.input_width(),
        model.keypoints,
        &model.preprocess,
    );
    
    match result {
        Ok(engine) => {
            assert_eq!(engine.input_h, 640);
            assert_eq!(engine.input_w, 640);
            assert_eq!(engine.num_keypoints, 17);
            println!("✓ Successfully loaded YOLOv11n model");
        }
        Err(e) => {
            eprintln!("Failed to load model: {}", e);
            panic!("Model loading failed");
        }
    }
}

#[test]
#[ignore] // Run with: cargo test -- --ignored
fn test_inference_with_dummy_frame() {
    // This test requires the actual ONNX model file
    let model = get_model("yolov11n_pose").expect("yolov11n_pose should exist");
    let model_path = model_cache_path(model);
    
    if !model_path.exists() {
        eprintln!("Skipping test: model file not found");
        return;
    }
    
    let mut engine = InferenceEngine::load(
        &model_path,
        model.input_height(),
        model.input_width(),
        model.keypoints,
        &model.preprocess,
    ).expect("Should load model");
    
    // Create a dummy 640x480 RGB frame (black image)
    let frame_w = 640u32;
    let frame_h = 480u32;
    let frame_data = vec![0u8; (frame_w * frame_h * 3) as usize];
    
    let result = engine.infer(&frame_data, frame_w, frame_h);
    
    match result {
        Ok(joints) => {
            assert_eq!(joints.len(), 17, "Should return 17 COCO joints");
            for (i, joint) in joints.iter().enumerate() {
                assert!(joint.position[0] >= 0.0 && joint.position[0] <= 1.0, 
                        "Joint {} x should be normalized", i);
                assert!(joint.position[1] >= 0.0 && joint.position[1] <= 1.0,
                        "Joint {} y should be normalized", i);
                assert!(joint.confidence >= 0.0 && joint.confidence <= 1.0,
                        "Joint {} confidence should be in [0,1]", i);
            }
            println!("✓ Inference completed successfully");
        }
        Err(e) => {
            eprintln!("Inference failed: {}", e);
            panic!("Inference failed");
        }
    }
}
