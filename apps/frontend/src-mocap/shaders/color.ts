/**
 * COLOR SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: color
 * Total shaders: 8
 */

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const GRAVITY_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  uniform float uSpeed;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / resolution;
    
    // Sample above
    vec4 above = texture2D(tSource, vUv + vec2(0.0, texel.y));
    float heaviness = length(above.rgb) * above.a;
    
    float jitter = sin(vUv.y * 50.0 + time) * 0.0005;
    vec2 offset = vec2(jitter, 0.002 * heaviness * uSpeed);
    
    vec4 flowColor = texture2D(tSource, vUv + offset);
    gl_FragColor = flowColor;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_NORMAL_FRAG = `
  uniform sampler2D tInput; uniform float uStrength; uniform vec2 uResolution; varying vec2 vUv;
  float getVal(vec2 uv) { return length(texture2D(tInput, uv).rgb); }
  void main() {
      vec2 step = 1.0 / uResolution;
      float tl = abs(getVal(vUv + vec2(-step.x, -step.y))); float l = abs(getVal(vUv + vec2(-step.x, 0.0))); float bl = abs(getVal(vUv + vec2(-step.x, step.y)));
      float t = abs(getVal(vUv + vec2(0.0, -step.y))); float b = abs(getVal(vUv + vec2(0.0, step.y)));
      float tr = abs(getVal(vUv + vec2(step.x, -step.y))); float r = abs(getVal(vUv + vec2(step.x, 0.0))); float br = abs(getVal(vUv + vec2(step.x, step.y)));
      float dX = (tr + 2.0*r + br) - (tl + 2.0*l + bl); float dY = (bl + 2.0*b + br) - (tl + 2.0*t + tr); float dZ = 1.0 / uStrength;
      vec3 n = normalize(vec3(dX, dY, dZ)); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_PIXEL_SORT_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uThreshold; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution; vec4 color = texture2D(tInput, vUv); float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      if (luma > uThreshold) { vec4 neighbor = texture2D(tInput, vUv + vec2(0.0, -texel.y * 20.0)); gl_FragColor = mix(color, neighbor, 0.5); } else { gl_FragColor = color; }
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_SORT_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uChaos; varying vec2 vUv;
  void main() {
      vec2 texel = 1.0 / uResolution;
      vec4 self = texture2D(tInput, vUv);
      float luma = dot(self.rgb, vec3(0.299, 0.587, 0.114));
      // Sort vertically or horizontally based on chaos
      vec2 dir = uChaos > 0.5 ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);
      vec4 neighbor = texture2D(tInput, vUv + dir * uSpeed);
      float lumaN = dot(neighbor.rgb, vec3(0.299, 0.587, 0.114));
      // Swap if neighbor brighter
      if (lumaN > luma) gl_FragColor = neighbor;
      else gl_FragColor = self;
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_AO_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uRadius;
  uniform float uIntensity;
  varying vec2 vUv;

  float getHeight(vec2 uv) {
    vec3 c = texture2D(tInput, uv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    float centerH = getHeight(vUv);
    float ao = 0.0;
    float samples = 0.0;

    for (float y = -3.0; y <= 3.0; y += 1.0) {
      for (float x = -3.0; x <= 3.0; x += 1.0) {
        if (x == 0.0 && y == 0.0) continue;
        vec2 offset = vec2(x, y) * texel * uRadius;
        float sampleH = getHeight(vUv + offset);
        float diff = centerH - sampleH;
        ao += max(0.0, diff);
        samples += 1.0;
      }
    }

    ao = 1.0 - (ao / samples) * uIntensity;
    ao = clamp(ao, 0.0, 1.0);
    gl_FragColor = vec4(vec3(ao), 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_CURVATURE_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uStrength;
  varying vec2 vUv;

  float getHeight(vec2 uv) {
    vec3 c = texture2D(tInput, uv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec2 texel = 1.0 / uResolution;

    float h = getHeight(vUv);
    float hL = getHeight(vUv - vec2(texel.x, 0.0));
    float hR = getHeight(vUv + vec2(texel.x, 0.0));
    float hT = getHeight(vUv + vec2(0.0, texel.y));
    float hB = getHeight(vUv - vec2(0.0, texel.y));

    // Second derivative (Laplacian) for curvature
    float curvature = (hL + hR + hT + hB - 4.0 * h) * uStrength;

    // Map to 0.5 = flat, <0.5 = concave, >0.5 = convex
    float result = curvature * 0.5 + 0.5;
    gl_FragColor = vec4(vec3(result), 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_EMBOSS_FRAG = `
  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / uResolution;

    vec3 tl = texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rgb;
    vec3 br = texture2D(tInput, vUv + vec2(texel.x, texel.y)).rgb;

    vec3 emboss = (br - tl) * uStrength + 0.5;
    gl_FragColor = vec4(emboss, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const FILTER_THRESHOLD_FRAG = `
  uniform sampler2D tInput;
  uniform float uThreshold;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(tInput, vUv);
    float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float bw = step(uThreshold, luma);
    gl_FragColor = vec4(vec3(bw), tex.a);
  }
`;

