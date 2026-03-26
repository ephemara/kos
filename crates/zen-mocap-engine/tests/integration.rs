//! Integration tests for ZenMocap engine
//!
//! These tests verify the full pipeline: ONNX inference → GPU compute → output

use zen_mocap_engine::{
    inference::InferenceEngine,
    models::{get_model, model_cache_path},
    types::Joint,
};

#[cfg(feature = "gpu-chain")]
use zen_mocap_engine::gpu_chain::GpuChain;

/// Test the full pipeline: load model → inference → verify output
#[test]
#[ignore] // Run with: cargo test --test integration -- --ignored
fn test_full_inference_pipeline() {
    // Load YOLOv11n model
    let model = get_model("yolov11n_pose").expect("yolov11n_pose should exist");
    let model_path = model_cache_path(model);

    if !model_path.exists() {
        eprintln!("Skipping test: model file not found at {:?}", model_path);
        eprintln!("Run: cargo run --bin download_models");
        return;
    }

    let mut engine = InferenceEngine::load(
        &model_path,
        model.input_height(),
        model.input_width(),
        model.keypoints,
        &model.preprocess,
    )
    .expect("Should load model");

    // Create a test frame (640x480 RGB)
    let frame_w = 640u32;
    let frame_h = 480u32;
    let frame_data = vec![128u8; (frame_w * frame_h * 3) as usize]; // Gray image

    // Run inference
    let joints = engine
        .infer(&frame_data, frame_w, frame_h)
        .expect("Inference should succeed");

    // Verify output
    assert_eq!(joints.len(), 17, "Should return 17 COCO joints");

    for (i, joint) in joints.iter().enumerate() {
        assert!(
            joint.position[0] >= 0.0 && joint.position[0] <= 1.0,
            "Joint {} x coordinate out of range: {}",
            i,
            joint.position[0]
        );
        assert!(
            joint.position[1] >= 0.0 && joint.position[1] <= 1.0,
            "Joint {} y coordinate out of range: {}",
            i,
            joint.position[1]
        );
        assert!(
            joint.confidence >= 0.0 && joint.confidence <= 1.0,
            "Joint {} confidence out of range: {}",
            i,
            joint.confidence
        );
    }

    println!("✓ Full inference pipeline test passed");
    println!("  Model: {}", model.name);
    println!("  Input: {}x{}", frame_w, frame_h);
    println!("  Output: {} joints", joints.len());
}

/// Test GPU pipeline integration (requires gpu-chain feature)
#[cfg(feature = "gpu-chain")]
#[tokio::test]
#[ignore] // Run with: cargo test --test integration --features gpu-chain -- --ignored
async fn test_full_gpu_pipeline() {
    // Load model
    let model = get_model("yolov11n_pose").expect("yolov11n_pose should exist");
    let model_path = model_cache_path(model);

    if !model_path.exists() {
        eprintln!("Skipping test: model file not found");
        return;
    }

    // Initialize inference engine
    let mut inference_engine = InferenceEngine::load(
        &model_path,
        model.input_height(),
        model.input_width(),
        model.keypoints,
        &model.preprocess,
    )
    .expect("Should load model");

    // Initialize GPU chain
    let gpu_chain = match GpuChain::new(17, None).await {
        Ok(chain) => chain,
        Err(e) => {
            eprintln!("Skipping test: GPU not available - {}", e);
            return;
        }
    };

    // Upload skeleton topology
    let parents: Vec<i32> = vec![
        -1, // 0: nose (root)
        0, 0, // 1-2: eyes
        1, 2, // 3-4: ears
        0, 0, // 5-6: shoulders
        5, 6, // 7-8: elbows
        7, 8, // 9-10: wrists
        5, 6, // 11-12: hips
        11, 12, // 13-14: knees
        13, 14, // 15-16: ankles
    ];
    let rest_lengths: Vec<f32> = vec![0.1; 17];
    gpu_chain.upload_topology(&parents, &rest_lengths);

    // Create test frame
    let frame_w = 640u32;
    let frame_h = 480u32;
    let frame_data = vec![128u8; (frame_w * frame_h * 3) as usize];

    // Run inference
    let raw_joints = inference_engine
        .infer(&frame_data, frame_w, frame_h)
        .expect("Inference should succeed");

    // Process through GPU pipeline
    let solved_joints = gpu_chain
        .process_frame(&raw_joints, 0.033, 0.0)
        .await
        .expect("GPU processing should succeed");

    // Verify output
    assert_eq!(solved_joints.len(), 17, "Should return 17 joints");

    for (i, joint) in solved_joints.iter().enumerate() {
        assert!(
            joint.confidence >= 0.0 && joint.confidence <= 1.0,
            "Joint {} confidence out of range",
            i
        );
    }

    println!("✓ Full GPU pipeline test passed");
    println!("  GPU: {}", gpu_chain.adapter_name);
    println!("  Backend: {}", gpu_chain.adapter_backend);
    println!("  Processed: {} joints", solved_joints.len());
}

