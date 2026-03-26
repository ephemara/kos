/**
 * NOISE SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: noise
 * Total shaders: 12
 */

// Source: systems\physics\ParticleShaders.ts
export const VELOCITY_FRAGMENT = `
  uniform sampler2D velocityTexture;
  uniform sampler2D positionTexture;
  uniform sampler2D fluidTexture; // Optional link to FluidSimulator
  uniform sampler2D originTexture;
  
  uniform float time;
  uniform float dt;
  uniform float speed;
  uniform float chaos;
  uniform int mode;
  
  // Interaction
  uniform vec3 mousePos;
  uniform float uDamping;
  
  // Audio / Modifiers
  uniform float audioLevel;
  uniform float audioBass;
  uniform float audioHigh;
  
  varying vec2 vUv;

  // --- NOISE FUNCTIONS ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }

  void main() {
    vec2 uv = vUv;
    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;

    vec3 acc = vec3(0.0);

    // --- PHYSICS MODES ---

    // MODE 0: ZERO-POINT (Stable Grid)
    if (mode == 0) {
        vec3 diff = origin - pos;
        acc += diff * 0.1 * speed; 
        acc += curl(pos.x * 0.1, pos.y * 0.1, time * 0.1) * chaos * 0.1; 
    }
    
    // MODE 1: KERR BLACK HOLE
    else if (mode == 1) {
        acc.y -= pos.y * 0.5; 
        vec3 dir = -normalize(pos);
        float r = length(pos);
        float gravity = 50.0 * speed / (r * r + 0.1);
        if (r < 2.0) gravity = 0.0; 
        acc += dir * gravity;
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 tangent = cross(dir, up);
        float spin = 20.0 * speed / (r + 1.0);
        acc += tangent * spin;
        acc += curl(pos.x*0.1, pos.y*0.1, time*0.1) * chaos * 0.5;
    }

    // MODE 2: TORNADO / ION STORM
    else if (mode == 2) {
        vec3 diff = pos - vec3(0, pos.y, 0);
        vec3 centerDir = -normalize(diff);
        vec3 up = vec3(0, 1, 0);
        vec3 spin = cross(centerDir, up);
        acc += spin * 2.0 * speed;
        acc += centerDir * 0.5 * speed; 
        acc.y += 0.5 * speed; 
        acc += curl(pos.x*0.1, pos.y*0.1, time*0.2) * chaos;
    }

    // MODE 3: GALAXY SPIRAL
    else if (mode == 3) {
        acc.y -= pos.y * 0.5;
        float r = length(pos.xz);
        float angle = atan(pos.z, pos.x);
        float spiralOffset = 2.0 * log(r + 1.0); 
        float armPhase = angle + spiralOffset;
        float density = cos(armPhase * 2.0); 
        vec3 tangent = cross(vec3(0,1,0), normalize(pos));
        float orbSpeed = 15.0 * speed / sqrt(r + 0.1);
        if (density > 0.0) orbSpeed *= 0.6; 
        acc += (tangent * orbSpeed - vel) * 0.5; 
        acc += -normalize(pos) * (10.0 / (r*r + 1.0)); 
        acc += curl(pos.x*0.05, pos.y*0.05, time*0.05) * chaos * 0.2;
    }

    // MODE 4: LORENZ ATTRACTOR
    else if (mode == 4) {
        float sigma = 10.0; float rho = 28.0; float beta = 8.0/3.0;
        vec3 p = pos * 1.0; 
        vec3 d;
        d.x = sigma * (p.y - p.x);
        d.y = p.x * (rho - p.z) - p.y;
        d.z = p.x * p.y - beta * p.z;
        acc += (d * 0.5 * speed - vel) * 0.5; 
    }

    // MODE 6: AIZAWA ATTRACTOR
    else if (mode == 6) {
        float a = 0.95; float b = 0.7; float c = 0.6; float d = 3.5; float e = 0.25; float f = 0.1;
        vec3 p = pos * 2.0; 
        float dx = (p.z - b) * p.x - d * p.y;
        float dy = d * p.x + (p.z - b) * p.y;
        float dz = c + a * p.z - (p.z * p.z * p.z) / 3.0 - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z) + f * p.z * (p.x * p.x * p.x);
        vec3 flow = vec3(dx, dy, dz);
        acc += (flow * 0.5 * speed - vel) * 0.5;
    }

    // MODE 12: NEURAL LATTICE (Quantum Pilot)
    else if (mode == 12) { 
        vec3 p = curl(pos.x*0.1, pos.y*0.1, pos.z*0.1); 
        vec3 m = curl(pos.x*0.5, pos.y*0.5, pos.z*0.5); 
        acc += p*2.0*speed + m*5.0*chaos; 
        if(length(pos)>40.0) acc -= normalize(pos); 
    }

    // MODE 13: FERROFLUID (Magnetic Liquid)
    else if (mode == 13) { 
        float s = pow(abs(sin(pos.x*0.5)*sin(pos.y*0.5)*sin(pos.z*0.5)), 4.0)*50.0; 
        acc += (-normalize(pos))*0.5*speed;
        acc += normalize(pos)*s*0.5*chaos; 
        acc += curl(pos.x*0.1,pos.y*0.1,time)*1.0; 
    }

    // MODE 17: FLUID COUPLING (Navier-Stokes)
    else if (mode == 17) {
        vec2 fUV = (pos.xy + 20.0) / 40.0; // Map world pos to 0-1 texture space
        if (fUV.x > 0.0 && fUV.x < 1.0 && fUV.y > 0.0 && fUV.y < 1.0) {
            vec3 fluidForce = texture2D(fluidTexture, fUV).xyz;
            acc += fluidForce * 50.0 * speed;
        }
        acc += curl(pos.x*0.2, pos.y*0.2, pos.z*0.2) * chaos;
        // Gravity/Centering
        if (length(pos) > 20.0) acc -= normalize(pos) * 1.0;
    }

    // General Damping & Integration
    vel += acc * dt;
    vel *= uDamping;

    // Mouse Interaction
    float dist = distance(pos.xy, mousePos.xy);
    if (dist < 5.0 && mousePos.z > 0.5) {
        vel += normalize(pos - mousePos) * 2.0;
    }

    gl_FragColor = vec4(vel, 1.0);
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const CURL_NOISE_FUNC = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }
`;

