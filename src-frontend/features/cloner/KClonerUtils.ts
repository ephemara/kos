import * as THREE from 'three';
import {
    Activity, Anchor, ArrowDownCircle, ArrowUpFromLine, Aperture, Bomb, Box, BarChart2,
    Camera, Circle, Cpu, Database, Diamond, Disc, Dna, Droplets, FileBox, FileCode,
    FileJson, Flame, Ghost, Grid as GridIcon, Heart, Image as ImageIcon, Infinity as InfinityIcon,
    Layers, Lightbulb, Link, Magnet, Maximize, Milestone, Minimize2, MonitorPlay, Move,
    Move3d, MoveHorizontal, Orbit, Package, Play, Radar, RefreshCcw, RefreshCw, Repeat,
    Rotate3D, RotateCw, Scissors, Share2, Shuffle, Snowflake, Spline, Split,
    Terminal, Timer, Tornado as TornadoIcon, Tornado, Trash2, Video, Wind, Zap, Waves,
    AlertTriangle
} from 'lucide-react';

// --- MATH & NOISE UTILS ---
export const fract = (x: number) => x - Math.floor(x);
export const hash = (n: number) => fract(Math.sin(n) * 43758.5453123);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const noise = (x: number) => {
    const i = Math.floor(x);
    const f = fract(x);
    const u = f * f * (3.0 - 2.0 * f);
    return lerp(hash(i), hash(i + 1.0), u);
};

