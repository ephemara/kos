use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_MODULE_REGISTRY: &str = include_str!("../../../apps/zen/resources/modules.toml");
const DEFAULT_ZEN_SHELL_SOURCE: &str = include_str!("../../../apps/zen/resources/zen_shell.kn");

#[derive(Clone, Debug)]
pub struct ZenKainModuleRegistry {
    source_label: String,
    default_shell: String,
    shells: Vec<ZenShellModule>,
}

#[derive(Clone, Debug)]
pub struct ZenShellModule {
    pub key: String,
    pub label: String,
    pub source_path: String,
    pub root_component: String,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct ZenResolvedShell {
    pub module_key: String,
    pub label: String,
    pub source: String,
    pub root_component: String,
    pub source_label: String,
    pub tags: Vec<String>,
}

impl ZenKainModuleRegistry {
    pub fn load(configured: &str) -> Result<Self, String> {
        for candidate in source_path_candidates(configured) {
            if candidate.exists() {
                let source = fs::read_to_string(&candidate).map_err(|err| {
                    format!(
                        "Failed to read Zen Kain module manifest '{}': {err}",
                        candidate.display()
                    )
                })?;
                return parse_registry(&source, candidate.display().to_string());
            }
        }

        parse_registry(
            DEFAULT_MODULE_REGISTRY,
            "embedded zen module registry".to_string(),
        )
    }

    pub fn default_shell(&self) -> &str {
        &self.default_shell
    }

    pub fn shells(&self) -> &[ZenShellModule] {
        &self.shells
    }

    pub fn summary(&self) -> String {
        format!(
            "{} shells // default {} // {}",
            self.shells.len(),
            self.default_shell,
            self.source_label
        )
    }

    pub fn resolve_shell(&self, key: Option<&str>) -> Result<ZenResolvedShell, String> {
        let selected_key = key
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(self.default_shell());
        let shell = self
            .shells
            .iter()
            .find(|entry| entry.key.eq_ignore_ascii_case(selected_key))
            .ok_or_else(|| format!("Unknown Zen shell module '{}'", selected_key))?;
        let source = load_shell_source(&shell.source_path)?;
        Ok(ZenResolvedShell {
            module_key: shell.key.clone(),
            label: shell.label.clone(),
            source,
            root_component: shell.root_component.clone(),
            source_label: shell.source_path.clone(),
            tags: shell.tags.clone(),
        })
    }
}

#[derive(Debug, Deserialize)]
struct ModuleRegistryFile {
    registry: ModuleRegistryMetaFile,
    shells: Vec<ZenShellModuleFile>,
}

#[derive(Debug, Deserialize)]
struct ModuleRegistryMetaFile {
    default_shell: String,
}

#[derive(Debug, Deserialize)]
struct ZenShellModuleFile {
    key: String,
    label: String,
    source_path: String,
    root_component: Option<String>,
    tags: Option<Vec<String>>,
}

fn parse_registry(source: &str, source_label: String) -> Result<ZenKainModuleRegistry, String> {
    let parsed: ModuleRegistryFile = toml::from_str(source)
        .map_err(|err| format!("Failed to parse Zen Kain module manifest: {err}"))?;
    let mut shells = Vec::new();
    for entry in parsed.shells {
        shells.push(ZenShellModule {
            key: normalized_non_empty("shell key", &entry.key)?,
            label: normalized_non_empty("shell label", &entry.label)?,
            source_path: normalized_non_empty("shell source path", &entry.source_path)?,
            root_component: entry
                .root_component
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("App")
                .to_string(),
            tags: entry.tags.unwrap_or_default(),
        });
    }
    if shells.is_empty() {
        return Err("Zen Kain module registry must declare at least one shell".to_string());
    }
    let default_shell = normalized_non_empty("default shell", &parsed.registry.default_shell)?;
    Ok(ZenKainModuleRegistry {
        source_label,
        default_shell,
        shells,
    })
}

fn load_shell_source(configured: &str) -> Result<String, String> {
    for candidate in source_path_candidates(configured) {
        if candidate.exists() {
            return fs::read_to_string(&candidate).map_err(|err| {
                format!(
                    "Failed to read Zen shell source '{}': {err}",
                    candidate.display()
                )
            });
        }
    }
    Ok(DEFAULT_ZEN_SHELL_SOURCE.to_string())
}

fn source_path_candidates(configured: &str) -> Vec<PathBuf> {
    let configured_path = PathBuf::from(configured);
    if configured_path.is_absolute() {
        return vec![configured_path];
    }

    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join(&configured_path));
            candidates.push(
                parent
                    .join("zen")
                    .join(file_name_or_original(&configured_path)),
            );
        }
    }
    candidates.push(k_os_kain::workspace_root().join(&configured_path));
    candidates
}

fn file_name_or_original(path: &Path) -> PathBuf {
    path.file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

fn normalized_non_empty(label: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(format!("Zen Kain module registry {label} cannot be empty"))
    } else {
        Ok(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_registry() {
        let registry = parse_registry(DEFAULT_MODULE_REGISTRY, "embedded".to_string())
            .expect("default module registry should parse");
        assert_eq!(registry.default_shell(), "zen.shell.main");
        assert_eq!(registry.shells().len(), 1);
        let shell = registry
            .resolve_shell(Some("zen.shell.main"))
            .expect("default shell should resolve");
        assert_eq!(shell.root_component, "App");
        assert!(shell.source.contains("viewport3d"));
    }
}
