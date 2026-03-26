/**
 * FILTERS SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: filters
 * Total shaders: 10
 */

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const BRUSH_FRAG = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHardness;
  uniform float uAngle;
  uniform float uTexScale;
  
  uniform sampler2D uBrushAlpha;
  uniform bool uUseBrushAlpha;
  
  uniform sampler2D uSrcTex;
  uniform bool uUseSrcTex;

  // --- MASKING SUPPORT ---
  uniform sampler2D uMaskMap;
  uniform bool uUseMask;

  // --- SMART MASKS ---
  // --- PROJECTION MODE ---
  uniform bool uProjectionMode;
  uniform vec3 uBrushPos;
  uniform float uBrushRadius;

  // --- SMART MASKS ---
  uniform bool uUseSmartMask;
  uniform sampler2D uCurvatureMap; // R=Convex(Edges), G=Concave(Cavities)
  uniform sampler2D uNormalMap;    // World Normals
  uniform sampler2D uPositionMap;  // World Positions
  
  uniform float uEdgeMask;   // -1.0 (Cavity) to 1.0 (Edge). 0.0 = Off
  uniform float uSlopeMask;  // -1.0 (Bottom) to 1.0 (Top). 0.0 = Off
  uniform float uHeightMask; // -1.0 (Low) to 1.0 (High). 0.0 = Off
  
  vec2 rotateUV(vec2 uv, float rotation) {
      float mid = 0.5;
      return vec2(
          cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
          cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
      );
  }
  
  void main() {
    // 1. Check Mask Buffer First (Global Mask)
    if (uUseMask) {
        float maskVal = texture2D(uMaskMap, vMapUV).r;
        if (maskVal > 0.99) discard; // Fully masked optimization
    }

    float alpha = 0.0;
    
    if (uProjectionMode) {
        // --- 3D PROJECTION MODE ---
        // Sample World Position from baked map
        vec3 worldPos = texture2D(uPositionMap, vMapUV).xyz;
        if (length(worldPos) < 0.001) discard; // Empty space background

        float dist3D = distance(worldPos, uBrushPos);
        
        // Hardness calc for 3D
        // Map 0 -> uBrushRadius to 1.0 -> 0.0
        // smoothstep(edge0, edge1, x)
        // We want 1.0 inside 'hardness' core, fading to 0.0 at radius
        
        float falloffStart = uBrushRadius * uHardness;
        alpha = 1.0 - smoothstep(falloffStart, uBrushRadius, dist3D);

        // Discard far pixels to save fill rate? Unlikely to help in fragment shader after dispatch, but cleaner.
        if (dist3D > uBrushRadius) discard;
        
    } else {
        // --- 2D UV MODE ---
        vec2 center = vec2(0.5);
        vec2 rUv = rotateUV(vUv, uAngle);
        float dist = distance(vUv, center) * 2.0; // 0.0 to 1.414 (corner)
        alpha = 1.0 - smoothstep(uHardness, 1.0, dist);
        
        if (uUseBrushAlpha) {
            vec4 mask = texture2D(uBrushAlpha, rUv);
            alpha *= mask.r; 
        }
    }
    
    // --- SMART MASK LOGIC (Procedural) ---
    if (uUseSmartMask) {
        vec2 meshUV = vMapUV;
        
        // 1. Edge/Cavity Mask
        if (abs(uEdgeMask) > 0.01) {
            vec4 curv = texture2D(uCurvatureMap, meshUV);
            float edge = curv.r;   
            float cavity = curv.g; 
            if (uEdgeMask > 0.0) alpha *= smoothstep(1.0 - uEdgeMask, 1.0, edge);
            else alpha *= smoothstep(1.0 + uEdgeMask, 1.0, cavity);
        }

        // 2. Slope Mask (Top/Bottom facing)
        if (abs(uSlopeMask) > 0.01) {
            vec3 norm = texture2D(uNormalMap, meshUV).xyz * 2.0 - 1.0;
            float up = norm.y; 
            if (uSlopeMask > 0.0) alpha *= smoothstep(1.0 - uSlopeMask, 1.0, up);
            else alpha *= smoothstep(1.0 + uSlopeMask, 1.0, -up);
        }

        // 3. Height Mask (Position Y)
        if (abs(uHeightMask) > 0.01) {
            float height = texture2D(uPositionMap, meshUV).y;
            if (uHeightMask > 0.0) {
                 alpha *= smoothstep(uHeightMask - 0.2, uHeightMask + 0.2, height);
            } else {
                 float level = abs(uHeightMask);
                 alpha *= 1.0 - smoothstep(level - 0.2, level + 0.2, height);
            }
        }
    }

    // --- APPLY GLOBAL MASK (Soft) ---
    if (uUseMask) {
        float maskVal = texture2D(uMaskMap, vMapUV).r;
        alpha *= (1.0 - maskVal);
    }
    
    vec3 outColor = uColor;
    
    if (uUseSrcTex) {
        vec2 texUV;
        if (uProjectionMode) {
             // Triplanar-ish or just World projected?
             // Simple Box projection based on position for now, or just use meshUV * scale
             texUV = vMapUV * uTexScale; 
        } else {
             texUV = vMapUV * uTexScale;
        }
        vec4 src = texture2D(uSrcTex, texUV);
        outColor *= src.rgb;
    }
    
    gl_FragColor = vec4(outColor, alpha * uOpacity);
    if (gl_FragColor.a <= 0.001) discard;
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const CURVATURE_COMPUTE_FRAG = `
  uniform sampler2D tNormal;
  uniform vec2 resolution;
  uniform float uSpread; 
  varying vec2 vUv;
  void main() {
    vec2 texel = (1.0 / resolution) * uSpread;
    
    vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
    
    // Sample 4 neighbors with spread
    vec3 nL = texture2D(tNormal, vUv - vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
    vec3 nR = texture2D(tNormal, vUv + vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
    vec3 nT = texture2D(tNormal, vUv + vec2(0.0, texel.y)).xyz * 2.0 - 1.0;
    vec3 nB = texture2D(tNormal, vUv - vec2(0.0, texel.y)).xyz * 2.0 - 1.0;
    
    float edge = length(n - nL) + length(n - nR) + length(n - nT) + length(n - nB);
    
    // R = Edges (Convex), G = Cavities (Approximation), B = Empty
    gl_FragColor = vec4(edge, edge * 0.5, 0.0, 1.0); 
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_BLUR_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uStrength; uniform vec2 uDirection; varying vec2 vUv;
  void main() {
      vec4 sum = vec4(0.0); vec2 off = uDirection * uStrength / uResolution;
      sum += texture2D(tInput, vUv - 4.0 * off) * 0.0162; sum += texture2D(tInput, vUv - 3.0 * off) * 0.0540; sum += texture2D(tInput, vUv - 2.0 * off) * 0.1216; sum += texture2D(tInput, vUv - 1.0 * off) * 0.1945;
      sum += texture2D(tInput, vUv) * 0.2270;
      sum += texture2D(tInput, vUv + 1.0 * off) * 0.1945; sum += texture2D(tInput, vUv + 2.0 * off) * 0.1216; sum += texture2D(tInput, vUv + 3.0 * off) * 0.0540; sum += texture2D(tInput, vUv + 4.0 * off) * 0.0162;
      gl_FragColor = sum;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_LEVELS_FRAG = `
  uniform sampler2D tInput; uniform float uMin; uniform float uMax; uniform float uGamma; uniform bool uInvert; varying vec2 vUv;
  void main() {
      vec4 tex = texture2D(tInput, vUv); vec3 col = tex.rgb;
      col = (col - uMin) / (uMax - uMin); col = clamp(col, 0.0, 1.0); col = pow(col, vec3(1.0 / uGamma));
      if (uInvert) col = 1.0 - col; gl_FragColor = vec4(col, tex.a);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_EDGE_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; float gx = 0.0; float gy = 0.0; vec3 t = texture2D(tInput, vUv).rgb;
      gx += -1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rgb); gx += -2.0 * length(texture2D(tInput, vUv + vec2(-texel.x, 0.0)).rgb); gx += -1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, texel.y)).rgb);
      gx += 1.0 * length(texture2D(tInput, vUv + vec2(texel.x, -texel.y)).rgb); gx += 2.0 * length(texture2D(tInput, vUv + vec2(texel.x, 0.0)).rgb); gx += 1.0 * length(texture2D(tInput, vUv + vec2(texel.x, texel.y)).rgb);
      gy += -1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rgb); gy += -2.0 * length(texture2D(tInput, vUv + vec2(0.0, -texel.y)).rgb); gy += -1.0 * length(texture2D(tInput, vUv + vec2(texel.x, -texel.y)).rgb);
      gy += 1.0 * length(texture2D(tInput, vUv + vec2(-texel.x, texel.y)).rgb); gy += 2.0 * length(texture2D(tInput, vUv + vec2(0.0, texel.y)).rgb); gy += 1.0 * length(texture2D(tInput, vUv + vec2(texel.x, texel.y)).rgb);
      float edge = sqrt(gx*gx + gy*gy); gl_FragColor = vec4(mix(t, vec3(edge), 0.8), 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_THERMAL_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uDecay; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution;
      vec4 c = texture2D(tInput, vUv);
      // Heat rises (Y-axis)
      vec4 below = texture2D(tInput, vUv + vec2(0.0, -texel.y));
      // Brightness determines heat
      float heat = length(below.rgb) * uSpeed * 0.01;
      vec2 offset = vec2((fract(sin(dot(vUv, vec2(12.9, 78.2)))*43758.5)-0.5)*0.005, -heat);
      vec4 hotSource = texture2D(tInput, vUv + offset);
      // Diffusion
      vec4 avg = (texture2D(tInput, vUv+vec2(texel.x,0)) + texture2D(tInput, vUv-vec2(texel.x,0))) * 0.5;
      gl_FragColor = mix(c, mix(hotSource, avg, 0.2), 0.5) * uDecay;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_SHARPEN_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 center = texture2D(tInput, vUv);

    vec4 blur = (
      texture2D(tInput, vUv + vec2(-texel.x, -texel.y)) +
      texture2D(tInput, vUv + vec2(0.0, -texel.y)) +
      texture2D(tInput, vUv + vec2(texel.x, -texel.y)) +
      texture2D(tInput, vUv + vec2(-texel.x, 0.0)) +
      texture2D(tInput, vUv + vec2(texel.x, 0.0)) +
      texture2D(tInput, vUv + vec2(-texel.x, texel.y)) +
      texture2D(tInput, vUv + vec2(0.0, texel.y)) +
      texture2D(tInput, vUv + vec2(texel.x, texel.y))
    ) / 8.0;

    vec4 sharp = center + (center - blur) * uStrength;
    gl_FragColor = clamp(sharp, 0.0, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_HSL_FRAG = `
  uniform sampler2D tInput;
  uniform float uHue;
  uniform float uSaturation;
  uniform float uLightness;
  varying vec2 vUv;

  vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) / 2.0;
    float s = 0.0;
    float h = 0.0;

    if (maxC != minC) {
      float d = maxC - minC;
      s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
      if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
      else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
      else h = (c.r - c.g) / d + 4.0;
      h /= 6.0;
    }
    return vec3(h, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 c) {
    float h = c.x, s = c.y, l = c.z;
    if (s == 0.0) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
  }

  void main() {
    vec4 tex = texture2D(tInput, vUv);
    vec3 hsl = rgb2hsl(tex.rgb);

    hsl.x = fract(hsl.x + uHue);
    hsl.y = clamp(hsl.y * uSaturation, 0.0, 1.0);
    hsl.z = clamp(hsl.z + uLightness, 0.0, 1.0);

    vec3 rgb = hsl2rgb(hsl);
    gl_FragColor = vec4(rgb, tex.a);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_POSTERIZE_FRAG = `
  uniform sampler2D tInput;
  uniform float uLevels;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(tInput, vUv);
    vec3 col = floor(tex.rgb * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(col, tex.a);
  }
`;

