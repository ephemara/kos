/**
 * SIMULATIONS SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: simulations
 * Total shaders: 4
 */

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_DRIP_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uThreshold; varying vec2 vUv;
  void main() {
      vec4 self = texture2D(tInput, vUv); vec2 texel = 1.0 / uResolution;
      vec4 above = texture2D(tInput, vUv + vec2(0.0, texel.y));
      float heavy = above.a; float jitter = sin(vUv.y * 50.0) * 0.0001;
      vec2 offset = vec2(jitter, uSpeed * heavy * 0.005);
      vec4 dripSource = texture2D(tInput, vUv + offset);
      vec4 result = mix(self, dripSource, 0.1); result.a = max(self.a, dripSource.a * 0.99); 
      gl_FragColor = result;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_BLEED_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; vec4 c = texture2D(tInput, vUv);
      vec4 l = texture2D(tInput, vUv + vec2(-texel.x, 0.0)); vec4 r = texture2D(tInput, vUv + vec2(texel.x, 0.0));
      vec4 t = texture2D(tInput, vUv + vec2(0.0, texel.y)); vec4 b = texture2D(tInput, vUv + vec2(0.0, -texel.y));
      vec4 avg = (l + r + t + b) * 0.25; vec4 result = mix(c, avg, uSpeed * 0.1); result.a = max(c.a, avg.a * 0.9);
      gl_FragColor = result;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_WIND_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform vec2 uWindDir; varying vec2 vUv;
  void main() {
      vec4 self = texture2D(tInput, vUv); vec2 offset = uWindDir * -0.002 * uSpeed;
      vec4 windSource = texture2D(tInput, vUv + offset);
      vec4 result = mix(self, windSource, 0.2 * uSpeed); result.a = max(self.a, windSource.a * 0.98);
      gl_FragColor = result;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_MAGNETIC_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; vec4 self = texture2D(tInput, vUv);
      vec2 center = vec2(0.0); float mass = 0.0;
      for(int y=-2; y<=2; y++) { for(int x=-2; x<=2; x++) { if(x==0 && y==0) continue; vec2 off = vec2(float(x), float(y)) * texel; float val = texture2D(tInput, vUv + off).a; center += off * val; mass += val; } }
      if(mass > 0.0) { center /= mass; vec2 pull = center * uSpeed * 2.0; vec4 neighbor = texture2D(tInput, vUv + pull); gl_FragColor = mix(self, neighbor, 0.1); } else { gl_FragColor = self; }
  }
`;

