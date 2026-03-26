import {
    Grid, Orbit, Network, Atom, Microscope, Flame, Zap, Tornado,
    ImageIcon, Binary, Waves, Droplet, Wind, Anchor, Heart, Activity,
    CircleDot, Infinity as InfinityIcon, Magnet, GitMerge, Radio, Sun, ArrowUp, Grid2x2,
    Sparkles, Cpu, Gauge, Compass, Target, Hexagon
} from 'lucide-react';

// --- PHYSICS MODES ---
// Mode IDs 0-199: JavaScript/GLSL based (original)
// Mode IDs 100-199: Chronos modes (JS)
// Mode IDs 300+: Rust-powered (uses quantum.rs backend)

export const PHYSICS_CATEGORIES = {
    COSMIC: [
        { id: 0, label: "ZERO-POINT FIELD", icon: Grid, desc: "Stable energy grid state (Reset)." },
        { id: 3, label: "GALACTIC SPIRAL", icon: Orbit, desc: "Density wave orbital dynamics." },
        { id: 101, label: "KERR BLACK HOLE", icon: CircleDot, desc: "Relativistic singularity." },
        { id: 109, label: "SUPERNOVA REMNANT", icon: Sun, desc: "Blast wave turbulence." },
        { id: 110, label: "ALCUBIERRE WARP", icon: ArrowUp, desc: "Metric tensor distortion." }
    ],
    QUANTUM: [
        { id: 12, label: "NEURAL LATTICE", icon: Network, desc: "Synaptic firing patterns." },
        { id: 6, label: "QUANTUM PILOT", icon: Atom, desc: "Bohmian mechanics trajectories." },
        { id: 8, label: "SCHRODINGER WAVE", icon: Microscope, desc: "Probability density collapse." },
        { id: 112, label: "QUANTUM FOAM", icon: Droplet, desc: "Sub-Planck fluctuations." }
    ],
    ELEMENTAL: [
        { id: 20, label: "HELLFIRE", icon: Flame, desc: "Volumetric buoyancy simulation." },
        { id: 21, label: "PLASMA ARC", icon: Zap, desc: "Magnetic flux tubes." },
        { id: 22, label: "SUPER VORTEX", icon: Tornado, desc: "High-velocity cyclonic flow." },
        { id: 102, label: "ION STORM", icon: Wind, desc: "Charged particle chaotic flow." },
        { id: 111, label: "SOLAR PROMINENCE", icon: Flame, desc: "Magnetic reconnection loops." }
    ],
    OPTICAL: [
        { id: 5, label: "PHOTO-KINESIS", icon: ImageIcon, desc: "Image-based particle reconstruction." },
        { id: 14, label: "DATAMOSH", icon: Binary, desc: "Compression artifact glitching." },
        { id: 10, label: "TESSERACT", icon: Grid, desc: "4D hypercube projection." },
        { id: 105, label: "VAN ALLEN BELT", icon: Magnet, desc: "Flux line visualization." }
    ],
    ATTRACTORS: [
        { id: 104, label: "LORENZ ATTRACTOR", icon: InfinityIcon, desc: "Chaotic strange attractor." },
        { id: 106, label: "AIZAWA ATTRACTOR", icon: Activity, desc: "Complex polynomial flow." },
        { id: 107, label: "BINARY SYSTEM", icon: GitMerge, desc: "Roche lobe transfer." },
        { id: 108, label: "QUASAR JET", icon: Radio, desc: "Relativistic polar ejection." }
    ],
    STRUCTURES: [
        { id: 113, label: "CYBERPUNK CITY", icon: Grid2x2, desc: "Procedural traffic flow." },
        { id: 114, label: "DNA HELIX", icon: Activity, desc: "Double helix replication." }
    ],
    HYDRO: [
        { id: 17, label: "NAVIER-STOKES", icon: Waves, desc: "Fluid dynamics coupling." },
        { id: 13, label: "FERROFLUID", icon: Droplet, desc: "Magnetic liquid simulation." },
        { id: 2, label: "TSUNAMI", icon: Wind, desc: "High velocity wave propagation." }
    ],

    // ═══════════════════════════════════════════════════════════════════════
    // RUST-POWERED CATEGORIES (Mode IDs 300+)
    // These automatically use the high-performance Rust backend
    // ═══════════════════════════════════════════════════════════════════════

    CHAOS_THEORY: [
        { id: 300, label: "LORENZ BUTTERFLY", icon: InfinityIcon, desc: "Classic strange attractor. Parallel Rust computation.", rust: true },
        { id: 301, label: "RÖSSLER SPIRAL", icon: Compass, desc: "Asymmetric chaotic flow.", rust: true },
        { id: 302, label: "AIZAWA BEAST", icon: Hexagon, desc: "6-parameter polynomial chaos.", rust: true },
        { id: 303, label: "TRUE N-BODY", icon: Sparkles, desc: "Every particle attracts every other.", rust: true },
    ],
    PLASMA: [
        { id: 310, label: "TOKAMAK FUSION", icon: Target, desc: "Toroidal magnetic confinement.", rust: true },
        { id: 311, label: "MAGNETIC DIPOLE", icon: Magnet, desc: "Lorentz force + charged particles.", rust: true },
        { id: 312, label: "SUPER VORTEX+", icon: Tornado, desc: "High-fidelity vortex dynamics.", rust: true },
    ],
    EXOTIC: [
        { id: 320, label: "GRAVITY WAVES", icon: Waves, desc: "Ripples in spacetime fabric.", rust: true },
        { id: 321, label: "COSMIC WEB", icon: Network, desc: "Large-scale structure filaments.", rust: true },
        { id: 322, label: "EVENT HORIZON", icon: CircleDot, desc: "Kerr metric + frame dragging.", rust: true },
    ],
    TURBULENT: [
        { id: 330, label: "FBM TURBULENCE", icon: Wind, desc: "Fractal Brownian motion field.", rust: true },
        { id: 331, label: "CURL FLOW", icon: Gauge, desc: "Divergence-free 3D noise.", rust: true },
    ],
};

