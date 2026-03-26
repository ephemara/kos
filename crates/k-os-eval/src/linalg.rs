//! Linear algebra ownership surface for evaluation and solver utilities.

use nalgebra::DVector;
use nalgebra_sparse::csr::CsrMatrix;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SparseTriplet {
    pub i: usize,
    pub j: usize,
    pub v: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CgResult {
    pub x: Vec<f64>,
    pub iter: usize,
    pub error: f64,
    pub time_ms: f64,
    pub converged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiplyResult {
    pub y: Vec<f64>,
    pub time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub rust_time_ms: f64,
    pub iterations: usize,
    pub error: f64,
    pub matrix_size: usize,
    pub nnz: usize,
}

fn build_csr_matrix(triplets: &[SparseTriplet], n_rows: usize, n_cols: usize) -> CsrMatrix<f64> {
    let mut sorted: Vec<(usize, usize, f64)> = triplets.iter().map(|t| (t.i, t.j, t.v)).collect();
    sorted.sort_by(|a, b| {
        if a.0 != b.0 {
            a.0.cmp(&b.0)
        } else {
            a.1.cmp(&b.1)
        }
    });

    let mut consolidated: Vec<(usize, usize, f64)> = Vec::with_capacity(sorted.len());
    if !sorted.is_empty() {
        let mut current = sorted[0];
        for &next in sorted.iter().skip(1) {
            if next.0 == current.0 && next.1 == current.1 {
                current.2 += next.2;
            } else {
                consolidated.push(current);
                current = next;
            }
        }
        consolidated.push(current);
    }

    let mut row_offsets = vec![0usize; n_rows + 1];
    let mut col_indices = Vec::with_capacity(consolidated.len());
    let mut values = Vec::with_capacity(consolidated.len());

    for &(row, col, val) in &consolidated {
        row_offsets[row + 1] += 1;
        col_indices.push(col);
        values.push(val);
    }

    for i in 1..=n_rows {
        row_offsets[i] += row_offsets[i - 1];
    }

    CsrMatrix::try_from_csr_data(n_rows, n_cols, row_offsets, col_indices, values)
        .expect("Failed to build CSR matrix")
}

fn get_diagonal(matrix: &CsrMatrix<f64>, i: usize) -> f64 {
    let row = matrix.row(i);
    for (col_idx, &val) in row.col_indices().iter().zip(row.values().iter()) {
        if *col_idx == i {
            return val;
        }
    }
    0.0
}

fn spmv(matrix: &CsrMatrix<f64>, x: &DVector<f64>) -> DVector<f64> {
    let n = matrix.nrows();
    let mut y = DVector::zeros(n);

    if n > 1000 {
        let y_slice: Vec<f64> = (0..n)
            .into_par_iter()
            .map(|i| {
                let row = matrix.row(i);
                let mut dot = 0.0;
                for (col_idx, &val) in row.col_indices().iter().zip(row.values().iter()) {
                    dot += val * x[*col_idx];
                }
                dot
            })
            .collect();

        for (i, val) in y_slice.into_iter().enumerate() {
            y[i] = val;
        }
    } else {
        for i in 0..n {
            let row = matrix.row(i);
            let mut dot = 0.0;
            for (col_idx, &val) in row.col_indices().iter().zip(row.values().iter()) {
                dot += val * x[*col_idx];
            }
            y[i] = dot;
        }
    }

    y
}

fn solve_cg_internal(
    matrix: &CsrMatrix<f64>,
    b: &DVector<f64>,
    x0: Option<&DVector<f64>>,
    tol: f64,
    max_iter: usize,
) -> (DVector<f64>, usize, f64) {
    let n = b.len();
    let mut x = match x0 {
        Some(initial) => initial.clone(),
        None => DVector::zeros(n),
    };

    let ax = spmv(matrix, &x);
    let mut r = b - ax;
    let m_inv: DVector<f64> = DVector::from_iterator(
        n,
        (0..n).map(|i| {
            let d = get_diagonal(matrix, i);
            if d.abs() > 1e-10 {
                1.0 / d
            } else {
                1.0
            }
        }),
    );

    let mut z = DVector::from_iterator(n, (0..n).map(|i| m_inv[i] * r[i]));
    let mut p = z.clone();
    let mut rs_old = r.dot(&z);
    let mut k = 0;
    let mut error = r.norm();

    while k < max_iter {
        let ap = spmv(matrix, &p);
        let p_ap = p.dot(&ap);
        let alpha = rs_old / (p_ap + 1e-10);

        x.axpy(alpha, &p, 1.0);
        r.axpy(-alpha, &ap, 1.0);

        error = r.norm();
        if error < tol {
            return (x, k, error);
        }

        for i in 0..n {
            z[i] = m_inv[i] * r[i];
        }

        let rs_new = r.dot(&z);
        let beta = rs_new / rs_old;

        for i in 0..n {
            p[i] = z[i] + beta * p[i];
        }

        rs_old = rs_new;
        k += 1;
    }

    (x, k, error)
}

pub fn solve_cg(
    triplets: Vec<SparseTriplet>,
    b: Vec<f64>,
    n_rows: Option<usize>,
    n_cols: Option<usize>,
    tol: Option<f64>,
    max_iter: Option<usize>,
) -> Result<CgResult, String> {
    let start = Instant::now();
    let n = b.len();
    let rows = n_rows.unwrap_or(n);
    let cols = n_cols.unwrap_or(n);
    let tolerance = tol.unwrap_or(1e-6);
    let iterations = max_iter.unwrap_or(1000);

    let matrix = build_csr_matrix(&triplets, rows, cols);
    let b_vec = DVector::from_vec(b);
    let (x, iter, error) = solve_cg_internal(&matrix, &b_vec, None, tolerance, iterations);
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    let converged = error < tolerance;

    if converged {
        log::info!(
            "CG Solver: converged in {} iterations, error={:.2e}, time={:.2}ms",
            iter,
            error,
            elapsed
        );
    } else {
        log::warn!(
            "CG Solver: DID NOT CONVERGE after {} iterations (error={:.2e}, tol={:.2e}, time={:.2}ms)",
            iter, error, tolerance, elapsed
        );
    }

    Ok(CgResult {
        x: x.data.as_vec().clone(),
        iter,
        error,
        time_ms: elapsed,
        converged,
    })
}

pub fn sparse_multiply(
    triplets: Vec<SparseTriplet>,
    x: Vec<f64>,
    n_rows: Option<usize>,
    n_cols: Option<usize>,
) -> Result<MultiplyResult, String> {
    let start = Instant::now();
    let n = x.len();
    let rows = n_rows.unwrap_or(n);
    let cols = n_cols.unwrap_or(n);

    let matrix = build_csr_matrix(&triplets, rows, cols);
    let x_vec = DVector::from_vec(x);
    let y = spmv(&matrix, &x_vec);
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    Ok(MultiplyResult {
        y: y.data.as_vec().clone(),
        time_ms: elapsed,
    })
}

pub fn benchmark_cg(size: usize, max_iter: Option<usize>) -> Result<BenchmarkResult, String> {
    let start = Instant::now();
    let mut triplets = Vec::with_capacity(3 * size);

    for i in 0..size {
        triplets.push(SparseTriplet { i, j: i, v: 2.0 });
        if i > 0 {
            triplets.push(SparseTriplet {
                i,
                j: i - 1,
                v: -1.0,
            });
        }
        if i < size - 1 {
            triplets.push(SparseTriplet {
                i,
                j: i + 1,
                v: -1.0,
            });
        }
    }

    let matrix = build_csr_matrix(&triplets, size, size);
    let b = DVector::from_element(size, 1.0);
    let iterations = max_iter.unwrap_or(1000);
    let (_, iter, error) = solve_cg_internal(&matrix, &b, None, 1e-6, iterations);
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    Ok(BenchmarkResult {
        rust_time_ms: elapsed,
        iterations: iter,
        error,
        matrix_size: size,
        nnz: triplets.len(),
    })
}
