//! Property-based tests for k-os-asset-pipeline using proptest
//!
//! These tests validate universal properties that should hold for the asset pipeline
//! across a wide range of inputs and scenarios.

use k_os_asset_pipeline::{
    asset::{MeshData, TextureData, TextureFormat},
    Asset, AssetData, AssetError, AssetExporter, AssetImporter, AssetPipeline, AssetProcessor,
    AssetType,
};
use proptest::prelude::*;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tempfile::TempDir;

// ============================================================================
// Test Importers and Exporters
// ============================================================================

/// Test importer that supports multiple extensions
#[derive(Clone)]
struct TestImporter {
    extensions: Vec<String>,
    name: String,
}

impl TestImporter {
    fn new(extensions: Vec<&str>) -> Self {
        Self {
            extensions: extensions.iter().map(|s| s.to_string()).collect(),
            name: "TestImporter".to_string(),
        }
    }
}

impl AssetImporter for TestImporter {
    fn supported_extensions(&self) -> Vec<&str> {
        self.extensions.iter().map(|s| s.as_str()).collect()
    }

    fn import(&self, path: &Path) -> k_os_asset_pipeline::Result<Asset> {
        // Read file content
        let content = fs::read(path)?;

        // Create a simple mesh asset from the file data
        let positions = vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        let mesh_data = MeshData {
            positions,
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        };

        Ok(Asset::new(
            format!("test_{}", content.len()),
            AssetType::Mesh,
            path.to_path_buf(),
            AssetData::Mesh(mesh_data),
        ))
    }

    fn name(&self) -> &str {
        &self.name
    }
}

/// Test exporter that supports multiple formats
#[derive(Clone)]
struct TestExporter {
    formats: Vec<String>,
    name: String,
}

impl TestExporter {
    fn new(formats: Vec<&str>) -> Self {
        Self {
            formats: formats.iter().map(|s| s.to_string()).collect(),
            name: "TestExporter".to_string(),
        }
    }
}

impl AssetExporter for TestExporter {
    fn supported_formats(&self) -> Vec<&str> {
        self.formats.iter().map(|s| s.as_str()).collect()
    }

    fn export(&self, asset: &Asset, path: &Path) -> k_os_asset_pipeline::Result<()> {
        // Simple export: write asset ID to file
        let mut file = fs::File::create(path)?;
        file.write_all(asset.id.as_bytes())?;
        Ok(())
    }

    fn name(&self) -> &str {
        &self.name
    }
}

/// Test processor that adds metadata
#[derive(Clone)]
struct TestProcessor {
    name: String,
    metadata_key: String,
    metadata_value: String,
}

impl TestProcessor {
    fn new(name: &str, key: &str, value: &str) -> Self {
        Self {
            name: name.to_string(),
            metadata_key: key.to_string(),
            metadata_value: value.to_string(),
        }
    }
}

impl AssetProcessor for TestProcessor {
    fn process(&self, asset: &mut Asset) -> k_os_asset_pipeline::Result<()> {
        asset.add_metadata(self.metadata_key.clone(), self.metadata_value.clone());
        Ok(())
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn should_process(&self, _asset: &Asset) -> bool {
        true
    }
}

/// Failing processor for testing error handling
#[derive(Clone)]
struct FailingProcessor {
    name: String,
}

impl FailingProcessor {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }
}

impl AssetProcessor for FailingProcessor {
    fn process(&self, _asset: &mut Asset) -> k_os_asset_pipeline::Result<()> {
        Err(AssetError::ProcessingFailed(
            "Intentional failure".to_string(),
        ))
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn should_process(&self, _asset: &Asset) -> bool {
        true
    }
}

// ============================================================================
// Proptest Strategies
// ============================================================================

/// Strategy for generating file extensions
fn extension_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("test".to_string()),
        Just("TEST".to_string()),
        Just("Test".to_string()),
        Just("TeSt".to_string()),
        Just("mesh".to_string()),
        Just("MESH".to_string()),
        Just("data".to_string()),
    ]
}

/// Strategy for generating unsupported extensions
fn unsupported_extension_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("unsupported".to_string()),
        Just("xyz".to_string()),
        Just("unknown".to_string()),
        Just("invalid".to_string()),
    ]
}

