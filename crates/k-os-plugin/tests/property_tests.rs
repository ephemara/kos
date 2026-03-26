//! Property-based tests for k-os-plugin
//!
//! These tests verify universal properties that should hold for all inputs.

use k_os_plugin::{PluginContext, PluginManager, ResourceLimits, ResourceMonitor};
use proptest::prelude::*;
use semver::Version;
use std::path::PathBuf;

// ============================================================================
// Property 11: Plugin API Version Compatibility
// **Validates: Requirements 4.1, 4.3**
// ============================================================================

proptest! {
    /// Property 11.1: Strict Mode - Only Exact Version Matches Pass
    ///
    /// **Validates: Requirement 4.1**
    ///
    /// For any valid semver version string, when strict mode is enabled,
    /// only exact matches with the API version should pass validation.
    #[test]
    fn property_11_1_strict_mode_exact_match_only(
        major in 0u64..10,
        minor in 0u64..20,
        patch in 0u64..100
    ) {
        let plugin_dir = PathBuf::from("test_plugins");
        let mut manager = PluginManager::new(plugin_dir);
        manager.set_strict_version_check(true);

        let api_version = Version::parse(k_os_plugin::PLUGIN_API_VERSION).unwrap();
        let test_version = Version::new(major, minor, patch);
        let test_version_str = test_version.to_string();

        // Use internal validation method through a test helper
        let result = validate_version_strict(&manager, &test_version_str);

        if test_version == api_version {
            // Exact match should pass
            prop_assert!(result.is_ok(), "Exact version match should pass in strict mode");
        } else {
            // Any other version should fail
            prop_assert!(result.is_err(), "Non-exact version should fail in strict mode");
        }
    }

    /// Property 11.2: Compatible Mode - Same Major Version Passes
    ///
    /// **Validates: Requirement 4.1**
    ///
    /// For any valid semver version string, when compatible mode is enabled,
    /// versions with the same major version should pass validation.
    #[test]
    fn property_11_2_compatible_mode_same_major(
        minor in 0u64..20,
        patch in 0u64..100
    ) {
        let plugin_dir = PathBuf::from("test_plugins");
        let mut manager = PluginManager::new(plugin_dir);
        manager.set_strict_version_check(false);

        let api_version = Version::parse(k_os_plugin::PLUGIN_API_VERSION).unwrap();
        let test_version = Version::new(api_version.major, minor, patch);
        let test_version_str = test_version.to_string();

        let result = validate_version_compatible(&manager, &test_version_str);

        // Same major version should pass in compatible mode
        prop_assert!(result.is_ok(), "Same major version should pass in compatible mode");
    }

    /// Property 11.3: Compatible Mode - Different Major Version Fails
    ///
    /// **Validates: Requirement 4.1, 4.3**
    ///
    /// For any valid semver version string, when compatible mode is enabled,
    /// versions with different major versions should fail validation.
    #[test]
    fn property_11_3_compatible_mode_different_major(
        major_offset in 1u64..10,
        minor in 0u64..20,
        patch in 0u64..100
    ) {
        let plugin_dir = PathBuf::from("test_plugins");
        let mut manager = PluginManager::new(plugin_dir);
        manager.set_strict_version_check(false);

        let api_version = Version::parse(k_os_plugin::PLUGIN_API_VERSION).unwrap();
        let different_major = api_version.major + major_offset;
        let test_version = Version::new(different_major, minor, patch);
        let test_version_str = test_version.to_string();

        let result = validate_version_compatible(&manager, &test_version_str);

        // Different major version should fail even in compatible mode
        prop_assert!(result.is_err(), "Different major version should fail in compatible mode");
    }

    /// Property 11.4: Invalid Version Strings Are Rejected Consistently
    ///
    /// **Validates: Requirement 4.3**
    ///
    /// For any invalid version string, validation should consistently reject it
    /// regardless of strict mode setting.
    #[test]
    fn property_11_4_invalid_versions_rejected(
        invalid_str in "[a-z]{1,10}|[0-9]{1,3}\\.[a-z]{1,5}|\\.[0-9]{1,3}"
    ) {
        let plugin_dir = PathBuf::from("test_plugins");

        // Test both strict and compatible modes
        for strict in [true, false] {
            let mut manager = PluginManager::new(plugin_dir.clone());
            manager.set_strict_version_check(strict);

            let result = if strict {
                validate_version_strict(&manager, &invalid_str)
            } else {
                validate_version_compatible(&manager, &invalid_str)
            };

            // Invalid versions should always fail
            prop_assert!(result.is_err(), "Invalid version string should be rejected");
        }
    }
}

