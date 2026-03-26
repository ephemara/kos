//! Unit tests for import/export functionality

#[cfg(test)]
mod tests {
    use crate::asset::{Asset, AssetData, AssetType, MeshData, TextureData, TextureFormat};
    use crate::exporters::{ImageExporter, ObjExporter};
    use crate::importers::{ImageImporter, ObjImporter};
    use crate::pipeline::{AssetExporter, AssetImporter};
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // Helper to create a simple test mesh
    fn create_test_mesh() -> MeshData {
        MeshData {
            positions: vec![
                0.0, 0.0, 0.0, // v0
                1.0, 0.0, 0.0, // v1
                0.0, 1.0, 0.0, // v2
            ],
            normals: Some(vec![
                0.0, 0.0, 1.0, // n0
                0.0, 0.0, 1.0, // n1
                0.0, 0.0, 1.0, // n2
            ]),
            tangents: None,
            uvs: Some(vec![
                0.0, 0.0, // uv0
                1.0, 0.0, // uv1
                0.0, 1.0, // uv2
            ]),
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        }
    }

    #[test]
    fn test_obj_import() {
        let temp_dir = TempDir::new().unwrap();
        let obj_path = temp_dir.path().join("test.obj");

        // Create a simple OBJ file
        let obj_content = r#"
# Test OBJ
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
vt 0.0 0.0
vt 1.0 0.0
vt 0.0 1.0
f 1/1/1 2/2/2 3/3/3
"#;
        fs::write(&obj_path, obj_content).unwrap();

        let importer = ObjImporter::new();
        let asset = importer.import(&obj_path).unwrap();

        assert_eq!(asset.asset_type, AssetType::Mesh);

        if let AssetData::Mesh(mesh) = &asset.data {
            assert_eq!(mesh.positions.len(), 9); // 3 vertices * 3 components
            assert!(mesh.normals.is_some());
            assert!(mesh.uvs.is_some());
            assert!(mesh.indices.is_some());
        } else {
            panic!("Expected mesh data");
        }
    }

    #[test]
    fn test_obj_export() {
        let temp_dir = TempDir::new().unwrap();
        let obj_path = temp_dir.path().join("export.obj");

        let mesh_data = create_test_mesh();
        let asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let exporter = ObjExporter::new();
        exporter.export(&asset, &obj_path).unwrap();

        // Verify file was created
        assert!(obj_path.exists());

        // Verify content
        let content = fs::read_to_string(&obj_path).unwrap();
        println!("OBJ content:\n{}", content); // Debug output
        assert!(content.contains("v "));
        assert!(content.contains("vn "));
        assert!(content.contains("vt "));
        assert!(content.contains("f "));
    }

    #[test]
    fn test_obj_round_trip() {
        let temp_dir = TempDir::new().unwrap();
        let obj_path = temp_dir.path().join("roundtrip.obj");

        // Create and export
        let mesh_data = create_test_mesh();
        let original_asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let exporter = ObjExporter::new();
        exporter.export(&original_asset, &obj_path).unwrap();

        // Import back
        let importer = ObjImporter::new();
        let imported_asset = importer.import(&obj_path).unwrap();

        // Verify data matches
        if let (AssetData::Mesh(original), AssetData::Mesh(imported)) =
            (&original_asset.data, &imported_asset.data)
        {
            assert_eq!(original.positions.len(), imported.positions.len());
            assert_eq!(original.normals.is_some(), imported.normals.is_some());
            assert_eq!(original.uvs.is_some(), imported.uvs.is_some());
        } else {
            panic!("Expected mesh data");
        }
    }

    #[test]
    fn test_image_import_png() {
        let temp_dir = TempDir::new().unwrap();
        let png_path = temp_dir.path().join("test.png");

        // Create a simple 2x2 red image
        let img = image::RgbaImage::from_fn(2, 2, |_, _| image::Rgba([255, 0, 0, 255]));
        img.save(&png_path).unwrap();

        let importer = ImageImporter::new();
        let asset = importer.import(&png_path).unwrap();

        assert_eq!(asset.asset_type, AssetType::Texture);

        if let AssetData::Texture(texture) = &asset.data {
            assert_eq!(texture.width, 2);
            assert_eq!(texture.height, 2);
            assert_eq!(texture.format, TextureFormat::Rgba8);
        } else {
            panic!("Expected texture data");
        }
    }