// Source: systems\shaders\shaderLibrary.ts
export const SIMPLEX_NOISE = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const VORTEX_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    float scale = 10.0;
    float n1 = snoise(vUv * scale + time * 0.1);
    float n2 = snoise(vUv * scale + vec2(100.0) + time * 0.1);
    vec2 vel = vec2(n1, n2) * 0.005;
    vec2 coord = vUv - vel;
    gl_FragColor = texture2D(tSource, coord);
  }
`;

// Source: three-d\examples\paint\engine\PaintShaders.ts
export const RIVULET_FRAG = `
  uniform sampler2D tSource;
  uniform float time;
  uniform vec2 resolution;
  uniform float uChaos;
  uniform float uSpeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), f.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
  }

  void main() {
    vec2 texel = 1.0 / resolution;
    vec4 self = texture2D(tSource, vUv);
    
    float n = noise(vec2(vUv.x * 20.0, vUv.y * 5.0 + time * 0.5));
    vec2 flow = vec2((n - 0.5) * 0.004 * uChaos, 0.005 * uSpeed); 
    
    vec4 incoming = texture2D(tSource, vUv + flow);
    float strength = length(incoming.rgb);
    vec4 result = incoming;
    
    if (strength < 0.1) result = self; 
    
    gl_FragColor = result;
  }
