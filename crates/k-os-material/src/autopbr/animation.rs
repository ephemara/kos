// Animation Engine
// Keyframe, procedural, and physics-based material animation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::gpu::GpuComputeDevice;

/// Animation engine for material parameter animation
pub struct AnimationEngine {
    #[allow(dead_code)]
    gpu_compute: Arc<GpuComputeDevice>,
}

/// Animation data for a material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationData {
    pub duration: f32,
    pub loop_mode: LoopMode,
    pub tracks: Vec<AnimationTrack>,
}

/// Animation loop mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoopMode {
    Once,
    Loop,
    PingPong,
}

/// Animation track for a single parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationTrack {
    pub parameter: AnimationParameter,
    pub animation_type: AnimationType,
}

/// Animatable material parameters
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AnimationParameter {
    // Layer parameters
    LayerOpacity,
    LayerBlendMode,

    // PBR map parameters
    AlbedoColor,
    AlbedoRed,
    AlbedoGreen,
    AlbedoBlue,
    Roughness,
    Metallic,
    EmissiveIntensity,
    EmissiveColor,
    HeightOffset,
    NormalStrength,

    // UV parameters
    UVOffsetX,
    UVOffsetY,
    UVScaleX,
    UVScaleY,
}

/// Animation type (keyframe, procedural, or physics)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnimationType {
    Keyframe(KeyframeAnimation),
    Procedural(ProceduralAnimation),
    Physics(PhysicsAnimation),
}

/// Keyframe-based animation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyframeAnimation {
    pub keyframes: Vec<Keyframe>,
    pub interpolation: InterpolationType,
}

/// Single keyframe with optional tangents for Bezier interpolation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keyframe {
    pub time: f32,
    pub value: f32,
    /// Tangent for incoming curve (used for Bezier interpolation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tangent_in: Option<Vec2>,
    /// Tangent for outgoing curve (used for Bezier interpolation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tangent_out: Option<Vec2>,
}

/// 2D vector for tangent control
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

/// Interpolation type for keyframes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterpolationType {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Bezier,
}

/// Procedural animation using expressions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProceduralAnimation {
    pub expression: String,
}

/// Physics-based animation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicsAnimation {
    pub simulation_type: SimulationType,
}

/// Physics simulation type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SimulationType {
    RustSpreading,
    MossGrowth,
    Erosion,
    Weathering,
    Cracking,
    Melting,
}

impl AnimationEngine {
    /// Create a new animation engine
    pub fn new(gpu_compute: Arc<GpuComputeDevice>) -> Self {
        Self { gpu_compute }
    }

    /// Evaluate all keyframe tracks at a given time
    ///
    /// This method:
    /// 1. Adjusts time based on loop mode (Once, Loop, Ping-Pong)
    /// 2. Evaluates each keyframe track at the adjusted time
    /// 3. Returns a HashMap mapping AnimationParameter to interpolated value
    ///
    /// # Arguments
    /// * `animation_data` - The animation data containing tracks and loop mode
    /// * `time` - The current time in seconds
    ///
    /// # Returns
    /// HashMap mapping each animated parameter to its value at the given time
    pub fn evaluate_keyframe(
        &self,
        animation_data: &AnimationData,
        time: f32,
    ) -> HashMap<AnimationParameter, f32> {
        let mut result = HashMap::new();

        // Handle loop modes to adjust time
        let adjusted_time = if animation_data.duration <= 0.0 {
            // Invalid duration, just use time as-is
            time
        } else {
            match animation_data.loop_mode {
                LoopMode::Once => {
                    // Clamp time to [0, duration]
                    time.max(0.0).min(animation_data.duration)
                }
                LoopMode::Loop => {
                    // Wrap time using modulo
                    if time < 0.0 {
                        // Handle negative time by wrapping backwards
                        let cycles = (-time / animation_data.duration).ceil();
                        time + cycles * animation_data.duration
                    } else {
                        time % animation_data.duration
                    }
                }
                LoopMode::PingPong => {
                    // Bounce back and forth
                    if time < 0.0 {
                        // For negative time, treat as if we're going backwards from 0
                        0.0
                    } else {
                        let cycle = time / animation_data.duration;
                        let cycle_int = cycle.floor() as i32;
                        let t = time % animation_data.duration;

                        // On odd cycles, reverse direction
                        if cycle_int % 2 == 1 {
                            animation_data.duration - t
                        } else {
                            t
                        }
                    }
                }
            }
        };

        // Evaluate each track at the adjusted time
        for track in &animation_data.tracks {
            match &track.animation_type {
                AnimationType::Keyframe(keyframe_anim) => {
                    let value = keyframe_anim.evaluate(adjusted_time);
                    result.insert(track.parameter, value);
                }
                AnimationType::Procedural(proc_anim) => {
                    // Evaluate procedural animation using ExpressionEvaluator
                    let evaluator = ExpressionEvaluator::new();
                    match evaluator.evaluate(&proc_anim.expression, adjusted_time) {
                        Ok(value) => {
                            result.insert(track.parameter, value);
                        }
                        Err(e) => {
                            // Log error but continue processing other tracks
                            eprintln!("Procedural animation error for parameter {:?}: {} (expression: '{}')", 
                                track.parameter, e, proc_anim.expression);
                        }
                    }
                }
                AnimationType::Physics(_) => {
                    // Physics animation will be implemented later
                    // For now, skip these tracks
                }
            }
        }

        result
    }

    /// Evaluate procedural animation tracks at a given time
    ///
    /// This method evaluates only procedural animation tracks using the ExpressionEvaluator.
    /// It's useful when you want to evaluate procedural animations separately from keyframe animations.
    ///
    /// # Arguments
    /// * `animation_data` - The animation data containing tracks and loop mode
    /// * `time` - The current time in seconds
    ///
    /// # Returns
    /// HashMap mapping each procedural animated parameter to its value at the given time
    ///
    /// # Examples
    /// ```
    /// use k_os_material::autopbr::animation::*;
    /// use std::sync::Arc;
    ///
    /// let engine = AnimationEngine::new(Arc::new(Default::default()));
    /// let mut animation = AnimationData::new(10.0);
    /// animation.add_track(AnimationTrack::procedural(
    ///     AnimationParameter::UVOffsetX,
    ///     ProceduralAnimation { expression: "t * 0.5".to_string() }
    /// ));
    ///
    /// let result = engine.evaluate_procedural(&animation, 2.0);
    /// assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&1.0));
    /// ```
    pub fn evaluate_procedural(
        &self,
        animation_data: &AnimationData,
        time: f32,
    ) -> HashMap<AnimationParameter, f32> {
        let mut result = HashMap::new();

        // Handle loop modes to adjust time (same logic as evaluate_keyframe)
        let adjusted_time = if animation_data.duration <= 0.0 {
            time
        } else {
            match animation_data.loop_mode {
                LoopMode::Once => time.max(0.0).min(animation_data.duration),
                LoopMode::Loop => {
                    if time < 0.0 {
                        let cycles = (-time / animation_data.duration).ceil();
                        time + cycles * animation_data.duration
                    } else {
                        time % animation_data.duration
                    }
                }
                LoopMode::PingPong => {
                    if time < 0.0 {
                        0.0
                    } else {
                        let cycle = time / animation_data.duration;
                        let cycle_int = cycle.floor() as i32;
                        let t = time % animation_data.duration;

                        if cycle_int % 2 == 1 {
                            animation_data.duration - t
                        } else {
                            t
                        }
                    }
                }
            }
        };

        // Evaluate only procedural tracks
        let evaluator = ExpressionEvaluator::new();
        for track in &animation_data.tracks {
            if let AnimationType::Procedural(proc_anim) = &track.animation_type {
                match evaluator.evaluate(&proc_anim.expression, adjusted_time) {
                    Ok(value) => {
                        result.insert(track.parameter, value);
                    }
                    Err(e) => {
                        // Log error but continue processing other tracks
                        eprintln!(
                            "Procedural animation error for parameter {:?}: {} (expression: '{}')",
                            track.parameter, e, proc_anim.expression
                        );
                    }
                }
            }
        }

        result
    }
}

impl Keyframe {
    /// Create a simple keyframe without tangents (for Linear, EaseIn, EaseOut, EaseInOut)
    pub fn new(time: f32, value: f32) -> Self {
        Self {
            time,
            value,
            tangent_in: None,
            tangent_out: None,
        }
    }

    /// Create a keyframe with Bezier tangents
    pub fn with_tangents(time: f32, value: f32, tangent_in: Vec2, tangent_out: Vec2) -> Self {
        Self {
            time,
            value,
            tangent_in: Some(tangent_in),
            tangent_out: Some(tangent_out),
        }
    }
}

impl AnimationData {
    /// Create a new animation with default settings
    pub fn new(duration: f32) -> Self {
        Self {
            duration,
            loop_mode: LoopMode::Loop,
            tracks: Vec::new(),
        }
    }

    /// Add a track to the animation
    pub fn add_track(&mut self, track: AnimationTrack) {
        self.tracks.push(track);
    }
}

impl AnimationTrack {
    /// Create a keyframe animation track
    pub fn keyframe(parameter: AnimationParameter, animation: KeyframeAnimation) -> Self {
        Self {
            parameter,
            animation_type: AnimationType::Keyframe(animation),
        }
    }

    /// Create a procedural animation track
    pub fn procedural(parameter: AnimationParameter, animation: ProceduralAnimation) -> Self {
        Self {
            parameter,
            animation_type: AnimationType::Procedural(animation),
        }
    }

    /// Create a physics animation track
    pub fn physics(parameter: AnimationParameter, animation: PhysicsAnimation) -> Self {
        Self {
            parameter,
            animation_type: AnimationType::Physics(animation),
        }
    }
}

impl KeyframeAnimation {
    /// Create a new keyframe animation
    pub fn new(interpolation: InterpolationType) -> Self {
        Self {
            keyframes: Vec::new(),
            interpolation,
        }
    }

