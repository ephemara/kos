//! One Euro Filter — real-time signal smoothing for joint jitter suppression.
//!
//! Reference: Géry Casiez, Nicolas Roussel, Daniel Vogel.
//! "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in
//! Interactive Systems." CHI 2012.
//! <https://cristal.univ-lille.fr/~casiez/1euro/>
//!
//! ## Why this filter
//!
//! - Adaptive: slows down when movement is slow (reduces jitter)
//!   but stays responsive when movement is fast (reduces lag)
//! - Only two tuning params: `min_cutoff` and `beta`
//! - Zero external deps — pure math
//! - Works per-scalar, so we apply it per joint per axis (x, y, z)

// ─── Low-pass filter (internal) ──────────────────────────────────────────────

struct LowPassFilter {
    y: Option<f64>,
    a: f64,
}

impl LowPassFilter {
    fn new() -> Self {
        Self { y: None, a: 0.0 }
    }

    fn set_alpha(&mut self, alpha: f64) {
        self.a = alpha.clamp(0.0, 1.0);
    }

    fn filter(&mut self, x: f64) -> f64 {
        let y = match self.y {
            Some(prev) => self.a * x + (1.0 - self.a) * prev,
            None => x,
        };
        self.y = Some(y);
        y
    }

    fn last(&self) -> Option<f64> {
        self.y
    }
}

// ─── One Euro Filter (per scalar) ────────────────────────────────────────────

/// One Euro Filter for a single scalar.
/// For 3D joints, create 3 of these (one per axis).
pub struct OneEuroFilter {
    /// Minimum cutoff frequency (Hz). Lower = smoother but more lag.
    /// Good default: 1.0
    min_cutoff: f64,
    /// Speed coefficient. Higher = less lag when moving fast.
    /// Good default: 0.007
    beta: f64,
    /// Derivative cutoff (fixed, usually 1.0)
    d_cutoff: f64,
    x_filter: LowPassFilter,
    dx_filter: LowPassFilter,
    t_prev: Option<f64>,
}

impl OneEuroFilter {
    /// Create a new filter.
    ///
    /// # Arguments
    /// * `min_cutoff` — Minimum cutoff frequency in Hz. Tune this to reduce
    ///    jitter when the joint is still. Start at 1.0.
    /// * `beta` — Speed coefficient. Increase to reduce lag when moving fast.
    ///    Start at 0.007.
    pub fn new(min_cutoff: f64, beta: f64) -> Self {
        Self {
            min_cutoff,
            beta,
            d_cutoff: 1.0,
            x_filter: LowPassFilter::new(),
            dx_filter: LowPassFilter::new(),
            t_prev: None,
        }
    }

    /// Update filter parameters live (e.g. from IK constraint sliders).
    pub fn set_params(&mut self, min_cutoff: f64, beta: f64) {
        self.min_cutoff = min_cutoff;
        self.beta = beta;
    }

    /// Compute alpha for a given cutoff frequency and timestep dt.
    fn alpha(cutoff: f64, dt: f64) -> f64 {
        let tau = 1.0 / (2.0 * std::f64::consts::PI * cutoff);
        1.0 / (1.0 + tau / dt)
    }

    /// Feed a new sample. Returns the filtered value.
    ///
    /// # Arguments
    /// * `x` — Raw input sample
    /// * `timestamp_s` — Current time in seconds (monotonic)
    pub fn filter(&mut self, x: f64, timestamp_s: f64) -> f64 {
        let dt = match self.t_prev {
            Some(t) => (timestamp_s - t).max(1e-6),
            None => 1.0 / 30.0, // Assume 30fps until we have two samples
        };
        self.t_prev = Some(timestamp_s);

        // Derivative estimate
        let dx_raw = match self.x_filter.last() {
            Some(prev) => (x - prev) / dt,
            None => 0.0,
        };

        self.dx_filter.set_alpha(Self::alpha(self.d_cutoff, dt));
        let dx_hat = self.dx_filter.filter(dx_raw);

        // Adaptive cutoff based on speed
        let cutoff = self.min_cutoff + self.beta * dx_hat.abs();

        self.x_filter.set_alpha(Self::alpha(cutoff, dt));
        self.x_filter.filter(x)
    }