    #[test]
    fn test_image_export_png() {
        let temp_dir = TempDir::new().unwrap();
        let png_path = temp_dir.path().join("export.png");

        // Create test texture
        let texture_data = TextureData {
            width: 2,
            height: 2,
            format: TextureFormat::Rgba8,
            data: vec![
                255, 0, 0, 255, // Red pixel
                0, 255, 0, 255, // Green pixel
                0, 0, 255, 255, // Blue pixel
                255, 255, 255, 255, // White pixel
            ],
            mip_levels: 1,
        };

        let asset = Asset::new(
            "test_id".to_string(),
            AssetType::Texture,
            PathBuf::from("test.png"),
            AssetData::Texture(texture_data),
        );

        let exporter = ImageExporter::new();
        exporter.export(&asset, &png_path).unwrap();

        // Verify file was created
        assert!(png_path.exists());

        // Verify we can load it back
        let img = image::open(&png_path).unwrap();
        assert_eq!(img.width(), 2);
        assert_eq!(img.height(), 2);
    }

    #[test]
    fn test_image_round_trip() {
        let temp_dir = TempDir::new().unwrap();
        let png_path = temp_dir.path().join("roundtrip.png");

        // Create original image
        let img = image::RgbaImage::from_fn(4, 4, |x, y| {
            image::Rgba([(x * 64) as u8, (y * 64) as u8, 128, 255])
        });
        img.save(&png_path).unwrap();

        // Import
        let importer = ImageImporter::new();
        let imported = importer.import(&png_path).unwrap();

        // Export to new file
        let export_path = temp_dir.path().join("exported.png");
        let exporter = ImageExporter::new();
        exporter.export(&imported, &export_path).unwrap();

        // Import again and compare
        let reimported = importer.import(&export_path).unwrap();

        if let (AssetData::Texture(original), AssetData::Texture(final_tex)) =
            (&imported.data, &reimported.data)
        {
            assert_eq!(original.width, final_tex.width);
            assert_eq!(original.height, final_tex.height);
            assert_eq!(original.format, final_tex.format);
        } else {
            panic!("Expected texture data");
        }
    }

    #[test]
    fn test_obj_export_without_normals() {
        let temp_dir = TempDir::new().unwrap();
        let obj_path = temp_dir.path().join("no_normals.obj");

        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        };

        let asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let exporter = ObjExporter::new();
        exporter.export(&asset, &obj_path).unwrap();

        let content = fs::read_to_string(&obj_path).unwrap();
        println!("OBJ content (no normals):\n{}", content); // Debug output
        assert!(content.contains("v "));
        assert!(!content.contains("vn")); // No normals
        assert!(!content.contains("vt")); // No UVs
        assert!(content.contains("f "));
    }

    #[test]
    fn test_obj_export_with_uvs_only() {
        let temp_dir = TempDir::new().unwrap();
        let obj_path = temp_dir.path().join("uvs_only.obj");

        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            normals: None,
            tangents: None,
            uvs: Some(vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0]),
            colors: None,
            indices: Some(vec![0, 1, 2]),
            submeshes: vec![(0, 3, None)],
        };

        let asset = Asset::new(
            "test_id".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        let exporter = ObjExporter::new();
        exporter.export(&asset, &obj_path).unwrap();

        let content = fs::read_to_string(&obj_path).unwrap();
        println!("OBJ content (UVs only):\n{}", content); // Debug output
        assert!(content.contains("vt "));
        assert!(!content.contains("vn"));
        assert!(content.contains("f "));
    }

    #[test]
    fn test_import_nonexistent_file() {
        let importer = ObjImporter::new();
        let result = importer.import(&PathBuf::from("nonexistent.obj"));
        assert!(result.is_err());
    }

    #[test]
    fn test_export_invalid_asset_type() {
        let temp_dir = TempDir::new().unwrap();
        let obj_path = temp_dir.path().join("invalid.obj");

        // Try to export a texture as OBJ
        let texture_data = TextureData {
            width: 2,
            height: 2,
            format: TextureFormat::Rgba8,
            data: vec![255; 16],
            mip_levels: 1,
        };

        let asset = Asset::new(
            "test_id".to_string(),
            AssetType::Texture,
            PathBuf::from("test.png"),
            AssetData::Texture(texture_data),
        );

        let exporter = ObjExporter::new();
        let result = exporter.export(&asset, &obj_path);
        assert!(result.is_err());
    }
}