    /// Add a keyframe to the animation
    pub fn add_keyframe(&mut self, keyframe: Keyframe) {
        self.keyframes.push(keyframe);
        // Keep keyframes sorted by time
        self.keyframes
            .sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap());
    }

    /// Evaluate the animation at a given time
    pub fn evaluate(&self, time: f32) -> f32 {
        // Handle edge cases
        if self.keyframes.is_empty() {
            return 0.0;
        }

        if self.keyframes.len() == 1 {
            return self.keyframes[0].value;
        }

        // Time before first keyframe
        if time <= self.keyframes[0].time {
            return self.keyframes[0].value;
        }

        // Time after last keyframe
        if time >= self.keyframes[self.keyframes.len() - 1].time {
            return self.keyframes[self.keyframes.len() - 1].value;
        }

        // Find the two keyframes to interpolate between
        let mut start_idx = 0;
        for (i, kf) in self.keyframes.iter().enumerate() {
            if kf.time <= time {
                start_idx = i;
            } else {
                break;
            }
        }

        let start = &self.keyframes[start_idx];
        let end = &self.keyframes[start_idx + 1];

        // Calculate normalized time between keyframes (0.0 to 1.0)
        let t = (time - start.time) / (end.time - start.time);

        // Apply interpolation based on type
        let t_eased = match self.interpolation {
            InterpolationType::Linear => t,
            InterpolationType::EaseIn => ease_in(t),
            InterpolationType::EaseOut => ease_out(t),
            InterpolationType::EaseInOut => ease_in_out(t),
            InterpolationType::Bezier => {
                // Use tangents if available, otherwise fall back to linear
                if let (Some(tangent_out), Some(tangent_in)) = (&start.tangent_out, &end.tangent_in)
                {
                    bezier_interpolate(t, tangent_out, tangent_in)
                } else {
                    t
                }
            }
        };

        // Linear interpolation with eased t
        start.value + (end.value - start.value) * t_eased
    }
}

/// Ease-in interpolation (quadratic - slow start, fast end)
fn ease_in(t: f32) -> f32 {
    t * t
}

/// Ease-out interpolation (quadratic - fast start, slow end)
fn ease_out(t: f32) -> f32 {
    t * (2.0 - t)
}

/// Ease-in-out interpolation (cubic - slow start and end)
fn ease_in_out(t: f32) -> f32 {
    if t < 0.5 {
        2.0 * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(2) / 2.0
    }
}

/// Bezier curve interpolation using cubic Bezier with tangent control points
///
/// The tangents define the control points for a cubic Bezier curve:
/// - P0 = (0, 0) - start point
/// - P1 = tangent_out - first control point (from start keyframe)
/// - P2 = tangent_in - second control point (from end keyframe)
/// - P3 = (1, 1) - end point
fn bezier_interpolate(t: f32, tangent_out: &Vec2, tangent_in: &Vec2) -> f32 {
    // Cubic Bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    // Since P0 = (0,0) and P3 = (1,1), we can simplify

    let t2 = t * t;
    let t3 = t2 * t;
    let one_minus_t = 1.0 - t;
    let one_minus_t2 = one_minus_t * one_minus_t;
    // Calculate y value of the Bezier curve
    // B(t) = 3(1-t)²t * P1.y + 3(1-t)t² * P2.y + t³
    let y = 3.0 * one_minus_t2 * t * tangent_out.y + 3.0 * one_minus_t * t2 * tangent_in.y + t3;

    y.clamp(0.0, 1.0)
}

// ============================================================================
// Expression Evaluator
// ============================================================================

/// Expression evaluator for procedural animation
///
/// Supports:
/// - Variable: t (time)
/// - Functions: sin, cos, tan, abs, sqrt, pow, min, max, clamp, lerp
/// - Noise functions: perlin, simplex, worley, fbm
/// - Operators: +, -, *, /, ^ (exponentiation)
/// - Standard operator precedence with parentheses
pub struct ExpressionEvaluator {
    // Uses evalexpr crate for expression parsing and evaluation
}

impl ExpressionEvaluator {
    /// Create a new expression evaluator
    pub fn new() -> Self {
        Self {}
    }

    fn build_context(
        expression: &str,
        time: f32,
    ) -> Result<evalexpr::HashMapContext<evalexpr::DefaultNumericTypes>, String> {
        use evalexpr::*;
        use noise::{NoiseFn, OpenSimplex, Perlin, Worley};

        let mut context = HashMapContext::<DefaultNumericTypes>::new();
        context
            .set_value("t".to_string(), Value::Float(time as f64))
            .map_err(|e| {
                format!(
                    "Failed to set time variable in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "sin".to_string(),
                Function::new(|argument| {
                    let value: f64 = argument.as_number()?;
                    Ok(Value::Float(value.sin()))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register sin function in expression '{}': {}",
                    expression, e
                )
            })?;
        context
            .set_function(
                "cos".to_string(),
                Function::new(|argument| {
                    let value: f64 = argument.as_number()?;
                    Ok(Value::Float(value.cos()))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register cos function in expression '{}': {}",
                    expression, e
                )
            })?;
        context
            .set_function(
                "tan".to_string(),
                Function::new(|argument| {
                    let value: f64 = argument.as_number()?;
                    Ok(Value::Float(value.tan()))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register tan function in expression '{}': {}",
                    expression, e
                )
            })?;
        context
            .set_function(
                "abs".to_string(),
                Function::new(|argument| {
                    let value: f64 = argument.as_number()?;
                    Ok(Value::Float(value.abs()))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register abs function in expression '{}': {}",
                    expression, e
                )
            })?;
        context
            .set_function(
                "sqrt".to_string(),
                Function::new(|argument| {
                    let value: f64 = argument.as_number()?;
                    Ok(Value::Float(value.sqrt()))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register sqrt function in expression '{}': {}",
                    expression, e
                )
            })?;
        context
            .set_function(
                "pow".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 2 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 2..=2,
                            actual: args.len(),
                        });
                    }
                    let base: f64 = args[0].as_number()?;
                    let exponent: f64 = args[1].as_number()?;
                    Ok(Value::Float(base.powf(exponent)))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register pow function in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "clamp".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 3 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 3..=3,
                            actual: args.len(),
                        });
                    }
                    let value: f64 = args[0].as_number()?;
                    let min: f64 = args[1].as_number()?;
                    let max: f64 = args[2].as_number()?;
                    Ok(Value::Float(value.max(min).min(max)))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register clamp function in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "lerp".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 3 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 3..=3,
                            actual: args.len(),
                        });
                    }
                    let a: f64 = args[0].as_number()?;
                    let b: f64 = args[1].as_number()?;
                    let t: f64 = args[2].as_number()?;
                    Ok(Value::Float(a + (b - a) * t))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register lerp function in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "perlin".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 3 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 3..=3,
                            actual: args.len(),
                        });
                    }
                    let x: f64 = args[0].as_number()?;
                    let frequency: f64 = args[1].as_number()?;
                    let amplitude: f64 = args[2].as_number()?;

                    let perlin = Perlin::new(0);
                    let value = perlin.get([x * frequency, 0.0]);
                    Ok(Value::Float(value * amplitude))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register perlin function in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "simplex".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 3 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 3..=3,
                            actual: args.len(),
                        });
                    }
                    let x: f64 = args[0].as_number()?;
                    let frequency: f64 = args[1].as_number()?;
                    let amplitude: f64 = args[2].as_number()?;

                    let simplex = OpenSimplex::new(0);
                    let value = simplex.get([x * frequency, 0.0]);
                    Ok(Value::Float(value * amplitude))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register simplex function in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "worley".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 3 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 3..=3,
                            actual: args.len(),
                        });
                    }
                    let x: f64 = args[0].as_number()?;
                    let frequency: f64 = args[1].as_number()?;
                    let amplitude: f64 = args[2].as_number()?;

                    let worley = Worley::new(0);
                    let value = worley.get([x * frequency, 0.0]);
                    Ok(Value::Float(value * amplitude))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register worley function in expression '{}': {}",
                    expression, e
                )
            })?;

        context
            .set_function(
                "fbm".to_string(),
                Function::new(|argument| {
                    let args = argument.as_tuple()?;
                    if args.len() != 6 {
                        return Err(EvalexprError::WrongFunctionArgumentAmount {
                            expected: 6..=6,
                            actual: args.len(),
                        });
                    }
                    let x: f64 = args[0].as_number()?;
                    let frequency: f64 = args[1].as_number()?;
                    let amplitude: f64 = args[2].as_number()?;
                    let octaves: i64 = args[3].as_int()?;
                    let lacunarity: f64 = args[4].as_number()?;
                    let persistence: f64 = args[5].as_number()?;

                    let perlin = Perlin::new(0);
                    let mut value = 0.0;
                    let mut current_amplitude = amplitude;
                    let mut current_frequency = frequency;

                    for _ in 0..octaves {
                        value += perlin.get([x * current_frequency, 0.0]) * current_amplitude;
                        current_frequency *= lacunarity;
                        current_amplitude *= persistence;
                    }

                    Ok(Value::Float(value))
                }),
            )
            .map_err(|e| {
                format!(
                    "Failed to register fbm function in expression '{}': {}",
                    expression, e
                )
            })?;

        Ok(context)
    }

    /// Evaluate an expression with the given time value
    ///
    /// # Arguments
    /// * `expression` - Mathematical expression string (e.g., "sin(t * 2.0) * 0.5 + 0.5")
    /// * `time` - Time value in seconds
    ///
    /// # Returns
    /// Result containing the evaluated value or an error message with the expression
    ///
    /// # Examples
    /// ```
    /// use k_os_material::autopbr::animation::ExpressionEvaluator;
    ///
    /// let evaluator = ExpressionEvaluator::new();
    /// let result = evaluator.evaluate("sin(t * 2.0) * 0.5 + 0.5", 1.0).unwrap();
    /// let noise_result = evaluator.evaluate("perlin(t, 1.0, 0.5)", 1.0).unwrap();
    /// ```
    pub fn evaluate(&self, expression: &str, time: f32) -> Result<f32, String> {
        use evalexpr::*;
        let context = Self::build_context(expression, time)?;

        // Evaluate expression
        let result = eval_with_context(expression, &context)
            .map_err(|e| format!("Failed to evaluate expression '{}': {}", expression, e))?;

        // Convert result to f32
        match result {
            Value::Float(f) => {
                let f64_val: f64 = f;
                Ok(f64_val as f32)
            }
            Value::Int(i) => {
                let i64_val: i64 = i;
                Ok(i64_val as f32)
            }
            _ => Err(format!(
                "Expression '{}' did not evaluate to a number",
                expression
            )),
        }
    }

    /// Validate an expression without evaluating it
    ///
    /// # Arguments
    /// * `expression` - Mathematical expression string
    ///
    /// # Returns
    /// Result indicating success or an error message with the expression
    pub fn validate(&self, expression: &str) -> Result<(), String> {
        self.evaluate(expression, 0.0).map(|_| ())
    }
}

