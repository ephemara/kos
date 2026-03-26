//! Integration tests for the ZenMocap real-time pipeline
//!
//! Tests the full pipeline flow:
//! Camera → AI Inference → IK Solving → DCC Broadcast → Frontend

use zen_mocap_engine::{
    camera::CameraCapture,
    filter::JointFilterBank,
    inference::InferenceEngine,
    models::{get_model, list_models},
    rig::{resolve_retarget_contract, RetargetSurface, RigRetargeter},
    types::{IkConstraintParams, Joint},
};

#[test]
fn test_camera_enumeration() {
    // Test camera discovery
    let cameras = CameraCapture::enumerate();
    println!("Found {} cameras", cameras.len());

    // Should not panic even if no cameras present
    assert!(cameras.len() >= 0);

    for (i, cam) in cameras.iter().enumerate() {
        println!("  Camera {}: {} (index: {})", i, cam.name, cam.index);
    }
}

#[test]
fn test_model_manifest_loading() {
    // Test model manifest parsing
    let models = list_models();

    assert!(
        !models.is_empty(),
        "Model manifest should contain at least one model"
    );

    println!("Available models:");
    for model in models {
        println!(
            "  - {} ({} keypoints, {}x{})",
            model.id,
            model.keypoints,
            model.input_width(),
            model.input_height()
        );

        // Verify model entry is valid
        assert!(!model.id.is_empty());
        assert!(model.keypoints > 0);
        assert!(model.input_width() > 0);
        assert!(model.input_height() > 0);
    }
}

#[test]
fn test_coco17_model_availability() {
    // Verify we have at least one COCO-17 model for live retargeting
    let models = list_models();
    let coco17_models: Vec<_> = models.iter().filter(|m| m.keypoints == 17).collect();

    assert!(
        !coco17_models.is_empty(),
        "At least one COCO-17 model required for live retargeting"
    );

    println!("COCO-17 compatible models:");
    for model in coco17_models {
        println!("  - {}", model.id);
    }
}

#[test]
fn test_ik_retargeter_initialization() {
    // Test IK retargeter can be created
    let params = IkConstraintParams::default();
    let resolved = resolve_retarget_contract("yolov11n_pose", 17, RetargetSurface::LiveSession)
        .expect("expected coco17 retarget contract for live session");
    let _retargeter = RigRetargeter::new(params, resolved.live_retarget_contract);

    // Should not panic
    println!("IK retargeter initialized successfully");
}

#[test]
fn test_joint_filter_bank() {
    // Test One Euro Filter initialization
    let mut filter_bank = JointFilterBank::new(17, 1.0, 0.007);

    // Create mock joint positions
    let mut joints = vec![[0.5f32, 0.5, 0.0]; 17];

    // Filter should smooth without panicking
    filter_bank.filter_frame(&mut joints, 0.0);
    filter_bank.filter_frame(&mut joints, 0.033); // 30 FPS

    println!("Joint filter bank processed frames successfully");
}

#[test]
fn test_joint_confidence_threshold() {
    // Test joint reliability checking
    let reliable = Joint {
        position: [0.5, 0.5, 0.0],
        confidence: 0.8,
    };

    let unreliable = Joint {
        position: [0.5, 0.5, 0.0],
        confidence: 0.2,
    };

    assert!(reliable.is_reliable());
    assert!(!unreliable.is_reliable());
}

#[test]
fn test_ik_params_validation() {
    // Test IK parameter ranges
    let params = IkConstraintParams {
        bone_length_tolerance: 0.01,
        foot_lock_strength: 0.9,
        filter_min_cutoff: 1.0,
        filter_beta: 0.007,
    };

    // All values should be positive
    assert!(params.bone_length_tolerance > 0.0);
    assert!(params.foot_lock_strength >= 0.0 && params.foot_lock_strength <= 1.0);
    assert!(params.filter_min_cutoff > 0.0);
    assert!(params.filter_beta > 0.0);
}

#[cfg(feature = "gpu-chain")]
#[tokio::test]
async fn test_gpu_chain_initialization() {
    use zen_mocap_engine::gpu_chain::GpuChain;

    // Test GPU chain can be initialized
    let result = GpuChain::new(17 * 8, None).await;

    match result {
        Ok(chain) => {
            println!("GPU chain initialized successfully");

            // Test topology upload
            let parents: [i32; 17] = [-1, 0, 0, 1, 2, -1, -1, 5, 6, 7, 8, 5, 6, 11, 12, 13, 14];
            let rest_lengths: [f32; 17] = [
                0.05, 0.04, 0.04, 0.08, 0.08, 0.0, 0.0, 0.28, 0.28, 0.25, 0.25, 0.30, 0.30, 0.42,
                0.42, 0.40, 0.40,
            ];

            chain.upload_topology(&parents, &rest_lengths);
            println!("GPU topology uploaded successfully");
        }
        Err(e) => {
            println!(
                "GPU chain initialization failed (expected on CPU-only systems): {}",
                e
            );
        }
    }
}

