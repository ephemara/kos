/**
 * PHYSICS SHADERS
 * 
 * Extracted from K_OS codebase
 * Category: physics
 * Total shaders: 8
 */

// Source: systems\physics\ParticleShaders.ts
export const POSITION_FRAGMENT = `
  uniform sampler2D positionTexture;
  uniform sampler2D velocityTexture;
  uniform sampler2D originTexture;
  uniform float dt;
  uniform float time;
  uniform int mode;
  varying vec2 vUv;

  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 pos = texture2D(positionTexture, uv).xyz;
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;

    pos += vel * dt;
    
    // Life/Respawn Logic
    float life = texture2D(positionTexture, uv).w - 0.005 * (1.0 + rand(uv)*0.5);
    bool respawn = false;
    
    if (life <= 0.0 || length(pos) > 100.0) respawn = true;
    
    // Mode specific bounds
    if (mode == 0) { respawn = false; life = 1.0; } 
    if (mode == 13 && length(pos) > 50.0) respawn = true;

    if (respawn) {
        life = 1.0;
        if (mode == 0 || mode == 13) pos = origin;
        else if (mode == 3) {
             float angle = rand(uv + time) * 6.28;
             float r = 2.0 + rand(uv + time + 1.0) * 40.0;
             pos = vec3(cos(angle)*r, (rand(uv)-0.5)*2.0, sin(angle)*r);
        }
        else if (mode == 17) {
             pos = (vec3(rand(uv), rand(uv+0.1), 0.0)-0.5) * 40.0;
        }
        else {
             pos = (vec3(rand(uv), rand(uv+1.0), rand(uv+2.0))-0.5) * 60.0;
        }
    }

    gl_FragColor = vec4(pos, life);
  }
`;

// Source: systems\physics\ParticleShaders.ts
export const RENDER_VERT = `
  uniform sampler2D positionTexture;
  uniform sampler2D velocityTexture;
  uniform float pointSize;
  attribute vec2 reference;
  varying vec3 vVel;
  varying float vLife;
  
  void main() {
    vec4 posData = texture2D(positionTexture, reference);
    vec3 pos = posData.xyz;
    vLife = posData.w;
    vVel = texture2D(velocityTexture, reference).xyz;
    
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = pointSize * (100.0 / -mvPosition.z);
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const FLUID_ADVECT = `
  uniform sampler2D velocityTex; 
  uniform sampler2D sourceTex; 
  uniform float dt; 
  uniform float dissipation; 
  varying vec2 vUv; 
  void main() { 
    // Follow velocity field backwards
    vec2 coord = vUv - dt * texture2D(velocityTex, vUv).xy * 0.01; 
    gl_FragColor = texture2D(sourceTex, coord) * dissipation; 
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const FLUID_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const FLUID_GRAD = `
  uniform sampler2D pressureTex; 
  uniform sampler2D velocityTex; 
  uniform vec2 texelSize;
  varying vec2 vUv; 
  void main() { 
    float L = texture2D(pressureTex, vUv - vec2(texelSize.x, 0.0)).x; 
    float R = texture2D(pressureTex, vUv + vec2(texelSize.x, 0.0)).x; 
    float T = texture2D(pressureTex, vUv + vec2(0.0, texelSize.y)).x; 
    float B = texture2D(pressureTex, vUv - vec2(0.0, texelSize.y)).x; 
    
    vec2 v = texture2D(velocityTex, vUv).xy; 
    // Subtract pressure gradient to enforce incompressibility
    v -= vec2(R - L, T - B); 
    gl_FragColor = vec4(v, 0.0, 1.0); 
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const FLUID_DIV = `
  uniform sampler2D velocityTex; 
  uniform vec2 texelSize;
  varying vec2 vUv; 
  void main() { 
    float L = texture2D(velocityTex, vUv - vec2(texelSize.x, 0.0)).x; 
    float R = texture2D(velocityTex, vUv + vec2(texelSize.x, 0.0)).x; 
    float T = texture2D(velocityTex, vUv + vec2(0.0, texelSize.y)).y; 
    float B = texture2D(velocityTex, vUv - vec2(0.0, texelSize.y)).y; 
    
    // Calculate divergence (net flow in/out)
    float div = 0.5 * (R - L + T - B); 
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0); 
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const FLUID_PRESS = `
  uniform sampler2D pressureTex; 
  uniform sampler2D divergenceTex; 
  uniform vec2 texelSize;
  varying vec2 vUv; 
  void main() { 
    float L = texture2D(pressureTex, vUv - vec2(texelSize.x, 0.0)).x; 
    float R = texture2D(pressureTex, vUv + vec2(texelSize.x, 0.0)).x; 
    float T = texture2D(pressureTex, vUv + vec2(0.0, texelSize.y)).x; 
    float B = texture2D(pressureTex, vUv - vec2(0.0, texelSize.y)).x; 
    float div = texture2D(divergenceTex, vUv).x; 
    
    // Jacobi iteration for pressure field
    float p = (L + R + T + B - div) * 0.25; 
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0); 
  }
`;

// Source: systems\shaders\physicsShaders.ts
export const FLUID_SPLAT = `
  uniform sampler2D targetTex; 
  uniform vec2 point; 
  uniform vec3 color; 
  uniform float radius; 
  varying vec2 vUv; 
  void main() { 
    vec2 p = vUv - point.xy; 
    // Gaussian splat
    vec3 splat = exp(-dot(p, p) / radius) * color; 
    vec3 base = texture2D(targetTex, vUv).xyz; 
    gl_FragColor = vec4(base + splat, 1.0); 
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const SIM_LIQUIFY_FRAG = `
  uniform sampler2D tInput; uniform sampler2D tVelocity; uniform float uSpeed; varying vec2 vUv;
  void main() {
      vec2 vel = texture2D(tVelocity, vUv).xy; vec2 coord = vUv - vel * uSpeed * 0.01;
      gl_FragColor = texture2D(tInput, coord);
  }
`;

// Source: two-d\examples\graphos\GraphosShaders.ts
export const BLACK_HOLE_FRAG = `
  uniform sampler2D tVelocity; 
  uniform vec2 uCenter;        
  uniform float uStrength;     
  uniform float uSpin;         
  uniform float uRadius;       
  uniform float uDecay;        
  uniform float uDt;
  varying vec2 vUv;

  void main() {
    vec2 vel = texture2D(tVelocity, vUv).xy;
    vel *= uDecay;
    vec2 dir = uCenter - vUv;
    float dist = length(dir);
    float influence = 1.0 - smoothstep(uRadius * 0.8, uRadius, dist);
    if (influence > 0.001) {
        float effectiveDist = max(dist, 0.001);
        vec2 normDir = normalize(dir);
        float gravity = uStrength / (effectiveDist * 10.0 + 0.1);
        vec2 tangent = vec2(-normDir.y, normDir.x);
        float spin = uSpin / (effectiveDist * 5.0 + 0.1);
        vec2 force = (normDir * gravity) + (tangent * spin);
        vel += force * influence * uDt;
    }
    if (length(vel) > 5.0) vel = normalize(vel) * 5.0;
  gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`;

