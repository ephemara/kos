//! Configuration File Watcher
//!
//! Hot-reload support for configuration files during development.

use super::loader::{ConfigError, ConfigLoader};
use super::registry::GLOBAL_CONFIG;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver};
use std::time::Duration;

/// Configuration file watcher for hot-reload
pub struct ConfigWatcher {
    _watcher: Box<dyn Watcher + Send>,
    receiver: Receiver<Result<Event, notify::Error>>,
    loader: ConfigLoader,
}

impl ConfigWatcher {
    /// Create a new config watcher
    pub fn new(loader: ConfigLoader) -> Result<Self, ConfigError> {
        let (tx, rx) = channel();

        let mut watcher = notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        })
        .map_err(|e| ConfigError::IoError {
            path: PathBuf::new(),
            error: format!("Failed to create file watcher: {}", e),
        })?;

        // Watch user config directory
        let user_dir = loader.user_config_dir();
        if user_dir.exists() {
            watcher
                .watch(user_dir, RecursiveMode::NonRecursive)
                .map_err(|e| ConfigError::IoError {
                    path: user_dir.to_path_buf(),
                    error: format!("Failed to watch directory: {}", e),
                })?;
            log::info!("[ConfigWatcher] Watching user config: {:?}", user_dir);
        }

        // Watch project config directory if set
        if let Some(project_dir) = loader.project_config_dir() {
            if project_dir.exists() {
                watcher
                    .watch(project_dir, RecursiveMode::NonRecursive)
                    .map_err(|e| ConfigError::IoError {
                        path: project_dir.to_path_buf(),
                        error: format!("Failed to watch directory: {}", e),
                    })?;
                log::info!("[ConfigWatcher] Watching project config: {:?}", project_dir);
            }
        }

        Ok(Self {
            _watcher: Box::new(watcher),
            receiver: rx,
            loader,
        })
    }

    /// Process file system events (call this in a loop)
    pub fn process_events(&self, timeout: Duration) -> Result<bool, ConfigError> {
        match self.receiver.recv_timeout(timeout) {
            Ok(Ok(event)) => {
                if self.should_reload(&event) {
                    log::info!("[ConfigWatcher] Configuration file changed, reloading...");
                    self.reload_config()?;
                    return Ok(true);
                }
            }
            Ok(Err(e)) => {
                log::warn!("[ConfigWatcher] File watch error: {}", e);
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                // No events, this is normal
            }
            Err(e) => {
                log::error!("[ConfigWatcher] Channel error: {}", e);
            }
        }
        Ok(false)
    }

    /// Check if event should trigger reload
    fn should_reload(&self, event: &Event) -> bool {
        match event.kind {
            EventKind::Create(_) | EventKind::Modify(_) => {
                // Check if it's a JSON file
                event.paths.iter().any(|p| {
                    p.extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| ext == "json")
                        .unwrap_or(false)
                })
            }
            _ => false,
        }
    }

    /// Reload configuration
    fn reload_config(&self) -> Result<(), ConfigError> {
        let new_registry = self.loader.load()?;
        *GLOBAL_CONFIG.write() = new_registry;
        log::info!("[ConfigWatcher] Configuration reloaded successfully");
        Ok(())
    }
}

/// Start config watcher in background thread
pub fn start_config_watcher(loader: ConfigLoader) -> Result<(), ConfigError> {
    let watcher = ConfigWatcher::new(loader)?;

    std::thread::spawn(move || {
        log::info!("[ConfigWatcher] Background watcher started");
        loop {
            if let Err(e) = watcher.process_events(Duration::from_secs(1)) {
                log::error!("[ConfigWatcher] Error processing events: {}", e);
            }
        }
    });

    Ok(())
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

#[cfg_attr(
    all(not(target_arch = "wasm32"), feature = "tauri-commands"),
    tauri::command
)]
pub fn start_config_hot_reload(project_dir: Option<String>) -> Result<String, String> {
    let loader = if let Some(dir) = project_dir {
        ConfigLoader::new().with_project_dir(PathBuf::from(dir))
    } else {
        ConfigLoader::new()
    };

    start_config_watcher(loader)
        .map(|_| "Config hot-reload started".to_string())
        .map_err(|e| format!("Failed to start config watcher: {}", e))
}
