//! Tests for GPU compute chain

use super::*;
use crate::types::Joint;

#[test]
fn test_gpu_vec4_conversion() {
    // Test Joint -> GpuVec4 conversion
    let joint = Joint {
        position: [0.5, 0.75, 0.25],
        confidence: 0.9,
    };
    
    let gpu_vec: GpuVec4 = (&joint).into();
    assert_eq!(gpu_vec.0[0], 0.5);
    assert_eq!(gpu_vec.0[1], 0.75);
    assert_eq!(gpu_vec.0[2], 0.25);
    assert_eq!(gpu_vec.0[3], 0.9);
    
    // Test GpuVec4 -> Joint conversion
    let joint_back: Joint = gpu_vec.into();
    assert_eq!(joint_back.position[0], 0.5);
    assert_eq!(joint_back.position[1], 0.75);
    assert_eq!(joint_back.position[2], 0.25);
    assert_eq!(joint_back.confidence, 0.9);
}

#[test]
fn test_uniform_defaults() {
    // Test DenoiseUniforms defaults
    let denoise = DenoiseUniforms::default();
    assert_eq!(denoise.joint_count, 17);
    assert!(denoise.delta_time > 0.0);
    assert!(denoise.min_cutoff > 0.0);
    assert!(denoise.beta > 0.0);
    
    // Test SkeletonUniforms defaults
    let skeleton = SkeletonUniforms::default();
    assert_eq!(skeleton.joint_count, 17);
    assert!(skeleton.stiffness > 0.0 && skeleton.stiffness <= 1.0);
    assert!(skeleton.solver_iterations > 0);
    
    // Test PhysicsUniforms defaults
    let physics = PhysicsUniforms::default();
    assert_eq!(physics.joint_count, 17);
    assert_eq!(physics.floor_y, 0.0);
    assert!(physics.lock_velocity_thresh > 0.0);
    assert_eq!(physics.ankle_start, 15);
    assert_eq!(physics.ankle_end, 16);
    
    // Test SupermotionLiveLinkUniforms defaults
    let supermotion = SupermotionLiveLinkUniforms::default();
    assert_eq!(supermotion.joint_count, 17);
    assert_eq!(supermotion.time_sec, 0.0);
    assert!(supermotion.delta_time > 0.0);
    
    // Test LiveLinkUniforms defaults
    let livelink = LiveLinkUniforms::default();
    assert_eq!(livelink.joint_count, 17);
    assert!(livelink.eps > 0.0);
}

#[test]
fn test_supermotion_default_profile_is_applied() {
    let max_joints = 34; // two COCO persons
    let (mod_type, params_a, _params_b, _params_c) = default_supermotion_commands(max_joints);
    assert_eq!(mod_type.len(), max_joints);
    assert_eq!(params_a.len(), max_joints);

    // default profile is intentionally neutral; all joints passthrough.
    assert!(mod_type.iter().all(|m| *m == 0));
}

#[test]
fn test_spirv_shaders_embedded() {
    // Verify all SPIR-V shaders are embedded and non-empty
    assert!(!DENOISE_SPV.is_empty(), "DENOISE_SPV should be embedded");
    assert!(!SKELETON_SPV.is_empty(), "SKELETON_SPV should be embedded");
    assert!(!PHYSICS_SPV.is_empty(), "PHYSICS_SPV should be embedded");
    assert!(!SUPERMOTION_LIVELINK_SPV.is_empty(), "SUPERMOTION_LIVELINK_SPV should be embedded");
    assert!(!LIVELINK_SPV.is_empty(), "LIVELINK_SPV should be embedded");
    
    // Verify SPIR-V magic number (0x07230203)
    let check_spirv_magic = |spv: &[u8], name: &str| {
        assert!(spv.len() >= 4, "{} should have at least 4 bytes", name);
        let magic = u32::from_le_bytes([spv[0], spv[1], spv[2], spv[3]]);
        assert_eq!(magic, 0x07230203, "{} should have valid SPIR-V magic number", name);
    };
    
    check_spirv_magic(DENOISE_SPV, "DENOISE_SPV");
    check_spirv_magic(SKELETON_SPV, "SKELETON_SPV");
    check_spirv_magic(PHYSICS_SPV, "PHYSICS_SPV");
    check_spirv_magic(SUPERMOTION_LIVELINK_SPV, "SUPERMOTION_LIVELINK_SPV");
    check_spirv_magic(LIVELINK_SPV, "LIVELINK_SPV");
}