    /// Reset filter state (e.g. on session restart or joint fully occluded).
    pub fn reset(&mut self) {
        self.x_filter = LowPassFilter::new();
        self.dx_filter = LowPassFilter::new();
        self.t_prev = None;
    }
}

// ─── Vec3Filter (convenience wrapper for 3D joints) ──────────────────────────

/// Three One Euro Filters — one per axis — for a 3D joint position.
pub struct Vec3Filter {
    fx: OneEuroFilter,
    fy: OneEuroFilter,
    fz: OneEuroFilter,
}

impl Vec3Filter {
    pub fn new(min_cutoff: f64, beta: f64) -> Self {
        Self {
            fx: OneEuroFilter::new(min_cutoff, beta),
            fy: OneEuroFilter::new(min_cutoff, beta),
            fz: OneEuroFilter::new(min_cutoff, beta),
        }
    }

    pub fn set_params(&mut self, min_cutoff: f64, beta: f64) {
        self.fx.set_params(min_cutoff, beta);
        self.fy.set_params(min_cutoff, beta);
        self.fz.set_params(min_cutoff, beta);
    }

    /// Filter a [x, y, z] position.
    pub fn filter(&mut self, pos: [f32; 3], timestamp_s: f64) -> [f32; 3] {
        [
            self.fx.filter(pos[0] as f64, timestamp_s) as f32,
            self.fy.filter(pos[1] as f64, timestamp_s) as f32,
            self.fz.filter(pos[2] as f64, timestamp_s) as f32,
        ]
    }

    pub fn reset(&mut self) {
        self.fx.reset();
        self.fy.reset();
        self.fz.reset();
    }
}

// ─── JointFilterBank ─────────────────────────────────────────────────────────

/// Filter bank for all 17 COCO joints.
/// Created once per session, updated every frame.
pub struct JointFilterBank {
    filters: Vec<Vec3Filter>,
    min_cutoff: f64,
    beta: f64,
}

impl JointFilterBank {
    /// Create a bank for `n` joints (typically 17 for COCO).
    pub fn new(n: usize, min_cutoff: f64, beta: f64) -> Self {
        Self {
            filters: (0..n).map(|_| Vec3Filter::new(min_cutoff, beta)).collect(),
            min_cutoff,
            beta,
        }
    }

    /// Update parameters live during a session.
    pub fn set_params(&mut self, min_cutoff: f64, beta: f64) {
        self.min_cutoff = min_cutoff;
        self.beta = beta;
        for f in &mut self.filters {
            f.set_params(min_cutoff, beta);
        }
    }

    /// Filter a full frame of joint positions.
    pub fn filter_frame(&mut self, joints: &mut [[f32; 3]], timestamp_s: f64) {
        for (i, pos) in joints.iter_mut().enumerate() {
            if let Some(f) = self.filters.get_mut(i) {
                *pos = f.filter(*pos, timestamp_s);
            }
        }
    }

    pub fn reset_all(&mut self) {
        for f in &mut self.filters {
            f.reset();
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_one_euro_convergence() {
        let mut f = OneEuroFilter::new(1.0, 0.007);
        // Constant signal — filter should converge to the constant
        let mut out = 0.0;
        for i in 0..100 {
            out = f.filter(5.0, i as f64 / 30.0);
        }
        // After 100 frames the filter should be very close to 5.0
        assert!((out - 5.0).abs() < 0.01, "Filter did not converge: {}", out);
    }

    #[test]
    fn test_vec3_filter_reset() {
        let mut f = Vec3Filter::new(1.0, 0.007);
        f.filter([1.0, 2.0, 3.0], 0.0);
        f.reset();
        // After reset, next output should track input immediately
        let out = f.filter([10.0, 20.0, 30.0], 1.0);
        assert_eq!(out, [10.0, 20.0, 30.0]);
    }
}
