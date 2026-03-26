//! Thin Tauri adapters for K_OS IO path commands.

use tauri::AppHandle;

#[tauri::command]
pub fn get_kos_user_root() -> Result<String, String> {
    k_os_io::paths::get_kos_user_root()
}

#[tauri::command]
pub fn get_kos_user_dir(dir_type: String) -> Result<String, String> {
    k_os_io::paths::get_kos_user_dir(dir_type)
}

#[tauri::command]
pub fn list_kos_directory(
    app: AppHandle,
    dir_type: String,
    extension: Option<String>,
) -> Result<Vec<String>, String> {
    k_os_io::paths::list_kos_directory(app, dir_type, extension)
}

#[tauri::command]
pub fn read_file_base64(app: AppHandle, path: String) -> Result<String, String> {
    k_os_io::paths::read_file_base64(app, path)
}