// ═══════════════════════════════════════════════════════════════════════════
// RUST MODE DETECTION & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/** Check if a mode ID uses Rust backend (IDs 300+) */
export const isRustMode = (modeId: number): boolean => modeId >= 300;

/** Rust mode configurations - maps mode ID to attractor setup */
export const RUST_MODE_CONFIG: Record<number, {
    attractors: Array<{ type: string; params: Record<string, unknown> }>;
    nbody?: { enabled: boolean; g: number; softening: number };
    particle_count?: number;
}> = {
    // CHAOS_THEORY
    300: { // LORENZ BUTTERFLY
        attractors: [{ type: 'lorenz', params: { sigma: 10, rho: 28, beta: 2.667, scale: 0.1, max_force: 50 } }],
        particle_count: 100000,
    },
    301: { // RÖSSLER SPIRAL
        attractors: [{ type: 'rossler', params: { a: 0.2, b: 0.2, c: 5.7, scale: 0.1, max_force: 50 } }],
        particle_count: 100000,
    },
    302: { // AIZAWA BEAST
        attractors: [{ type: 'aizawa', params: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1, scale: 0.5, max_force: 50 } }],
        particle_count: 100000,
    },
    303: { // TRUE N-BODY
        attractors: [{ type: 'point', params: { position: [0, 0, 0], mass: 20, softening: 1.0, max_force: 100 } }],
        nbody: { enabled: true, g: 0.5, softening: 0.5 },
        particle_count: 5000, // Lower count for O(n²) N-body
    },

    // PLASMA
    310: { // TOKAMAK FUSION
        attractors: [{ type: 'tokamak', params: { center: [0, 0, 0], major_radius: 25, minor_radius: 8, field_strength: 15, max_force: 100 } }],
        particle_count: 150000,
    },
    311: { // MAGNETIC DIPOLE
        attractors: [{ type: 'magnetic', params: { position: [0, 0, 0], moment: [0, 200, 0], max_force: 100 } }],
        particle_count: 100000,
    },
    312: { // SUPER VORTEX+
        attractors: [
            { type: 'vortex', params: { position: [0, 0, 0], axis: [0, 1, 0], strength: 15, radius: 40, max_force: 50 } },
            { type: 'point', params: { position: [0, 0, 0], mass: 10, softening: 2.0, max_force: 30 } },
        ],
        particle_count: 120000,
    },

    // EXOTIC
    320: { // GRAVITY WAVES
        attractors: [{ type: 'gravity_wave', params: { source: [0, 0, 0], frequency: 0.5, amplitude: 15, phase: 0, max_force: 80 } }],
        particle_count: 100000,
    },
    321: { // COSMIC WEB
        attractors: [{ type: 'cosmic_web', params: { seed: 42, cell_size: 25, filament_strength: 5, max_force: 30 } }],
        particle_count: 200000,
    },
    322: { // EVENT HORIZON
        attractors: [{ type: 'blackhole', params: { position: [0, 0, 0], mass: 100, spin: 25, event_horizon: 3.0, max_force: 500 } }],
        particle_count: 150000,
    },

    // TURBULENT
    330: { // FBM TURBULENCE
        attractors: [{ type: 'turbulence', params: { seed: 42, octaves: 4, frequency: 0.08, amplitude: 8, max_force: 50 } }],
        particle_count: 150000,
    },
    331: { // CURL FLOW
        attractors: [{ type: 'curl', params: { seed: 42, scale: 0.1, strength: 6, max_force: 40 } }],
        particle_count: 150000,
    },
};

// --- COLOR PALETTES (15+) ---
export const COLOR_PALETTES: Record<string, string[]> = {
    // Original
    COSMIC: ['#000000', '#140024', '#4a00e0', '#8e2de2', '#00ffcc'],
    INFERNO: ['#000000', '#3d0000', '#ff0000', '#ff8800', '#ffff00'],
    ARCTIC: ['#000510', '#001433', '#004488', '#00aaff', '#ffffff'],
    TOXIC: ['#000000', '#0a1a0a', '#00ff00', '#ccff00', '#ffffff'],
    NEON: ['#000000', '#ff00ff', '#0000ff', '#00ffff', '#ffffff'],
    // New palettes
    SUNSET: ['#0d0221', '#261447', '#e94560', '#ff9a3c', '#ffe66d'],
    OCEAN: ['#000814', '#001d3d', '#003566', '#0077b6', '#90e0ef'],
    CYBERPUNK: ['#0a0a0a', '#1a1a2e', '#16213e', '#e94560', '#ff00ff'],
    MATRIX: ['#000000', '#001100', '#003300', '#00ff00', '#88ff88'],
    VAPOR: ['#120458', '#441752', '#ff00aa', '#00ffff', '#ffffff'],
    EMBER: ['#0a0000', '#1a0000', '#4a0000', '#ff4400', '#ffaa00'],
    AURORA: ['#001122', '#004455', '#00aa88', '#44ffaa', '#aaffcc'],
    SPECTRUM: ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#0000ff'],
    MONOCHROME: ['#000000', '#333333', '#666666', '#999999', '#ffffff'],
    PLASMA: ['#0c0032', '#190061', '#3500d3', '#ff00ff', '#00ffff'],
    FIRE_ICE: ['#00aaff', '#0066cc', '#000000', '#ff6600', '#ff0000'],
    GALAXY: ['#000000', '#0f0c29', '#302b63', '#24243e', '#efd5ff'],
    BLOOD: ['#0a0000', '#1a0505', '#3d0000', '#8b0000', '#dc143c'],
    ELECTRIC: ['#000022', '#000066', '#0066ff', '#00ffff', '#ffffff'],
    FOREST: ['#0a0f0a', '#1a2f1a', '#2d5a27', '#71b340', '#a8e063'],
};

// Palette names for UI
export const PALETTE_NAMES = Object.keys(COLOR_PALETTES);