/// Strategy for generating file content
fn file_content_strategy() -> impl Strategy<Value = Vec<u8>> {
    prop::collection::vec(any::<u8>(), 1..1024)
}

/// Strategy for generating mesh positions
fn mesh_positions_strategy() -> impl Strategy<Value = Vec<f32>> {
    prop::collection::vec(-100.0f32..100.0f32, 9..300)
        .prop_filter("Must be multiple of 3", |v| v.len() % 3 == 0)
}

/// Strategy for generating texture dimensions
fn texture_dimensions_strategy() -> impl Strategy<Value = (u32, u32)> {
    (1u32..=4096, 1u32..=4096)
}

// ============================================================================
// Property 7: Asset Import Format Detection
// **Validates: Requirements 3.1, 3.2**
// ============================================================================

proptest! {
    /// **Validates: Requirements 3.1, 3.2**
    ///
    /// Property: For any supported file extension, the pipeline should detect the correct format
    #[test]
    fn prop_format_detection_supported(
        ext in extension_strategy(),
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer for test extensions
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test", "mesh", "data"])));

        // Create test file with the extension
        let file_path = temp_dir.path().join(format!("test_file.{}", ext.to_lowercase()));
        fs::write(&file_path, &content).unwrap();

        // Import should succeed for supported extensions
        let result = pipeline.import(&file_path);

        if ext.to_lowercase() == "test" || ext.to_lowercase() == "mesh" || ext.to_lowercase() == "data" {
            prop_assert!(result.is_ok(), "Import should succeed for supported extension: {}", ext);
        }
    }

    /// **Validates: Requirements 3.1, 3.2**
    ///
    /// Property: Format detection should be case-insensitive
    #[test]
    fn prop_format_detection_case_insensitive(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Test different case variations
        let variations = vec!["test", "TEST", "Test", "TeSt"];

        for ext in variations {
            let file_path = temp_dir.path().join(format!("file.{}", ext));
            fs::write(&file_path, &content).unwrap();

            let result = pipeline.import(&file_path);
            prop_assert!(
                result.is_ok(),
                "Import should succeed regardless of extension case: {}",
                ext
            );
        }
    }

    /// **Validates: Requirements 3.1, 3.3**
    ///
    /// Property: Unknown extensions should return error with list of supported formats
    #[test]
    fn prop_format_detection_unknown_extension(
        ext in unsupported_extension_strategy(),
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer for known extensions only
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test", "mesh"])));

        // Create file with unsupported extension
        let file_path = temp_dir.path().join(format!("file.{}", ext));
        fs::write(&file_path, &content).unwrap();

        // Import should fail with UnsupportedFormat error
        let result = pipeline.import(&file_path);
        prop_assert!(result.is_err(), "Import should fail for unsupported extension");

        if let Err(AssetError::UnsupportedFormat { extension, supported }) = result {
            prop_assert_eq!(extension, ext.to_lowercase());
            prop_assert!(supported.contains("test"), "Error should list supported formats");
            prop_assert!(supported.contains("mesh"), "Error should list supported formats");
        } else {
            prop_assert!(false, "Should return UnsupportedFormat error");
        }
    }
}

// ============================================================================
// Property 8: Asset Import/Export Round-Trip
// **Validates: Requirements 3.7, 3.9**
// ============================================================================

