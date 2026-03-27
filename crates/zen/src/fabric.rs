use crate::config::KainFabricConfig;
use kain_host::fabric::execute_fabric_manifest_path;
use kain_omni::fabric::FabricExecutionResult;
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) struct ZenFabricService {
    config: KainFabricConfig,
    resolved_manifest_path: Option<PathBuf>,
    status_summary: String,
    last_error: Option<String>,
    last_result: Option<FabricExecutionResult>,
    recent_events: Vec<String>,
}

impl ZenFabricService {
    pub(crate) fn new(config: KainFabricConfig) -> Self {
        let mut service = Self {
            config,
            resolved_manifest_path: None,
            status_summary: String::new(),
            last_error: None,
            last_result: None,
            recent_events: Vec::new(),
        };
        service.refresh_status();
        service
    }

    pub(crate) fn enabled(&self) -> bool {
        self.config.enabled
    }

    pub(crate) fn configured_manifest_path(&self) -> &str {
        &self.config.manifest_path
    }

    pub(crate) fn resolved_manifest_path(&self) -> Option<&Path> {
        self.resolved_manifest_path.as_deref()
    }

    pub(crate) fn status_summary(&self) -> &str {
        &self.status_summary
    }

    pub(crate) fn last_error(&self) -> Option<&str> {
        self.last_error.as_deref()
    }

    pub(crate) fn last_result(&self) -> Option<&FabricExecutionResult> {
        self.last_result.as_ref()
    }

    pub(crate) fn recent_events(&self) -> &[String] {
        &self.recent_events
    }

    pub(crate) fn refresh_status(&mut self) {
        self.resolved_manifest_path = resolve_source_path(&self.config.manifest_path);
        self.status_summary = self.compute_status_summary();
        self.recent_events = self
            .last_result
            .as_ref()
            .map(|result| load_recent_events(result.events_path.as_deref()))
            .unwrap_or_default();
    }

    pub(crate) fn run_configured_manifest(&mut self) -> Result<&FabricExecutionResult, String> {
        if !self.config.enabled {
            let error = "Fabric is disabled in the Zen runtime config".to_string();
            self.last_error = Some(error.clone());
            self.status_summary = format!("fabric disabled // {}", self.config.manifest_path);
            return Err(error);
        }

        let manifest_path = self
            .resolved_manifest_path
            .clone()
            .ok_or_else(|| format!("Fabric manifest path is unresolved: {}", self.config.manifest_path))?;

        if !manifest_path.exists() {
            let error = format!("Fabric manifest missing: {}", manifest_path.display());
            self.last_error = Some(error.clone());
            self.status_summary = format!("fabric manifest missing // {}", manifest_path.display());
            return Err(error);
        }

        match execute_fabric_manifest_path(&manifest_path) {
            Ok(result) => {
                self.recent_events = load_recent_events(result.events_path.as_deref());
                self.last_error = None;
                self.status_summary = format!(
                    "fabric {:?} // {} steps // {}",
                    result.status,
                    result.step_results.len(),
                    result.session_id
                );
                self.last_result = Some(result);
                Ok(self.last_result.as_ref().expect("fabric result just stored"))
            }
            Err(err) => {
                let error = format!("Fabric execution failed: {err}");
                self.last_error = Some(error.clone());
                self.status_summary = format!("fabric failed // {}", manifest_path.display());
                Err(error)
            }
        }
    }

    fn compute_status_summary(&self) -> String {
        if !self.config.enabled {
            return format!("fabric disabled // {}", self.config.manifest_path);
        }

        match &self.resolved_manifest_path {
            Some(path) if path.exists() => format!("fabric ready // {}", path.display()),
            Some(path) => format!("fabric manifest missing // {}", path.display()),
            None => format!("fabric unresolved // {}", self.config.manifest_path),
        }
    }
}

fn resolve_source_path(configured: &str) -> Option<PathBuf> {
    let configured_path = PathBuf::from(configured);
    if configured_path.is_absolute() {
        return Some(configured_path);
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

    let fallback = candidates.last().cloned();
    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .or(fallback)
}

fn file_name_or_original(path: &Path) -> PathBuf {
    path.file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

fn load_recent_events(path: Option<&Path>) -> Vec<String> {
    let Some(path) = path else {
        return Vec::new();
    };
    let Ok(source) = fs::read_to_string(path) else {
        return vec![format!("unable to read events // {}", path.display())];
    };

    let mut lines = source
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect::<Vec<_>>();
    if lines.len() > 12 {
        lines.drain(0..lines.len().saturating_sub(12));
    }
    lines
}