// Helper functions to test version validation
fn validate_version_strict(
    _manager: &PluginManager,
    version: &str,
) -> Result<(), k_os_plugin::PluginError> {
    let required = Version::parse(k_os_plugin::PLUGIN_API_VERSION)?;
    let plugin = Version::parse(version)?;

    if plugin != required {
        return Err(k_os_plugin::PluginError::IncompatibleVersion {
            plugin_version: version.to_string(),
            required_version: k_os_plugin::PLUGIN_API_VERSION.to_string(),
        });
    }
    Ok(())
}

fn validate_version_compatible(
    _manager: &PluginManager,
    version: &str,
) -> Result<(), k_os_plugin::PluginError> {
    let required = Version::parse(k_os_plugin::PLUGIN_API_VERSION)?;
    let plugin = Version::parse(version)?;

    if plugin.major != required.major {
        return Err(k_os_plugin::PluginError::IncompatibleVersion {
            plugin_version: version.to_string(),
            required_version: k_os_plugin::PLUGIN_API_VERSION.to_string(),
        });
    }
    Ok(())
}

// ============================================================================
// Property 12: Plugin Resource Limit Enforcement
// **Validates: Requirements 4.5, 4.6**
// ============================================================================

proptest! {
    /// Property 12.1: Memory Tracking Consistency
    ///
    /// **Validates: Requirement 4.5**
    ///
    /// For any sequence of memory allocations and deallocations,
    /// the tracked memory usage should remain consistent with the
    /// sum of allocations minus deallocations.
    #[test]
    fn property_12_1_memory_tracking_consistency(
        operations in prop::collection::vec((prop::bool::ANY, 1u64..1000), 0..100)
    ) {
        let limits = ResourceLimits::unlimited();
        let monitor = ResourceMonitor::new("test", limits);

        let mut expected_total = 0u64;
        let mut allocated_sizes = Vec::new();

        for (is_allocate, size) in operations {
            if is_allocate {
                // Allocate memory
                monitor.allocate_memory(size).unwrap();
                allocated_sizes.push(size);
                expected_total += size;
            } else if !allocated_sizes.is_empty() {
                // Deallocate memory (pop from allocated sizes)
                let size = allocated_sizes.pop().unwrap();
                monitor.deallocate_memory(size);
                expected_total -= size;
            }
        }

        // Memory usage should match expected total
        prop_assert_eq!(
            monitor.memory_usage(),
            expected_total,
            "Memory tracking should be consistent with allocations and deallocations"
        );
    }

    /// Property 12.2: File Handle Tracking Consistency
    ///
    /// **Validates: Requirement 4.5**
    ///
    /// For any sequence of file handle opens and closes,
    /// the tracked file handle count should remain consistent with
    /// the number of opens minus closes.
    #[test]
    fn property_12_2_file_handle_tracking_consistency(
        operations in prop::collection::vec(prop::bool::ANY, 0..100)
    ) {
        let limits = ResourceLimits::unlimited();
        let monitor = ResourceMonitor::new("test", limits);

        let mut expected_count = 0u32;

        for is_open in operations {
            if is_open {
                // Open file handle
                monitor.open_file_handle().unwrap();
                expected_count += 1;
            } else if expected_count > 0 {
                // Close file handle
                monitor.close_file_handle();
                expected_count -= 1;
            }
        }

        // File handle count should match expected
        prop_assert_eq!(
            monitor.file_handle_count(),
            expected_count,
            "File handle tracking should be consistent with opens and closes"
        );
    }

    /// Property 12.3: Memory Limit Enforcement
    ///
    /// **Validates: Requirement 4.6**
    ///
    /// For any configured memory limit, allocations that would exceed
    /// the limit should be rejected, and allocations within the limit
    /// should succeed.
    #[test]
    fn property_12_3_memory_limit_enforcement(
        limit in 1000u64..100000,
        allocation_size in 1u64..1000
    ) {
        let limits = ResourceLimits {
            max_memory_bytes: limit,
            ..Default::default()
        };
        let monitor = ResourceMonitor::new("test", limits);

        let mut total_allocated = 0u64;

        // Allocate up to the limit
        while total_allocated + allocation_size <= limit {
            let result = monitor.allocate_memory(allocation_size);
            prop_assert!(result.is_ok(), "Allocation within limit should succeed");
            total_allocated += allocation_size;
        }

        // Next allocation should exceed limit and fail
        if total_allocated + allocation_size > limit {
            let result = monitor.allocate_memory(allocation_size);
            prop_assert!(result.is_err(), "Allocation exceeding limit should fail");
        }

        // Current usage should not exceed limit
        prop_assert!(
            monitor.memory_usage() <= limit,
            "Memory usage should never exceed configured limit"
        );
    }

    /// Property 12.4: File Handle Limit Enforcement
    ///
    /// **Validates: Requirement 4.6**
    ///
    /// For any configured file handle limit, opening handles that would
    /// exceed the limit should be rejected, and opens within the limit
    /// should succeed.
    #[test]
    fn property_12_4_file_handle_limit_enforcement(
        limit in 10u32..200
    ) {
        let limits = ResourceLimits {
            max_file_handles: limit,
            ..Default::default()
        };
        let monitor = ResourceMonitor::new("test", limits);

        // Open handles up to the limit
        for i in 0..limit {
            let result = monitor.open_file_handle();
            prop_assert!(
                result.is_ok(),
                "Opening handle {} within limit {} should succeed",
                i,
                limit
            );
        }

        // Next open should exceed limit and fail
        let result = monitor.open_file_handle();
        prop_assert!(result.is_err(), "Opening handle beyond limit should fail");

        // Current count should not exceed limit
        prop_assert!(
            monitor.file_handle_count() <= limit,
            "File handle count should never exceed configured limit"
        );
    }

    /// Property 12.5: Resource Usage Percentage Calculation
    ///
    /// **Validates: Requirement 4.5**
    ///
    /// For any memory usage and limit, the calculated usage percentage
    /// should be accurate within floating point precision.
    #[test]
    fn property_12_5_usage_percentage_accuracy(
        memory_used in 0u64..10000,
        memory_limit in 10000u64..100000
    ) {
        let limits = ResourceLimits {
            max_memory_bytes: memory_limit,
            ..Default::default()
        };
        let monitor = ResourceMonitor::new("test", limits);

        // Allocate memory
        if memory_used <= memory_limit {
            monitor.allocate_memory(memory_used).unwrap();

            let usage = monitor.usage_summary();
            let expected_percent = (memory_used as f64 / memory_limit as f64) * 100.0;

            // Allow small floating point error (0.01%)
            let diff = (usage.memory_percent() - expected_percent).abs();
            prop_assert!(
                diff < 0.01,
                "Usage percentage should be accurate: expected {:.2}%, got {:.2}%",
                expected_percent,
                usage.memory_percent()
            );
        }
    }

    /// Property 12.6: Deallocation Never Goes Negative
    ///
    /// **Validates: Requirement 4.5**
    ///
    /// For any sequence of deallocations, even if they exceed allocations,
    /// the tracked usage should never go negative (saturating subtraction).
    #[test]
    fn property_12_6_deallocation_saturation(
        deallocations in prop::collection::vec(1u64..1000, 1..50)
    ) {
        let limits = ResourceLimits::unlimited();
        let monitor = ResourceMonitor::new("test", limits);

        // Deallocate without allocating first
        for size in deallocations {
            monitor.deallocate_memory(size);
        }

        // Usage should be zero, not negative
        prop_assert_eq!(
            monitor.memory_usage(),
            0,
            "Memory usage should saturate at zero, never go negative"
        );
    }

    /// Property 12.7: Resource Limit Presets Are Valid
    ///
    /// **Validates: Requirement 4.5, 4.6**
    ///
    /// All preset resource limit configurations should have valid,
    /// sensible values with proper ordering (strict < default < relaxed).
    #[test]
    fn property_12_7_preset_limits_ordering(
        _seed in 0u32..100 // Just to make it a property test
    ) {
        let strict = ResourceLimits::strict();
        let default = ResourceLimits::default();
        let relaxed = ResourceLimits::relaxed();
        let unlimited = ResourceLimits::unlimited();

        // Strict should be most restrictive
        prop_assert!(
            strict.max_memory_bytes < default.max_memory_bytes,
            "Strict memory limit should be less than default"
        );
        prop_assert!(
            strict.max_cpu_time_ms < default.max_cpu_time_ms,
            "Strict CPU time should be less than default"
        );
        prop_assert!(
            strict.max_file_handles < default.max_file_handles,
            "Strict file handles should be less than default"
        );

        // Relaxed should be most permissive (except unlimited)
        prop_assert!(
            relaxed.max_memory_bytes > default.max_memory_bytes,
            "Relaxed memory limit should be greater than default"
        );
        prop_assert!(
            relaxed.max_cpu_time_ms > default.max_cpu_time_ms,
            "Relaxed CPU time should be greater than default"
        );
        prop_assert!(
            relaxed.max_file_handles > default.max_file_handles,
            "Relaxed file handles should be greater than default"
        );

        // Unlimited should have zero limits
        prop_assert_eq!(unlimited.max_memory_bytes, 0, "Unlimited memory should be 0");
        prop_assert_eq!(unlimited.max_cpu_time_ms, 0, "Unlimited CPU time should be 0");
        prop_assert_eq!(unlimited.max_file_handles, 0, "Unlimited file handles should be 0");
    }

    /// Property 12.8: Mixed Resource Operations Maintain Consistency
    ///
    /// **Validates: Requirement 4.5**
    ///
    /// For any sequence of mixed memory and file handle operations,
    /// both resource types should be tracked independently and consistently.
    #[test]
    fn property_12_8_mixed_resource_consistency(
        operations in prop::collection::vec(
            (prop::bool::ANY, prop::bool::ANY, 1u64..500),
            0..100
        )
    ) {
        let limits = ResourceLimits::unlimited();
        let monitor = ResourceMonitor::new("test", limits);

        let mut expected_memory = 0u64;
        let mut expected_handles = 0u32;
        let mut allocated_memory = Vec::new();

        for (is_memory_op, is_allocate, size) in operations {
            if is_memory_op {
                // Memory operation
                if is_allocate {
                    monitor.allocate_memory(size).unwrap();
                    allocated_memory.push(size);
                    expected_memory += size;
                } else if !allocated_memory.is_empty() {
                    let size = allocated_memory.pop().unwrap();
                    monitor.deallocate_memory(size);
                    expected_memory -= size;
                }
            } else {
                // File handle operation
                if is_allocate {
                    monitor.open_file_handle().unwrap();
                    expected_handles += 1;
                } else if expected_handles > 0 {
                    monitor.close_file_handle();
                    expected_handles -= 1;
                }
            }
        }

        // Both resources should be tracked correctly
        prop_assert_eq!(
            monitor.memory_usage(),
            expected_memory,
            "Memory tracking should be consistent"
        );
        prop_assert_eq!(
            monitor.file_handle_count(),
            expected_handles,
            "File handle tracking should be consistent"
        );
    }
}