// --- MODIFIERS (12+) ---
export const MODIFIER_CONFIG = {
    RHYTHMIC: [
        { id: 'heartbeat', name: 'Heartbeat', icon: Heart, params: { bpm: { val: 60, min: 30, max: 200, step: 1 }, intensity: { val: 2.0, min: 0, max: 10, step: 0.1 } } },
        { id: 'seismic', name: 'Seismic', icon: Activity, params: { scale: { val: 1.0, min: 0, max: 5, step: 0.1 }, freq: { val: 2.0, min: 0.1, max: 10, step: 0.1 } } },
        { id: 'pulse', name: 'Pulse Wave', icon: Radio, params: { freq: { val: 1.0, min: 0.1, max: 5, step: 0.1 }, amplitude: { val: 5.0, min: 0, max: 20, step: 0.5 } } },
        { id: 'breathe', name: 'Breathe', icon: Wind, params: { rate: { val: 0.5, min: 0.1, max: 2, step: 0.1 }, depth: { val: 10.0, min: 1, max: 30, step: 1 } } },
    ],
    FORCES: [
        { id: 'helix', name: 'Helix Twist', icon: Tornado, params: { speed: { val: 1.0, min: -5, max: 5, step: 0.1 }, tightness: { val: 0.1, min: 0.01, max: 1.0, step: 0.01 } } },
        { id: 'gravity', name: 'Gravity Well', icon: Anchor, params: { force: { val: 5.0, min: -20, max: 20, step: 0.5 }, radius: { val: 10.0, min: 1, max: 50, step: 1 } } },
        { id: 'repulsor', name: 'Repulsor', icon: Zap, params: { force: { val: 10.0, min: 0, max: 50, step: 1 }, falloff: { val: 2.0, min: 0.5, max: 5, step: 0.1 } } },
        { id: 'orbit', name: 'Orbital', icon: Orbit, params: { speed: { val: 2.0, min: -10, max: 10, step: 0.5 }, radius: { val: 20.0, min: 5, max: 50, step: 1 } } },
        { id: 'vortex', name: 'Vortex', icon: Tornado, params: { strength: { val: 5.0, min: 0, max: 20, step: 0.5 }, lift: { val: 1.0, min: -5, max: 5, step: 0.1 } } },
        { id: 'magnet', name: 'Magnet Poles', icon: Magnet, params: { dipole: { val: 50.0, min: 0, max: 200, step: 5 }, separation: { val: 20.0, min: 5, max: 50, step: 1 } } },
        { id: 'explosion', name: 'Explosion', icon: Sun, params: { force: { val: 30.0, min: 0, max: 100, step: 5 }, decay: { val: 0.95, min: 0.8, max: 0.99, step: 0.01 } } },
        { id: 'swarm', name: 'Swarm AI', icon: Network, params: { cohesion: { val: 1.0, min: 0, max: 5, step: 0.1 }, separation: { val: 2.0, min: 0, max: 5, step: 0.1 } } },
    ]
};

