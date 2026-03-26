//! Thin Tauri adapters for math and sparse linear algebra commands.

pub use k_os_eval::linalg::{BenchmarkResult, CgResult, MultiplyResult, SparseTriplet};

#[tauri::command]
pub fn solve_cg(
    triplets: Vec<SparseTriplet>,
    b: Vec<f64>,
    n_rows: Option<usize>,
    n_cols: Option<usize>,
    tol: Option<f64>,
    max_iter: Option<usize>,
) -> Result<CgResult, String> {
    k_os_eval::linalg::solve_cg(triplets, b, n_rows, n_cols, tol, max_iter)
}

#[tauri::command]
pub fn sparse_multiply(
    triplets: Vec<SparseTriplet>,
    x: Vec<f64>,
    n_rows: Option<usize>,
    n_cols: Option<usize>,
) -> Result<MultiplyResult, String> {
    k_os_eval::linalg::sparse_multiply(triplets, x, n_rows, n_cols)
}

#[tauri::command]
pub fn benchmark_cg(size: usize, max_iter: Option<usize>) -> Result<BenchmarkResult, String> {
    k_os_eval::linalg::benchmark_cg(size, max_iter)
}
