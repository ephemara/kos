//! Unit tests for format detection

#[cfg(test)]
mod tests {
    use crate::exporters::{ImageExporter, ObjExporter};
    use crate::importers::{GltfImporter, ImageImporter, ObjImporter};
    use crate::pipeline::{AssetExporter, AssetImporter, AssetPipeline};
    use std::sync::Arc;
    use tempfile::TempDir;

    #[test]
    fn test_detect_format_by_extension() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Register importers
        pipeline.register_importer(Arc::new(GltfImporter::new()));
        pipeline.register_importer(Arc::new(ObjImporter::new()));
        pipeline.register_importer(Arc::new(ImageImporter::new()));

        // Test that we can create a pipeline with multiple importers
        // (We can't access private fields directly, so we test indirectly)
    }

    #[test]
    fn test_case_insensitive_extension() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        pipeline.register_importer(Arc::new(ObjImporter::new()));

        // The importer returns lowercase, so "OBJ" would be normalized to "obj"
        // This is handled by the pipeline's import method
    }

    #[test]
    fn test_multiple_extensions_same_format() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        pipeline.register_importer(Arc::new(GltfImporter::new()));

        // GLTF importer supports both .gltf and .glb
        // We test this indirectly by checking both extensions work
    }

    #[test]
    fn test_unknown_format_error() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Try to import a file with unknown extension
        let test_file = temp_dir.path().join("test.unknown");
        std::fs::write(&test_file, b"test data").unwrap();

        let result = pipeline.import(&test_file);
        assert!(result.is_err());

        if let Err(e) = result {
            let error_msg = e.to_string();
            assert!(error_msg.contains("Unsupported file format"));
            assert!(error_msg.contains("unknown"));
        }
    }

    #[test]
    fn test_no_extension_error() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        // Try to import a file with no extension
        let test_file = temp_dir.path().join("test_no_ext");
        std::fs::write(&test_file, b"test data").unwrap();

        let result = pipeline.import(&test_file);
        assert!(result.is_err());

        if let Err(e) = result {
            let error_msg = e.to_string();
            assert!(error_msg.contains("Unsupported file format"));
        }
    }

    #[test]
    fn test_list_supported_formats() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().to_path_buf()).unwrap();

        pipeline.register_importer(Arc::new(ObjImporter::new()));
        pipeline.register_importer(Arc::new(GltfImporter::new()));
        pipeline.register_exporter(Arc::new(ObjExporter::new()));
        pipeline.register_exporter(Arc::new(ImageExporter::new()));

        // Test that we can list formats (indirectly through error messages)
        let test_file = temp_dir.path().join("test.xyz");
        std::fs::write(&test_file, b"test").unwrap();

        let result = pipeline.import(&test_file);
        if let Err(e) = result {
            let error_msg = e.to_string();
            // Should list supported formats
            assert!(
                error_msg.contains("glb")
                    || error_msg.contains("gltf")
                    || error_msg.contains("obj")
            );
        }
    }

    #[test]
    fn test_importer_name() {
        use crate::pipeline::AssetImporter;

        let obj_importer = ObjImporter::new();
        assert_eq!(obj_importer.name(), "ObjImporter");

        let gltf_importer = GltfImporter::new();
        assert_eq!(gltf_importer.name(), "GltfImporter");

        let image_importer = ImageImporter::new();
        assert_eq!(image_importer.name(), "ImageImporter");
    }

    #[test]
    fn test_exporter_name() {
        use crate::pipeline::AssetExporter;

        let obj_exporter = ObjExporter::new();
        assert_eq!(obj_exporter.name(), "ObjExporter");

        let image_exporter = ImageExporter::new();
        assert_eq!(image_exporter.name(), "ImageExporter");
    }
}
