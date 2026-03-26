//! Tests for import/export functionality

#[cfg(test)]
mod tests {
    use super::super::*;
    use std::path::Path;
    
    #[test]
    fn test_format_registry_loads() {
        let engine = ImportExportEngine::new().unwrap();
        assert!(engine.registry.formats.contains_key("gltf"));
        assert!(engine.registry.formats.contains_key("obj"));
        assert!(engine.registry.formats.contains_key("fbx"));
        assert!(engine.registry.formats.contains_key("usd"));
        assert!(engine.registry.formats.contains_key("pbr_material"));
        assert!(engine.registry.formats.contains_key("substance"));
    }
    
    #[test]
    fn test_format_detection_gltf() {
        let engine = ImportExportEngine::new().unwrap();
        let path = Path::new("model.gltf");
        let format = engine.detect_format(path, None).unwrap();
        assert_eq!(format, "gltf");
    }
    
    #[test]
    fn test_format_detection_obj() {
        let engine = ImportExportEngine::new().unwrap();
        let path = Path::new("mesh.obj");
        let format = engine.detect_format(path, None).unwrap();
        assert_eq!(format, "obj");
    }
    
    #[test]
    fn test_format_detection_fbx() {
        let engine = ImportExportEngine::new().unwrap();
        let path = Path::new("scene.fbx");
        let format = engine.detect_format(path, None).unwrap();
        assert_eq!(format, "fbx");
    }
    
    #[test]
    fn test_pbr_material_import() {
        let engine = ImportExportEngine::new().unwrap();
        
        let json = r#"{
            "name": "TestMaterial",
            "base_color": [1.0, 0.5, 0.0, 1.0],
            "metallic": 0.8,
            "roughness": 0.2
        }"#;
        
        let result = engine.import_pbr_material(json.as_bytes()).unwrap();
        assert_eq!(result.assets.len(), 1);
        assert_eq!(result.format, "pbr_material");
        
        if let AssetType::Material(mat) = &result.assets[0] {
            assert_eq!(mat.name, "TestMaterial");
            assert!(mat.parameters.contains_key("metallic"));
            assert!(mat.parameters.contains_key("roughness"));
            assert!(mat.parameters.contains_key("base_color"));
        } else {
            panic!("Expected material asset");
        }
    }
    
    #[test]
    fn test_registry_capabilities() {
        let engine = ImportExportEngine::new().unwrap();
        
        // Check glTF capabilities
        let gltf_spec = engine.registry.formats.get("gltf").unwrap();
        assert!(gltf_spec.capabilities.import);
        assert!(gltf_spec.capabilities.export);
        assert!(gltf_spec.capabilities.supports_meshes);
        assert!(gltf_spec.capabilities.supports_materials);
        
        // Check OBJ capabilities
        let obj_spec = engine.registry.formats.get("obj").unwrap();
        assert!(obj_spec.capabilities.import);
        assert!(obj_spec.capabilities.supports_meshes);
        
        // Check FBX capabilities
        let fbx_spec = engine.registry.formats.get("fbx").unwrap();
        assert!(fbx_spec.capabilities.import);
        assert!(fbx_spec.capabilities.supports_animations);
    }
}