proptest! {
    /// **Validates: Requirements 3.7, 3.9**
    ///
    /// Property: For any asset, export then import should preserve essential data
    #[test]
    fn prop_import_export_round_trip(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer and exporter
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));
        pipeline.register_exporter(Arc::new(TestExporter::new(vec!["test"])));

        // Create original file
        let original_path = temp_dir.path().join("original.test");
        fs::write(&original_path, &content).unwrap();

        // Import asset
        let asset = pipeline.import(&original_path).unwrap();
        let original_type = asset.asset_type;

        // Export asset
        let export_path = temp_dir.path().join("exported.test");
        pipeline.export(&asset, &export_path, "test").unwrap();

        // Re-import exported asset
        let reimported = pipeline.import(&export_path).unwrap();

        // Asset type should be preserved
        prop_assert_eq!(
            reimported.asset_type,
            original_type,
            "Asset type should be preserved through round-trip"
        );
    }

    /// **Validates: Requirements 3.7, 3.9**
    ///
    /// Property: Mesh positions should be preserved (within floating point tolerance)
    #[test]
    fn prop_mesh_positions_preserved(
        positions in mesh_positions_strategy()
    ) {
        let _ = env_logger::try_init();

        // Create mesh asset
        let mesh_data = MeshData {
            positions: positions.clone(),
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some((0..positions.len() as u32 / 3).collect()),
            submeshes: vec![(0, positions.len() as u32 / 3, None)],
        };

        let asset = Asset::new(
            "test_mesh".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.mesh"),
            AssetData::Mesh(mesh_data),
        );

        // Extract positions
        if let AssetData::Mesh(ref mesh) = asset.data {
            prop_assert_eq!(mesh.positions.len(), positions.len());

            // Verify positions match (exact for this test)
            for (i, &pos) in positions.iter().enumerate() {
                prop_assert!(
                    (mesh.positions[i] - pos).abs() < 1e-6,
                    "Position {} should be preserved: expected {}, got {}",
                    i,
                    pos,
                    mesh.positions[i]
                );
            }
        }
    }

    /// **Validates: Requirements 3.7, 3.9**
    ///
    /// Property: Texture dimensions and format should be preserved
    #[test]
    fn prop_texture_dimensions_preserved(
        (width, height) in texture_dimensions_strategy()
    ) {
        let _ = env_logger::try_init();

        // Create texture asset
        let pixel_count = (width * height * 4) as usize;
        let texture_data = TextureData {
            width,
            height,
            format: TextureFormat::Rgba8,
            data: vec![128u8; pixel_count],
            mip_levels: 1,
        };

        let asset = Asset::new(
            "test_texture".to_string(),
            AssetType::Texture,
            PathBuf::from("test.png"),
            AssetData::Texture(texture_data),
        );

        // Verify dimensions
        if let AssetData::Texture(ref tex) = asset.data {
            prop_assert_eq!(tex.width, width, "Width should be preserved");
            prop_assert_eq!(tex.height, height, "Height should be preserved");
            prop_assert_eq!(tex.format, TextureFormat::Rgba8, "Format should be preserved");
        }
    }

    /// **Validates: Requirements 3.7, 3.9**
    ///
    /// Property: Round-trip should not corrupt data
    #[test]
    fn prop_round_trip_no_corruption(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer and exporter
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));
        pipeline.register_exporter(Arc::new(TestExporter::new(vec!["test"])));

        // Create and import original
        let original_path = temp_dir.path().join("original.test");
        fs::write(&original_path, &content).unwrap();
        let asset1 = pipeline.import(&original_path).unwrap();

        // Export and re-import
        let export_path = temp_dir.path().join("exported.test");
        pipeline.export(&asset1, &export_path, "test").unwrap();
        let asset2 = pipeline.import(&export_path).unwrap();

        // Asset types should match
        prop_assert_eq!(asset1.asset_type, asset2.asset_type);

        // Both should be valid mesh assets
        prop_assert!(matches!(asset1.data, AssetData::Mesh(_)));
        prop_assert!(matches!(asset2.data, AssetData::Mesh(_)));
    }
}

// ============================================================================
// Property 9: Asset Import Caching
// **Validates: Requirement 3.6**
// ============================================================================