/// Test model loading for all models in manifest
#[test]
#[ignore] // Run with: cargo test --test integration -- --ignored
fn test_all_models_loadable() {
    use zen_mocap_engine::models::list_models;

    let models = list_models();
    let mut loaded_count = 0;
    let mut skipped_count = 0;

    for model in models {
        let model_path = model_cache_path(model);

        if !model_path.exists() {
            eprintln!("Skipping {}: file not found", model.id);
            skipped_count += 1;
            continue;
        }

        match InferenceEngine::load(
            &model_path,
            model.input_height(),
            model.input_width(),
            model.keypoints,
            &model.preprocess,
        ) {
            Ok(_) => {
                println!("✓ Loaded: {} ({})", model.name, model.id);
                loaded_count += 1;
            }
            Err(e) => {
                eprintln!("✗ Failed to load {}: {}", model.id, e);
                panic!("Model loading failed");
            }
        }
    }

    println!("\n=== Model Loading Summary ===");
    println!("Loaded: {}", loaded_count);
    println!("Skipped: {}", skipped_count);
    println!("Total: {}", models.len());

    assert!(loaded_count > 0, "At least one model should be loadable");
}

/// Benchmark inference performance
#[test]
#[ignore] // Run with: cargo test --test integration -- --ignored --nocapture
fn benchmark_inference_performance() {
    use std::time::Instant;

    let model = get_model("yolov11n_pose").expect("yolov11n_pose should exist");
    let model_path = model_cache_path(model);

    if !model_path.exists() {
        eprintln!("Skipping benchmark: model file not found");
        return;
    }

    let mut engine = InferenceEngine::load(
        &model_path,
        model.input_height(),
        model.input_width(),
        model.keypoints,
        &model.preprocess,
    )
    .expect("Should load model");

    // Warmup
    let frame_w = 640u32;
    let frame_h = 480u32;
    let frame_data = vec![128u8; (frame_w * frame_h * 3) as usize];

    for _ in 0..3 {
        let _ = engine.infer(&frame_data, frame_w, frame_h);
    }

    // Benchmark
    let iterations = 30;
    let start = Instant::now();

    for _ in 0..iterations {
        engine
            .infer(&frame_data, frame_w, frame_h)
            .expect("Inference should succeed");
    }

    let elapsed = start.elapsed();
    let avg_ms = elapsed.as_millis() as f64 / iterations as f64;
    let fps = 1000.0 / avg_ms;

    println!("\n=== Inference Benchmark ===");
    println!("Model: {}", model.name);
    println!("Iterations: {}", iterations);
    println!("Total time: {:.2}s", elapsed.as_secs_f64());
    println!("Average: {:.2}ms per frame", avg_ms);
    println!("FPS: {:.1}", fps);

    // Performance assertions
    assert!(
        avg_ms < 100.0,
        "Inference should be faster than 100ms (got {:.2}ms)",
        avg_ms
    );
}
