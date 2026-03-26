//! Integration tests for asset pipeline

use k_os_asset_pipeline::{
    exporters::{ImageExporter, ObjExporter},
    importers::{GltfImporter, ImageImporter, ObjImporter},
    pipeline::AssetProcessor,
    processors::{MetadataProcessor, ValidationProcessor},
    AssetPipeline, AssetType,
};
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::TempDir;

#[test]
fn test_pipeline_creation() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf());
    assert!(pipeline.is_ok());
}

#[test]
fn test_register_importers() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(GltfImporter::new()));
    pipeline.register_importer(Arc::new(ObjImporter::new()));
    pipeline.register_importer(Arc::new(ImageImporter::new()));

    // Pipeline should be created successfully
    // Actual registration is tested by trying to import files
}

#[test]
fn test_register_exporters() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_exporter(Arc::new(ObjExporter::new()));
    pipeline.register_exporter(Arc::new(ImageExporter::new()));

    // Pipeline should be created successfully
    // Actual registration is tested by trying to export files
}

#[test]
fn test_register_processors() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_processor(Arc::new(ValidationProcessor::new()));
    pipeline.register_processor(Arc::new(MetadataProcessor::new()));

    // Pipeline should be created successfully
    // Actual registration is tested by processing assets
}

#[test]
fn test_cache_stats() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    let stats = pipeline.cache_stats();
    assert_eq!(stats.memory_entries, 0);
}

#[test]
fn test_unsupported_format_error() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(ObjImporter::new()));

    // Try to import unsupported format
    let result = pipeline.import(&PathBuf::from("test.unsupported"));
    assert!(result.is_err());
}

#[test]
fn test_file_not_found_error() {
    let temp_dir = TempDir::new().unwrap();
    let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

    pipeline.register_importer(Arc::new(ObjImporter::new()));

    // Try to import non-existent file
    let result = pipeline.import(&PathBuf::from("nonexistent.obj"));
    assert!(result.is_err());
}

#[test]
fn test_metadata_processor() {
    use k_os_asset_pipeline::asset::{Asset, AssetData, MeshData};

    let mut asset = Asset::new(
        "test_id".to_string(),
        AssetType::Mesh,
        PathBuf::from("test.obj"),
        AssetData::Mesh(MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: Some(vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0]),
            tangents: None,
            uvs: Some(vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0]),
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        }),
    );

    let processor = MetadataProcessor::new();
    processor.process(&mut asset).unwrap();

    assert_eq!(asset.get_metadata("vertex_count"), Some(&"3".to_string()));
    assert_eq!(asset.get_metadata("triangle_count"), Some(&"1".to_string()));
    assert_eq!(asset.get_metadata("has_normals"), Some(&"true".to_string()));
    assert_eq!(asset.get_metadata("has_uvs"), Some(&"true".to_string()));
}

#[test]
fn test_validation_processor() {
    use k_os_asset_pipeline::asset::{Asset, AssetData, MeshData};

    let mut asset = Asset::new(
        "test_id".to_string(),
        AssetType::Mesh,
        PathBuf::from("test.obj"),
        AssetData::Mesh(MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        }),
    );

    let processor = ValidationProcessor::new();
    let result = processor.process(&mut asset);
    assert!(result.is_ok());
}

#[test]
fn test_validation_processor_invalid_mesh() {
    use k_os_asset_pipeline::asset::{Asset, AssetData, MeshData};

    let mut asset = Asset::new(
        "test_id".to_string(),
        AssetType::Mesh,
        PathBuf::from("test.obj"),
        AssetData::Mesh(MeshData {
            positions: vec![0.0, 0.0], // Invalid: not multiple of 3
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: None,
            submeshes: vec![],
        }),
    );

    let processor = ValidationProcessor::new();
    let result = processor.process(&mut asset);
    assert!(result.is_err());
}