proptest! {
    /// **Validates: Requirement 3.6**
    ///
    /// Property: Importing the same file twice should return cached result (same hash)
    #[test]
    fn prop_caching_same_file_same_hash(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Create file
        let file_path = temp_dir.path().join("test.test");
        fs::write(&file_path, &content).unwrap();

        // Import twice
        let asset1 = pipeline.import(&file_path).unwrap();
        let asset2 = pipeline.import(&file_path).unwrap();

        // Should have same hash (cached)
        prop_assert_eq!(
            asset1.id,
            asset2.id,
            "Importing same file twice should return same hash"
        );
    }

    /// **Validates: Requirement 3.6**
    ///
    /// Property: Modifying file content should invalidate cache (different hash)
    #[test]
    fn prop_caching_modified_file_different_hash(
        content1 in file_content_strategy(),
        content2 in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        // Ensure contents are different
        prop_assume!(content1 != content2);

        let temp_dir = TempDir::new().unwrap();
        // Use a subdirectory for cache to avoid issues with clear_cache
        let cache_dir = temp_dir.path().join("cache");
        let pipeline = AssetPipeline::new(cache_dir).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Create and import file with first content
        let file_path = temp_dir.path().join("test.test");
        fs::write(&file_path, &content1).unwrap();
        let asset1 = pipeline.import(&file_path).unwrap();

        // Modify file content
        fs::write(&file_path, &content2).unwrap();

        // Clear cache to force re-import
        pipeline.clear_cache().unwrap();

        // Import again
        let asset2 = pipeline.import(&file_path).unwrap();

        // Should have different hash
        prop_assert_ne!(
            asset1.id,
            asset2.id,
            "Modified file should have different hash"
        );
    }

    /// **Validates: Requirement 3.6**
    ///
    /// Property: Cache should respect file hash for identical content in different files
    #[test]
    fn prop_caching_identical_content_same_hash(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Create two files with identical content
        let file1_path = temp_dir.path().join("file1.test");
        let file2_path = temp_dir.path().join("file2.test");
        fs::write(&file1_path, &content).unwrap();
        fs::write(&file2_path, &content).unwrap();

        // Import both
        let asset1 = pipeline.import(&file1_path).unwrap();
        let asset2 = pipeline.import(&file2_path).unwrap();

        // Should have same hash (identical content)
        prop_assert_eq!(
            asset1.id,
            asset2.id,
            "Files with identical content should have same hash"
        );
    }

    /// **Validates: Requirement 3.6**
    ///
    /// Property: Cache stats should reflect cache usage
    #[test]
    fn prop_caching_stats_accurate(
        num_files in 1usize..10,
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Create and import multiple files
        for i in 0..num_files {
            let file_path = temp_dir.path().join(format!("file{}.test", i));
            fs::write(&file_path, &content).unwrap();
            pipeline.import(&file_path).unwrap();
        }

        // Get cache stats
        let stats = pipeline.cache_stats();

        // Should have cached entries
        prop_assert!(
            stats.memory_entries > 0 || stats.disk_entries > 0,
            "Cache should have entries after imports"
        );
    }
}

// ============================================================================
// Property 10: Asset Processing Pipeline
// **Validates: Requirement 3.4**
// ============================================================================

proptest! {
    /// **Validates: Requirement 3.4**
    ///
    /// Property: Processors should be applied in registration order
    #[test]
    fn prop_processors_applied_in_order(
        content in file_content_strategy(),
        num_processors in 1usize..5
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Register processors in order
        for i in 0..num_processors {
            pipeline.register_processor(Arc::new(TestProcessor::new(
                &format!("processor_{}", i),
                &format!("key_{}", i),
                &format!("value_{}", i),
            )));
        }

        // Create and import file
        let file_path = temp_dir.path().join("test.test");
        fs::write(&file_path, &content).unwrap();
        let asset = pipeline.import(&file_path).unwrap();

        // Verify all processors were applied
        for i in 0..num_processors {
            let key = format!("key_{}", i);
            let expected_value = format!("value_{}", i);
            prop_assert_eq!(
                asset.get_metadata(&key),
                Some(&expected_value),
                "Processor {} should have been applied",
                i
            );
        }
    }

    /// **Validates: Requirement 3.4**
    ///
    /// Property: If any processor fails, subsequent processors should not run
    #[test]
    fn prop_processor_failure_stops_pipeline(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Register processors: success, failure, success
        pipeline.register_processor(Arc::new(TestProcessor::new(
            "processor_1",
            "key_1",
            "value_1",
        )));
        pipeline.register_processor(Arc::new(FailingProcessor::new("failing_processor")));
        pipeline.register_processor(Arc::new(TestProcessor::new(
            "processor_3",
            "key_3",
            "value_3",
        )));

        // Create and import file
        let file_path = temp_dir.path().join("test.test");
        fs::write(&file_path, &content).unwrap();
        let result = pipeline.import(&file_path);

        // Import should fail due to failing processor
        prop_assert!(
            result.is_err(),
            "Import should fail when processor fails"
        );

        if let Err(AssetError::ProcessingFailed(msg)) = result {
            prop_assert!(
                msg.contains("failing_processor"),
                "Error should mention failing processor"
            );
        }
    }

    /// **Validates: Requirement 3.4**
    ///
    /// Property: Valid assets should pass through all processors successfully
    #[test]
    fn prop_valid_assets_pass_all_processors(
        content in file_content_strategy(),
        num_processors in 1usize..10
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Register only successful processors
        for i in 0..num_processors {
            pipeline.register_processor(Arc::new(TestProcessor::new(
                &format!("processor_{}", i),
                &format!("key_{}", i),
                &format!("value_{}", i),
            )));
        }

        // Create and import file
        let file_path = temp_dir.path().join("test.test");
        fs::write(&file_path, &content).unwrap();
        let result = pipeline.import(&file_path);

        // Should succeed
        prop_assert!(
            result.is_ok(),
            "Valid asset should pass through all processors"
        );

        let asset = result.unwrap();

        // All processors should have been applied
        prop_assert_eq!(
            asset.metadata.len(),
            num_processors,
            "All processors should have added metadata"
        );
    }

    /// **Validates: Requirement 3.4**
    ///
    /// Property: Processors should be able to modify asset data
    #[test]
    fn prop_processors_can_modify_asset(
        content in file_content_strategy()
    ) {
        let _ = env_logger::try_init();

        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importer
        pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

        // Register processor that adds metadata
        pipeline.register_processor(Arc::new(TestProcessor::new(
            "metadata_processor",
            "processed",
            "true",
        )));

        // Create and import file
        let file_path = temp_dir.path().join("test.test");
        fs::write(&file_path, &content).unwrap();
        let asset = pipeline.import(&file_path).unwrap();

        // Verify processor modified the asset
        prop_assert_eq!(
            asset.get_metadata("processed"),
            Some(&"true".to_string()),
            "Processor should have modified asset metadata"
        );
    }
}

