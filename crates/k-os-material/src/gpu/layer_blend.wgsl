// ============================================================================
// K_OS Layer Blending Shader - Material System
// ============================================================================
// GPU-accelerated layer blending for KAutoPBR material system
// Supports 10 blend modes with mask and opacity control
// 
// Requirements: 2.5, 2.6, 2.7, 2.8
// ============================================================================

// === BLEND MODE CONSTANTS ===
const BLEND_NORMAL: u32 = 0u;
const BLEND_MULTIPLY: u32 = 1u;
const BLEND_SCREEN: u32 = 2u;
const BLEND_OVERLAY: u32 = 3u;
const BLEND_ADD: u32 = 4u;
const BLEND_SUBTRACT: u32 = 5u;
const BLEND_DIVIDE: u32 = 6u;
const BLEND_DIFFERENCE: u32 = 7u;
const BLEND_DARKEN: u32 = 8u;
const BLEND_LIGHTEN: u32 = 9u;

// === BLEND PARAMS (16-byte aligned) ===
struct BlendParams {
    opacity: f32,           // Layer opacity (0.0-1.0)
    blend_mode: u32,        // Blend mode constant
    has_mask: u32,          // 0 = no mask, 1 = has mask
    invert_mask: u32,       // 0 = normal, 1 = inverted
}

// === BINDINGS ===
@group(0) @binding(0) var base_texture: texture_2d<f32>;
@group(0) @binding(1) var layer_texture: texture_2d<f32>;
@group(0) @binding(2) var mask_texture: texture_2d<f32>;
@group(0) @binding(3) var output_texture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<uniform> params: BlendParams;

// ============================================================================
// BLEND MODE FUNCTIONS
// ============================================================================

/// Normal blend: layer replaces base
fn blend_normal(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return layer;
}

/// Multiply blend: darkens by multiplying colors
fn blend_multiply(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return base * layer;
}

/// Screen blend: lightens by inverting, multiplying, and inverting again
fn blend_screen(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(1.0) - (vec3<f32>(1.0) - base) * (vec3<f32>(1.0) - layer);
}

/// Overlay blend: combines multiply and screen based on base value
fn blend_overlay(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        overlay_channel(base.r, layer.r),
        overlay_channel(base.g, layer.g),
        overlay_channel(base.b, layer.b)
    );
}

/// Overlay blend for a single channel
fn overlay_channel(base: f32, layer: f32) -> f32 {
    if (base < 0.5) {
        return 2.0 * base * layer;
    } else {
        return 1.0 - 2.0 * (1.0 - base) * (1.0 - layer);
    }
}

/// Add blend: adds colors together, clamped to 1.0
fn blend_add(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return min(base + layer, vec3<f32>(1.0));
}

/// Subtract blend: subtracts layer from base, clamped to 0.0
fn blend_subtract(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return max(base - layer, vec3<f32>(0.0));
}

/// Divide blend: divides base by layer, clamped to 1.0
fn blend_divide(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(
        select(1.0, min(base.r / layer.r, 1.0), layer.r > 0.0),
        select(1.0, min(base.g / layer.g, 1.0), layer.g > 0.0),
        select(1.0, min(base.b / layer.b, 1.0), layer.b > 0.0)
    );
}

/// Difference blend: absolute difference between colors
fn blend_difference(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return abs(base - layer);
}

/// Darken blend: takes minimum of base and layer
fn blend_darken(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return min(base, layer);
}

/// Lighten blend: takes maximum of base and layer
fn blend_lighten(base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
    return max(base, layer);
}

// ============================================================================
// MAIN COMPUTE SHADER
// ============================================================================

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(base_texture);
    
    // Bounds check
    if (global_id.x >= dims.x || global_id.y >= dims.y) {
        return;
    }
    
    let coords = vec2<i32>(global_id.xy);
    
    // Load base and layer pixels
    var base = textureLoad(base_texture, coords, 0);
    var layer = textureLoad(layer_texture, coords, 0);
    
    // Apply mask if present
    var effective_opacity = params.opacity;
    if (params.has_mask != 0u) {
        var mask_value = textureLoad(mask_texture, coords, 0).r;
        
        // Invert mask if requested
        if (params.invert_mask != 0u) {
            mask_value = 1.0 - mask_value;
        }
        
        // Modulate layer alpha by mask
        effective_opacity *= mask_value;
    }
    
    // Apply opacity to layer alpha
    let final_opacity = effective_opacity * layer.a;
    
    // Apply blend mode to RGB channels
    var blended_rgb: vec3<f32>;
    switch (params.blend_mode) {
        case BLEND_NORMAL: {
            blended_rgb = blend_normal(base.rgb, layer.rgb);
        }
        case BLEND_MULTIPLY: {
            blended_rgb = blend_multiply(base.rgb, layer.rgb);
        }
        case BLEND_SCREEN: {
            blended_rgb = blend_screen(base.rgb, layer.rgb);
        }
        case BLEND_OVERLAY: {
            blended_rgb = blend_overlay(base.rgb, layer.rgb);
        }
        case BLEND_ADD: {
            blended_rgb = blend_add(base.rgb, layer.rgb);
        }
        case BLEND_SUBTRACT: {
            blended_rgb = blend_subtract(base.rgb, layer.rgb);
        }
        case BLEND_DIVIDE: {
            blended_rgb = blend_divide(base.rgb, layer.rgb);
        }
        case BLEND_DIFFERENCE: {
            blended_rgb = blend_difference(base.rgb, layer.rgb);
        }
        case BLEND_DARKEN: {
            blended_rgb = blend_darken(base.rgb, layer.rgb);
        }
        case BLEND_LIGHTEN: {
            blended_rgb = blend_lighten(base.rgb, layer.rgb);
        }
        default: {
            // Fallback to normal blend
            blended_rgb = layer.rgb;
        }
    }
    
    // Mix blended result with base using effective opacity
    let final_rgb = base.rgb * (1.0 - final_opacity) + blended_rgb * final_opacity;
    
    // Alpha compositing: max of base and layer (standard over operation)
    let final_alpha = max(base.a, layer.a * final_opacity);
    
    // Write output
    textureStore(output_texture, coords, vec4<f32>(final_rgb, final_alpha));
}
