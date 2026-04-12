/**
 * UNCATEGORIZED SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: uncategorized
 * Total shaders: 12
 */

// Source: systems\physics\ParticleShaders.ts
export const PARTICLE_SIM_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Source: systems\physics\ParticleShaders.ts
export const RENDER_FRAG = `
  uniform vec3 color;
  uniform float opacity;
  varying vec3 vVel;
  varying float vLife;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if(dot(coord, coord) > 0.25) discard;
    
    float speed = length(vVel);
    vec3 finalColor = color + vec3(speed * 0.1); // Speed glow
    
    gl_FragColor = vec4(finalColor, opacity * vLife);
  }
`;

// Source: systems\shaders\shaderLibrary.ts
export const CIRCULAR_FALLOFF = `
  float circularFalloff(vec2 uv, vec2 center, float radius, float hardness) {
    float dist = distance(uv, center) * 2.0;
    return 1.0 - smoothstep(hardness, 1.0, dist / radius);
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const FILL_FRAG = `
  uniform sampler2D tSource;
  uniform bool uUseTexture;
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    if (uUseTexture) {
        vec4 tex = texture2D(tSource, vUv);
        gl_FragColor = tex;
    } else {
        gl_FragColor = vec4(uColor, uAlpha);
    }
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const REACTION_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 uv = texture2D(tSource, vUv);
    
    vec4 uv_L = texture2D(tSource, vUv + vec2(-texel.x, 0.0));
    vec4 uv_R = texture2D(tSource, vUv + vec2(texel.x, 0.0));
    vec4 uv_T = texture2D(tSource, vUv + vec2(0.0, texel.y));
    vec4 uv_B = texture2D(tSource, vUv + vec2(0.0, -texel.y));
    
    vec4 laplacian = (uv_L + uv_R + uv_T + uv_B - 4.0 * uv);
    
    float dA = 1.0;
    float dB = 0.5;
    float feed = 0.037;
    float k = 0.06;
    
    float a = uv.r;
    float b = uv.g;
    
    float newA = a + (dA * laplacian.r - a * b * b + feed * (1.0 - a));
    float newB = b + (dB * laplacian.g + a * b * b - (k + feed) * b);
    
    gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), uv.b * 0.99, uv.a);
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const FERRO_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    float h = texture2D(tSource, vUv).r; 
    float hL = texture2D(tSource, vUv + vec2(-texel.x, 0.0)).r;
    float hR = texture2D(tSource, vUv + vec2(texel.x, 0.0)).r;
    float hT = texture2D(tSource, vUv + vec2(0.0, texel.y)).r;
    float hB = texture2D(tSource, vUv + vec2(0.0, -texel.y)).r;
    float laplacian = hL + hR + hT + hB - 4.0 * h;
    vec4 color = texture2D(tSource, vUv);
    vec4 outColor = color;
    if (h > 0.1) {
        outColor.r += laplacian * -0.5; 
        outColor.g += laplacian * -0.5;
        outColor.b += laplacian * -0.5;
    }
    gl_FragColor = clamp(outColor, 0.0, 1.0);
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const CHRONOS_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec4 self = texture2D(tSource, vUv);
    gl_FragColor = max(self * 0.98, vec4(0.0));
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const NORMAL_BAKE_FRAG = `
  varying vec3 vNormal;
  void main() {
    gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const POS_BAKE_FRAG = `
  varying vec3 vPosition;
  void main() {
    gl_FragColor = vec4(vPosition, 1.0);
  }
`;

// Source: three-d\examples\tecton\KTectonshaders.tsx
export const CURSOR_FRAGMENT = `
  uniform vec3 color;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(color, opacity);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_LIFE_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uChaos; varying vec2 vUv;
  float get(vec2 offset) { vec4 c = texture2D(tInput, vUv + offset / uResolution); return step(0.5, max(c.r, max(c.g, c.b))); }
  void main() {
      float sum = get(vec2(-1,-1)) + get(vec2(0,-1)) + get(vec2(1,-1)) + get(vec2(-1,0)) + get(vec2(1,0)) + get(vec2(-1,1)) + get(vec2(0,1)) + get(vec2(1,1));
      float self = get(vec2(0,0));
      float next = 0.0;
      if (self > 0.5) { if (sum == 2.0 || sum == 3.0) next = 1.0; } else { if (sum == 3.0) next = 1.0; }
      // Soften / Decay
      vec4 color = texture2D(tInput, vUv);
      if (next > 0.5) color = vec4(1.0); else color *= 0.9 * uChaos;
      gl_FragColor = color;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_SEAMLESS_FRAG = `
  uniform sampler2D tInput;
  uniform float uBlend;
  varying vec2 vUv;

  void main() {
    vec4 c1 = texture2D(tInput, vUv);
    vec4 c2 = texture2D(tInput, vec2(1.0 - vUv.x, vUv.y));
    vec4 c3 = texture2D(tInput, vec2(vUv.x, 1.0 - vUv.y));
    vec4 c4 = texture2D(tInput, vec2(1.0 - vUv.x, 1.0 - vUv.y));

    // Diamond blend weights
    float bx = smoothstep(0.0, uBlend, vUv.x) * smoothstep(0.0, uBlend, 1.0 - vUv.x);
    float by = smoothstep(0.0, uBlend, vUv.y) * smoothstep(0.0, uBlend, 1.0 - vUv.y);

    vec4 top = mix(c2, c1, bx);
    vec4 bot = mix(c4, c3, bx);
    vec4 result = mix(bot, top, by);

    gl_FragColor = result;
  }
`;