impl Default for ExpressionEvaluator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_animation_parameter_serialization() {
        let param = AnimationParameter::Roughness;
        let json = serde_json::to_string(&param).unwrap();
        let deserialized: AnimationParameter = serde_json::from_str(&json).unwrap();
        assert_eq!(param, deserialized);
    }

    #[test]
    fn test_keyframe_creation() {
        // Simple keyframe without tangents
        let kf1 = Keyframe::new(0.0, 0.5);
        assert_eq!(kf1.time, 0.0);
        assert_eq!(kf1.value, 0.5);
        assert!(kf1.tangent_in.is_none());
        assert!(kf1.tangent_out.is_none());

        // Keyframe with Bezier tangents
        let kf2 = Keyframe::with_tangents(1.0, 1.0, Vec2::new(0.5, 0.5), Vec2::new(0.5, 0.5));
        assert_eq!(kf2.time, 1.0);
        assert_eq!(kf2.value, 1.0);
        assert!(kf2.tangent_in.is_some());
        assert!(kf2.tangent_out.is_some());
    }

    #[test]
    fn test_keyframe_animation_builder() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(1.0, 0.5));
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(2.0, 1.0));

        // Verify keyframes are sorted by time
        assert_eq!(anim.keyframes.len(), 3);
        assert_eq!(anim.keyframes[0].time, 0.0);
        assert_eq!(anim.keyframes[1].time, 1.0);
        assert_eq!(anim.keyframes[2].time, 2.0);
    }

    #[test]
    fn test_animation_data_builder() {
        let mut anim_data = AnimationData::new(5.0);
        assert_eq!(anim_data.duration, 5.0);
        assert_eq!(anim_data.loop_mode, LoopMode::Loop);
        assert_eq!(anim_data.tracks.len(), 0);

        // Add a keyframe track
        let mut kf_anim = KeyframeAnimation::new(InterpolationType::EaseInOut);
        kf_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        kf_anim.add_keyframe(Keyframe::new(5.0, 1.0));

        anim_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            kf_anim,
        ));

        assert_eq!(anim_data.tracks.len(), 1);
    }

    #[test]
    fn test_animation_serialization_round_trip() {
        // Create a complex animation with all features
        let anim_data = AnimationData {
            duration: 10.0,
            loop_mode: LoopMode::PingPong,
            tracks: vec![
                AnimationTrack {
                    parameter: AnimationParameter::Roughness,
                    animation_type: AnimationType::Keyframe(KeyframeAnimation {
                        keyframes: vec![
                            Keyframe::new(0.0, 0.0),
                            Keyframe::with_tangents(
                                5.0,
                                0.5,
                                Vec2::new(0.3, 0.3),
                                Vec2::new(0.7, 0.7),
                            ),
                            Keyframe::new(10.0, 1.0),
                        ],
                        interpolation: InterpolationType::Bezier,
                    }),
                },
                AnimationTrack {
                    parameter: AnimationParameter::EmissiveIntensity,
                    animation_type: AnimationType::Procedural(ProceduralAnimation {
                        expression: "sin(t * 2.0) * 0.5 + 0.5".to_string(),
                    }),
                },
            ],
        };

        // Serialize to JSON
        let json = serde_json::to_string_pretty(&anim_data).unwrap();

        // Deserialize back
        let deserialized: AnimationData = serde_json::from_str(&json).unwrap();

        // Verify equivalence
        assert_eq!(deserialized.duration, anim_data.duration);
        assert_eq!(deserialized.loop_mode, anim_data.loop_mode);
        assert_eq!(deserialized.tracks.len(), anim_data.tracks.len());

        // Verify first track (keyframe)
        if let AnimationType::Keyframe(kf_anim) = &deserialized.tracks[0].animation_type {
            assert_eq!(kf_anim.keyframes.len(), 3);
            assert_eq!(kf_anim.interpolation, InterpolationType::Bezier);
            assert!(kf_anim.keyframes[1].tangent_in.is_some());
            assert!(kf_anim.keyframes[1].tangent_out.is_some());
        } else {
            panic!("Expected keyframe animation");
        }

        // Verify second track (procedural)
        if let AnimationType::Procedural(proc_anim) = &deserialized.tracks[1].animation_type {
            assert_eq!(proc_anim.expression, "sin(t * 2.0) * 0.5 + 0.5");
        } else {
            panic!("Expected procedural animation");
        }
    }

    #[test]
    fn test_all_animation_parameters() {
        // Verify all animation parameters can be serialized
        let params = vec![
            AnimationParameter::LayerOpacity,
            AnimationParameter::LayerBlendMode,
            AnimationParameter::AlbedoColor,
            AnimationParameter::AlbedoRed,
            AnimationParameter::AlbedoGreen,
            AnimationParameter::AlbedoBlue,
            AnimationParameter::Roughness,
            AnimationParameter::Metallic,
            AnimationParameter::EmissiveIntensity,
            AnimationParameter::EmissiveColor,
            AnimationParameter::HeightOffset,
            AnimationParameter::NormalStrength,
            AnimationParameter::UVOffsetX,
            AnimationParameter::UVOffsetY,
            AnimationParameter::UVScaleX,
            AnimationParameter::UVScaleY,
        ];

        for param in params {
            let json = serde_json::to_string(&param).unwrap();
            let deserialized: AnimationParameter = serde_json::from_str(&json).unwrap();
            assert_eq!(param, deserialized);
        }
    }

    #[test]
    fn test_loop_modes() {
        let modes = vec![LoopMode::Once, LoopMode::Loop, LoopMode::PingPong];

        for mode in modes {
            let json = serde_json::to_string(&mode).unwrap();
            let deserialized: LoopMode = serde_json::from_str(&json).unwrap();
            assert_eq!(mode, deserialized);
        }
    }

    #[test]
    fn test_interpolation_types() {
        let types = vec![
            InterpolationType::Linear,
            InterpolationType::EaseIn,
            InterpolationType::EaseOut,
            InterpolationType::EaseInOut,
            InterpolationType::Bezier,
        ];

        for interp_type in types {
            let json = serde_json::to_string(&interp_type).unwrap();
            let deserialized: InterpolationType = serde_json::from_str(&json).unwrap();
            assert_eq!(interp_type, deserialized);
        }
    }

    // ===== Interpolation Tests =====

    #[test]
    fn test_evaluate_empty_keyframes() {
        let anim = KeyframeAnimation::new(InterpolationType::Linear);
        assert_eq!(anim.evaluate(0.0), 0.0);
        assert_eq!(anim.evaluate(1.0), 0.0);
    }

    #[test]
    fn test_evaluate_single_keyframe() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(1.0, 0.5));

        assert_eq!(anim.evaluate(0.0), 0.5);
        assert_eq!(anim.evaluate(1.0), 0.5);
        assert_eq!(anim.evaluate(2.0), 0.5);
    }

    #[test]
    fn test_evaluate_before_first_keyframe() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(1.0, 0.5));
        anim.add_keyframe(Keyframe::new(2.0, 1.0));

        assert_eq!(anim.evaluate(0.0), 0.5);
        assert_eq!(anim.evaluate(0.5), 0.5);
    }

    #[test]
    fn test_evaluate_after_last_keyframe() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(1.0, 0.5));
        anim.add_keyframe(Keyframe::new(2.0, 1.0));

        assert_eq!(anim.evaluate(2.0), 1.0);
        assert_eq!(anim.evaluate(3.0), 1.0);
    }

    #[test]
    fn test_linear_interpolation() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 1.0));

        // Test linear interpolation at various points
        assert_eq!(anim.evaluate(0.0), 0.0);
        assert_eq!(anim.evaluate(0.25), 0.25);
        assert_eq!(anim.evaluate(0.5), 0.5);
        assert_eq!(anim.evaluate(0.75), 0.75);
        assert_eq!(anim.evaluate(1.0), 1.0);
    }

    #[test]
    fn test_linear_interpolation_non_unit_range() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(0.0, 10.0));
        anim.add_keyframe(Keyframe::new(2.0, 20.0));

        assert_eq!(anim.evaluate(0.0), 10.0);
        assert_eq!(anim.evaluate(1.0), 15.0);
        assert_eq!(anim.evaluate(2.0), 20.0);
    }

    #[test]
    fn test_ease_in_interpolation() {
        let mut anim = KeyframeAnimation::new(InterpolationType::EaseIn);
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 1.0));

        // Ease-in should start slow (values < linear) and end fast
        let val_0_25 = anim.evaluate(0.25);
        let val_0_5 = anim.evaluate(0.5);
        let val_0_75 = anim.evaluate(0.75);

        // At t=0.25, ease-in should be slower than linear (< 0.25)
        assert!(val_0_25 < 0.25);
        // At t=0.5, ease-in should be slower than linear (< 0.5)
        assert!(val_0_5 < 0.5);
        // At t=0.75, quadratic ease-in is still below linear.
        assert!(val_0_75 < 0.75);

        // Verify exact values for quadratic ease-in: t²
        assert!((val_0_25 - 0.0625).abs() < 0.001); // 0.25² = 0.0625
        assert!((val_0_5 - 0.25).abs() < 0.001); // 0.5² = 0.25
        assert!((val_0_75 - 0.5625).abs() < 0.001); // 0.75² = 0.5625
    }

    #[test]
    fn test_ease_out_interpolation() {
        let mut anim = KeyframeAnimation::new(InterpolationType::EaseOut);
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 1.0));

        // Ease-out should start fast (values > linear) and end slow
        let val_0_25 = anim.evaluate(0.25);
        let val_0_5 = anim.evaluate(0.5);
        let val_0_75 = anim.evaluate(0.75);

        // At t=0.25, ease-out should be faster than linear (> 0.25)
        assert!(val_0_25 > 0.25);
        // At t=0.5, ease-out should be faster than linear (> 0.5)
        assert!(val_0_5 > 0.5);
        // At t=0.75, quadratic ease-out remains above linear.
        assert!(val_0_75 > 0.75);

        // Verify exact values for quadratic ease-out: t * (2 - t)
        assert!((val_0_25 - 0.4375).abs() < 0.001); // 0.25 * 1.75 = 0.4375
        assert!((val_0_5 - 0.75).abs() < 0.001); // 0.5 * 1.5 = 0.75
        assert!((val_0_75 - 0.9375).abs() < 0.001); // 0.75 * 1.25 = 0.9375
    }

    #[test]
    fn test_ease_in_out_interpolation() {
        let mut anim = KeyframeAnimation::new(InterpolationType::EaseInOut);
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 1.0));

        // Ease-in-out should start slow, accelerate in middle, end slow
        let val_0_25 = anim.evaluate(0.25);
        let val_0_5 = anim.evaluate(0.5);
        let val_0_75 = anim.evaluate(0.75);

        // At t=0.25, should be slower than linear (< 0.25)
        assert!(val_0_25 < 0.25);
        // At t=0.5, should be exactly at midpoint
        assert!((val_0_5 - 0.5).abs() < 0.001);
        // At t=0.75, ease-in-out is above linear on the second half.
        assert!(val_0_75 > 0.75);

        // Verify exact values for cubic ease-in-out
        // t < 0.5: 2t²
        assert!((val_0_25 - 0.125).abs() < 0.001); // 2 * 0.25² = 0.125
                                                   // t >= 0.5: 1 - (-2t + 2)² / 2
        assert!((val_0_75 - 0.875).abs() < 0.001); // 1 - 0.5² / 2 = 0.875
    }

    #[test]
    fn test_bezier_interpolation_with_tangents() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Bezier);

        // Create keyframes with tangents
        // Tangents at (0.33, 0.33) and (0.67, 0.67) create a smooth S-curve
        anim.add_keyframe(Keyframe::with_tangents(
            0.0,
            0.0,
            Vec2::new(0.0, 0.0),
            Vec2::new(0.33, 0.33),
        ));
        anim.add_keyframe(Keyframe::with_tangents(
            1.0,
            1.0,
            Vec2::new(0.67, 0.67),
            Vec2::new(1.0, 1.0),
        ));

        // Test that interpolation produces smooth curve
        let val_0_25 = anim.evaluate(0.25);
        let val_0_5 = anim.evaluate(0.5);
        let val_0_75 = anim.evaluate(0.75);

        // Values should be between 0 and 1
        assert!(val_0_25 >= 0.0 && val_0_25 <= 1.0);
        assert!(val_0_5 >= 0.0 && val_0_5 <= 1.0);
        assert!(val_0_75 >= 0.0 && val_0_75 <= 1.0);

        // Values should be monotonically increasing
        assert!(val_0_25 < val_0_5);
        assert!(val_0_5 < val_0_75);
    }

    #[test]
    fn test_bezier_interpolation_without_tangents_falls_back_to_linear() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Bezier);

        // Create keyframes without tangents
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 1.0));

        // Should fall back to linear interpolation
        assert_eq!(anim.evaluate(0.0), 0.0);
        assert_eq!(anim.evaluate(0.5), 0.5);
        assert_eq!(anim.evaluate(1.0), 1.0);
    }

    #[test]
    fn test_multiple_keyframes_interpolation() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 0.5));
        anim.add_keyframe(Keyframe::new(2.0, 1.0));
        anim.add_keyframe(Keyframe::new(3.0, 0.0));

        // Test interpolation between each pair of keyframes
        assert_eq!(anim.evaluate(0.0), 0.0);
        assert_eq!(anim.evaluate(0.5), 0.25); // Between 0.0 and 0.5
        assert_eq!(anim.evaluate(1.0), 0.5);
        assert_eq!(anim.evaluate(1.5), 0.75); // Between 0.5 and 1.0
        assert_eq!(anim.evaluate(2.0), 1.0);
        assert_eq!(anim.evaluate(2.5), 0.5); // Between 1.0 and 0.0
        assert_eq!(anim.evaluate(3.0), 0.0);
    }

    #[test]
    fn test_keyframes_added_out_of_order_are_sorted() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);

        // Add keyframes out of order
        anim.add_keyframe(Keyframe::new(2.0, 1.0));
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 0.5));

        // Interpolation should still work correctly
        assert_eq!(anim.evaluate(0.0), 0.0);
        assert_eq!(anim.evaluate(0.5), 0.25);
        assert_eq!(anim.evaluate(1.0), 0.5);
        assert_eq!(anim.evaluate(1.5), 0.75);
        assert_eq!(anim.evaluate(2.0), 1.0);
    }

    #[test]
    fn test_interpolation_with_negative_values() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(0.0, -1.0));
        anim.add_keyframe(Keyframe::new(1.0, 1.0));

        assert_eq!(anim.evaluate(0.0), -1.0);
        assert_eq!(anim.evaluate(0.5), 0.0);
        assert_eq!(anim.evaluate(1.0), 1.0);
    }

    #[test]
    fn test_interpolation_with_large_values() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Linear);
        anim.add_keyframe(Keyframe::new(0.0, 0.0));
        anim.add_keyframe(Keyframe::new(1.0, 1000.0));

        assert_eq!(anim.evaluate(0.0), 0.0);
        assert_eq!(anim.evaluate(0.5), 500.0);
        assert_eq!(anim.evaluate(1.0), 1000.0);
    }

    #[test]
    fn test_bezier_extreme_tangents() {
        let mut anim = KeyframeAnimation::new(InterpolationType::Bezier);

        // Create keyframes with extreme tangents (overshoot)
        anim.add_keyframe(Keyframe::with_tangents(
            0.0,
            0.0,
            Vec2::new(0.0, 0.0),
            Vec2::new(0.5, 2.0), // Overshoot upward
        ));
        anim.add_keyframe(Keyframe::with_tangents(
            1.0,
            1.0,
            Vec2::new(0.5, -1.0), // Overshoot downward
            Vec2::new(1.0, 1.0),
        ));

        // Values should be clamped to [0, 1]
        let val_0_5 = anim.evaluate(0.5);
        assert!(val_0_5 >= 0.0 && val_0_5 <= 1.0);
    }

    // ============================================================================
    // AnimationEngine Tests
    // ============================================================================

    #[test]
    fn test_animation_engine_creation() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        // Just verify it can be created
        let animation_data = AnimationData::new(1.0);
        let result = engine.evaluate_keyframe(&animation_data, 0.5);
        assert!(result.is_empty()); // No tracks, so empty result
    }

    #[test]
    fn test_evaluate_keyframe_single_track() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        // Create animation with single track
        let mut animation_data = AnimationData::new(2.0);
        animation_data.loop_mode = LoopMode::Once;
        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(2.0, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // Evaluate at different times
        let result_0 = engine.evaluate_keyframe(&animation_data, 0.0);
        let result_1 = engine.evaluate_keyframe(&animation_data, 1.0);
        let result_2 = engine.evaluate_keyframe(&animation_data, 2.0);

        assert_eq!(result_0.get(&AnimationParameter::Roughness), Some(&0.0));
        assert_eq!(result_1.get(&AnimationParameter::Roughness), Some(&0.5));
        assert_eq!(result_2.get(&AnimationParameter::Roughness), Some(&1.0));
    }

    #[test]
    fn test_evaluate_keyframe_multiple_tracks() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        // Create animation with multiple tracks
        let mut animation_data = AnimationData::new(1.0);

        // Roughness track
        let mut roughness_anim = KeyframeAnimation::new(InterpolationType::Linear);
        roughness_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        roughness_anim.add_keyframe(Keyframe::new(1.0, 1.0));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            roughness_anim,
        ));

        // Metallic track
        let mut metallic_anim = KeyframeAnimation::new(InterpolationType::Linear);
        metallic_anim.add_keyframe(Keyframe::new(0.0, 1.0));
        metallic_anim.add_keyframe(Keyframe::new(1.0, 0.0));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Metallic,
            metallic_anim,
        ));

        // Evaluate at midpoint
        let result = engine.evaluate_keyframe(&animation_data, 0.5);

        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.5));
        assert_eq!(result.get(&AnimationParameter::Metallic), Some(&0.5));
    }

    #[test]
    fn test_loop_mode_once() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(2.0);
        animation_data.loop_mode = LoopMode::Once;

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(2.0, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // Time before start should clamp to 0
        let result_neg = engine.evaluate_keyframe(&animation_data, -1.0);
        assert_eq!(result_neg.get(&AnimationParameter::Roughness), Some(&0.0));

        // Time within range should interpolate normally
        let result_mid = engine.evaluate_keyframe(&animation_data, 1.0);
        assert_eq!(result_mid.get(&AnimationParameter::Roughness), Some(&0.5));

        // Time after end should clamp to duration
        let result_over = engine.evaluate_keyframe(&animation_data, 5.0);
        assert_eq!(result_over.get(&AnimationParameter::Roughness), Some(&1.0));
    }

    #[test]
    fn test_loop_mode_loop() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(2.0);
        animation_data.loop_mode = LoopMode::Loop;

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(2.0, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // Time at 0.5 should be 0.25 (0.5 / 2.0 = 0.25)
        let result_0_5 = engine.evaluate_keyframe(&animation_data, 0.5);
        assert_eq!(result_0_5.get(&AnimationParameter::Roughness), Some(&0.25));

        // Time at 2.5 should wrap to 0.5, giving value 0.25
        let result_2_5 = engine.evaluate_keyframe(&animation_data, 2.5);
        assert_eq!(result_2_5.get(&AnimationParameter::Roughness), Some(&0.25));

        // Time at 4.5 should wrap to 0.5, giving value 0.25
        let result_4_5 = engine.evaluate_keyframe(&animation_data, 4.5);
        assert_eq!(result_4_5.get(&AnimationParameter::Roughness), Some(&0.25));

        // Time at exactly 2.0 should wrap to 0.0
        let result_2_0 = engine.evaluate_keyframe(&animation_data, 2.0);
        assert_eq!(result_2_0.get(&AnimationParameter::Roughness), Some(&0.0));
    }

    #[test]
    fn test_loop_mode_ping_pong() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(2.0);
        animation_data.loop_mode = LoopMode::PingPong;

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(2.0, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // First cycle (0-2): forward direction
        let result_0_5 = engine.evaluate_keyframe(&animation_data, 0.5);
        assert_eq!(result_0_5.get(&AnimationParameter::Roughness), Some(&0.25));

        let result_1_0 = engine.evaluate_keyframe(&animation_data, 1.0);
        assert_eq!(result_1_0.get(&AnimationParameter::Roughness), Some(&0.5));

        // Second cycle (2-4): reverse direction
        // At time 2.5, we're 0.5 into the second cycle
        // Reversed: 2.0 - 0.5 = 1.5, which gives value 0.75
        let result_2_5 = engine.evaluate_keyframe(&animation_data, 2.5);
        assert_eq!(result_2_5.get(&AnimationParameter::Roughness), Some(&0.75));

        // At time 3.0, we're 1.0 into the second cycle
        // Reversed: 2.0 - 1.0 = 1.0, which gives value 0.5
        let result_3_0 = engine.evaluate_keyframe(&animation_data, 3.0);
        assert_eq!(result_3_0.get(&AnimationParameter::Roughness), Some(&0.5));

        // Third cycle (4-6): forward direction again
        // At time 4.5, we're 0.5 into the third cycle
        // Forward: 0.5, which gives value 0.25
        let result_4_5 = engine.evaluate_keyframe(&animation_data, 4.5);
        assert_eq!(result_4_5.get(&AnimationParameter::Roughness), Some(&0.25));
    }

    #[test]
    fn test_loop_mode_ping_pong_at_boundaries() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(1.0);
        animation_data.loop_mode = LoopMode::PingPong;

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(1.0, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // At exact cycle boundaries
        let result_0 = engine.evaluate_keyframe(&animation_data, 0.0);
        assert_eq!(result_0.get(&AnimationParameter::Roughness), Some(&0.0));

        let result_1 = engine.evaluate_keyframe(&animation_data, 1.0);
        assert_eq!(result_1.get(&AnimationParameter::Roughness), Some(&1.0));

        let result_2 = engine.evaluate_keyframe(&animation_data, 2.0);
        assert_eq!(result_2.get(&AnimationParameter::Roughness), Some(&0.0));

        let result_3 = engine.evaluate_keyframe(&animation_data, 3.0);
        assert_eq!(result_3.get(&AnimationParameter::Roughness), Some(&1.0));
    }

    #[test]
    fn test_evaluate_keyframe_with_all_interpolation_types() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(1.0);

        // Add tracks with different interpolation types
        let mut linear_anim = KeyframeAnimation::new(InterpolationType::Linear);
        linear_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        linear_anim.add_keyframe(Keyframe::new(1.0, 1.0));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            linear_anim,
        ));

        let mut ease_in_anim = KeyframeAnimation::new(InterpolationType::EaseIn);
        ease_in_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        ease_in_anim.add_keyframe(Keyframe::new(1.0, 1.0));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Metallic,
            ease_in_anim,
        ));

        let mut ease_out_anim = KeyframeAnimation::new(InterpolationType::EaseOut);
        ease_out_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        ease_out_anim.add_keyframe(Keyframe::new(1.0, 1.0));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::EmissiveIntensity,
            ease_out_anim,
        ));

        // Evaluate at midpoint
        let result = engine.evaluate_keyframe(&animation_data, 0.5);

        // Linear should be exactly 0.5
        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.5));

        // EaseIn should be less than 0.5 (slow start)
        let metallic = result.get(&AnimationParameter::Metallic).unwrap();
        assert!(*metallic < 0.5);

        // EaseOut should be greater than 0.5 (fast start)
        let emissive = result.get(&AnimationParameter::EmissiveIntensity).unwrap();
        assert!(*emissive > 0.5);
    }

    #[test]
    fn test_evaluate_keyframe_handles_procedural_and_skips_physics() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(1.0);

        // Add a keyframe track (should be evaluated)
        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(1.0, 1.0));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // Add a procedural track (should be evaluated)
        animation_data.add_track(AnimationTrack::procedural(
            AnimationParameter::Metallic,
            ProceduralAnimation {
                expression: "sin(t)".to_string(),
            },
        ));

        // Add a physics track (should be skipped)
        animation_data.add_track(AnimationTrack::physics(
            AnimationParameter::EmissiveIntensity,
            PhysicsAnimation {
                simulation_type: SimulationType::RustSpreading,
            },
        ));

        // Evaluate
        let result = engine.evaluate_keyframe(&animation_data, 0.5);

        // Keyframe and procedural tracks should be in the result; physics is still skipped.
        assert_eq!(result.len(), 2);
        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.5));
        assert!(result.get(&AnimationParameter::Metallic).is_some());
        assert_eq!(result.get(&AnimationParameter::EmissiveIntensity), None);
    }

    #[test]
    fn test_evaluate_keyframe_with_zero_duration() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(0.0);

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.5));
        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // Should handle gracefully without panicking
        let result = engine.evaluate_keyframe(&animation_data, 1.0);
        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.5));
    }

    #[test]
    fn test_evaluate_keyframe_with_negative_time_loop_mode() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(2.0);
        animation_data.loop_mode = LoopMode::Loop;

        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(2.0, 1.0));

        animation_data.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        // Negative time should wrap correctly
        let result = engine.evaluate_keyframe(&animation_data, -0.5);
        // -0.5 + ceil(0.5/2.0) * 2.0 = -0.5 + 2.0 = 1.5
        // 1.5 / 2.0 = 0.75
        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.75));
    }

    #[test]
    fn test_all_animation_parameters_can_be_animated() {
        let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
        let engine = AnimationEngine::new(gpu_compute);

        let mut animation_data = AnimationData::new(1.0);

        // Create a track for each parameter type
        let parameters = vec![
            AnimationParameter::LayerOpacity,
            AnimationParameter::AlbedoRed,
            AnimationParameter::AlbedoGreen,
            AnimationParameter::AlbedoBlue,
            AnimationParameter::Roughness,
            AnimationParameter::Metallic,
            AnimationParameter::EmissiveIntensity,
            AnimationParameter::HeightOffset,
            AnimationParameter::NormalStrength,
            AnimationParameter::UVOffsetX,
            AnimationParameter::UVOffsetY,
        ];

        for (i, param) in parameters.iter().enumerate() {
            let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
            keyframe_anim.add_keyframe(Keyframe::new(0.0, i as f32));
            keyframe_anim.add_keyframe(Keyframe::new(1.0, (i + 1) as f32));
            animation_data.add_track(AnimationTrack::keyframe(*param, keyframe_anim));
        }

        // Evaluate at midpoint
        let result = engine.evaluate_keyframe(&animation_data, 0.5);

        // Verify all parameters are present
        assert_eq!(result.len(), parameters.len());

        for (i, param) in parameters.iter().enumerate() {
            let expected = i as f32 + 0.5;
            assert_eq!(result.get(param), Some(&expected));
        }
    }

    // ========================================================================
    // Expression Evaluator Tests
    // ========================================================================

    #[test]
    fn test_expression_evaluator_creation() {
        let evaluator = ExpressionEvaluator::new();
        // Should be able to create without errors
        let _ = evaluator;
    }

    #[test]
    fn test_expression_simple_time_variable() {
        let evaluator = ExpressionEvaluator::new();

        // Simple time variable
        let result = evaluator.evaluate("t", 5.0).unwrap();
        assert_eq!(result, 5.0);

        // Time with multiplication
        let result = evaluator.evaluate("t * 2.0", 3.0).unwrap();
        assert_eq!(result, 6.0);
    }

    #[test]
    fn test_expression_basic_operators() {
        let evaluator = ExpressionEvaluator::new();

        // Addition
        let result = evaluator.evaluate("t + 1.0", 2.0).unwrap();
        assert_eq!(result, 3.0);

        // Subtraction
        let result = evaluator.evaluate("t - 1.0", 5.0).unwrap();
        assert_eq!(result, 4.0);

        // Multiplication
        let result = evaluator.evaluate("t * 3.0", 2.0).unwrap();
        assert_eq!(result, 6.0);

        // Division
        let result = evaluator.evaluate("t / 2.0", 8.0).unwrap();
        assert_eq!(result, 4.0);

        // Exponentiation
        let result = evaluator.evaluate("t ^ 2.0", 3.0).unwrap();
        assert_eq!(result, 9.0);
    }

    #[test]
    fn test_expression_operator_precedence() {
        let evaluator = ExpressionEvaluator::new();

        // Multiplication before addition
        let result = evaluator.evaluate("t + 2.0 * 3.0", 1.0).unwrap();
        assert_eq!(result, 7.0);

        // Parentheses override precedence
        let result = evaluator.evaluate("(t + 2.0) * 3.0", 1.0).unwrap();
        assert_eq!(result, 9.0);

        // Exponentiation before multiplication
        let result = evaluator.evaluate("2.0 * t ^ 2.0", 3.0).unwrap();
        assert_eq!(result, 18.0);
    }

    #[test]
    fn test_expression_sin_function() {
        let evaluator = ExpressionEvaluator::new();

        // sin(0) = 0
        let result = evaluator.evaluate("sin(t)", 0.0).unwrap();
        assert!((result - 0.0).abs() < 0.0001);

        // sin(π/2) ≈ 1
        let result = evaluator
            .evaluate("sin(t)", std::f32::consts::PI / 2.0)
            .unwrap();
        assert!((result - 1.0).abs() < 0.0001);

        // Sine wave oscillation: sin(t * 2.0) * 0.5 + 0.5
        let result = evaluator.evaluate("sin(t * 2.0) * 0.5 + 0.5", 0.0).unwrap();
        assert!((result - 0.5).abs() < 0.0001);
    }

    #[test]
    fn test_expression_cos_function() {
        let evaluator = ExpressionEvaluator::new();

        // cos(0) = 1
        let result = evaluator.evaluate("cos(t)", 0.0).unwrap();
        assert!((result - 1.0).abs() < 0.0001);

        // cos(π) ≈ -1
        let result = evaluator.evaluate("cos(t)", std::f32::consts::PI).unwrap();
        assert!((result + 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_expression_tan_function() {
        let evaluator = ExpressionEvaluator::new();

        // tan(0) = 0
        let result = evaluator.evaluate("tan(t)", 0.0).unwrap();
        assert!((result - 0.0).abs() < 0.0001);

        // tan(π/4) ≈ 1
        let result = evaluator
            .evaluate("tan(t)", std::f32::consts::PI / 4.0)
            .unwrap();
        assert!((result - 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_expression_abs_function() {
        let evaluator = ExpressionEvaluator::new();

        // abs(positive) = positive
        let result = evaluator.evaluate("abs(t)", 5.0).unwrap();
        assert_eq!(result, 5.0);

        // abs(negative) = positive
        let result = evaluator.evaluate("abs(t - 10.0)", 3.0).unwrap();
        assert_eq!(result, 7.0);

        // abs(sin(t)) for oscillating positive values
        let result = evaluator
            .evaluate("abs(sin(t))", std::f32::consts::PI)
            .unwrap();
        assert!(result.abs() < 0.0001); // sin(π) ≈ 0
    }

    #[test]
    fn test_expression_sqrt_function() {
        let evaluator = ExpressionEvaluator::new();

        // sqrt(4) = 2
        let result = evaluator.evaluate("sqrt(t)", 4.0).unwrap();
        assert_eq!(result, 2.0);

        // sqrt(9) = 3
        let result = evaluator.evaluate("sqrt(t)", 9.0).unwrap();
        assert_eq!(result, 3.0);

        // sqrt(0) = 0
        let result = evaluator.evaluate("sqrt(t)", 0.0).unwrap();
        assert_eq!(result, 0.0);
    }

    #[test]
    fn test_expression_pow_function() {
        let evaluator = ExpressionEvaluator::new();

        // pow(2, 3) = 8
        let result = evaluator.evaluate("pow(2.0, t)", 3.0).unwrap();
        assert_eq!(result, 8.0);

        // pow(t, 2) = t^2
        let result = evaluator.evaluate("pow(t, 2.0)", 5.0).unwrap();
        assert_eq!(result, 25.0);

        // pow(t, 0.5) = sqrt(t)
        let result = evaluator.evaluate("pow(t, 0.5)", 16.0).unwrap();
        assert_eq!(result, 4.0);
    }

    #[test]
    fn test_expression_min_function() {
        let evaluator = ExpressionEvaluator::new();

        // min(5, 3) = 3
        let result = evaluator.evaluate("min(5.0, t)", 3.0).unwrap();
        assert_eq!(result, 3.0);

        // min(2, 8) = 2
        let result = evaluator.evaluate("min(t, 8.0)", 2.0).unwrap();
        assert_eq!(result, 2.0);
    }

    #[test]
    fn test_expression_max_function() {
        let evaluator = ExpressionEvaluator::new();

        // max(5, 3) = 5
        let result = evaluator.evaluate("max(5.0, t)", 3.0).unwrap();
        assert_eq!(result, 5.0);

        // max(2, 8) = 8
        let result = evaluator.evaluate("max(t, 8.0)", 2.0).unwrap();
        assert_eq!(result, 8.0);
    }

    #[test]
    fn test_expression_clamp_function() {
        let evaluator = ExpressionEvaluator::new();

        // clamp(5, 0, 10) = 5 (within range)
        let result = evaluator.evaluate("clamp(t, 0.0, 10.0)", 5.0).unwrap();
        assert_eq!(result, 5.0);

        // clamp(-5, 0, 10) = 0 (below min)
        let result = evaluator.evaluate("clamp(t, 0.0, 10.0)", -5.0).unwrap();
        assert_eq!(result, 0.0);

        // clamp(15, 0, 10) = 10 (above max)
        let result = evaluator.evaluate("clamp(t, 0.0, 10.0)", 15.0).unwrap();
        assert_eq!(result, 10.0);
    }

    #[test]
    fn test_expression_lerp_function() {
        let evaluator = ExpressionEvaluator::new();

        // lerp(0, 10, 0.5) = 5
        let result = evaluator.evaluate("lerp(0.0, 10.0, t)", 0.5).unwrap();
        assert_eq!(result, 5.0);

        // lerp(0, 10, 0) = 0
        let result = evaluator.evaluate("lerp(0.0, 10.0, t)", 0.0).unwrap();
        assert_eq!(result, 0.0);

        // lerp(0, 10, 1) = 10
        let result = evaluator.evaluate("lerp(0.0, 10.0, t)", 1.0).unwrap();
        assert_eq!(result, 10.0);

        // lerp with abs(sin(t))
        let result = evaluator
            .evaluate("lerp(0.2, 0.8, abs(sin(t)))", 0.0)
            .unwrap();
        assert!((result - 0.2).abs() < 0.0001);
    }

    #[test]
    fn test_expression_complex_combinations() {
        let evaluator = ExpressionEvaluator::new();

        // Sine wave oscillation: sin(t * 2.0) * 0.5 + 0.5
        let result = evaluator.evaluate("sin(t * 2.0) * 0.5 + 0.5", 0.0).unwrap();
        assert!((result - 0.5).abs() < 0.0001);

        // Complex combination: abs(sin(t)) * pow(t, 0.5)
        let result = evaluator
            .evaluate("abs(sin(t)) * pow(t, 0.5)", 4.0)
            .unwrap();
        let expected = (4.0_f32.sin().abs() * 2.0) as f32;
        assert!((result - expected).abs() < 0.001);

        // Nested functions: clamp(sin(t) * 2.0, -1.0, 1.0)
        let result = evaluator
            .evaluate("clamp(sin(t) * 2.0, -1.0, 1.0)", 0.0)
            .unwrap();
        assert!((result - 0.0).abs() < 0.0001);
    }

    #[test]
    fn test_expression_validation_valid() {
        let evaluator = ExpressionEvaluator::new();

        // Valid expressions should pass validation
        assert!(evaluator.validate("t").is_ok());
        assert!(evaluator.validate("sin(t * 2.0)").is_ok());
        assert!(evaluator.validate("lerp(0.0, 1.0, t)").is_ok());
        assert!(evaluator.validate("abs(sin(t)) * pow(t, 0.5)").is_ok());
    }

    #[test]
    fn test_expression_validation_invalid() {
        let evaluator = ExpressionEvaluator::new();

        // Invalid expressions should fail validation
        assert!(evaluator.validate("sin(").is_err());
        assert!(evaluator.validate("t +").is_err());
        assert!(evaluator.validate("unknown_function(t)").is_err());
        assert!(evaluator.validate("").is_err());
    }

    #[test]
    fn test_expression_error_includes_expression_text() {
        let evaluator = ExpressionEvaluator::new();

        // Invalid expression
        let result = evaluator.evaluate("sin(", 1.0);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("sin("),
            "Error message should include the expression text"
        );

        // Division by zero
        let result = evaluator.evaluate("t / 0.0", 1.0);
        // Note: evalexpr may handle division by zero differently, but error should include expression
        if result.is_err() {
            let error = result.unwrap_err();
            assert!(
                error.contains("t / 0.0"),
                "Error message should include the expression text"
            );
        }
    }

    #[test]
    fn test_expression_unary_negation() {
        let evaluator = ExpressionEvaluator::new();

        // Unary minus
        let result = evaluator.evaluate("-t", 5.0).unwrap();
        assert_eq!(result, -5.0);

        // Unary minus with expression
        let result = evaluator.evaluate("-(t + 2.0)", 3.0).unwrap();
        assert_eq!(result, -5.0);
    }

    #[test]
    fn test_expression_with_constants() {
        let evaluator = ExpressionEvaluator::new();

        // Expression with only constants (no time variable)
        let result = evaluator.evaluate("2.0 + 3.0", 0.0).unwrap();
        assert_eq!(result, 5.0);

        // Mix of constants and time
        let result = evaluator.evaluate("10.0 - t", 3.0).unwrap();
        assert_eq!(result, 7.0);
    }

    #[test]
    fn test_expression_floating_point_precision() {
        let evaluator = ExpressionEvaluator::new();

        // Test with very small numbers
        let result = evaluator.evaluate("t * 0.001", 1.0).unwrap();
        assert!((result - 0.001).abs() < 0.00001);

        // Test with very large numbers
        let result = evaluator.evaluate("t * 1000.0", 1.0).unwrap();
        assert_eq!(result, 1000.0);
    }

    #[test]
    fn test_expression_real_world_examples() {
        let evaluator = ExpressionEvaluator::new();

        // Pulsing emissive: abs(sin(t * 3.14159))
        let result = evaluator.evaluate("abs(sin(t * 3.14159))", 0.5).unwrap();
        assert!(result >= 0.0 && result <= 1.0);

        // Breathing effect: sin(t) * 0.1 + 0.9
        let result = evaluator.evaluate("sin(t) * 0.1 + 0.9", 0.0).unwrap();
        assert!((result - 0.9).abs() < 0.0001);

        // Flickering: abs(sin(t * 10.0)) * 0.3 + 0.7
        let result = evaluator
            .evaluate("abs(sin(t * 10.0)) * 0.3 + 0.7", 0.0)
            .unwrap();
        assert!((result - 0.7).abs() < 0.0001);
    }

    // ========================================================================
    // Noise Function Tests
    // ========================================================================

    #[test]
    fn test_perlin_noise_basic() {
        let evaluator = ExpressionEvaluator::new();

        // Basic perlin noise call
        let result = evaluator.evaluate("perlin(t, 1.0, 1.0)", 0.0).unwrap();
        // Perlin noise returns values in range [-1, 1], so with amplitude 1.0 it should be in that range
        assert!(result >= -1.0 && result <= 1.0);

        // Test with different time values - should produce different results
        let result1 = evaluator.evaluate("perlin(t, 0.73, 1.0)", 0.25).unwrap();
        let result2 = evaluator.evaluate("perlin(t, 0.73, 1.0)", 0.75).unwrap();
        let result3 = evaluator.evaluate("perlin(t, 0.73, 1.0)", 1.25).unwrap();

        // Results should be different (noise is continuous but not constant)
        assert_ne!(result1, result2);
        assert_ne!(result2, result3);
    }

    #[test]
    fn test_perlin_noise_frequency() {
        let evaluator = ExpressionEvaluator::new();

        // Higher frequency should produce more variation
        let low_freq = evaluator.evaluate("perlin(t, 0.1, 1.0)", 5.0).unwrap();
        let high_freq = evaluator.evaluate("perlin(t, 10.0, 1.0)", 5.0).unwrap();

        // Both should be in valid range
        assert!(low_freq >= -1.0 && low_freq <= 1.0);
        assert!(high_freq >= -1.0 && high_freq <= 1.0);
    }

    #[test]
    fn test_perlin_noise_amplitude() {
        let evaluator = ExpressionEvaluator::new();

        // Test different amplitudes
        let small_amp = evaluator.evaluate("perlin(t, 1.0, 0.3)", 1.0).unwrap();
        let large_amp = evaluator.evaluate("perlin(t, 1.0, 2.0)", 1.0).unwrap();

        // Small amplitude should produce smaller values
        assert!(small_amp.abs() <= 0.3);
        // Large amplitude can produce larger values
        assert!(large_amp.abs() <= 2.0);
    }

    #[test]
    fn test_perlin_noise_in_expression() {
        let evaluator = ExpressionEvaluator::new();

        // Organic pulsing with Perlin noise: 0.5 + perlin(t, 1.0, 0.3)
        let result = evaluator
            .evaluate("0.5 + perlin(t, 1.0, 0.3)", 1.0)
            .unwrap();
        // Should be in range [0.5 - 0.3, 0.5 + 0.3] = [0.2, 0.8]
        assert!(result >= 0.2 - 0.01 && result <= 0.8 + 0.01); // Small epsilon for floating point
    }

    #[test]
    fn test_simplex_noise_basic() {
        let evaluator = ExpressionEvaluator::new();

        // Basic simplex noise call
        let result = evaluator.evaluate("simplex(t, 1.0, 1.0)", 0.0).unwrap();
        // Simplex noise also returns values in range [-1, 1]
        assert!(result >= -1.0 && result <= 1.0);

        // Test with different time values
        let result1 = evaluator.evaluate("simplex(t, 1.0, 1.0)", 0.0).unwrap();
        let result2 = evaluator.evaluate("simplex(t, 1.0, 1.0)", 1.0).unwrap();
        let result3 = evaluator.evaluate("simplex(t, 1.0, 1.0)", 2.0).unwrap();

        // Results should be different
        assert_ne!(result1, result2);
        assert_ne!(result2, result3);
    }

    #[test]
    fn test_simplex_noise_frequency_and_amplitude() {
        let evaluator = ExpressionEvaluator::new();

        // Test with different parameters
        let result1 = evaluator.evaluate("simplex(t, 0.5, 0.5)", 2.0).unwrap();
        let result2 = evaluator.evaluate("simplex(t, 2.0, 0.5)", 2.0).unwrap();

        // Both should be in valid range for amplitude 0.5
        assert!(result1.abs() <= 0.5);
        assert!(result2.abs() <= 0.5);
    }

    #[test]
    fn test_simplex_noise_in_expression() {
        let evaluator = ExpressionEvaluator::new();

        // Smoother variation: simplex(t * 2.0, 1.0, 0.3)
        let result = evaluator
            .evaluate("simplex(t * 2.0, 1.0, 0.3)", 1.0)
            .unwrap();
        assert!(result.abs() <= 0.3);
    }

    #[test]
    fn test_worley_noise_basic() {
        let evaluator = ExpressionEvaluator::new();

        // Basic worley noise call
        let result = evaluator.evaluate("worley(t, 1.0, 1.0)", 0.0).unwrap();
        // Worley noise returns distance values, typically in [0, 1] range but can vary
        assert!(result.is_finite());

        // Test with different time values
        let result1 = evaluator.evaluate("worley(t, 1.0, 1.0)", 0.0).unwrap();
        let result2 = evaluator.evaluate("worley(t, 1.0, 1.0)", 1.0).unwrap();
        let result3 = evaluator.evaluate("worley(t, 1.0, 1.0)", 2.0).unwrap();

        // Results should be different
        assert_ne!(result1, result2);
        assert_ne!(result2, result3);
    }

    #[test]
    fn test_worley_noise_cellular_patterns() {
        let evaluator = ExpressionEvaluator::new();

        // Cellular patterns with Worley: worley(t, 2.0, 1.0)
        let result = evaluator.evaluate("worley(t, 2.0, 1.0)", 0.5).unwrap();
        assert!(result.is_finite());

        // Test with amplitude scaling
        let result_scaled = evaluator
            .evaluate("worley(t * 0.5, 1.0, 0.8)", 1.0)
            .unwrap();
        assert!(result_scaled.is_finite());
    }

    #[test]
    fn test_fbm_basic() {
        let evaluator = ExpressionEvaluator::new();

        // Basic FBM call: fbm(x, frequency, amplitude, octaves, lacunarity, persistence)
        let result = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.0)
            .unwrap();
        assert!(result.is_finite());

        // FBM with 4 octaves should produce more detailed noise than single octave
        let single_octave = evaluator.evaluate("perlin(t, 1.0, 0.5)", 1.0).unwrap();
        let multi_octave = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.0)
            .unwrap();

        // Both should be finite
        assert!(single_octave.is_finite());
        assert!(multi_octave.is_finite());
    }

    #[test]
    fn test_fbm_octaves() {
        let evaluator = ExpressionEvaluator::new();

        // Test with different octave counts
        let octaves_1 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 1, 2.0, 0.5)", 1.0)
            .unwrap();
        let octaves_2 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 2, 2.0, 0.5)", 1.0)
            .unwrap();
        let octaves_4 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.0)
            .unwrap();
        let octaves_8 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 8, 2.0, 0.5)", 1.0)
            .unwrap();

        // All should be finite
        assert!(octaves_1.is_finite());
        assert!(octaves_2.is_finite());
        assert!(octaves_4.is_finite());
        assert!(octaves_8.is_finite());
    }

    #[test]
    fn test_fbm_lacunarity_and_persistence() {
        let evaluator = ExpressionEvaluator::new();

        // Test with different lacunarity (frequency multiplier)
        let lac_2 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.0)
            .unwrap();
        let lac_3 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 3.0, 0.5)", 1.0)
            .unwrap();

        // Test with different persistence (amplitude multiplier)
        let pers_05 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.0)
            .unwrap();
        let pers_07 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.7)", 1.0)
            .unwrap();

        // All should be finite
        assert!(lac_2.is_finite());
        assert!(lac_3.is_finite());
        assert!(pers_05.is_finite());
        assert!(pers_07.is_finite());
    }

    #[test]
    fn test_fbm_detailed_organic_noise() {
        let evaluator = ExpressionEvaluator::new();

        // Detailed organic noise: fbm(t, 1.0, 0.5, 4, 2.0, 0.5)
        let result = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 2.5)
            .unwrap();
        assert!(result.is_finite());

        // Test continuity - nearby time values should produce similar results
        let t1 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.0)
            .unwrap();
        let t2 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", 1.01)
            .unwrap();

        // Should be continuous (nearby values should be similar)
        assert!((t1 - t2).abs() < 0.5); // Reasonable continuity threshold
    }

    #[test]
    fn test_noise_functions_combined() {
        let evaluator = ExpressionEvaluator::new();

        // Combine multiple noise functions
        let result = evaluator
            .evaluate("perlin(t, 1.0, 0.3) + simplex(t * 2.0, 1.0, 0.2)", 1.0)
            .unwrap();
        assert!(result.is_finite());

        // Mix noise with trigonometric functions
        let result = evaluator
            .evaluate("sin(t) * perlin(t, 1.0, 0.5)", 1.0)
            .unwrap();
        assert!(result.is_finite());

        // Complex layered effect
        let result = evaluator
            .evaluate(
                "0.5 + perlin(t, 1.0, 0.2) + simplex(t * 3.0, 1.0, 0.1)",
                1.0,
            )
            .unwrap();
        assert!(result.is_finite());
    }

    #[test]
    fn test_noise_with_clamp() {
        let evaluator = ExpressionEvaluator::new();

        // Clamp noise to specific range
        let result = evaluator
            .evaluate("clamp(perlin(t, 1.0, 1.0), 0.0, 1.0)", 1.0)
            .unwrap();
        assert!(result >= 0.0 && result <= 1.0);

        // Clamp FBM to range
        let result = evaluator
            .evaluate("clamp(fbm(t, 1.0, 0.5, 4, 2.0, 0.5), -0.5, 0.5)", 1.0)
            .unwrap();
        assert!(result >= -0.5 && result <= 0.5);
    }

    #[test]
    fn test_noise_with_lerp() {
        let evaluator = ExpressionEvaluator::new();

        // Use noise to drive lerp
        let result = evaluator
            .evaluate("lerp(0.2, 0.8, abs(perlin(t, 1.0, 1.0)))", 1.0)
            .unwrap();
        // abs(perlin) is in [0, 1], so lerp result should be in [0.2, 0.8]
        assert!(result >= 0.2 - 0.01 && result <= 0.8 + 0.01);
    }

    #[test]
    fn test_noise_real_world_use_cases() {
        let evaluator = ExpressionEvaluator::new();

        // Flowing water effect: 0.5 + perlin(t * 0.5, 1.0, 0.3)
        let water = evaluator
            .evaluate("0.5 + perlin(t * 0.5, 1.0, 0.3)", 2.0)
            .unwrap();
        assert!(water >= 0.2 - 0.01 && water <= 0.8 + 0.01);

        // Flickering fire: abs(simplex(t * 10.0, 1.0, 0.5)) * 0.5 + 0.5
        let fire = evaluator
            .evaluate("abs(simplex(t * 10.0, 1.0, 0.5)) * 0.5 + 0.5", 1.0)
            .unwrap();
        assert!(fire >= 0.5 && fire <= 1.0);

        // Organic pulsing: 0.7 + fbm(t, 1.0, 0.2, 3, 2.0, 0.5)
        let pulse = evaluator
            .evaluate("0.7 + fbm(t, 1.0, 0.2, 3, 2.0, 0.5)", 1.5)
            .unwrap();
        assert!(pulse.is_finite());

        // Cellular texture variation: worley(t * 0.3, 2.0, 0.8)
        let cellular = evaluator
            .evaluate("worley(t * 0.3, 2.0, 0.8)", 3.0)
            .unwrap();
        assert!(cellular.is_finite());
    }

    #[test]
    fn test_noise_validation() {
        let evaluator = ExpressionEvaluator::new();

        // Valid noise expressions should pass validation
        assert!(evaluator.validate("perlin(t, 1.0, 0.5)").is_ok());
        assert!(evaluator.validate("simplex(t, 1.0, 0.5)").is_ok());
        assert!(evaluator.validate("worley(t, 1.0, 0.5)").is_ok());
        assert!(evaluator.validate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)").is_ok());

        // Complex expressions with noise
        assert!(evaluator
            .validate("0.5 + perlin(t * 2.0, 1.0, 0.3)")
            .is_ok());
        assert!(evaluator.validate("sin(t) * simplex(t, 1.0, 0.5)").is_ok());
    }

    #[test]
    fn test_noise_error_handling() {
        let evaluator = ExpressionEvaluator::new();

        // Wrong number of arguments for perlin (needs 3)
        let result = evaluator.evaluate("perlin(t, 1.0)", 1.0);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.contains("perlin"));

        // Wrong number of arguments for fbm (needs 6)
        let result = evaluator.evaluate("fbm(t, 1.0, 0.5)", 1.0);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.contains("fbm"));
    }

    #[test]
    fn test_noise_continuity() {
        let evaluator = ExpressionEvaluator::new();

        // Test that noise functions are continuous
        // Nearby time values should produce similar results

        let t1 = 1.0;
        let t2 = 1.001; // Very close time value

        let perlin1 = evaluator.evaluate("perlin(t, 1.0, 1.0)", t1).unwrap();
        let perlin2 = evaluator.evaluate("perlin(t, 1.0, 1.0)", t2).unwrap();
        assert!((perlin1 - perlin2).abs() < 0.1); // Should be very similar

        let simplex1 = evaluator.evaluate("simplex(t, 1.0, 1.0)", t1).unwrap();
        let simplex2 = evaluator.evaluate("simplex(t, 1.0, 1.0)", t2).unwrap();
        assert!((simplex1 - simplex2).abs() < 0.1);

        let fbm1 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", t1)
            .unwrap();
        let fbm2 = evaluator
            .evaluate("fbm(t, 1.0, 0.5, 4, 2.0, 0.5)", t2)
            .unwrap();
        assert!((fbm1 - fbm2).abs() < 0.1);
    }

    #[test]
    fn test_all_noise_functions_in_single_expression() {
        let evaluator = ExpressionEvaluator::new();

        // Kitchen sink: combine all noise types
        let expr =
            "perlin(t, 1.0, 0.2) + simplex(t * 2.0, 1.0, 0.15) + worley(t * 0.5, 1.0, 0.1) * 0.5";
        let result = evaluator.evaluate(expr, 1.0).unwrap();
        assert!(result.is_finite());

        // With FBM
        let expr = "fbm(t, 1.0, 0.3, 3, 2.0, 0.5) + perlin(t * 3.0, 1.0, 0.1)";
        let result = evaluator.evaluate(expr, 1.0).unwrap();
        assert!(result.is_finite());
    }

    // ============================================================================
    // Procedural Animation Evaluation Tests (Task 9.3)
    // ============================================================================

    #[test]
    fn test_evaluate_procedural_basic() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Add a simple procedural track: t * 0.5
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t * 0.5".to_string(),
            },
        ));

        let result = engine.evaluate_procedural(&animation, 2.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&1.0));

        let result = engine.evaluate_procedural(&animation, 4.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&2.0));
    }

    #[test]
    fn test_evaluate_procedural_uv_scrolling() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // UV scrolling in X direction at 0.5 units/second
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t * 0.5".to_string(),
            },
        ));

        // UV scrolling in Y direction at 0.2 units/second
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetY,
            ProceduralAnimation {
                expression: "t * 0.2".to_string(),
            },
        ));

        let result = engine.evaluate_procedural(&animation, 5.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&2.5));
        assert_eq!(result.get(&AnimationParameter::UVOffsetY), Some(&1.0));
    }

    #[test]
    fn test_evaluate_procedural_with_noise() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Procedural animation with Perlin noise
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::EmissiveIntensity,
            ProceduralAnimation {
                expression: "abs(perlin(t, 1.0, 0.5))".to_string(),
            },
        ));

        let result = engine.evaluate_procedural(&animation, 1.0);
        let value = result.get(&AnimationParameter::EmissiveIntensity).unwrap();
        assert!(value.is_finite());
        assert!(*value >= 0.0); // abs() ensures non-negative
    }

    #[test]
    fn test_evaluate_procedural_complex_expression() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Complex expression: sin wave oscillation
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::Roughness,
            ProceduralAnimation {
                expression: "sin(t * 2.0) * 0.5 + 0.5".to_string(),
            },
        ));

        let result = engine.evaluate_procedural(&animation, 0.0);
        let value = result.get(&AnimationParameter::Roughness).unwrap();
        assert!((value - 0.5).abs() < 0.01); // sin(0) = 0, so result is 0.5

        let result = engine.evaluate_procedural(&animation, std::f32::consts::PI / 4.0);
        let value = result.get(&AnimationParameter::Roughness).unwrap();
        assert!(*value > 0.5); // sin(π/2) = 1, so result approaches 1.0
    }

    #[test]
    fn test_evaluate_procedural_error_handling() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Add an invalid expression
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::Metallic,
            ProceduralAnimation {
                expression: "invalid_function(t)".to_string(),
            },
        ));

        // Should not panic, just skip the invalid track
        let result = engine.evaluate_procedural(&animation, 1.0);

        // The invalid track should not be in the result
        assert!(result.get(&AnimationParameter::Metallic).is_none());
    }

    #[test]
    fn test_evaluate_procedural_multiple_tracks() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Multiple procedural tracks
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t * 0.5".to_string(),
            },
        ));

        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::Roughness,
            ProceduralAnimation {
                expression: "sin(t) * 0.3 + 0.5".to_string(),
            },
        ));

        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::EmissiveIntensity,
            ProceduralAnimation {
                expression: "abs(perlin(t, 1.0, 0.5)) * 10.0".to_string(),
            },
        ));

        let result = engine.evaluate_procedural(&animation, 2.0);

        assert_eq!(result.len(), 3);
        assert!(result.contains_key(&AnimationParameter::UVOffsetX));
        assert!(result.contains_key(&AnimationParameter::Roughness));
        assert!(result.contains_key(&AnimationParameter::EmissiveIntensity));
    }

    #[test]
    fn test_evaluate_procedural_with_loop_mode_once() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(5.0);
        animation.loop_mode = LoopMode::Once;

        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t".to_string(),
            },
        ));

        // Time beyond duration should clamp to duration
        let result = engine.evaluate_procedural(&animation, 10.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&5.0));

        // Negative time should clamp to 0
        let result = engine.evaluate_procedural(&animation, -1.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&0.0));
    }

    #[test]
    fn test_evaluate_procedural_with_loop_mode_loop() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(5.0);
        animation.loop_mode = LoopMode::Loop;

        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t".to_string(),
            },
        ));

        // Time should wrap around
        let result = engine.evaluate_procedural(&animation, 7.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&2.0));

        let result = engine.evaluate_procedural(&animation, 12.5);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&2.5));
    }

    #[test]
    fn test_evaluate_procedural_with_loop_mode_ping_pong() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(5.0);
        animation.loop_mode = LoopMode::PingPong;

        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t".to_string(),
            },
        ));

        // First cycle: forward (0 to 5)
        let result = engine.evaluate_procedural(&animation, 2.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&2.0));

        // Second cycle: backward (5 to 0)
        let result = engine.evaluate_procedural(&animation, 7.0);
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&3.0)); // 5 - 2
    }

    #[test]
    fn test_evaluate_keyframe_now_handles_procedural() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Add both keyframe and procedural tracks
        let mut keyframe_anim = KeyframeAnimation::new(InterpolationType::Linear);
        keyframe_anim.add_keyframe(Keyframe::new(0.0, 0.0));
        keyframe_anim.add_keyframe(Keyframe::new(10.0, 1.0));

        animation.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            keyframe_anim,
        ));

        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t * 0.5".to_string(),
            },
        ));

        // evaluate_keyframe should now handle both types
        let result = engine.evaluate_keyframe(&animation, 4.0);

        assert_eq!(result.len(), 2);
        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.4));
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&2.0));
    }

    #[test]
    fn test_mixing_keyframe_and_procedural_tracks() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Keyframe animation for roughness
        let mut roughness_anim = KeyframeAnimation::new(InterpolationType::Linear);
        roughness_anim.add_keyframe(Keyframe::new(0.0, 0.2));
        roughness_anim.add_keyframe(Keyframe::new(10.0, 0.8));
        animation.add_track(AnimationTrack::keyframe(
            AnimationParameter::Roughness,
            roughness_anim,
        ));

        // Procedural animation for UV scrolling
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t * 0.3".to_string(),
            },
        ));

        // Procedural animation for emissive with noise
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::EmissiveIntensity,
            ProceduralAnimation {
                expression: "abs(sin(t * 2.0)) * 5.0".to_string(),
            },
        ));

        let result = engine.evaluate_keyframe(&animation, 5.0);

        assert_eq!(result.len(), 3);

        // Keyframe track
        assert_eq!(result.get(&AnimationParameter::Roughness), Some(&0.5));

        // Procedural tracks
        assert_eq!(result.get(&AnimationParameter::UVOffsetX), Some(&1.5));

        let emissive = result.get(&AnimationParameter::EmissiveIntensity).unwrap();
        assert!(emissive.is_finite());
    }

    #[test]
    fn test_procedural_animation_real_world_examples() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Flowing water UV offset
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::UVOffsetX,
            ProceduralAnimation {
                expression: "t * 0.1 + perlin(t * 0.5, 1.0, 0.2) * 0.1".to_string(),
            },
        ));

        // Flickering fire emissive
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::EmissiveIntensity,
            ProceduralAnimation {
                expression: "abs(simplex(t * 10.0, 1.0, 0.5)) * 3.0 + 2.0".to_string(),
            },
        ));

        // Pulsing effect
        animation.add_track(AnimationTrack::procedural(
            AnimationParameter::EmissiveColor,
            ProceduralAnimation {
                expression: "sin(t * 3.0) * 0.5 + 0.5".to_string(),
            },
        ));

        let result = engine.evaluate_procedural(&animation, 2.0);

        assert_eq!(result.len(), 3);

        // All values should be finite
        for value in result.values() {
            assert!(value.is_finite());
        }
    }

    #[test]
    fn test_procedural_animation_with_all_parameters() {
        let engine = AnimationEngine::new(Arc::new(GpuComputeDevice::new_mock()));
        let mut animation = AnimationData::new(10.0);

        // Test that procedural animation works with all parameter types
        let parameters = vec![
            AnimationParameter::AlbedoColor,
            AnimationParameter::AlbedoRed,
            AnimationParameter::AlbedoGreen,
            AnimationParameter::AlbedoBlue,
            AnimationParameter::Roughness,
            AnimationParameter::Metallic,
            AnimationParameter::EmissiveIntensity,
            AnimationParameter::EmissiveColor,
            AnimationParameter::HeightOffset,
            AnimationParameter::NormalStrength,
            AnimationParameter::UVOffsetX,
            AnimationParameter::UVOffsetY,
        ];

        for param in parameters {
            animation.add_track(AnimationTrack::procedural(
                param,
                ProceduralAnimation {
                    expression: "t * 0.1".to_string(),
                },
            ));
        }

        let result = engine.evaluate_procedural(&animation, 5.0);

        assert_eq!(result.len(), 12);

        // All should evaluate to 0.5
        for value in result.values() {
            assert_eq!(*value, 0.5);
        }
    }
}