// --- SHADERS ---
export const SIM_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`;

export const FLUID_ADVECT = `uniform sampler2D velocityTex; uniform sampler2D sourceTex; uniform float dt; uniform float dissipation; varying vec2 vUv; void main() { vec2 coord = vUv - dt * texture2D(velocityTex, vUv).xy * 0.01; gl_FragColor = texture2D(sourceTex, coord) * dissipation; }`;
export const FLUID_DIV = `uniform sampler2D velocityTex; varying vec2 vUv; void main() { float w = 1.0/128.0; float L = texture2D(velocityTex, vUv - vec2(w, 0.0)).x; float R = texture2D(velocityTex, vUv + vec2(w, 0.0)).x; float T = texture2D(velocityTex, vUv + vec2(0.0, w)).y; float B = texture2D(velocityTex, vUv - vec2(0.0, w)).y; float div = 0.5 * (R - L + T - B); gl_FragColor = vec4(div, 0.0, 0.0, 1.0); }`;
export const FLUID_PRESS = `uniform sampler2D pressureTex; uniform sampler2D divergenceTex; varying vec2 vUv; void main() { float w = 1.0/128.0; float L = texture2D(pressureTex, vUv - vec2(w, 0.0)).x; float R = texture2D(pressureTex, vUv + vec2(w, 0.0)).x; float T = texture2D(pressureTex, vUv + vec2(0.0, w)).x; float B = texture2D(pressureTex, vUv - vec2(0.0, w)).x; float div = texture2D(divergenceTex, vUv).x; float p = (L + R + T + B - div) * 0.25; gl_FragColor = vec4(p, 0.0, 0.0, 1.0); }`;
export const FLUID_GRAD = `uniform sampler2D pressureTex; uniform sampler2D velocityTex; varying vec2 vUv; void main() { float w = 1.0/128.0; float L = texture2D(pressureTex, vUv - vec2(w, 0.0)).x; float R = texture2D(pressureTex, vUv + vec2(w, 0.0)).x; float T = texture2D(pressureTex, vUv + vec2(0.0, w)).x; float B = texture2D(pressureTex, vUv - vec2(0.0, w)).x; vec2 v = texture2D(velocityTex, vUv).xy; v -= vec2(R - L, T - B); gl_FragColor = vec4(v, 0.0, 1.0); }`;
export const FLUID_SPLAT = `uniform sampler2D targetTex; uniform vec2 point; uniform vec3 color; uniform float radius; varying vec2 vUv; void main() { vec2 p = vUv - point.xy; vec3 splat = exp(-dot(p, p) / radius) * color; vec3 base = texture2D(targetTex, vUv).xyz; gl_FragColor = vec4(base + splat, 1.0); }`;

export const VELOCITY_TEMPLATE = `
  uniform sampler2D velocityTexture; uniform sampler2D positionTexture; uniform sampler2D fluidTexture; uniform sampler2D originTexture;
  uniform vec3 mousePos; uniform float time; uniform float speed; uniform float chaos; uniform int mode;
  uniform float audioLevel; uniform float audioBass; uniform float audioHigh;
  uniform float uDamping; // FRICTION CONTROL
  
  // Original modifiers
  uniform float uHeartbeatActive; uniform float uHeartbeatBPM; uniform float uHeartbeatIntensity;
  uniform float uHelixActive; uniform float uHelixSpeed; uniform float uHelixTightness;
  uniform float uSeismicActive; uniform float uSeismicScale; uniform float uSeismicFreq;
  uniform float uGravityActive; uniform float uGravityForce; uniform float uGravityRadius;

  // NEW MODIFIERS - Rhythmic
  uniform float uPulseActive; uniform float uPulseFreq; uniform float uPulseAmplitude;
  uniform float uBreatheActive; uniform float uBreatheRate; uniform float uBreatheDepth;

  // NEW MODIFIERS - Forces
  uniform float uRepulsorActive; uniform float uRepulsorForce; uniform float uRepulsorFalloff;
  uniform float uOrbitActive; uniform float uOrbitSpeed; uniform float uOrbitRadius;
  uniform float uVortexActive; uniform float uVortexStrength; uniform float uVortexLift;
  uniform float uMagnetActive; uniform float uMagnetDipole; uniform float uMagnetSeparation;
  uniform float uExplosionActive; uniform float uExplosionForce; uniform float uExplosionDecay;
  uniform float uSwarmActive; uniform float uSwarmCohesion; uniform float uSwarmSeparation;

  // Force controls from UI
  uniform float uForceMultiplier;
  uniform float uCurlStrength;
  uniform float uCenterPull;
  uniform float uMaxVelocity;

  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) { const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
  vec3 curl(float x, float y, float z) { float eps = 0.1; float n1 = snoise(vec2(x, y)); float n2 = snoise(vec2(y, z)); float n3 = snoise(vec2(z, x)); return vec3(n2 - n3, n3 - n1, n1 - n2); }
  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  vec3 applyCustomScripts(vec3 p, vec3 v, float t) {
      vec3 force = vec3(0.0);
      //_USER_CODE_INJECTION_
      return force;
  }

  void main() {
    vec2 uv = vUv; 
    vec3 pos = texture2D(positionTexture, uv).xyz; 
    vec3 vel = texture2D(velocityTexture, uv).xyz;
    vec3 origin = texture2D(originTexture, uv).xyz;
    
    // ═══════════════════════════════════════════════════════════
    // KINETIX STACK - ORIGINAL MODIFIERS
    // ═══════════════════════════════════════════════════════════
    if (uHeartbeatActive > 0.5) { float beatT = mod(time * (uHeartbeatBPM / 60.0), 1.0); float pulse = 0.0; if(beatT<0.1) pulse=sin(beatT*31.4); else if(beatT<0.3&&beatT>0.1) pulse=-0.5; vel += normalize(pos) * pulse * uHeartbeatIntensity * 0.2; }
    if (uHelixActive > 0.5) { vec3 up = vec3(0,1,0); vec3 tan = cross(normalize(pos), up); float tq = sin(pos.y * uHelixTightness + time * uHelixSpeed); vel += tan * tq * 0.1; vel -= normalize(pos) * 0.05 * abs(tq); }
    if (uSeismicActive > 0.5) { float s = snoise(vec2(time * uSeismicFreq, pos.x*0.01)); vel.y += s * uSeismicScale * 0.05; }
    if (uGravityActive > 0.5) { float d = length(pos); if(d < uGravityRadius) { vel -= normalize(pos) * (uGravityForce / (d*d+0.1)) * 0.5; } }

    // ═══════════════════════════════════════════════════════════
    // NEW RHYTHMIC MODIFIERS
    // ═══════════════════════════════════════════════════════════
    // Pulse Wave: Radial sine wave emanating from center
    if (uPulseActive > 0.5) {
        float dist = length(pos);
        float wave = sin(dist * 0.2 - time * uPulseFreq * 3.0);
        vel += normalize(pos) * wave * uPulseAmplitude * 0.1;
    }
    
    // Breathe: Gentle expansion/contraction like breathing
    if (uBreatheActive > 0.5) {
        float breath = sin(time * uBreatheRate * 3.14159);
        vel += normalize(pos) * breath * uBreatheDepth * 0.05;
    }

    // ═══════════════════════════════════════════════════════════
    // NEW FORCE MODIFIERS
    // ═══════════════════════════════════════════════════════════
    // Repulsor: Push particles away from center
    if (uRepulsorActive > 0.5) {
        float dist = length(pos);
        float falloff = 1.0 / (pow(dist, uRepulsorFalloff) + 0.1);
        vel += normalize(pos) * uRepulsorForce * falloff * 0.1;
    }

    // Orbital: Circular motion around Y axis
    if (uOrbitActive > 0.5) {
        vec3 toCenter = -normalize(vec3(pos.x, 0.0, pos.z));
        vec3 tangent = cross(toCenter, vec3(0.0, 1.0, 0.0));
        float r = length(pos.xz);
        float targetR = uOrbitRadius;
        vel += tangent * uOrbitSpeed * 0.5;
        vel += toCenter * (r - targetR) * 0.1; // Pull to orbit radius
    }

    // Vortex: Spinning tornado with lift
    if (uVortexActive > 0.5) {
        vec3 toCenter = -normalize(vec3(pos.x, 0.0, pos.z));
        vec3 spin = cross(toCenter, vec3(0.0, 1.0, 0.0));
        float r = length(pos.xz);
        vel += spin * uVortexStrength / (r + 1.0);
        vel.y += uVortexLift * (1.0 - r * 0.02);
        vel += toCenter * 0.5; // Inward pull
    }

    // Magnet Poles: Two opposing poles
    if (uMagnetActive > 0.5) {
        vec3 poleN = vec3(0.0, uMagnetSeparation * 0.5, 0.0);
        vec3 poleS = vec3(0.0, -uMagnetSeparation * 0.5, 0.0);
        vec3 toN = poleN - pos; vec3 toS = poleS - pos;
        float distN = length(toN); float distS = length(toS);
        vec3 forceN = normalize(toN) * uMagnetDipole / (distN * distN + 1.0);
        vec3 forceS = -normalize(toS) * uMagnetDipole / (distS * distS + 1.0);
        vel += (forceN + forceS) * 0.01;
    }

    // Explosion: Outward burst with decay
    if (uExplosionActive > 0.5) {
        float dist = length(pos);
        float intensity = uExplosionForce / (dist + 1.0);
        vel += normalize(pos) * intensity * 0.1 * (1.0 - uExplosionDecay);
    }

    // Swarm: Flocking behavior (simplified boids)
    if (uSwarmActive > 0.5) {
        // Cohesion: move toward center
        vel -= normalize(pos) * uSwarmCohesion * 0.1;
        // Separation: based on distance from origin (proxy for neighbors)
        float dist = length(pos);
        if (dist < 10.0) {
            vel += normalize(pos) * uSwarmSeparation * (10.0 - dist) * 0.02;
        }
        // Alignment: add some curl for organic movement
        vel += curl(pos.x * 0.1, pos.y * 0.1, time * 0.5) * 0.3;
    }
    
    // AUDIO REACTIVITY
    if (audioBass > 0.05) { vec3 centerDir = normalize(pos); vel += centerDir * audioBass * 0.8 * chaos; vel += cross(centerDir, vec3(0,1,0)) * audioBass * 0.4; }

    // MODE 0: ZERO-POINT (Reset/Stable)
    if (mode == 0) {
        vec3 diff = origin - pos;
        vel += diff * 0.1 * speed; // Spring force to origin
        vel += curl(pos.x * 0.05, pos.y * 0.05, time * 0.1) * chaos * 0.05;
    }

    // MODE 3: GALACTIC SPIRAL (SHARED)
    else if (mode == 3) {
        vec3 d = pos; d.y *= 2.0; // Flatten galaxy
        float r = length(d.xz);
        float angle = atan(d.z, d.x);
        float spiral = 3.0 * log(r + 1.0);
        float phase = angle + spiral;
        float dens = cos(phase * 2.0 - time * speed * 0.5);
        
        vec3 tan = cross(vec3(0,1,0), normalize(d));
        float orb = 10.0 * speed / sqrt(r + 0.1);
        
        vel += (tan * orb - vel) * 0.05; // Orbital entrainment
        vel -= normalize(d) * (5.0 / (r*r+1.0)); // Central gravity
        vel += curl(pos.x*0.1, pos.y*0.1, time*0.5) * chaos * 0.2;
    }

    // MODE 5: PHOTO-KINESIS (Kaleidoscope)
    else if (mode == 5) {
       vec3 target = vec3((uv.x - 0.5) * 60.0, (uv.y - 0.5) * 60.0, 0.0); 
       vel += (target - pos) * 0.05 * speed + curl(pos.x*0.1, pos.y*0.1, time*0.5) * 0.05 * chaos;
    }

    // --- CHRONOS IMPORTED MODES (100+) ---
    // MODE 101: KERR BLACK HOLE
    else if (mode == 101) {
        vel.y -= pos.y * 0.5; 
        vec3 dir = -normalize(pos);
        float r = length(pos);
        float gravity = 50.0 * speed / (r * r + 0.1);
        if (r < 2.0) gravity = 0.0; 
        vel += dir * gravity * 0.1;
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 tangent = cross(dir, up);
        float spin = 20.0 * speed / (r + 1.0);
        vel += tangent * spin * 0.1;
        vel += curl(pos.x*0.1, pos.y*0.1, time*0.1) * chaos * 0.1;
    }

    // MODE 102: ION STORM (Was 2)
    else if (mode == 102) {
        vec3 diff = pos - vec3(0, pos.y, 0);
        vec3 centerDir = -normalize(diff);
        vec3 up = vec3(0, 1, 0);
        vec3 spin = cross(centerDir, up);
        vel += spin * 2.0 * speed * 0.1;
        vel += centerDir * 0.5 * speed * 0.1; 
        vel.y += 0.5 * speed * 0.1; 
        vel += curl(pos.x*0.1, pos.y*0.1, time*0.2) * chaos * 0.2;
    }

    // MODE 104: LORENZ ATTRACTOR
    else if (mode == 104) {
        float sigma = 10.0; float rho = 28.0; float beta = 8.0/3.0;
        vec3 p = pos * 1.0; 
        vec3 d;
        d.x = sigma * (p.y - p.x);
        d.y = p.x * (rho - p.z) - p.y;
        d.z = p.x * p.y - beta * p.z;
        vel += (d * 0.5 * speed - vel) * 0.1; 
    }

    // MODE 105: VAN ALLEN BELT (Was 5)
    else if (mode == 105) {
        vec3 m = vec3(0.0, 50.0, 0.0); 
        vec3 p = pos;
        float r = length(p);
        float dotMR = dot(m, p);
        vec3 B = (3.0 * p * dotMR - m * (r*r)) / pow(r, 5.0);
        vec3 B_dir = normalize(B);
        vel += B_dir * 20.0 * speed * 0.1;
        if (r < 5.0) vel += normalize(p) * 50.0 * 0.1;
        vel += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1) * chaos * 0.2;
    }

    // MODE 106: AIZAWA ATTRACTOR
    else if (mode == 106) {
        float a = 0.95; float b = 0.7; float c = 0.6; float d = 3.5; float e = 0.25; float f = 0.1;
        vec3 p = pos * 2.0; 
        float dx = (p.z - b) * p.x - d * p.y;
        float dy = d * p.x + (p.z - b) * p.y;
        float dz = c + a * p.z - (p.z * p.z * p.z) / 3.0 - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z) + f * p.z * (p.x * p.x * p.x);
        vec3 flow = vec3(dx, dy, dz);
        vel += (flow * 0.5 * speed - vel) * 0.1;
    }

    // MODE 107: BINARY SYSTEM
    else if (mode == 107) {
        vec3 star1 = vec3(-10.0, 0.0, 0.0);
        vec3 star2 = vec3(10.0, 0.0, 0.0);
        float m1 = 1.0; float m2 = 0.8;
        float angle = time * 0.5 * speed;
        float ca = cos(angle); float sa = sin(angle);
        vec3 rStar1 = vec3(star1.x*ca - star1.z*sa, 0.0, star1.x*sa + star1.z*ca);
        vec3 rStar2 = vec3(star2.x*ca - star2.z*sa, 0.0, star2.x*sa + star2.z*ca);
        vec3 d1 = rStar1 - pos; vec3 d2 = rStar2 - pos;
        float dist1 = length(d1); float dist2 = length(d2);
        vec3 f1 = normalize(d1) * (m1 / (dist1*dist1 + 0.1)) * 100.0;
        vec3 f2 = normalize(d2) * (m2 / (dist2*dist2 + 0.1)) * 100.0;
        vec3 centrifugal = vec3(pos.x, 0.0, pos.z) * 0.1; 
        vel += (f1 + f2 + centrifugal) * speed * 0.1;
        vel += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1) * chaos * 0.5;
        vel.y -= pos.y * 0.1;
    }

    // MODE 108: QUASAR JET
    else if (mode == 108) {
        vec3 centerDir = -normalize(pos);
        float r = length(pos);
        float gForce = 20.0 / (r*r + 0.1);
        vel += centerDir * gForce * 0.1;
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 spin = cross(centerDir, up);
        vel += spin * 10.0 / (r + 1.0) * 0.1;
        float cone = length(pos.xz);
        if (cone < 5.0 && abs(pos.y) > 2.0) {
            float jetForce = 50.0 * speed;
            vel.y += sign(pos.y) * jetForce * 0.1;
            vel.x -= pos.x * 2.0 * 0.1; 
            vel.z -= pos.z * 2.0 * 0.1;
            vel += spin * 20.0 * 0.1;
        }
        vel += curl(pos.x*0.2, pos.y*0.05, time*2.0) * chaos * 0.2;
    }

    // MODE 109: SUPERNOVA REMNANT
    else if (mode == 109) {
        vec3 dir = normalize(pos);
        float r = length(pos);
        float blastSpeed = 20.0 * speed / (r * 0.1 + 1.0); 
        vel += dir * blastSpeed * 0.1;
        vec3 turbulence = curl(pos.x*0.2, pos.y*0.2, pos.z*0.2) * chaos * 5.0;
        float shellStart = 20.0 + time * 5.0;
        if (r > shellStart - 5.0 && r < shellStart + 5.0) {
            vel += turbulence * 0.1;
        }
        vel -= vel * 0.1 * 0.1; // Drag
    }

    // MODE 110: ALCUBIERRE WARP
    else if (mode == 110) {
        float r = length(pos.xy); 
        float bubble = 1.0 - (tanh(r - 10.0) + 1.0) * 0.5; 
        vec3 warpField = vec3(0.0);
        if (pos.z > 0.0) warpField.z = -10.0; else warpField.z = 10.0; 
        vel += warpField * bubble * speed * 5.0 * 0.1;
        if (r < 5.0 && abs(pos.z) < 5.0) { vel *= 0.5; }
        vel += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1 + time) * chaos * 0.1;
    }

    // MODE 111: SOLAR PROMINENCE
    else if (mode == 111) {
        if (pos.y < -20.0) vel.y += 10.0 * 0.1;
        float xNorm = pos.x / 20.0;
        float arcHeight = cos(xNorm * 1.57) * 30.0;
        float targetY = -20.0 + arcHeight;
        vec3 fieldTarget = vec3(pos.x, targetY, 0.0);
        vec3 magneticForce = (fieldTarget - pos) * 2.0;
        vec3 tangent = normalize(vec3(1.0, -sin(xNorm * 1.57), 0.0));
        vec3 twist = cross(tangent, normalize(pos - fieldTarget)) * 10.0;
        vel += (magneticForce + twist) * speed * 0.1;
        if (chaos > 0.8 && abs(pos.x) < 5.0) vel += normalize(pos) * 100.0 * 0.1;
    }

    // MODE 112: QUANTUM FOAM
    else if (mode == 112) {
        vec3 disp = curl(pos.x*0.5, pos.y*0.5, time*0.5) * chaos * 5.0;
        float expansion = sin(length(pos)*0.5 - time*2.0);
        vel += disp * 0.1;
        vel += normalize(pos) * expansion * speed * 2.0 * 0.1;
        if (length(pos) > 50.0) vel -= normalize(pos) * 10.0 * 0.1;
        if (length(vel) < 0.1) vel += (vec3(rand(vec2(time)), rand(vec2(time+1.0)), rand(vec2(time+2.0)))-0.5) * 10.0 * 0.1;
    }

    // MODE 113: CYBERPUNK CITY
    else if (mode == 113) {
        vec3 grid = floor(pos / 5.0) * 5.0;
        vec3 diff = pos - grid;
        vec3 flow = vec3(0.0);
        float tVal = sin(time*0.5 + grid.x + grid.z);
        if (abs(diff.x) < 0.5) flow.z = sign(sin(grid.x))*10.0;
        if (abs(diff.z) < 0.5) flow.x = sign(sin(grid.z))*10.0;
        if (abs(diff.y) < 0.5) {
             flow.y = 0.0;
             if (length(flow) < 1.0) flow.y = sin(time + grid.x)*2.0;
        }
        vel += (flow * speed - vel) * 0.5 * 0.1;
        vel += curl(pos.x*0.2, pos.y*0.2, time*0.5) * chaos * 0.1;
        if (length(pos) > 60.0) vel -= normalize(pos) * 5.0 * 0.1;
    }

    // MODE 114: DNA HELIX
    else if (mode == 114) {
        float helixRad = 10.0;
        float rise = pos.y * 0.2 + time;
        vec3 strand1 = vec3(cos(rise)*helixRad, pos.y, sin(rise)*helixRad);
        vec3 strand2 = vec3(cos(rise + 3.14)*helixRad, pos.y, sin(rise + 3.14)*helixRad);
        vec3 d1 = strand1 - pos;
        vec3 d2 = strand2 - pos;
        if (length(d1) < length(d2)) vel += d1 * 5.0 * speed * 0.1;
        else vel += d2 * 5.0 * speed * 0.1;
        vel += curl(pos.x*0.1, pos.y*0.1, pos.z*0.1) * chaos * 0.5;
        vel.y += sin(pos.x * 0.1) * 0.5;
    }
    
    // ELEMENTAL MODES
    else if (mode == 20) { // Hellfire
       vel.y += 0.5 * speed; 
       if (pos.y < -10.0) { vel.x -= pos.x * 0.05; vel.z -= pos.z * 0.05; }
       vel += curl(pos.x * 0.1, pos.y * 0.1 + time * 2.0, pos.z * 0.1) * 0.5 * chaos;
    }
    else if (mode == 21) { // Plasma Arc
       vec3 center = vec3(0.0); vec3 dir = center - pos;
       vec3 tangent = cross(normalize(dir), vec3(0,1,0));
       vel += normalize(dir) * 0.5 * speed; 
       vel += tangent * 1.0 * speed;        
       vel += curl(pos.x * 0.5, pos.y * 0.5, time * 5.0) * 2.0 * chaos;
    }
    else if (mode == 22) { // Super Vortex
       float twist = pos.y * 0.1;
       vec3 flow = curl(pos.x * 0.1 + twist, pos.y * 0.05, pos.z * 0.1 + twist);
       vel.y += 0.1 * speed;
       vec3 centerDir = -normalize(vec3(pos.x, 0.0, pos.z));
       vec3 spin = cross(centerDir, vec3(0,1,0));
       vel += spin * 2.0 * speed; vel += centerDir * 0.5; 
       vel += flow * chaos;
    }

    // SPECIAL PROXIMITIES
    else if (mode == 17) { 
        vec2 fUV = (pos.xy+40.0)/80.0; 
        if(fUV.x>0.0&&fUV.x<1.0&&fUV.y>0.0&&fUV.y<1.0) { 
            vec3 f = texture2D(fluidTexture, fUV).xyz; 
            vel += f * 5.0 * speed; 
            vel += curl(pos.x*0.2, pos.y*0.2, pos.z*0.2)*0.5*chaos; 
        } 
    }
    
    // K-SCRIPT
    vel += applyCustomScripts(pos, vel, time) * 0.05;

    // STANDARD MODES
    if (mode == 14) { float g = 2.0 + audioHigh * 5.0; vec3 q = floor(pos/g)*g; vel += (q-pos)*0.5*speed; if(chaos>0.5) vel += curl(pos.x,pos.y,time)*chaos*2.0; vel*=0.85; }
    if (mode == 13) { float s = pow(abs(sin(pos.x*0.5)*sin(pos.y*0.5)*sin(pos.z*0.5)), 4.0)*50.0; vel += (-normalize(pos))*0.5*speed + normalize(pos)*s*0.05*chaos + curl(pos.x*0.1,pos.y*0.1,time)*0.1; vel*=0.92; }
    if (mode == 12) { vec3 p = curl(pos.x*0.1, pos.y*0.1, pos.z*0.1); vec3 m = curl(pos.x*0.5, pos.y*0.5, pos.z*0.5); vel += p*0.2*speed + m*0.05*chaos; if(length(pos)>40.0) vel -= normalize(pos); vel*=0.96; }
    
    // Fallback Logic
    float dist = distance(pos.xy, mousePos.xy);
    if(mode != 11 && mode != 111 && mode != 5 && dist < 10.0 && mousePos.z != 0.0) vel += normalize(pos - mousePos) * 1.0;
    
    if(mode == 11) { vec3 t = texture2D(originTexture, uv).xyz; vec3 diff = t - pos; float jitter = audioHigh * 3.0; vel += diff * (0.08 + audioLevel * 0.05) * speed; vel += curl(t.x, t.y, time) * (0.15 + jitter) * chaos; vel *= 0.94; }
    
    vel *= uDamping;
    gl_FragColor = vec4(vel, 1.0);
  }
