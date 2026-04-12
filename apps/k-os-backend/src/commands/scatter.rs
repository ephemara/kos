//! Thin Tauri adapters for scatter commands.

pub use k_os_scatter::ScatterTransform;

#[tauri::command]
pub fn poisson_disk_scatter(
    count: usize,
    radius: f32,
    min_distance: f32,
    seed: u64,
) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::poisson_disk_scatter(count, radius, min_distance, seed)
}

#[tauri::command]
pub fn poisson_disk_surface(
    surface_points: Vec<[f32; 3]>,
    surface_normals: Vec<[f32; 3]>,
    count: usize,
    min_distance: f32,
    seed: u64,
) -> Result<Vec<ScatterTransform>, String> {
    k_os_scatter::poisson_disk_surface(surface_points, surface_normals, count, min_distance, seed)
}

#[tauri::command]
pub fn physics_drop_scatter(
    count: usize,
    spawn_height: f32,
    spawn_radius: f32,
    object_radius: f32,
    gravity: f32,
    iterations: usize,
    seed: u64,
) -> Result<Vec<ScatterTransform>, String> {
    k_os_scatter::physics_drop_scatter(
        count,
        spawn_height,
        spawn_radius,
        object_radius,
        gravity,
        iterations,
        seed,
    )
}

#[tauri::command]
pub fn voronoi_cell_scatter(count: usize, radius: f32, seed: u64) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::voronoi_cell_scatter(count, radius, seed)
}

#[tauri::command]
pub fn fibonacci_spiral_scatter(
    count: usize,
    radius: f32,
    height: f32,
) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::fibonacci_spiral_scatter(count, radius, height)
}

#[tauri::command]
pub fn sunflower_disk_scatter(count: usize, radius: f32) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::sunflower_disk_scatter(count, radius)
}

#[tauri::command]
pub fn halton_scatter(count: usize, radius: f32) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::halton_scatter(count, radius)
}

#[tauri::command]
pub fn cluster_scatter(
    count: usize,
    radius: f32,
    cluster_count: usize,
    cluster_tightness: f32,
    seed: u64,
) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::cluster_scatter(count, radius, cluster_count, cluster_tightness, seed)
}

#[tauri::command]
pub fn organic_scatter(
    count: usize,
    radius: f32,
    noise_scale: f32,
    density_threshold: f32,
    seed: u64,
) -> Result<Vec<[f32; 3]>, String> {
    k_os_scatter::organic_scatter(count, radius, noise_scale, density_threshold, seed)
}
