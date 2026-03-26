//! Test utilities for storage module

#[cfg(test)]
mod storage_tests {
    use super::super::*;

    #[test]
    fn test_asset_handle_generation() {
        let handle1 = AssetHandle::new();
        let handle2 = AssetHandle::new();
        assert_ne!(handle1, handle2);
    }

    #[test]
    fn test_asset_type_detection() {
        let mesh = Asset::Mesh(MeshAsset {
            positions: vec![0.0, 0.0, 0.0],
            indices: vec![0],
            normals: None,
            uvs: None,
            tangents: None,
            colors: None,
        });
        assert_eq!(mesh.asset_type(), AssetType::Mesh);
    }

    // More tests will be added as implementation progresses
}