`;

// Source: three-d\examples\tecton\KTectonshaders.tsx
export const PHYSICS_FRAGMENT = `
  uniform sampler2D heightMap;
  uniform sampler2D velocityMap; // From Fluid Simulator
  
  uniform vec2 mousePos;
  uniform float brushSize;
  uniform float brushStrength;
  uniform float time;
  uniform int activeEffect; 
  uniform float simSpeed;
  uniform bool doReset;
  uniform bool isSimulating;
  uniform bool blending;
  uniform float blendFactor;
  uniform sampler2D blendTargetA;
  uniform sampler2D blendTargetB;
  uniform vec2 res;
  
  varying vec2 vUv;

  // Simplex Noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    if (blending) {
       float hA = texture2D(blendTargetA, vUv).r;
       float hB = texture2D(blendTargetB, vUv).r;
       float h = mix(hA, hB, blendFactor);
       gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
       return;
    }

    if (doReset) {
        float n = snoise(vUv * 3.0) * 0.3 + 0.3;
        n += snoise(vUv * 10.0) * 0.05;
        gl_FragColor = vec4(n, 0.0, 0.0, 1.0);
        return;
    }

    vec4 data = texture2D(heightMap, vUv);
    float h = data.r;

    if (isSimulating) {
        vec2 uv = vUv;
        float texel = 1.0 / res.x;
        
        // 0. MAGMA (Fluid Advection)
        if (activeEffect == 6) {
            vec2 vel = texture2D(velocityMap, uv).xy;
            vec2 coord = uv - (vel * 0.005 * simSpeed); // Backtrace
            h = texture2D(heightMap, coord).r;
            // Add some cooling/hardening noise
            h += snoise(uv * 50.0 + time) * 0.001 * simSpeed;
        }

        // 3. WARP
        else if (activeEffect == 3) {
            float n = snoise(uv * 8.0 + time * 0.1);
            uv += vec2(n, n) * 0.001 * brushStrength * simSpeed; 
            h = texture2D(heightMap, uv).r;
        }
        
        // 7. HYDRO-THERMAL VENTS (Deposition)
        else if (activeEffect == 7) {
             vec2 vel = texture2D(velocityMap, uv).xy;
             float speed = length(vel);
             // Deposit mass where fluid energy is high
             if (speed > 0.1) {
                 h += 0.005 * speed * simSpeed; 
             }
             // General cooling/sinking
             h -= 0.0005 * simSpeed;
        }

        float hL = texture2D(heightMap, uv + vec2(-texel, 0.0)).r;
        float hR = texture2D(heightMap, uv + vec2(texel, 0.0)).r;
        float hU = texture2D(heightMap, uv + vec2(0.0, texel)).r;
        float hD = texture2D(heightMap, uv + vec2(0.0, -texel)).r;
        
        float delta = 0.0;

        // 1. THERMAL (Diffusion)
        if (activeEffect == 1) {
            float diff = (hL + hR + hU + hD) * 0.25 - h;
            if (abs(diff) > 0.001) delta += diff * simSpeed * 0.5;
        }

        // 2. HYDRAULIC (Simplified)
        if (activeEffect == 2) {
            // Find lowest neighbor
            float minH = min(min(hL, hR), min(hU, hD));
            float diff = h - minH;
            
            if (diff > 0.0) {
                // Erode peak
                delta -= diff * 0.2 * simSpeed;
            } else {
                // Deposit (sedimentation)
                delta += 0.001 * simSpeed; 
            }
        }
        
        // 4. SHATTER (Seismic)
        if (activeEffect == 4) {
            float crack = abs(snoise(uv * 20.0));
            if (crack < 0.05) delta -= 0.02 * simSpeed; 
            // Uplift
            if (crack > 0.9) delta += 0.01 * simSpeed;
        }

        // 5. STRATIFY (Terrace)
        if (activeEffect == 5) {
            float steps = 15.0;
            float target = floor(h * steps) / steps;
            delta += (target - h) * simSpeed * 0.1;
        }
        
        // Stability Clamp
        delta = clamp(delta, -0.05, 0.05);
        h += delta;
    }

    gl_FragColor = vec4(clamp(h, 0.0, 1.0), 0.0, 0.0, 1.0);
  }