#[test]
fn test_spirv_shader_sizes() {
    // Verify shader sizes are reasonable (not corrupted)
    assert!(DENOISE_SPV.len() > 1000, "DENOISE_SPV should be > 1KB");
    assert!(SKELETON_SPV.len() > 1000, "SKELETON_SPV should be > 1KB");
    assert!(PHYSICS_SPV.len() > 1000, "PHYSICS_SPV should be > 1KB");
    assert!(SUPERMOTION_LIVELINK_SPV.len() > 10000, "SUPERMOTION_LIVELINK_SPV should be > 10KB");
    assert!(LIVELINK_SPV.len() > 5000, "LIVELINK_SPV should be > 5KB");
    
    // Verify shaders are 4-byte aligned (required by wgpu)
    assert_eq!(DENOISE_SPV.len() % 4, 0, "DENOISE_SPV should be 4-byte aligned");
    assert_eq!(SKELETON_SPV.len() % 4, 0, "SKELETON_SPV should be 4-byte aligned");
    assert_eq!(PHYSICS_SPV.len() % 4, 0, "PHYSICS_SPV should be 4-byte aligned");
}

#[test]
fn test_sanitize_solved_joint_applies_confidence_and_clamps() {
    let raw = GpuVec4([0.5, 0.5, 0.0, 0.2]);
    // Extreme solved sample should be pulled back toward raw and clamped.
    let solved = GpuVec4([4.0, -3.0, 9.0, 1.0]);
    let out = sanitize_solved_joint(solved, raw);

    assert!(out.position[0].is_finite());
    assert!(out.position[1].is_finite());
    assert!(out.position[2].is_finite());
    assert!(out.position[0] >= 0.0 && out.position[0] <= 1.0);
    assert!(out.position[1] >= 0.0 && out.position[1] <= 1.0);
    assert!(out.position[2] >= -1.0 && out.position[2] <= 1.0);
    // Confidence must come from detector/raw stream, not solved w=1.
    assert!((out.confidence - 0.2).abs() < 1e-6);
}

// Integration test - requires GPU
#[tokio::test]
#[ignore] // Run with: cargo test -- --ignored
async fn test_gpu_chain_initialization() {
    // This test requires a GPU with wgpu support
    let max_joints = 17;
    let result = GpuChain::new(max_joints, None).await;
    
    match result {
        Ok(chain) => {
            assert_eq!(chain.max_joints, 17);
            assert!(!chain.adapter_name.is_empty(), "Adapter name should not be empty");
            assert!(!chain.adapter_backend.is_empty(), "Backend should not be empty");
            println!("✓ GPU chain initialized successfully");
            println!("  Adapter: {}", chain.adapter_name);
            println!("  Backend: {}", chain.adapter_backend);
            println!("  Driver: {}", chain.adapter_driver);
        }
        Err(e) => {
            eprintln!("GPU chain initialization failed: {}", e);
            eprintln!("This is expected if no GPU is available");
        }
    }
}

#[tokio::test]
#[ignore] // Run with: cargo test -- --ignored
async fn test_gpu_chain_process_frame() {
    // This test requires a GPU
    let max_joints = 17;
    let chain = match GpuChain::new(max_joints, None).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Skipping test: GPU not available - {}", e);
            return;
        }
    };
    
    // Create dummy COCO joints
    let joints: Vec<Joint> = (0..17).map(|i| Joint {
        position: [i as f32 * 0.05, i as f32 * 0.05, 0.0],
        confidence: 0.9,
    }).collect();
    
    // Upload topology (dummy parent chain)
    let parents: Vec<i32> = vec![-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    let rest_lengths: Vec<f32> = vec![0.1; 17];
    chain.upload_topology(&parents, &rest_lengths);
    
    // Process frame
    let result = chain.process_frame(&joints, 0.033, 0.0).await;
    
    match result {
        Ok(solved_joints) => {
            assert_eq!(solved_joints.len(), 17, "Should return 17 joints");
            for (i, joint) in solved_joints.iter().enumerate() {
                assert!(joint.confidence >= 0.0 && joint.confidence <= 1.0,
                        "Joint {} confidence should be in [0,1]", i);
            }
            println!("✓ GPU frame processing completed successfully");
        }
        Err(e) => {
            eprintln!("GPU frame processing failed: {}", e);
            panic!("Frame processing failed");
        }
    }
}

#[test]
fn test_pod_zeroable_implementations() {
    // Verify Pod/Zeroable implementations work correctly
    use bytemuck::{Pod, Zeroable};
    
    // Test GpuVec4
    let zero_vec: GpuVec4 = Zeroable::zeroed();
    assert_eq!(zero_vec.0, [0.0, 0.0, 0.0, 0.0]);
    
    // Test that we can cast to bytes
    let vec = GpuVec4([1.0, 2.0, 3.0, 4.0]);
    let bytes: &[u8] = bytemuck::bytes_of(&vec);
    assert_eq!(bytes.len(), 16); // 4 * f32
    
    // Test DenoiseUniforms
    let denoise: DenoiseUniforms = Zeroable::zeroed();
    assert_eq!(denoise.joint_count, 0);
    
    // Test SkeletonUniforms
    let skeleton: SkeletonUniforms = Zeroable::zeroed();
    assert_eq!(skeleton.joint_count, 0);
    
    // Test PhysicsUniforms
    let physics: PhysicsUniforms = Zeroable::zeroed();
    assert_eq!(physics.joint_count, 0);
}
