//! Animation - Controlled animations with keyframes
//!
//! Animation bindings that let Bevy control animation progress
//! while React renders the current frame.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Animation configuration bound to a progress value
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct AnimationBinding {
    /// Path to the progress value (0.0 - 1.0)
    pub progress_bind: String,
    
    /// Easing function
    #[serde(default)]
    pub easing: Easing,
    
    /// Keyframes defining the animation
    pub keyframes: Vec<Keyframe>,
}

impl AnimationBinding {
    pub fn new(progress_bind: impl Into<String>) -> Self {
        Self {
            progress_bind: progress_bind.into(),
            easing: Easing::Linear,
            keyframes: vec![],
        }
    }
    
    pub fn with_easing(mut self, easing: Easing) -> Self {
        self.easing = easing;
        self
    }
    
    pub fn keyframe(mut self, at: f32, props: serde_json::Value) -> Self {
        self.keyframes.push(Keyframe { at, props });
        self
    }
    
    /// Slide in from left
    pub fn slide_in_left(progress_bind: impl Into<String>, distance: f32) -> Self {
        Self {
            progress_bind: progress_bind.into(),
            easing: Easing::EaseOutCubic,
            keyframes: vec![
                Keyframe { at: 0.0, props: serde_json::json!({ "translateX": -distance, "opacity": 0 }) },
                Keyframe { at: 1.0, props: serde_json::json!({ "translateX": 0, "opacity": 1 }) },
            ],
        }
    }
    
    /// Fade in
    pub fn fade_in(progress_bind: impl Into<String>) -> Self {
        Self {
            progress_bind: progress_bind.into(),
            easing: Easing::EaseOut,
            keyframes: vec![
                Keyframe { at: 0.0, props: serde_json::json!({ "opacity": 0 }) },
                Keyframe { at: 1.0, props: serde_json::json!({ "opacity": 1 }) },
            ],
        }
    }
    
    /// Scale up
    pub fn scale_up(progress_bind: impl Into<String>) -> Self {
        Self {
            progress_bind: progress_bind.into(),
            easing: Easing::EaseOutBack,
            keyframes: vec![
                Keyframe { at: 0.0, props: serde_json::json!({ "scale": 0.8, "opacity": 0 }) },
                Keyframe { at: 1.0, props: serde_json::json!({ "scale": 1.0, "opacity": 1 }) },
            ],
        }
    }
}

/// A keyframe in an animation
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct Keyframe {
    /// Position in animation (0.0 - 1.0)
    pub at: f32,
    
    /// Props at this keyframe
    pub props: serde_json::Value,
}

/// Easing function
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum Easing {
    #[default]
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    EaseInCubic,
    EaseOutCubic,
    EaseInOutCubic,
    EaseInQuad,
    EaseOutQuad,
    EaseInOutQuad,
    EaseInBack,
    EaseOutBack,
    EaseInOutBack,
    EaseInElastic,
    EaseOutElastic,
    Spring,
}

impl Easing {
    /// Apply easing to a linear progress value
    pub fn apply(&self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);
        match self {
            Self::Linear => t,
            Self::EaseIn => t * t,
            Self::EaseOut => 1.0 - (1.0 - t) * (1.0 - t),
            Self::EaseInOut => {
                if t < 0.5 { 2.0 * t * t } 
                else { 1.0 - (-2.0 * t + 2.0).powi(2) / 2.0 }
            }
            Self::EaseInCubic => t * t * t,
            Self::EaseOutCubic => 1.0 - (1.0 - t).powi(3),
            Self::EaseInOutCubic => {
                if t < 0.5 { 4.0 * t * t * t } 
                else { 1.0 - (-2.0 * t + 2.0).powi(3) / 2.0 }
            }
            Self::EaseInQuad => t * t,
            Self::EaseOutQuad => 1.0 - (1.0 - t) * (1.0 - t),
            Self::EaseInOutQuad => {
                if t < 0.5 { 2.0 * t * t } 
                else { 1.0 - (-2.0 * t + 2.0).powi(2) / 2.0 }
            }
            Self::EaseInBack => {
                let c1 = 1.70158;
                let c3 = c1 + 1.0;
                c3 * t * t * t - c1 * t * t
            }
            Self::EaseOutBack => {
                let c1 = 1.70158;
                let c3 = c1 + 1.0;
                1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
            }
            Self::EaseInOutBack => {
                let c1 = 1.70158;
                let c2 = c1 * 1.525;
                if t < 0.5 {
                    ((2.0 * t).powi(2) * ((c2 + 1.0) * 2.0 * t - c2)) / 2.0
                } else {
                    ((2.0 * t - 2.0).powi(2) * ((c2 + 1.0) * (t * 2.0 - 2.0) + c2) + 2.0) / 2.0
                }
            }
            Self::EaseInElastic => {
                if t == 0.0 { 0.0 }
                else if t == 1.0 { 1.0 }
                else {
                    let c4 = (2.0 * std::f32::consts::PI) / 3.0;
                    -2.0_f32.powf(10.0 * t - 10.0) * ((t * 10.0 - 10.75) * c4).sin()
                }
            }
            Self::EaseOutElastic => {
                if t == 0.0 { 0.0 }
                else if t == 1.0 { 1.0 }
                else {
                    let c4 = (2.0 * std::f32::consts::PI) / 3.0;
                    2.0_f32.powf(-10.0 * t) * ((t * 10.0 - 0.75) * c4).sin() + 1.0
                }
            }
            Self::Spring => {
                // Simple spring approximation
                let omega = 8.0;
                let zeta = 0.5;
                1.0 - ((-zeta * omega * t).exp() * ((1.0 - zeta * zeta).sqrt() * omega * t).cos())
            }
        }
    }
}
