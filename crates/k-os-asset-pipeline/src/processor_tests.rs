//! Unit tests for asset processors

#[cfg(test)]
mod tests {
    use crate::asset::{Asset, AssetData, AssetType, MeshData, TextureData, TextureFormat};
    use crate::pipeline::{AssetPipeline, AssetProcessor};
    use crate::processors::{MetadataProcessor, ThumbnailProcessor, ValidationProcessor};
    use std::path::PathBuf;
    use std::sync::Arc;
    use tempfile::TempDir;

    fn create_test_mesh_asset() -> Asset {
        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: Some(vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0]),
            tangents: None,
            uvs: Some(vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0]),
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        };

        Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        )
    }

    fn create_test_texture_asset() -> Asset {
        let texture_data = TextureData {
            width: 4,
            height: 4,
            format: TextureFormat::Rgba8,
            data: vec![255; 64], // 4x4 RGBA
            mip_levels: 1,
        };

        Asset::new(
            "test_id".to_string(),
            AssetType::Texture,
            PathBuf::from("test.png"),
            AssetData::Texture(texture_data),
        )
    }

    #[test]
    fn test_validation_processor_valid_mesh() {
        let mut asset = create_test_mesh_asset();
        let processor = ValidationProcessor::new();

        let result = processor.process(&mut asset);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validation_processor_empty_positions() {
        let mesh_data = MeshData {
            positions: vec![], // Empty!
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: None,
            submeshes: vec![],
        };

        let mut asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let processor = ValidationProcessor::new();
        let result = processor.process(&mut asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_processor_mismatched_normals() {
        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: Some(vec![0.0, 0.0, 1.0]), // Only 1 normal for 3 vertices!
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        };

        let mut asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let processor = ValidationProcessor::new();
        let result = processor.process(&mut asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_processor_invalid_indices() {
        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some(vec![0, 1, 5]), // Index 5 out of bounds!
            submeshes: vec![(0, 3, None)],
        };

        let mut asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let processor = ValidationProcessor::new();
        let result = processor.process(&mut asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_validation_processor_valid_texture() {
        let mut asset = create_test_texture_asset();
        let processor = ValidationProcessor::new();

        let result = processor.process(&mut asset);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validation_processor_invalid_texture_data() {
        let texture_data = TextureData {
            width: 4,
            height: 4,
            format: TextureFormat::Rgba8,
            data: vec![255; 32], // Wrong size! Should be 64 bytes
            mip_levels: 1,
        };

        let mut asset = Asset::new(
            "test_id".to_string(),
            AssetType::Texture,
            PathBuf::from("test.png"),
            AssetData::Texture(texture_data),
        );

        let processor = ValidationProcessor::new();
        let result = processor.process(&mut asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_metadata_processor_mesh() {
        let mut asset = create_test_mesh_asset();
        let processor = MetadataProcessor::new();

        processor.process(&mut asset).unwrap();

        // Check that metadata was added
        assert!(asset.get_metadata("vertex_count").is_some());
        assert!(asset.get_metadata("triangle_count").is_some());
        assert!(asset.get_metadata("has_normals").is_some());
        assert!(asset.get_metadata("has_uvs").is_some());

        assert_eq!(asset.get_metadata("vertex_count").unwrap(), "3");
        assert_eq!(asset.get_metadata("triangle_count").unwrap(), "1");
        assert_eq!(asset.get_metadata("has_normals").unwrap(), "true");
        assert_eq!(asset.get_metadata("has_uvs").unwrap(), "true");
    }

    #[test]
    fn test_metadata_processor_texture() {
        let mut asset = create_test_texture_asset();
        let processor = MetadataProcessor::new();

        processor.process(&mut asset).unwrap();

        // Check that metadata was added
        assert!(asset.get_metadata("width").is_some());
        assert!(asset.get_metadata("height").is_some());
        assert!(asset.get_metadata("format").is_some());

        assert_eq!(asset.get_metadata("width").unwrap(), "4");
        assert_eq!(asset.get_metadata("height").unwrap(), "4");
    }

    #[test]
    fn test_thumbnail_processor_texture() {
        let temp_dir = TempDir::new().unwrap();
        let mut asset = create_test_texture_asset();

        let processor = ThumbnailProcessor::new(temp_dir.path().to_path_buf(), 256);
        processor.process(&mut asset).unwrap();

        // Check that thumbnail was generated
        assert!(asset.thumbnail.is_some());
        let thumbnail_path = asset.thumbnail.as_ref().unwrap();
        assert!(thumbnail_path.exists());
    }

    #[test]
    fn test_thumbnail_processor_mesh() {
        let temp_dir = TempDir::new().unwrap();
        let mut asset = create_test_mesh_asset();

        let processor = ThumbnailProcessor::new(temp_dir.path().to_path_buf(), 256);
        processor.process(&mut asset).unwrap();

        // Mesh thumbnails are generated (placeholder for now)
        assert!(asset.thumbnail.is_some());
    }

    #[test]
    fn test_processor_should_process() {
        let asset = create_test_mesh_asset();

        let validation_processor = ValidationProcessor::new();
        assert!(validation_processor.should_process(&asset));

        let metadata_processor = MetadataProcessor::new();
        assert!(metadata_processor.should_process(&asset));

        let temp_dir = TempDir::new().unwrap();
        let thumbnail_processor = ThumbnailProcessor::new(temp_dir.path().to_path_buf(), 256);
        assert!(thumbnail_processor.should_process(&asset));
    }

    #[test]
    fn test_multiple_processors_in_order() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();

        // Register processors in order
        pipeline.register_processor(Arc::new(ValidationProcessor::new()));
        pipeline.register_processor(Arc::new(MetadataProcessor::new()));
        pipeline.register_processor(Arc::new(ThumbnailProcessor::new(
            temp_dir.path().join("thumbnails"),
            256,
        )));

        let mut asset = create_test_mesh_asset();
        pipeline.process(&mut asset).unwrap();

        // All processors should have run
        assert!(asset.get_metadata("vertex_count").is_some());
        assert!(asset.thumbnail.is_some());
    }

    #[test]
    fn test_processor_chain_stops_on_error() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();

        // Register processors
        pipeline.register_processor(Arc::new(ValidationProcessor::new()));
        pipeline.register_processor(Arc::new(MetadataProcessor::new()));

        // Create invalid asset
        let mesh_data = MeshData {
            positions: vec![], // Empty - will fail validation
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: None,
            submeshes: vec![],
        };

        let mut asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let result = pipeline.process(&mut asset);
        assert!(result.is_err());

        // Metadata processor should not have run
        assert!(asset.get_metadata("vertex_count").is_none());
    }

    #[test]
    fn test_processor_names() {
        let validation = ValidationProcessor::new();
        assert_eq!(validation.name(), "ValidationProcessor");

        let metadata = MetadataProcessor::new();
        assert_eq!(metadata.name(), "MetadataProcessor");

        let temp_dir = TempDir::new().unwrap();
        let thumbnail = ThumbnailProcessor::new(temp_dir.path().to_path_buf(), 256);
        assert_eq!(thumbnail.name(), "ThumbnailProcessor");
    }

    #[test]
    fn test_validation_processor_non_triangular_indices() {
        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some(vec![0, 1]), // Not divisible by 3!
            submeshes: vec![(0, 2, None)],
        };

        let mut asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let processor = ValidationProcessor::new();
        let result = processor.process(&mut asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_metadata_processor_preserves_existing_metadata() {
        let mut asset = create_test_mesh_asset();
        asset.add_metadata("custom_key".to_string(), "custom_value".to_string());

        let processor = MetadataProcessor::new();
        processor.process(&mut asset).unwrap();

        // Custom metadata should still be there
        assert_eq!(asset.get_metadata("custom_key").unwrap(), "custom_value");
        // New metadata should be added
        assert!(asset.get_metadata("vertex_count").is_some());
    }
}