`;

export const POSITION_FRAGMENT = `
  uniform sampler2D positionTexture; uniform sampler2D velocityTexture; uniform sampler2D originTexture; 
  uniform float time; uniform float dt; uniform int mode; varying vec2 vUv;
  
  // Particle life controls from UI
  uniform float uParticleLifeEnabled;
  uniform float uLifeDecayRate;
  uniform float uRespawnBounds;
  
  float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
  float rand2(vec2 co){ return fract(sin(dot(co.xy ,vec2(78.233,12.9898))) * 43758.5453); }
  
  void main() {
    vec2 uv = vUv; 
    vec3 pos = texture2D(positionTexture, uv).xyz; 
    vec3 vel = texture2D(velocityTexture, uv).xyz; 
    vec3 origin = texture2D(originTexture, uv).xyz;
    pos += vel * dt;
    
    // === PARTICLE LIFE SYSTEM ===
    float life = texture2D(positionTexture, uv).w;
    bool respawn = false;
    
    if (uParticleLifeEnabled > 0.5) {
        // MORTAL: particles decay and respawn
        float particleDecayRate = uLifeDecayRate * (0.5 + rand(uv) * 1.0); // Varied decay
        life -= particleDecayRate;
        if (life <= 0.0) respawn = true;
    }
    // else: IMMORTAL - no life decay
    
    // Bounds check (always active)
    if (length(pos) > uRespawnBounds) respawn = true;
    
    // Special respawn bounds
    if (mode == 5) { life = 1.0; } 
    if (mode == 0) { respawn = false; life = 1.0; }
    
    // CHRONOS BOUNDS
    if (mode >= 100) {
        if(mode == 101 || mode == 108) { if(length(pos) < 1.0 || length(pos) > 100.0) respawn = true; }
        else if(mode == 110) { if(abs(pos.z) > 60.0) respawn = true; }
        else if(mode == 111) { if(pos.y > 40.0) respawn = true; }
        else if(mode == 113) { if(abs(pos.x) > 60.0) respawn = true; }
        else if(mode == 114) { if(abs(pos.y) > 60.0) respawn = true; }
        else if(length(pos) > 80.0) respawn = true;
    }
    
    // === FIX: Time-varied respawn using per-particle offset ===
    // Combine UV with time to break grid spawn patterns
    float tSeed = fract(time * 0.1 + rand(uv) * 100.0); // Different phase per particle
    
    if(respawn) {
        // Randomize starting life (0.5-1.0) so particles don't all have same lifespan
        life = 0.5 + rand2(uv) * 0.5;
        
        if(mode==11 || mode==0) pos = origin;
        else if(mode==5) pos = (vec3(rand(uv + tSeed), rand2(uv + tSeed), 0.0)-0.5)*60.0;
        else if(mode==3) { 
             float angle = rand(uv + tSeed) * 6.28;
             float r = 2.0 + rand2(uv + tSeed) * 40.0;
             pos = vec3(cos(angle)*r, (rand(uv + tSeed * 2.0)-0.5)*2.0, sin(angle)*r);
        }
        else if(mode==17) pos = (vec3(rand(uv + tSeed), rand2(uv + tSeed), 0.0)-0.5)*80.0;
        
        // CHRONOS SPAWNS
        else if(mode == 101 || mode == 108) { // Black Hole / Quasar Disk
             float angle = rand(uv + tSeed) * 6.28; float r = 20.0 + rand2(uv + tSeed) * 40.0;
             pos = vec3(cos(angle)*r, (rand(uv + tSeed * 2.0)-0.5), sin(angle)*r);
        }
        else if(mode == 110 || mode == 113 || mode == 114) { // Box volumes
             pos = (vec3(rand(uv + tSeed), rand2(uv + tSeed), rand(uv + tSeed * 2.0))-0.5)*60.0;
        }
        else pos = (vec3(rand(uv + tSeed), rand2(uv + tSeed), rand(uv + tSeed * 2.0))-0.5)*60.0;
    }
    gl_FragColor = vec4(pos, life);
  }