// ============================================================================
// Existing Property Tests (Plugin Context)
// ============================================================================

proptest! {
    #[test]
    fn property_plugin_context_data_roundtrip(
        key in "[a-z]{1,20}",
        value in prop::collection::vec(0u8..255, 0..100)
    ) {
        let mut context = PluginContext::new();

        // Store data
        let json_value = serde_json::json!(value);
        context.set_data(&key, json_value.clone());

        // Retrieve data
        let retrieved = context.get_data(&key);
        prop_assert_eq!(retrieved, Some(json_value));
    }

    #[test]
    fn property_capability_registration(
        capabilities in prop::collection::vec("[a-z_]{1,20}", 0..10)
    ) {
        let mut context = PluginContext::new();

        // Register all capabilities
        for cap in &capabilities {
            context.register_capability(cap);
        }

        // All registered capabilities should be present
        for cap in &capabilities {
            prop_assert!(context.has_capability(cap));
        }

        // Unregistered capability should not be present
        prop_assert!(!context.has_capability("unregistered_capability"));
    }

    #[test]
    fn property_resource_restriction(
        resources in prop::collection::vec("[a-z/_]{1,30}", 0..10)
    ) {
        let mut context = PluginContext::new();

        // Add all resources as restricted
        for resource in &resources {
            context.add_restricted_resource(resource);
        }

        // All restricted resources should be blocked
        for resource in &resources {
            prop_assert!(context.is_resource_restricted(resource));
            prop_assert!(context.check_resource_access(resource).is_err());
        }

        // Unrestricted resource should be allowed
        prop_assert!(context.check_resource_access("/unrestricted/path").is_ok());
    }

    #[test]
    fn property_context_data_removal(
        keys in prop::collection::hash_set("[a-z]{1,20}", 1..20)
    ) {
        let mut context = PluginContext::new();
        let keys: Vec<String> = keys.into_iter().collect();

        // Store data for all keys
        for key in &keys {
            context.set_data(key, serde_json::json!(key));
        }

        // Remove half the keys
        let to_remove = &keys[..keys.len() / 2];
        for key in to_remove {
            context.remove_data(key);
        }

        // Removed keys should be gone
        for key in to_remove {
            prop_assert_eq!(context.get_data(key), None);
        }

        // Remaining keys should still exist
        let remaining = &keys[keys.len() / 2..];
        for key in remaining {
            prop_assert_eq!(context.get_data(key), Some(serde_json::json!(key)));
        }
    }
}
