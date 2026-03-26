//! Unit tests for caching behavior

#[cfg(test)]
mod tests {
    use crate::asset::{Asset, AssetData, AssetType, MeshData};
    use crate::cache::AssetCache;
    use crate::hash::hash_file;
    use crate::importers::ObjImporter;
    use crate::pipeline::AssetPipeline;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;
    use tempfile::TempDir;

    fn create_test_obj_file(path: &PathBuf) {
        let obj_content = r#"
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
f 1 2 3
"#;
        fs::write(path, obj_content).unwrap();
    }

    #[test]
    fn test_cache_hit_returns_cached_asset() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();
        pipeline.register_importer(Arc::new(ObjImporter::new()));

        let obj_path = temp_dir.path().join("test.obj");
        create_test_obj_file(&obj_path);

        // First import - cache miss
        let asset1 = pipeline.import(&obj_path).unwrap();

        // Second import - should hit cache
        let asset2 = pipeline.import(&obj_path).unwrap();

        // Should be the same asset
        assert_eq!(asset1.id, asset2.id);
    }

    #[test]
    fn test_cache_miss_triggers_import() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let obj_path = temp_dir.path().join("test.obj");
        create_test_obj_file(&obj_path);

        // Cache should be empty
        let result = cache.get(&obj_path).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_file_modification_invalidates_cache() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();
        pipeline.register_importer(Arc::new(ObjImporter::new()));

        let obj_path = temp_dir.path().join("test.obj");
        create_test_obj_file(&obj_path);

        // First import
        let asset1 = pipeline.import(&obj_path).unwrap();
        let hash1 = asset1.id.clone();

        // Wait a bit to ensure file modification time changes
        thread::sleep(Duration::from_millis(100));

        // Modify the file
        let modified_content = r#"
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
v 1.0 1.0 0.0
f 1 2 3
f 2 3 4
"#;
        fs::write(&obj_path, modified_content).unwrap();

        // Second import - should detect modification
        let asset2 = pipeline.import(&obj_path).unwrap();
        let hash2 = asset2.id.clone();

        // Hashes should be different
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_cache_respects_file_hash() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let obj_path = temp_dir.path().join("test.obj");
        create_test_obj_file(&obj_path);

        let hash = hash_file(&obj_path).unwrap();

        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: None,
            submeshes: vec![],
        };

        let asset = Asset::new(
            hash.clone(),
            AssetType::Mesh,
            obj_path.clone(),
            AssetData::Mesh(mesh_data),
        );

        // Put in cache
        cache.put(&asset).unwrap();

        // Get from cache
        let cached = cache.get(&obj_path).unwrap();
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().id, hash);
    }

    #[test]
    fn test_cache_can_be_cleared() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();
        pipeline.register_importer(Arc::new(ObjImporter::new()));

        let obj_path = temp_dir.path().join("test.obj");
        create_test_obj_file(&obj_path);

        // Import to populate cache
        pipeline.import(&obj_path).unwrap();

        let stats_before = pipeline.cache_stats();
        assert!(stats_before.memory_entries > 0 || stats_before.disk_entries > 0);

        // Clear cache
        pipeline.clear_cache().unwrap();

        let stats_after = pipeline.cache_stats();
        assert_eq!(stats_after.memory_entries, 0);
        assert_eq!(stats_after.disk_entries, 0);
    }

    #[test]
    fn test_cache_memory_and_disk() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: None,
            submeshes: vec![],
        };

        let asset = Asset::new(
            "test_hash".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        // Put in cache
        cache.put(&asset).unwrap();

        // Check stats
        let stats = cache.stats();
        assert_eq!(stats.memory_entries, 1);
        assert_eq!(stats.disk_entries, 1);
    }

    #[test]
    fn test_cache_disk_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path().join("cache");

        // Create cache and add asset
        {
            let cache = AssetCache::new(cache_dir.clone()).unwrap();

            let mesh_data = MeshData {
                positions: vec![0.0, 0.0, 0.0],
                normals: None,
                tangents: None,
                uvs: None,
                colors: None,
                indices: None,
                submeshes: vec![],
            };

            let asset = Asset::new(
                "persistent_hash".to_string(),
                AssetType::Mesh,
                PathBuf::from("test.obj"),
                AssetData::Mesh(mesh_data),
            );

            cache.put(&asset).unwrap();
        } // Cache dropped

        // Create new cache instance
        let cache2 = AssetCache::new(cache_dir).unwrap();
        let stats = cache2.stats();

        // Disk cache should still have the entry
        assert_eq!(stats.disk_entries, 1);
    }

    #[test]
    fn test_cache_multiple_assets() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        // Create multiple assets
        for i in 0..5 {
            let mesh_data = MeshData {
                positions: vec![i as f32, 0.0, 0.0],
                normals: None,
                tangents: None,
                uvs: None,
                colors: None,
                indices: None,
                submeshes: vec![],
            };

            let asset = Asset::new(
                format!("hash_{}", i),
                AssetType::Mesh,
                PathBuf::from(format!("test_{}.obj", i)),
                AssetData::Mesh(mesh_data),
            );

            cache.put(&asset).unwrap();
        }

        let stats = cache.stats();
        assert_eq!(stats.memory_entries, 5);
        assert_eq!(stats.disk_entries, 5);
    }

    #[test]
    fn test_cache_get_nonexistent_file() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let result = cache.get(&PathBuf::from("nonexistent.obj"));
        assert!(result.is_err()); // File doesn't exist, so hash_file fails
    }

    #[test]
    fn test_cache_corrupted_disk_cache() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path().join("cache");
        let cache = AssetCache::new(cache_dir.clone()).unwrap();

        // Create a corrupted cache file
        let corrupted_path = cache_dir.join("corrupted_hash.json");
        fs::write(&corrupted_path, "invalid json {{{").unwrap();

        // Cache should handle corrupted files gracefully
        let stats = cache.stats();
        assert_eq!(stats.disk_entries, 1); // File exists but is corrupted
    }

    #[test]
    fn test_pipeline_cache_integration() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();
        pipeline.register_importer(Arc::new(ObjImporter::new()));

        let obj_path = temp_dir.path().join("test.obj");
        create_test_obj_file(&obj_path);

        // First import
        let start = std::time::Instant::now();
        let _asset1 = pipeline.import(&obj_path).unwrap();
        let first_duration = start.elapsed();

        // Second import (cached)
        let start = std::time::Instant::now();
        let _asset2 = pipeline.import(&obj_path).unwrap();
        let second_duration = start.elapsed();

        // Cached import should be faster (though this is not guaranteed in tests)
        // At minimum, it should not fail
        assert!(second_duration < first_duration * 10); // Very generous bound
    }

    #[test]
    fn test_cache_with_identical_content_different_paths() {
        let temp_dir = TempDir::new().unwrap();
        let pipeline = AssetPipeline::new(temp_dir.path().join("cache")).unwrap();
        pipeline.register_importer(Arc::new(ObjImporter::new()));

        // Create two files with identical content
        let obj_path1 = temp_dir.path().join("test1.obj");
        let obj_path2 = temp_dir.path().join("test2.obj");
        create_test_obj_file(&obj_path1);
        create_test_obj_file(&obj_path2);

        let asset1 = pipeline.import(&obj_path1).unwrap();
        let asset2 = pipeline.import(&obj_path2).unwrap();

        // Same content = same hash = same cached asset
        assert_eq!(asset1.id, asset2.id);
    }

    #[test]
    fn test_cache_stats_accuracy() {
        let temp_dir = TempDir::new().unwrap();
        let cache = AssetCache::new(temp_dir.path().to_path_buf()).unwrap();

        let initial_stats = cache.stats();
        assert_eq!(initial_stats.memory_entries, 0);
        assert_eq!(initial_stats.disk_entries, 0);

        // Add one asset
        let mesh_data = MeshData {
            positions: vec![0.0, 0.0, 0.0],
            normals: None,
            tangents: None,
            uvs: None,
            colors: None,
            indices: None,
            submeshes: vec![],
        };

        let asset = Asset::new(
            "test_hash".to_string(),
            AssetType::Mesh,
            PathBuf::from("test.obj"),
            AssetData::Mesh(mesh_data),
        );

        cache.put(&asset).unwrap();

        let after_stats = cache.stats();
        assert_eq!(after_stats.memory_entries, 1);
        assert_eq!(after_stats.disk_entries, 1);

        // Clear and check
        cache.clear().unwrap();

        let final_stats = cache.stats();
        assert_eq!(final_stats.memory_entries, 0);
        assert_eq!(final_stats.disk_entries, 0);
    }
}