`;


export const RENDER_VERT = `
  uniform sampler2D positionTexture; uniform sampler2D velocityTexture; uniform float pixelRatio; uniform float sizeMult; uniform float audioLevel;
  attribute vec2 reference; varying float vLife; varying float vSpeed; varying vec3 vVel; varying vec2 vUv; varying vec3 vPos;
  void main() {
    vUv = reference;
    vec4 posData = texture2D(positionTexture, reference); vec3 pos = posData.xyz; vLife = posData.w; vPos = pos;
    vec3 vel = texture2D(velocityTexture, reference).xyz; vSpeed = length(vel); vVel = vel;
    vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0); gl_Position = projectionMatrix * mv;
    float boost = 1.0 + audioLevel * 3.0;
    gl_PointSize = clamp((14.0 * pixelRatio * sizeMult * boost * vLife) * (50.0 / -mv.z), 1.0, 50.0);
  }
`;

export const RENDER_FRAG = `
  varying float vLife; varying float vSpeed; varying vec3 vVel; varying vec2 vUv; varying vec3 vPos;
  uniform vec3 color; uniform vec3 color2; uniform int colorMode; uniform bool forceDoppler; uniform sampler2D imageTexture; uniform bool useImageColor; uniform sampler2D paletteTexture; uniform float opacityFactor; uniform float gradientStrength;
  void main() {
    // Soft/Glow Particle Logic
    vec2 c = 2.0 * gl_PointCoord - 1.0; 
    float dist = dot(c, c);
    if(dist > 1.0) discard;
    
    // Gaussian falloff for glow effect
    float alpha = exp(-dist * 3.0); 

    vec3 fC = color;
    
    if(colorMode == 1) { // VELOCITY
        float t = clamp(vSpeed * 0.05, 0.0, 1.0);
        fC = texture2D(paletteTexture, vec2(t, 0.5)).rgb;
    } 
    
    if(colorMode == 3) { // ANGLE / GRADIENT MIX
        vec3 nPos = normalize(vPos) * 0.5 + 0.5;
        fC = mix(color, color2, nPos.y * gradientStrength);
    }

    if(colorMode == 2) { // IMAGE / POSITION
        if(useImageColor) {
            fC = texture2D(imageTexture, vUv).rgb;
        } else {
             // Radial Mix
             float pDist = length(vPos) / 50.0;
             fC = mix(color, color2, clamp(pDist * gradientStrength, 0.0, 1.0));
        }
    } 
    
    if(forceDoppler && (colorMode != 2 || !useImageColor)) { float shift = dot(normalize(vVel), vec3(0,0,1)); fC += vec3(0.5, 0.2, 0.2) * shift; }
    
    // Combine for final glowy particle
    gl_FragColor = vec4(fC, vLife * opacityFactor * alpha);
  }
`;

export const FEEDBACK_FRAGMENT = `
  uniform sampler2D tDiffuse; uniform sampler2D tPrev; uniform float decay; uniform float aberration; uniform float distortion;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    vec2 center = uv - 0.5;
    uv = center * (1.0 - distortion * dot(center, center)) + 0.5;
    
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }

    vec4 newFrame = texture2D(tDiffuse, uv);
    
    vec2 offset = (newFrame.rg - 0.5) * 0.01 * aberration;
    float r = texture2D(tPrev, uv - offset).r;
    float g = texture2D(tPrev, uv).g;
    float b = texture2D(tPrev, uv + offset).b;
    
    vec3 trail = vec3(r, g, b) * min(decay, 0.95);
    gl_FragColor = vec4(max(newFrame.rgb, trail), 1.0);
  }
`;

// --- UTILS ---
import * as THREE from 'three';

export const generatePaletteTexture = (colors: string[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const grd = ctx.createLinearGradient(0, 0, 256, 0);
    colors.forEach((c, i) => grd.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
};
