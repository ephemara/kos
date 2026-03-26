// Material Parser and Serializer
// JSON serialization with round-trip fidelity

use std::fs;
use std::path::Path;

use super::Material;

/// Load a material from a JSON file
pub fn load_material(path: &Path) -> anyhow::Result<Material> {
    let json = fs::read_to_string(path)
        .map_err(|e| anyhow::anyhow!("Failed to read material file: {}", e))?;

    let material: Material = serde_json::from_str(&json).map_err(|e| {
        anyhow::anyhow!(
            "Failed to parse material JSON at {}:{}: {}",
            e.line(),
            e.column(),
            e
        )
    })?;

    Ok(material)
}

/// Save a material to a JSON file (pretty-printed)
pub fn save_material(material: &Material, path: &Path) -> anyhow::Result<()> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| anyhow::anyhow!("Failed to create directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(material)
        .map_err(|e| anyhow::anyhow!("Failed to serialize material: {}", e))?;

    fs::write(path, json).map_err(|e| anyhow::anyhow!("Failed to write material file: {}", e))?;

    Ok(())
}

/// Save a material to a JSON file (compact)
pub fn save_material_compact(material: &Material, path: &Path) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| anyhow::anyhow!("Failed to create directory: {}", e))?;
    }

    let json = serde_json::to_string(material)
        .map_err(|e| anyhow::anyhow!("Failed to serialize material: {}", e))?;

    fs::write(path, json).map_err(|e| anyhow::anyhow!("Failed to write material file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::material::{MaterialCategory, MaterialMetadata};
    use chrono::Utc;
    use tempfile::tempdir;
    use uuid::Uuid;

    #[test]
    fn test_save_and_load_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test_material.json");

        let original = Material {
            id: Uuid::new_v4(),
            metadata: MaterialMetadata {
                name: "Test Material".to_string(),
                description: "A test material".to_string(),
                tags: vec!["test".to_string()],
                author: "Tester".to_string(),
                created_at: Utc::now(),
                modified_at: Utc::now(),
                version: 1,
                category: MaterialCategory::Metal,
            },
            layers: vec![],
            animation: None,
            variants: vec![],
            base_material: None,
        };

        // Save
        save_material(&original, &path).unwrap();

        // Load
        let loaded = load_material(&path).unwrap();

        // Verify
        assert_eq!(original.id, loaded.id);
        assert_eq!(original.metadata.name, loaded.metadata.name);
        assert_eq!(original.metadata.category, loaded.metadata.category);
    }
}
