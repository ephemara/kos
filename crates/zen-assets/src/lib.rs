use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenAssetCatalog {
    pub roots: Vec<ZenAssetRoot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenAssetRoot {
    pub key: String,
    pub path: String,
    pub tags: Vec<String>,
}

impl ZenAssetCatalog {
    pub fn parse(source: &str) -> Result<Self, String> {
        toml::from_str(source).map_err(|err| format!("Failed to parse Zen asset catalog: {err}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_asset_catalog() {
        let source = r#"
            [[roots]]
            key = "project"
            path = "Content"
            tags = ["source", "editable"]
        "#;
        let catalog = ZenAssetCatalog::parse(source).expect("asset catalog should parse");
        assert_eq!(catalog.roots.len(), 1);
        assert_eq!(catalog.roots[0].key, "project");
    }
}
