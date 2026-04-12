/**
 * MATH SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: math
 * Total shaders: 10
 */

// Source: systems\shaders\shaderLibrary.ts
export const RANDOM_FUNCTION = `
  float rand(vec2 co) { 
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); 
  }
`;

// Source: systems\shaders\shaderLibrary.ts
export const HASH_FUNCTION = `
  float hash(vec2 p) { 
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); 
  }
`;

// Source: systems\shaders\shaderLibrary.ts
export const FULLSCREEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Source: systems\shaders\shaderLibrary.ts
export const ROTATE_UV = `
  vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
      cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
      cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const BRUSH_VERT = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vMapUV = worldPos.xy; 
    gl_Position = projectionMatrix * worldPos;
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const MASK_BRUSH_FRAG = `
  varying vec2 vUv;
  varying vec2 vMapUV;
  
  uniform float uOpacity;
  uniform float uHardness;
  uniform float uAngle;
  uniform float uValue; // 1.0 for Add, 0.0 for Subtract
  
  uniform sampler2D uBrushAlpha;
  uniform bool uUseBrushAlpha;

  vec2 rotateUV(vec2 uv, float rotation) {
      float mid = 0.5;
      return vec2(
          cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
          cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
      );
  }

  void main() {
    vec2 center = vec2(0.5);
    vec2 rUv = rotateUV(vUv, uAngle);
    float dist = distance(vUv, center) * 2.0;
    
    float alpha = 1.0 - smoothstep(uHardness, 1.0, dist);
    
    if (uUseBrushAlpha) {
        vec4 mask = texture2D(uBrushAlpha, rUv);
        alpha *= mask.r;
    }

    float str = alpha * uOpacity;
    
    // Output R channel is the mask value.
    // We blend this additively or subtractively in the blend function of the material/renderer
    gl_FragColor = vec4(str, 0.0, 0.0, str); 
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const QUANTUM_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec4 self = texture2D(tSource, vUv);
    if (self.a < 0.01) discard;
    float prob = hash(vUv * 100.0 + time);
    if (prob > 0.98) {
        gl_FragColor = self * 0.9;
    } else if (prob < 0.02) {
        gl_FragColor = min(self * 1.5, 1.0);
    } else {
        vec2 offset = (vec2(hash(vUv), hash(vUv + 1.0)) - 0.5) * 0.01;
        vec4 neighbor = texture2D(tSource, vUv + offset);
        gl_FragColor = mix(self, neighbor, 0.1);
    }
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const GROWTH_FRAG = `
  uniform sampler2D tSource;
  uniform vec2 resolution;
  uniform float time;
  uniform float uSpeed;
  uniform float uChaos;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 self = texture2D(tSource, vUv);
    
    if (self.a > 0.1) {
        gl_FragColor = self;
        return;
    }
    
    // Check 4 direct neighbors
    vec4 nL = texture2D(tSource, vUv + vec2(-texel.x, 0.0));
    vec4 nR = texture2D(tSource, vUv + vec2(texel.x, 0.0));
    vec4 nT = texture2D(tSource, vUv + vec2(0.0, texel.y));
    vec4 nB = texture2D(tSource, vUv + vec2(0.0, -texel.y));
    
    float chance = 0.0;
    vec4 grower = vec4(0.0);
    
    if(nL.a > 0.5) { chance += 1.0; grower = nL; }
    if(nR.a > 0.5) { chance += 1.0; grower = nR; }
    if(nT.a > 0.5) { chance += 1.0; grower = nT; }
    if(nB.a > 0.5) { chance += 1.0; grower = nB; }
    
    float rnd = hash(vUv * 100.0 + time);
    
    // Dynamic threshold based on speed and chaos
    float threshold = 0.99 - (uSpeed * 0.1) + (uChaos * 0.05);
    
    if (chance > 0.0 && rnd > threshold) {
        gl_FragColor = grower;
    } else {
        gl_FragColor = self;
    }
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const BAKE_VERT = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldNormal = modelMatrix * vec4(normal, 0.0);
    vNormal = normalize(worldNormal.xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPosition = worldPos.xyz;
    gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_DATAMOSH_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
      vec4 self = texture2D(tInput, vUv); float bright = dot(self.rgb, vec3(0.299, 0.587, 0.114));
      float drift = (bright - 0.5) * 0.01 * uSpeed;
      if (hash(vUv * 100.0) > 0.99) drift += 0.05 * uSpeed;
      vec2 offset = vec2(drift, 0.0); gl_FragColor = texture2D(tInput, vUv - offset);
  }
`;

