/**
 * GENERATORS SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: generators
 * Total shaders: 2
 */

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_PATTERN_FRAG = `
  uniform float uScale;
  uniform int uMode; 
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
      vec2 st = vUv * uScale; float mask = 0.0;
      if (uMode == 0) { vec2 f = fract(st); if (f.x < 0.05 || f.y < 0.05) mask = 1.0; } 
      else if (uMode == 1) { vec2 f = floor(st); mask = mod(f.x + f.y, 2.0); } 
      else if (uMode == 2) { vec2 f = fract(st) - 0.5; if (length(f) < 0.25) mask = 1.0; } 
      else if (uMode == 3) { vec2 ipos = floor(st); vec2 fpos = fract(st); float rnd = hash(ipos); if (rnd > 0.5) fpos.x = 1.0 - fpos.x; float d = abs(fpos.x - fpos.y); if (d < 0.1) mask = 1.0; if (length(fpos - 0.5) < 0.1 && rnd > 0.8) mask = 1.0; }
      gl_FragColor = vec4(mix(uColorA, uColorB, mask), 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_GRADIENT_FRAG = `
  uniform int uMode; // 0=linear, 1=radial, 2=angular
  uniform float uAngle;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec2 uCenter;
  varying vec2 vUv;

  void main() {
    float t = 0.0;
    vec2 uv = vUv - uCenter;

    if (uMode == 0) {
      // Linear gradient
      float rad = uAngle * 3.14159 / 180.0;
      vec2 dir = vec2(cos(rad), sin(rad));
      t = dot(uv + 0.5, dir) + 0.5;
    } else if (uMode == 1) {
      // Radial gradient
      t = length(uv) * 2.0;
    } else if (uMode == 2) {
      // Angular gradient
      t = atan(uv.y, uv.x) / 6.28318 + 0.5;
    }

    t = clamp(t, 0.0, 1.0);
    vec3 color = mix(uColorA, uColorB, t);
    gl_FragColor = vec4(color, 1.0);
  }
`;

