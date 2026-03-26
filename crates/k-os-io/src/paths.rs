use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy)]
pub enum KosDirectory {
    Projects,
    Brushes,
    Matcaps,
    Alphas,
    Materials,
    Meshes,
}

impl KosDirectory {
    fn folder_name(&self) -> &'static str {
        match self {
            KosDirectory::Projects => "KProjects",
            KosDirectory::Brushes => "KBrushes",
            KosDirectory::Matcaps => "KMatcaps",
            KosDirectory::Alphas => "KAlphas",
            KosDirectory::Materials => "KMaterials",
            KosDirectory::Meshes => "KMeshes",
        }
    }
}

pub fn get_bundled_dir(app: &AppHandle, dir: KosDirectory) -> Option<PathBuf> {
    app.path()
        .resolve(
            format!("resources/{}", dir.folder_name()),
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
}

pub fn get_user_dir(dir: KosDirectory) -> Option<PathBuf> {
    let documents = dirs::document_dir()?;
    let kos_dir = documents.join("K_OS").join(dir.folder_name());
    if !kos_dir.exists() {
        std::fs::create_dir_all(&kos_dir).ok()?;
    }
    Some(kos_dir)
}

pub fn get_user_root() -> Option<PathBuf> {
    let documents = dirs::document_dir()?;
    let kos_dir = documents.join("K_OS");
    if !kos_dir.exists() {
        std::fs::create_dir_all(&kos_dir).ok()?;
    }
    Some(kos_dir)
}

pub fn init_user_directories() -> Result<(), String> {
    let dirs = [
        KosDirectory::Projects,
        KosDirectory::Brushes,
        KosDirectory::Matcaps,
        KosDirectory::Alphas,
        KosDirectory::Materials,
        KosDirectory::Meshes,
    ];
    for dir in dirs {
        get_user_dir(dir).ok_or_else(|| format!("Failed to create {}", dir.folder_name()))?;
    }
    log::info!(
        "[KosPaths] User directories initialized at {:?}",
        get_user_root()
    );
    Ok(())
}

pub fn get_kos_user_root() -> Result<String, String> {
    get_user_root()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Failed to get Documents directory".to_string())
}

pub fn get_kos_user_dir(dir_type: String) -> Result<String, String> {
    let dir = match dir_type.to_lowercase().as_str() {
        "projects" => KosDirectory::Projects,
        "brushes" => KosDirectory::Brushes,
        "matcaps" => KosDirectory::Matcaps,
        "alphas" => KosDirectory::Alphas,
        "materials" => KosDirectory::Materials,
        "meshes" => KosDirectory::Meshes,
        _ => return Err(format!("Unknown directory type: {}", dir_type)),
    };
    get_user_dir(dir)
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Failed to create user directory".to_string())
}

pub fn list_kos_directory(
    app: AppHandle,
    dir_type: String,
    extension: Option<String>,
) -> Result<Vec<String>, String> {
    let dir = match dir_type.to_lowercase().as_str() {
        "projects" => KosDirectory::Projects,
        "brushes" => KosDirectory::Brushes,
        "matcaps" => KosDirectory::Matcaps,
        "alphas" => KosDirectory::Alphas,
        "materials" => KosDirectory::Materials,
        "meshes" => KosDirectory::Meshes,
        _ => return Err(format!("Unknown directory type: {}", dir_type)),
    };

    let mut files = Vec::new();
    if let Some(bundled_path) = get_bundled_dir(&app, dir) {
        if bundled_path.exists() {
            list_files_in_dir(&bundled_path, &extension, &mut files);
        }
    }
    if let Some(user_path) = get_user_dir(dir) {
        if user_path.exists() {
            list_files_in_dir(&user_path, &extension, &mut files);
        }
    }
    Ok(files)
}

pub fn read_file_base64(app: AppHandle, path: String) -> Result<String, String> {
    use base64::Engine;

    let requested = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    let mut allowed_roots: Vec<PathBuf> = Vec::new();
    if let Some(bundled) = get_bundled_dir(&app, KosDirectory::Matcaps) {
        if let Ok(canon) = bundled.canonicalize() {
            allowed_roots.push(canon);
        }
    }
    if let Some(user) = get_user_dir(KosDirectory::Matcaps) {
        if let Ok(canon) = user.canonicalize() {
            allowed_roots.push(canon);
        }
    }
    if !allowed_roots.iter().any(|root| requested.starts_with(root)) {
        return Err("Path not allowed".to_string());
    }

    let bytes = std::fs::read(&requested).map_err(|e| format!("Failed to read file: {}", e))?;
    let ext = requested
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn list_files_in_dir(path: &PathBuf, extension: &Option<String>, files: &mut Vec<String>) {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(ext_filter) = extension {
                    if let Some(ext) = entry_path.extension() {
                        if ext.to_string_lossy().to_lowercase() == ext_filter.to_lowercase() {
                            files.push(entry_path.to_string_lossy().to_string());
                        }
                    }
                } else {
                    files.push(entry_path.to_string_lossy().to_string());
                }
            }
        }
    }
}