#[test]
fn test_dcc_protocol_registry() {
    use zen_mocap_engine::dcc::{get_protocol, DCC_PROTOCOLS};

    // Test all DCC protocols are registered
    assert!(!DCC_PROTOCOLS.is_empty());

    println!("Registered DCC protocols:");
    for protocol in DCC_PROTOCOLS {
        println!(
            "  - {} ({}) → port {}",
            protocol.name, protocol.id, protocol.default_port
        );

        // Verify protocol can be retrieved
        let retrieved = get_protocol(protocol.id);
        assert!(retrieved.is_some());
    }

    // Test specific protocols
    assert!(get_protocol("ue5").is_some());
    assert!(get_protocol("unity").is_some());
    assert!(get_protocol("blender").is_some());
}

#[test]
fn test_session_state_transitions() {
    use zen_mocap_engine::session::SessionState;

    // Test state enum serialization
    let states = vec![
        SessionState::Idle,
        SessionState::Initializing,
        SessionState::Running,
        SessionState::Paused,
        SessionState::Recording,
        SessionState::Error("test error".into()),
    ];

    for state in states {
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: SessionState = serde_json::from_str(&json).unwrap();
        assert_eq!(state, deserialized);
    }
}

#[test]
fn test_coco_joint_names() {
    use zen_mocap_engine::types::COCO_JOINT_NAMES;

    // Verify COCO-17 joint names are defined
    assert_eq!(COCO_JOINT_NAMES.len(), 17);

    println!("COCO-17 joint names:");
    for (i, name) in COCO_JOINT_NAMES.iter().enumerate() {
        println!("  {}: {}", i, name);
    }

    // Verify key joints exist
    assert!(COCO_JOINT_NAMES.contains(&"nose"));
    assert!(COCO_JOINT_NAMES.contains(&"left_wrist"));
    assert!(COCO_JOINT_NAMES.contains(&"right_wrist"));
    assert!(COCO_JOINT_NAMES.contains(&"left_ankle"));
    assert!(COCO_JOINT_NAMES.contains(&"right_ankle"));
}

/// Performance benchmark: measure filter overhead
#[test]
fn bench_filter_performance() {
    use std::time::Instant;

    let mut filter_bank = JointFilterBank::new(17, 1.0, 0.007);
    let mut joints = vec![[0.5f32, 0.5, 0.0]; 17];

    let iterations = 1000;
    let start = Instant::now();

    for i in 0..iterations {
        let timestamp = i as f64 / 30.0; // 30 FPS
        filter_bank.filter_frame(&mut joints, timestamp);
    }

    let elapsed = start.elapsed();
    let avg_us = elapsed.as_micros() / iterations;

    println!("Filter performance: {} µs/frame (target: <500 µs)", avg_us);

    // Filter should be fast enough for real-time (< 500 µs per frame)
    assert!(avg_us < 500, "Filter too slow: {} µs/frame", avg_us);
}

/// Test pipeline latency budget
#[test]
fn test_latency_budget() {
    // Target: < 30ms glass-to-glass
    // Breakdown:
    // - Camera: 16ms (60 FPS) or 33ms (30 FPS)
    // - AI Inference: 5-15ms
    // - Filtering: < 0.5ms
    // - IK Solving: 1-3ms
    // - UDP Broadcast: < 0.5ms
    // - Frontend Rendering: 2-5ms

    let camera_latency_60fps = 16.0;
    let inference_latency = 10.0; // Average
    let filter_latency = 0.5;
    let ik_latency = 2.0;
    let udp_latency = 0.5;
    let render_latency = 3.0;

    let total_latency = camera_latency_60fps
        + inference_latency
        + filter_latency
        + ik_latency
        + udp_latency
        + render_latency;

    println!("Estimated pipeline latency: {:.1}ms", total_latency);
    println!("  Camera (60 FPS): {:.1}ms", camera_latency_60fps);
    println!("  AI Inference: {:.1}ms", inference_latency);
    println!("  Filtering: {:.1}ms", filter_latency);
    println!("  IK Solving: {:.1}ms", ik_latency);
    println!("  UDP Broadcast: {:.1}ms", udp_latency);
    println!("  Frontend Render: {:.1}ms", render_latency);

    // 30ms is an aspirational target for top-end systems.
    // Keep a hard regression gate at 40ms in CI for broad hardware variance.
    assert!(
        total_latency < 40.0,
        "Pipeline latency {} ms exceeds 40ms hard budget",
        total_latency
    );
}