`;

// Source: three-d\examples\tecton\KTectonshaders.tsx
export const SCULPT_FRAGMENT = `
  uniform sampler2D heightMap;
  uniform vec2 brushPos;
  uniform float brushRadius;
  uniform float brushStrength;
  uniform int mode; // 0=Raise, 1=Lower, 2=Flatten, 3=Noise, 4=Smooth, 5=Terrace, 6=Crater, 7=Sharpen, 8=Pinch, 9=Twist
  uniform float noiseSeed;
  uniform vec2 res;
  
  varying vec2 vUv;

  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  void main() {
      vec4 data = texture2D(heightMap, vUv);
      float h = data.r;
      
      float dist = distance(vUv, brushPos);
      
      // Brush Radius is passed in 0..1 UV space here
      if (dist < brushRadius) {
          // Cosine falloff
          float falloff = 0.5 * (1.0 + cos(3.14159 * (dist / brushRadius)));
          float force = brushStrength * falloff * 0.02; // Strength scaling
          float hardForce = brushStrength * falloff; // Stronger for shape brushes

          // 0: RAISE
          if (mode == 0) h += force;
          
          // 1: LOWER
          else if (mode == 1) h -= force;
          
          // 2: FLATTEN (Towards average of area ideally, but here 0.5 or current)
          else if (mode == 2) { 
              float target = 0.5; // Todo: Pass sampled height at brush center?
              h = mix(h, target, force * 5.0); 
          }
          
          // 3: NOISE
          else if (mode == 3) { 
              float n = (rand(vUv * 100.0 + noiseSeed) - 0.5) * 2.0; 
              h += n * force; 
          }

          // 4: SMOOTH (Blur)
          else if (mode == 4) {
              vec2 texel = vec2(1.0/res.x, 1.0/res.y);
              float sum = 0.0;
              sum += texture2D(heightMap, vUv + vec2(-texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, -texel.y)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, texel.y)).r;
              float avg = sum * 0.25;
              h = mix(h, avg, force * 10.0);
          }

          // 5: TERRACE (Quantize)
          else if (mode == 5) {
               float steps = 20.0;
               float target = floor(h * steps) / steps;
               h = mix(h, target, force * 10.0);
          }

          // 6: CRATER
          else if (mode == 6) {
              // Normalized distance 0..1
              float d = dist / brushRadius;
              // Crater profile: -1 at center, +0.5 at rim (d~0.7), 0 at 1.0
              float shape = -1.0 * exp(-10.0 * d * d) + 0.5 * exp(-10.0 * (d - 0.7) * (d - 0.7));
              h += shape * hardForce * 0.05;
          }

          // 7: SHARPEN (Contrast/Inverse Smooth)
          else if (mode == 7) {
              vec2 texel = vec2(1.0/res.x, 1.0/res.y);
              float sum = 0.0;
              sum += texture2D(heightMap, vUv + vec2(-texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(texel.x, 0.0)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, -texel.y)).r;
              sum += texture2D(heightMap, vUv + vec2(0.0, texel.y)).r;
              float avg = sum * 0.25;
              float diff = h - avg;
              h += diff * force * 20.0; // Exaggerate difference
          }

          // 8: PINCH (Warp UV towards center)
          else if (mode == 8) {
              // Calculate displacement vector towards center
              vec2 dir = brushPos - vUv;
              // Warp strength depends on distance (bell curve)
              float warp = -0.5 * (cos(3.14159 * (dist / brushRadius)) + 1.0);
              vec2 offset = dir * warp * force * 2.0;
              h = texture2D(heightMap, vUv + offset).r;
          }

          // 9: TWIST (Rotate UV around center)
          else if (mode == 9) {
              float angle = force * 10.0 * (1.0 - (dist / brushRadius));
              float s = sin(angle);
              float c = cos(angle);
              vec2 dir = vUv - brushPos;
              vec2 rotated = vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);
              h = texture2D(heightMap, brushPos + rotated).r;
          }
      }
      
      gl_FragColor = vec4(clamp(h, 0.0, 1.0), data.gba);
  }