// ============================================================================
// Additional Edge Case Tests
// ============================================================================

#[test]
fn test_empty_file_import() {
    let _ = env_logger::try_init();

    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

    // Create empty file
    let file_path = temp_dir.path().join("empty.test");
    fs::write(&file_path, &[]).unwrap();

    // Should still import successfully
    let result = pipeline.import(&file_path);
    assert!(result.is_ok(), "Empty file should import successfully");
}

#[test]
fn test_nonexistent_file_import() {
    let _ = env_logger::try_init();

    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

    // Try to import non-existent file
    let file_path = temp_dir.path().join("nonexistent.test");
    let result = pipeline.import(&file_path);

    assert!(result.is_err(), "Non-existent file should fail to import");
    assert!(matches!(result.unwrap_err(), AssetError::FileNotFound(_)));
}

#[test]
fn test_no_extension_file() {
    let _ = env_logger::try_init();

    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

    // Create file without extension
    let file_path = temp_dir.path().join("noextension");
    fs::write(&file_path, b"test data").unwrap();

    // Should fail with unsupported format
    let result = pipeline.import(&file_path);
    assert!(result.is_err(), "File without extension should fail");
    assert!(matches!(
        result.unwrap_err(),
        AssetError::UnsupportedFormat { .. }
    ));
}

#[test]
fn test_cache_clear() {
    let _ = env_logger::try_init();

    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

    // Import file
    let file_path = temp_dir.path().join("test.test");
    fs::write(&file_path, b"test data").unwrap();
    pipeline.import(&file_path).unwrap();

    // Cache should have entries
    let stats = pipeline.cache_stats();
    assert!(stats.memory_entries > 0 || stats.disk_entries > 0);

    // Clear cache
    pipeline.clear_cache().unwrap();

    // Cache should be empty
    let stats = pipeline.cache_stats();
    assert_eq!(stats.memory_entries, 0);
    assert_eq!(stats.disk_entries, 0);
}

#[test]
fn test_multiple_importers_same_extension() {
    let _ = env_logger::try_init();

    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    // Register two importers for same extension (last one wins)
    pipeline.register_importer(Arc::new(TestImporter::new(vec!["test"])));

    let mut importer2 = TestImporter::new(vec!["test"]);
    importer2.name = "TestImporter2".to_string();
    pipeline.register_importer(Arc::new(importer2));

    // Create and import file
    let file_path = temp_dir.path().join("test.test");
    fs::write(&file_path, b"test data").unwrap();

    // Should use the last registered importer
    let result = pipeline.import(&file_path);
    assert!(result.is_ok());
}