// --- MOTION MODIFIERS ---
export const MODIFIERS: Record<string, any> = {
    // --- CLASSICS ---
    ORBIT: { id: 'orbit', name: 'Orbit', icon: RotateCw, params: { speed: 0.5, axis: 'y', step: 0.1 } },
    FLOAT: { id: 'float', name: 'Float', icon: Ghost, params: { speed: 1.0, height: 0.5, phase: 0, step: 0.2 } },
    PULSE: { id: 'pulse', name: 'Pulse', icon: Activity, params: { speed: 3.0, scale: 0.1, base: 1.0, step: 0.1 } },
    SHAKE: { id: 'shake', name: 'Shake', icon: Zap, params: { intensity: 0.1, frequency: 10, decay: 0 } },
    ELASTIC: { id: 'elastic', name: 'Elastic', icon: Maximize, params: { speed: 4, amount: 0.15, axis: 'y', step: 0.1 } },

    // --- INTERMEDIATE ---
    PENDULUM: { id: 'pendulum', name: 'Pendulum', icon: Anchor, params: { speed: 2.0, angle: 45, axis: 'z', step: 0.1 } },
    WOBBLE: { id: 'wobble', name: 'Wobble', icon: Wind, params: { speed: 1.5, intensity: 0.3, step: 0.2 } },
    FIGURE8: { id: 'figure8', name: 'Figure 8', icon: InfinityIcon, params: { speed: 1.0, width: 1.0, height: 0.5, step: 0.1 } },
    HEARTBEAT: { id: 'heartbeat', name: 'Heartbeat', icon: Heart, params: { bpm: 60, intensity: 0.2, step: 0.0 } },
    GLITCH: { id: 'glitch', name: 'Glitch', icon: AlertTriangle, params: { interval: 0.5, scatter: 0.2 } },
    STEP: { id: 'step', name: 'Stop Motion', icon: Video, params: { fps: 12 } },

    // --- PHYSICS & FX ---
    BOUNCE: { id: 'bounce', name: 'Bounce', icon: ArrowUpFromLine, params: { speed: 2.0, height: 1.0, squash: 0.2, step: 0.1 } },
    TUMBLE: { id: 'tumble', name: 'Tumble', icon: RefreshCcw, params: { speedX: 0.5, speedY: 0.3, speedZ: 0.7, step: 0.05 } },
    STROBE: { id: 'strobe', name: 'Strobe', icon: Lightbulb, params: { speed: 15.0, duty: 0.5, step: 0.1 } },
    CORKSCREW: { id: 'corkscrew', name: 'Corkscrew', icon: Dna, params: { speed: 1.0, height: 1.0, rotations: 2.0, step: 0.1 } },
    SHIVER: { id: 'shiver', name: 'Shiver', icon: Snowflake, params: { intensity: 0.05, frequency: 50.0 } },
    SWAY: { id: 'sway', name: 'Sway', icon: Waves, params: { speed: 0.8, angle: 15.0, step: 0.2 } },
    YOYO: { id: 'yoyo', name: 'Yo-Yo', icon: ArrowDownCircle, params: { speed: 2.0, length: 1.5, step: 0.1 } },
    CRAB: { id: 'crab', name: 'Crab', icon: MoveHorizontal, params: { speed: 2.0, width: 1.0, step: 0.1 } },

    // --- COMPLEX ---
    LISSAJOUS: { id: 'lissajous', name: 'Lissajous', icon: Spline, params: { speed: 1.0, size: 1.0, a: 3, b: 2, step: 0.05 } },
    FLIP: { id: 'flip', name: 'Flip', icon: Rotate3D, params: { interval: 2.0, speed: 5.0, axis: 'x', step: 0.1 } },
    TREMOR: { id: 'tremor', name: 'Tremor', icon: Tornado, params: { intensity: 0.1, speed: 20.0 } },
    SCAN: { id: 'scan', name: 'Scan', icon: Radar, params: { distance: 2.0, speed: 1.0, axis: 'x', step: 0.1 } },
    WARP: { id: 'warp', name: 'Warp', icon: Flame, params: { speed: 2.0, stretch: 0.5, step: 0.1 } },
    DRIFT: { id: 'drift', name: 'Drift', icon: Milestone, params: { speed: 0.2, radius: 0.5 } },
    BOBBLE: { id: 'bobble', name: 'Bobble', icon: Activity, params: { speed: 4.0, amount: 0.3, step: 0.1 } },
    TWIST: { id: 'twist', name: 'Twist', icon: RefreshCw, params: { speed: 2.0, angle: 30, axis: 'y', step: 0.05 } },

    // --- ADVANCED (NEW) ---
    SPIRAL: { id: 'spiral', name: 'Spiral', icon: TornadoIcon, params: { speed: 1.0, radius: 2.0, grow: 1.0, rotations: 3.0 } },
    VORTEX: { id: 'vortex', name: 'Vortex', icon: Disc, params: { speed: 2.0, strength: 2.0, radius: 5.0, falloff: 1.0 } },
    MAGNET: { id: 'magnet', name: 'Magnet', icon: Magnet, params: { speed: 1.0, strength: 2.0, range: 4.0 } },
    NOISE_FLOW: { id: 'noise_flow', name: 'Noise Flow', icon: Waves, params: { speed: 0.5, scale: 0.2, force: 1.0 } },
    RIPPLE: { id: 'ripple', name: 'Ripple', icon: Droplets, params: { speed: 2.0, frequency: 2.0, amplitude: 0.5, decay: 0.2 } },
    SQUASH: { id: 'squash', name: 'Squash', icon: Minimize2, params: { speed: 3.0, amount: 0.5, axis: 'y' } },
    ACCORDION: { id: 'accordion', name: 'Accordion', icon: Move3d, params: { speed: 1.5, amount: 0.5, axis: 'y' } },
    CHAOS: { id: 'chaos', name: 'Chaos', icon: Shuffle, params: { speed: 1.0, scale: 2.0 } },
    BREATHE: { id: 'breathe', name: 'Breathe', icon: Aperture, params: { speed: 0.5, amount: 0.2 } },
    EXPLODE: { id: 'explode', name: 'Explode', icon: Bomb, params: { strength: 5.0, decay: 0.1, trigger: 0.5 } },

    // --- K-SCRIPT ---
    CODE: {
        id: 'code', name: 'K-SCRIPT', icon: Terminal,
        params: {
            code: "p.y += Math.sin(t * v.freq + i * 0.1) * v.amp;", error: null,
            sliders: [{ id: 'amp', label: 'Amplitude', val: 1.0, min: 0, max: 5 }, { id: 'freq', label: 'Frequency', val: 2.0, min: 0, max: 10 }]
        }
    }
};

export const createModifierInstance = (key: string) => ({
    instanceId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: MODIFIERS[key].id,
    name: MODIFIERS[key].name,
    icon: MODIFIERS[key].icon,
    params: { ...MODIFIERS[key].params, sliders: MODIFIERS[key].params.sliders ? JSON.parse(JSON.stringify(MODIFIERS[key].params.sliders)) : undefined }
});

export const createChainInstance = (index: number) => ({
    id: `chain_${Date.now()}`,
    name: `CHAIN ${index + 1}`,
    duration: 4.0,
    modifiers: [] as any[]
});