`;

// Source: three-d\examples\tecton\KTectonshaders.tsx
export const RENDER_FRAGMENT = `
  uniform sampler2D albedoMap;
  uniform bool useAlbedoMap;
  uniform float detailScale;
  uniform float detailStrength;
  uniform int viewMode;
  uniform vec3 sunDir;
  uniform float sunIntensity;
  
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  // Modern Dark/High-Contrast Palette
  vec3 colDarkBase = vec3(0.02, 0.02, 0.03);
  vec3 colMid = vec3(0.2, 0.2, 0.25);
  vec3 colHigh = vec3(0.8, 0.8, 0.9);

  // Neon Palette (Cyber)
  vec3 colDeep   = vec3(0.0, 0.02, 0.05); 
  vec3 colGrid   = vec3(0.0, 0.2, 0.2);   
  vec3 colNeon   = vec3(0.0, 1.0, 0.8);   
  vec3 colHot    = vec3(1.0, 0.0, 0.5);   

  // GIS
  vec3 heatStart = vec3(0.0, 1.0, 0.0); 
  vec3 heatEnd = vec3(1.0, 0.0, 0.0);   

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec3 x = dFdx(vWorldPosition);
    vec3 y = dFdy(vWorldPosition);
    vec3 normal = normalize(cross(x, y));
    float slope = 1.0 - normal.y;

    vec3 finalColor = vec3(0.0);

    // MODE 0: DARK MATTER (Standard)
    if (viewMode == 0) {
        if (!useAlbedoMap) {
            // Dark base with highlights on peaks
            finalColor = mix(colDarkBase, colMid, vHeight * 1.2);
            finalColor = mix(finalColor, colHigh, smoothstep(0.7, 1.0, vHeight));
            
            // Subtle noise
            float n = hash(vUv * 500.0) * 0.05;
            finalColor += n;
        } else {
            finalColor = texture2D(albedoMap, vUv).rgb;
        }
        
        vec3 lightDir = normalize(sunDir);
        float diff = max(dot(normal, lightDir), 0.0);
        
        // High contrast lighting
        finalColor = finalColor * (0.1 + diff * sunIntensity);
    }

    // MODE 1: NEON CYBERPUNK
    if (viewMode == 1) { 
        // Grid effect
        float gridX = step(0.98, fract(vUv.x * 50.0));
        float gridY = step(0.98, fract(vUv.y * 50.0));
        float grid = max(gridX, gridY) * 0.3;

        if (!useAlbedoMap) {
            if(vHeight < 0.1) finalColor = colDeep;
            else if(vHeight < 0.4) finalColor = mix(colDeep, colGrid, smoothstep(0.1, 0.4, vHeight));
            else if(vHeight < 0.8) finalColor = mix(colGrid, colNeon, smoothstep(0.4, 0.8, vHeight));
            else finalColor = mix(colNeon, colHot, smoothstep(0.8, 1.0, vHeight));
            
            finalColor += grid * colNeon;
        } else {
            finalColor = texture2D(albedoMap, vUv).rgb * vec3(0.5, 1.0, 1.0); // Tint cyan
        }

        vec3 lightDir = normalize(sunDir);
        float diff = max(dot(normal, lightDir), 0.0);
        float spec = pow(max(dot(normal, normalize(sunDir + normalize(vViewPosition))), 0.0), 16.0);
        
        finalColor = finalColor * (0.2 + diff * sunIntensity) + spec * sunIntensity * 0.8;
    }

    // MODE 2: SLOPE HEATMAP
    if (viewMode == 2) { 
        finalColor = mix(heatStart, heatEnd, slope * 2.0);
    }

    // MODE 3: CONTOUR
    if (viewMode == 3) { 
        float lines = fract(vHeight * 30.0);
        float thickness = 0.05;
        float edge = step(thickness, lines) - step(1.0-thickness, lines);
        vec3 terrainCol = mix(vec3(0.05), vec3(0.2), vHeight);
        finalColor = mix(vec3(0.0, 1.0, 0.5), terrainCol, edge); 
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_NOISE_FRAG = `
  uniform float uScale;
  uniform float uDetail;
  uniform float uSeed;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
      float n = 0.0;
      float amp = 1.0;
      float freq = uScale;
      float maxAmp = 0.0;
      
      for(int i=0; i<4; i++) {
          if (float(i) >= uDetail) break;
          n += snoise(vUv * freq + uSeed) * amp;
          maxAmp += amp;
          amp *= 0.5;
          freq *= 2.0;
      }
      
      n = (n / maxAmp) * 0.5 + 0.5;
      vec3 col = mix(uColorA, uColorB, n);
      gl_FragColor = vec4(col, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_FBM_FRAG = `
  uniform float uScale;
  uniform float uSeed;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  varying vec2 vUv;

  float random (in vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123); }
  float noise (in vec2 st) {
      vec2 i = floor(st); vec2 f = fract(st);
      float a = random(i); float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  #define OCTAVES 6
  float fbm (in vec2 st) {
      float value = 0.0; float amplitude = .5;
      for (int i = 0; i < OCTAVES; i++) { value += amplitude * noise(st); st *= 2.; amplitude *= .5; }
      return value;
  }
  void main() {
      vec2 st = vUv * uScale;
      vec2 q = vec2(0.); q.x = fbm( st + 0.00*uTime); q.y = fbm( st + vec2(1.0));
      vec2 r = vec2(0.); r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*uTime ); r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*uTime);
      float f = fbm(st+r);
      vec3 color = mix(uColorA, uColorB, clamp((f*f)*4.0, 0.0, 1.0));
      gl_FragColor = vec4(color, 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const GEN_VORONOI_FRAG = `
  uniform float uScale; uniform float uSeed; uniform vec3 uColorA; uniform vec3 uColorB; varying vec2 vUv;
  vec2 random2( vec2 p ) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
  void main() {
      vec2 st = vUv * uScale; vec2 i_st = floor(st); vec2 f_st = fract(st); float m_dist = 1.0;
      for (int y= -1; y <= 1; y++) { for (int x= -1; x <= 1; x++) { vec2 neighbor = vec2(float(x),float(y)); vec2 point = random2(i_st + neighbor + uSeed); point = 0.5 + 0.5*sin(uSeed + 6.2831*point); vec2 diff = neighbor + point - f_st; float dist = length(diff); m_dist = min(m_dist, dist); } }
      gl_FragColor = vec4(mix(uColorA, uColorB, m_dist), 1.0);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_NEBULA_FRAG = `
  uniform sampler2D tInput; uniform float uTime; uniform float uSpeed; uniform float uChaos; uniform float uScale; varying vec2 vUv;
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  void main() {
      vec4 c = texture2D(tInput, vUv);
      float n1 = snoise(vUv * uScale + uTime * 0.1);
      float n2 = snoise(vUv * uScale + vec2(100.0) + uTime * 0.1);
      vec2 offset = vec2(n1, n2) * 0.005 * uSpeed;
      vec4 source = texture2D(tInput, vUv - offset);
      gl_FragColor = mix(c, source, 0.5 + uChaos * 0.5);
  }
`;

