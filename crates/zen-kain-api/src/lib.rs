use serde::Serialize;
use zen_host::ZenHostApi;
use zen_kain_modules::ZenKainModuleRegistry;

#[derive(Debug, Clone, Serialize)]
pub struct ZenKainContract {
    pub host_summary: String,
    pub module_summary: String,
    pub actions: Vec<ZenKainActionContract>,
    pub bindings: Vec<ZenKainBindingContract>,
    pub shells: Vec<ZenKainShellContract>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZenKainActionContract {
    pub key: String,
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZenKainBindingContract {
    pub key: String,
    pub label: String,
    pub widget: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZenKainShellContract {
    pub key: String,
    pub label: String,
    pub source_path: String,
    pub root_component: String,
    pub tags: Vec<String>,
}

impl ZenKainContract {
    pub fn from_host_and_modules(host: &ZenHostApi, modules: &ZenKainModuleRegistry) -> Self {
        Self {
            host_summary: host.summary(),
            module_summary: modules.summary(),
            actions: host
                .actions()
                .iter()
                .map(|action| ZenKainActionContract {
                    key: action.key.clone(),
                    label: action.label.clone(),
                    description: action.description.clone(),
                })
                .collect(),
            bindings: host
                .bindings()
                .iter()
                .map(|binding| ZenKainBindingContract {
                    key: binding.key.clone(),
                    label: binding.label.clone(),
                    widget: binding.widget.clone(),
                    description: binding.description.clone(),
                })
                .collect(),
            shells: modules
                .shells()
                .iter()
                .map(|shell| ZenKainShellContract {
                    key: shell.key.clone(),
                    label: shell.label.clone(),
                    source_path: shell.source_path.clone(),
                    root_component: shell.root_component.clone(),
                    tags: shell.tags.clone(),
                })
                .collect(),
        }
    }

    pub fn emit_toml(&self) -> Result<String, String> {
        toml::to_string_pretty(self)
            .map_err(|err| format!("Failed to serialize Zen Kain contract: {err}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_contract_toml() {
        let host = ZenHostApi::load("crates/zen/resources/host_api.toml")
            .expect("host api should load from workspace");
        let modules = ZenKainModuleRegistry::load("crates/zen/resources/modules.toml")
            .expect("module registry should load from workspace");
        let contract = ZenKainContract::from_host_and_modules(&host, &modules);
        let toml = contract.emit_toml().expect("contract should serialize");
        assert!(toml.contains("scene.spawn_box"));
        assert!(toml.contains("zen.shell.main"));
    }
}
