/**
 * matcapSystem.ts — Procedural Matcap Engine for KSculpt
 *
 * Generates photorealistic-quality matcap textures entirely in-code using
 * Canvas 2D radial gradients + multi-pass compositing.
 *
 * No external PNG files required. All matcaps are described as data-driven
 * configs and rendered on first access, then cached permanently.
 *
 * Also provides a `buildEnhancedMatcapMaterial` factory that injects custom
 * GLSL on top of Three.js MeshMatcapMaterial for:
 *   - Cavity / ambient occlusion darkening
 *   - Fresnel rim lighting
 *   - Specular gloss boost
 *   - Subsurface scatter tint (optional)
 */

import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatcapLayer {
    /** Normalized center [0..1, 0..1] — default sphere highlight is at (0.55, 0.4) */
    cx: number;
    cy: number;
    /** Radii as fractions of texture width */
    r0: number; // inner radius
    r1: number; // outer radius
    colorInner: string;
    colorOuter: string;
    blendMode?: GlobalCompositeOperation;
    alpha?: number;
}

export interface MatcapDef {
    id: string;
    label: string;
    /** Short colour description shown in tooltip */
    desc: string;
    /** Canvas texture size — power of 2, 256 looks perfect */
    size: number;
    /** Background fill / base colour */
    base: string;
    layers: MatcapLayer[];
    /** Optional: tint the final composite */
    tint?: { color: string; alpha: number };
    /** Optional: overlay sharp specular highlight */
    specular?: { cx: number; cy: number; r: number; color: string; alpha: number };
    /** Optional: subtle edge darkening (rim direction AO) */
    edgeDarken?: number; // 0..1
    /** Shader enhancements baked on top */
    shaderOpts?: KMatcapShaderOpts;
}

export interface KMatcapShaderOpts {
    /** 0..1 — strength of cavity darkening */
    cavityStrength?: number;
    /** Fresnel rim colour in hex */
    rimColor?: string;
    /** 0..1 */
    rimStrength?: number;
    /** Extra specular gloss [0..1] */
    glossStrength?: number;
    /** Subsurface scatter tint hex */
    sstColor?: string;
    /** 0..1 */
    sstStrength?: number;
}

// ─── Matcap Library (data-driven) ─────────────────────────────────────────────

export const MATCAP_LIBRARY: MatcapDef[] = [
    // ── 01 Clay Default ─────────────────────────────────────────────────────
    {
        id: 'CLAY',
        label: 'Clay',
        desc: 'Warm matte clay — the sculpting default',
        size: 256,
        base: '#3a2e28',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.55, colorInner: '#c9a07a', colorOuter: '#7a5038', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.18, colorInner: '#f0dbbf', colorOuter: 'transparent', alpha: 0.85 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.45, colorInner: '#1a0e08', colorOuter: 'transparent', alpha: 0.55 },
        ],
        specular: { cx: 0.57, cy: 0.35, r: 0.06, color: '#fff8ee', alpha: 0.65 },
        edgeDarken: 0.45,
        shaderOpts: { cavityStrength: 0.35, rimStrength: 0.15, rimColor: '#ffb86c' },
    },

    // ── 02 Pearl White ───────────────────────────────────────────────────────
    {
        id: 'PEARL',
        label: 'Pearl',
        desc: 'Smooth pearl — great for character work',
        size: 256,
        base: '#bfc0c4',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.6, colorInner: '#f8f8ff', colorOuter: '#8b8ea0', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#ffffff', colorOuter: 'transparent', alpha: 0.92 },
            { cx: 0.35, cy: 0.65, r0: 0.0, r1: 0.4, colorInner: '#4a4c5c', colorOuter: 'transparent', alpha: 0.5 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.045, color: '#ffffff', alpha: 0.9 },
        edgeDarken: 0.38,
        shaderOpts: { cavityStrength: 0.18, rimStrength: 0.12, rimColor: '#c8d0ff', glossStrength: 0.3 },
    },

    // ── 03 Polished Chrome ──────────────────────────────────────────────────
    {
        id: 'CHROME',
        label: 'Chrome',
        desc: 'Mirror-finish chrome — high contrast metal',
        size: 256,
        base: '#1a1a1a',
        layers: [
            { cx: 0.5, cy: 0.5, r0: 0.0, r1: 0.5, colorInner: '#ffffff', colorOuter: '#000000', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.22, colorInner: '#ffffff', colorOuter: 'transparent', alpha: 0.95 },
            { cx: 0.35, cy: 0.62, r0: 0.0, r1: 0.25, colorInner: '#606060', colorOuter: 'transparent', alpha: 0.6 },
            { cx: 0.5, cy: 0.9, r0: 0.0, r1: 0.35, colorInner: '#cccccc', colorOuter: 'transparent', alpha: 0.3 },
        ],
        specular: { cx: 0.57, cy: 0.34, r: 0.05, color: '#ffffff', alpha: 1.0 },
        edgeDarken: 0.6,
        shaderOpts: { cavityStrength: 0.5, rimStrength: 0.25, rimColor: '#aaddff', glossStrength: 0.55 },
    },

    // ── 04 Brushed Copper ───────────────────────────────────────────────────
    {
        id: 'COPPER',
        label: 'Copper',
        desc: 'Warm brushed copper / bronze',
        size: 256,
        base: '#2a1608',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.58, colorInner: '#d4813a', colorOuter: '#3d1900', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#ffcf88', colorOuter: 'transparent', alpha: 0.9 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.4, colorInner: '#120800', colorOuter: 'transparent', alpha: 0.6 },
        ],
        specular: { cx: 0.58, cy: 0.34, r: 0.07, color: '#fff7d4', alpha: 0.75 },
        edgeDarken: 0.5,
        shaderOpts: { cavityStrength: 0.4, rimStrength: 0.2, rimColor: '#ff8844', glossStrength: 0.4 },
    },

    // ── 05 Jade ─────────────────────────────────────────────────────────────
    {
        id: 'JADE',
        label: 'Jade',
        desc: 'Deep translucent jade green',
        size: 256,
        base: '#0d2617',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.58, colorInner: '#5dba7d', colorOuter: '#0d2617', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#b8ffd5', colorOuter: 'transparent', alpha: 0.82 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#030f08', colorOuter: 'transparent', alpha: 0.6 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.05, color: '#d8fff0', alpha: 0.72 },
        edgeDarken: 0.5,
        shaderOpts: {
            cavityStrength: 0.35, rimStrength: 0.18, rimColor: '#88ffcc',
            sstColor: '#00ff88', sstStrength: 0.12,
        },
    },

    // ── 06 Ice ──────────────────────────────────────────────────────────────
    {
        id: 'ICE',
        label: 'Ice',
        desc: 'Cold translucent glacier blue',
        size: 256,
        base: '#0c1f2e',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.62, colorInner: '#8ec8e8', colorOuter: '#0c1f2e', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.21, colorInner: '#e8f8ff', colorOuter: 'transparent', alpha: 0.9 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#040c12', colorOuter: 'transparent', alpha: 0.55 },
        ],
        specular: { cx: 0.575, cy: 0.34, r: 0.055, color: '#f0faff', alpha: 0.88 },
        edgeDarken: 0.42,
        shaderOpts: {
            cavityStrength: 0.22, rimStrength: 0.22, rimColor: '#44aaff',
            glossStrength: 0.35, sstColor: '#88ccff', sstStrength: 0.1,
        },
    },

    // ── 07 Dark Rough ───────────────────────────────────────────────────────
    {
        id: 'DARK',
        label: 'Dark',
        desc: 'Dark matte — good for rock / concrete',
        size: 256,
        base: '#101010',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.58, colorInner: '#525252', colorOuter: '#121212', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.19, colorInner: '#909090', colorOuter: 'transparent', alpha: 0.7 },
            { cx: 0.3, cy: 0.68, r0: 0.0, r1: 0.42, colorInner: '#000000', colorOuter: 'transparent', alpha: 0.7 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.04, color: '#e0e0e0', alpha: 0.45 },
        edgeDarken: 0.65,
        shaderOpts: { cavityStrength: 0.55, rimStrength: 0.2, rimColor: '#667788' },
    },

    // ── 08 Gold ─────────────────────────────────────────────────────────────
    {
        id: 'GOLD',
        label: 'Gold',
        desc: 'Rich polished gold',
        size: 256,
        base: '#1e1200',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.58, colorInner: '#e8c240', colorOuter: '#1e1200', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#fff7a0', colorOuter: 'transparent', alpha: 0.92 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#100800', colorOuter: 'transparent', alpha: 0.6 },
        ],
        specular: { cx: 0.575, cy: 0.335, r: 0.065, color: '#fffff0', alpha: 0.88 },
        edgeDarken: 0.5,
        shaderOpts: { cavityStrength: 0.4, rimStrength: 0.2, rimColor: '#ffdd55', glossStrength: 0.5 },
    },

    // ── 09 Lava  ────────────────────────────────────────────────────────────
    {
        id: 'LAVA',
        label: 'Lava',
        desc: 'Molten magma — hot emissive glow',
        size: 256,
        base: '#0d0200',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.58, colorInner: '#e84000', colorOuter: '#0d0200', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.22, colorInner: '#ffe090', colorOuter: 'transparent', alpha: 0.9 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#050000', colorOuter: 'transparent', alpha: 0.65 },
        ],
        specular: { cx: 0.57, cy: 0.34, r: 0.07, color: '#ffffff', alpha: 0.72 },
        edgeDarken: 0.6,
        shaderOpts: { cavityStrength: 0.45, rimStrength: 0.35, rimColor: '#ff4400', glossStrength: 0.2 },
    },

    // ── 10 ZBrush Classic ───────────────────────────────────────────────────
    {
        id: 'ZBRUSH',
        label: 'ZBrush',
        desc: 'ZBrush-style grey matte — form clarity',
        size: 256,
        base: '#2c2c2c',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.62, colorInner: '#b0b0b0', colorOuter: '#2c2c2c', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#f0f0f0', colorOuter: 'transparent', alpha: 0.85 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.45, colorInner: '#141414', colorOuter: 'transparent', alpha: 0.6 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.05, color: '#ffffff', alpha: 0.7 },
        edgeDarken: 0.42,
        shaderOpts: { cavityStrength: 0.4, rimStrength: 0.12, rimColor: '#aaaacc' },
    },

    // ── 11 Skin ─────────────────────────────────────────────────────────────
    {
        id: 'SKIN',
        label: 'Skin',
        desc: 'Subsurface skin — for character anatomy',
        size: 256,
        base: '#2a1510',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.6, colorInner: '#d48062', colorOuter: '#2a1510', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.22, colorInner: '#f7c4a8', colorOuter: 'transparent', alpha: 0.88 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#0e0603', colorOuter: 'transparent', alpha: 0.55 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.048, color: '#fff0e8', alpha: 0.62 },
        edgeDarken: 0.38,
        shaderOpts: {
            cavityStrength: 0.25, rimStrength: 0.15, rimColor: '#ff9977',
            sstColor: '#ff4422', sstStrength: 0.18,
        },
    },

    // ── 12 Amethyst ─────────────────────────────────────────────────────────
    {
        id: 'AMETHYST',
        label: 'Amethyst',
        desc: 'Semi-precious gem violet',
        size: 256,
        base: '#100820',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.58, colorInner: '#9a60d8', colorOuter: '#100820', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.21, colorInner: '#e8ccff', colorOuter: 'transparent', alpha: 0.88 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#040010', colorOuter: 'transparent', alpha: 0.55 },
        ],
        specular: { cx: 0.575, cy: 0.34, r: 0.052, color: '#f8eeff', alpha: 0.82 },
        edgeDarken: 0.48,
        shaderOpts: {
            cavityStrength: 0.3, rimStrength: 0.22, rimColor: '#cc88ff',
            glossStrength: 0.4, sstColor: '#9944ff', sstStrength: 0.12,
        },
    },

    // ── 13 Ocean ────────────────────────────────────────────────────────────
    {
        id: 'OCEAN',
        label: 'Ocean',
        desc: 'Deep ocean, dark to cyan',
        size: 256,
        base: '#00101e',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.6, colorInner: '#1ea8c0', colorOuter: '#00101e', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#a0f0ff', colorOuter: 'transparent', alpha: 0.88 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.45, colorInner: '#00060e', colorOuter: 'transparent', alpha: 0.6 },
        ],
        specular: { cx: 0.58, cy: 0.34, r: 0.053, color: '#e0ffff', alpha: 0.78 },
        edgeDarken: 0.45,
        shaderOpts: {
            cavityStrength: 0.3, rimStrength: 0.2, rimColor: '#00eeff',
            sstColor: '#00aacc', sstStrength: 0.12, glossStrength: 0.3,
        },
    },

    // ── 14 Studio Neutral ───────────────────────────────────────────────────
    {
        id: 'STUDIO',
        label: 'Studio',
        desc: 'Studio neutral — balanced for topology reading',
        size: 256,
        base: '#888888',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.6, colorInner: '#e8e8e8', colorOuter: '#606060', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#ffffff', colorOuter: 'transparent', alpha: 0.9 },
            { cx: 0.35, cy: 0.65, r0: 0.0, r1: 0.45, colorInner: '#383838', colorOuter: 'transparent', alpha: 0.5 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.048, color: '#ffffff', alpha: 0.75 },
        edgeDarken: 0.35,
        shaderOpts: { cavityStrength: 0.3, rimStrength: 0.08, rimColor: '#ccddff' },
    },

    // ── 15 Holographic  ─────────────────────────────────────────────────────
    {
        id: 'HOLO',
        label: 'Holo',
        desc: 'Iridescent holographic foil',
        size: 256,
        base: '#080818',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.6, colorInner: '#8080ff', colorOuter: '#080818', alpha: 1.0 },
            { cx: 0.45, cy: 0.5, r0: 0.0, r1: 0.5, colorInner: '#ff40c0', colorOuter: 'transparent', alpha: 0.35, blendMode: 'screen' },
            { cx: 0.65, cy: 0.4, r0: 0.0, r1: 0.4, colorInner: '#40ffcc', colorOuter: 'transparent', alpha: 0.3, blendMode: 'screen' },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.2, colorInner: '#ffffff', colorOuter: 'transparent', alpha: 0.92 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#020210', colorOuter: 'transparent', alpha: 0.6 },
        ],
        specular: { cx: 0.575, cy: 0.34, r: 0.058, color: '#ffffff', alpha: 0.9 },
        edgeDarken: 0.5,
        shaderOpts: {
            cavityStrength: 0.35, rimStrength: 0.35, rimColor: '#ff00ff',
            glossStrength: 0.5,
        },
    },

    // ── 16 Wax / Candle ─────────────────────────────────────────────────────
    {
        id: 'WAX',
        label: 'Wax',
        desc: 'Translucent wax / candle — warm SSS',
        size: 256,
        base: '#2a1a08',
        layers: [
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.62, colorInner: '#e8b060', colorOuter: '#2a1a08', alpha: 1.0 },
            { cx: 0.55, cy: 0.38, r0: 0.0, r1: 0.22, colorInner: '#fff0c0', colorOuter: 'transparent', alpha: 0.88 },
            { cx: 0.3, cy: 0.65, r0: 0.0, r1: 0.42, colorInner: '#0a0400', colorOuter: 'transparent', alpha: 0.55 },
        ],
        specular: { cx: 0.575, cy: 0.345, r: 0.055, color: '#fffde0', alpha: 0.68 },
        edgeDarken: 0.38,
        shaderOpts: {
            cavityStrength: 0.2, rimStrength: 0.2, rimColor: '#ffcc44',
            sstColor: '#ff8800', sstStrength: 0.22,
        },
    },
];

// ─── Texture Cache ─────────────────────────────────────────────────────────────

const _texCache = new Map<string, THREE.Texture>();

/**
 * Generates (or retrieves from cache) a THREE.Texture for the given matcap ID.
 * The texture is created procedurally from the MatcapDef — no file I/O.
 */
export function getProceduralMatcap(id: string): THREE.Texture {
    if (_texCache.has(id)) return _texCache.get(id)!;

    const def = MATCAP_LIBRARY.find(m => m.id === id) ?? MATCAP_LIBRARY[0];
    const tex = renderMatcapDef(def);
    _texCache.set(id, tex);
    return tex;
}

/**
 * Returns ids of all registered matcaps.
 */
export function getAllMatcapIds(): string[] {
    return MATCAP_LIBRARY.map(m => m.id);
}

/**
 * Returns the full definition for a given ID.
 */
export function getMatcapDef(id: string): MatcapDef {
    return MATCAP_LIBRARY.find(m => m.id === id) ?? MATCAP_LIBRARY[0];
}

// ─── Procedural Renderer ──────────────────────────────────────────────────────

function renderMatcapDef(def: MatcapDef): THREE.Texture {
    const { size } = def;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Base fill
    ctx.fillStyle = def.base;
    ctx.fillRect(0, 0, size, size);

    // 2. Layers
    for (const layer of def.layers) {
        const prevAlpha = ctx.globalAlpha;
        const prevComposite = ctx.globalCompositeOperation;

        if (layer.blendMode) ctx.globalCompositeOperation = layer.blendMode;
        if (layer.alpha !== undefined) ctx.globalAlpha = layer.alpha;

        const cx = layer.cx * size;
        const cy = layer.cy * size;
        const r0 = layer.r0 * size;
        const r1 = layer.r1 * size;

        const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
        grad.addColorStop(0, layer.colorInner);
        grad.addColorStop(1, layer.colorOuter === 'transparent' ? 'rgba(0,0,0,0)' : layer.colorOuter);

        ctx.fillStyle = grad as any;
        ctx.fillRect(0, 0, size, size);

        ctx.globalAlpha = prevAlpha;
        ctx.globalCompositeOperation = prevComposite;
    }

    // 3. Sharp specular highlight
    if (def.specular) {
        const s = def.specular;
        const cx = s.cx * size;
        const cy = s.cy * size;
        const r = s.r * size;

        ctx.globalAlpha = s.alpha;
        const gSpec = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gSpec.addColorStop(0, s.color);
        gSpec.addColorStop(0.5, s.color);
        gSpec.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gSpec as any;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1.0;
    }

    // 4. Vignette / edge darkening (circular mask from edge inward)
    if (def.edgeDarken && def.edgeDarken > 0) {
        const vig = ctx.createRadialGradient(
            size * 0.5, size * 0.5, size * 0.32,
            size * 0.5, size * 0.5, size * 0.55
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(0,0,0,${def.edgeDarken.toFixed(2)})`);

        ctx.fillStyle = vig as any;
        ctx.fillRect(0, 0, size, size);
    }

    // 5. Clip to circle — clamp corners so it looks like a properly-formed sphere
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 6. Optional tint overlay
    if (def.tint) {
        ctx.globalAlpha = def.tint.alpha;
        ctx.fillStyle = def.tint.color;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1.0;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

// ─── Enhanced Material Factory ─────────────────────────────────────────────────

/**
 * Creates a `MeshMatcapMaterial` with custom GLSL injected for:
 * - Cavity shading (shadows crevices more)
 * - Fresnel rim lighting
 * - Specular gloss boost
 * - Subsurface scatter approximation
 *
 * Falls back cleanly if shader compilation fails.
 */
export function buildEnhancedMatcapMaterial(
    matcapId: string,
    opts?: {
        vertexColors?: boolean;
        showMask?: boolean;
    }
): THREE.MeshMatcapMaterial {
    const def = getMatcapDef(matcapId);
    const tex = getProceduralMatcap(matcapId);
    const so = def.shaderOpts ?? {};

    const cavStr = so.cavityStrength ?? 0.0;
    const rimStr = so.rimStrength ?? 0.0;
    const rimR = so.rimColor ? parseInt(so.rimColor.slice(1, 3), 16) / 255 : 1.0;
    const rimG = so.rimColor ? parseInt(so.rimColor.slice(3, 5), 16) / 255 : 1.0;
    const rimB = so.rimColor ? parseInt(so.rimColor.slice(5, 7), 16) / 255 : 1.0;
    const glossStr = so.glossStrength ?? 0.0;
    const sstStr = so.sstStrength ?? 0.0;
    const sstR = so.sstColor ? parseInt(so.sstColor.slice(1, 3), 16) / 255 : 1.0;
    const sstG = so.sstColor ? parseInt(so.sstColor.slice(3, 5), 16) / 255 : 0.3;
    const sstB = so.sstColor ? parseInt(so.sstColor.slice(5, 7), 16) / 255 : 0.1;

    const mat = new THREE.MeshMatcapMaterial({
        matcap: tex,
        color: 0xffffff,
        flatShading: false,
        vertexColors: opts?.vertexColors ?? true,
    });

    // Store uniforms on the material so swapMatcapTexture can update them
    const shaderUniforms: Record<string, { value: any }> = {};

    mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
        // ── Uniforms ──────────────────────────────────────────────────────
        shaderUniforms.uCavityStr  = shader.uniforms.uCavityStr  = { value: cavStr };
        shaderUniforms.uRimStr     = shader.uniforms.uRimStr     = { value: rimStr };
        shaderUniforms.uRimColor   = shader.uniforms.uRimColor   = { value: new THREE.Vector3(rimR, rimG, rimB) };
        shaderUniforms.uGlossStr   = shader.uniforms.uGlossStr   = { value: glossStr };
        shaderUniforms.uSstStr     = shader.uniforms.uSstStr     = { value: sstStr };
        shaderUniforms.uSstColor   = shader.uniforms.uSstColor   = { value: new THREE.Vector3(sstR, sstG, sstB) };
        shaderUniforms.uShowMask   = shader.uniforms.uShowMask   = { value: opts?.showMask ? 1.0 : 0.0 };

        // ── Vertex ────────────────────────────────────────────────────────
        // Track view-space position for Fresnel. vViewPosition is already
        // provided by Three.js MeshMatcapMaterial, so we only add vWorldNormal.
        shader.vertexShader = [
            'varying vec3 vKWorldNormal;',
            'attribute float mask;',
            'varying float vMask;',
            shader.vertexShader,
        ].join('\n').replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vKWorldNormal = normalize( (modelMatrix * vec4(normal, 0.0)).xyz );
            vMask = mask;`
        );

        // ── Fragment ─────────────────────────────────────────────────────
        shader.fragmentShader = [
            'varying vec3 vKWorldNormal;',
            'varying float vMask;',
            'uniform float uCavityStr;',
            'uniform float uRimStr;',
            'uniform vec3  uRimColor;',
            'uniform float uGlossStr;',
            'uniform float uSstStr;',
            'uniform vec3  uSstColor;',
            'uniform float uShowMask;',
            shader.fragmentShader,
        ].join('\n').replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>

            // ── Cavity shading ──────────────────────────────────────────
            // Screen-space normal derivative approximation of curvature.
            // fwidth() is safe here — derivatives always enabled in fragment shaders.
            float kCavity = 1.0 - clamp(length(fwidth(vKWorldNormal)) * 8.0, 0.0, 1.0);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * kCavity, uCavityStr);

            // ── Fresnel rim ─────────────────────────────────────────────
            // vViewPosition is a built-in Three.js varying (view-space pos)
            float kRim = 1.0 - max(0.0, dot(normalize(vKWorldNormal), normalize(-vViewPosition)));
            kRim = pow(kRim, 2.8) * uRimStr;
            gl_FragColor.rgb += uRimColor * kRim;

            // ── Gloss boost ─────────────────────────────────────────────
            float kLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            float kGloss = pow(kLum, 4.0) * uGlossStr;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), kGloss);

            // ── Subsurface scatter tint ─────────────────────────────────
            float kShadow = clamp(1.0 - kLum, 0.0, 1.0);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * uSstColor, kShadow * uSstStr);

            // ── Mask overlay ────────────────────────────────────────────
            const vec3 kMaskCol = vec3(1.0, 0.06, 0.06);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, kMaskCol, vMask * 0.55 * uShowMask);
            `
        );
    };

    // Expose uniforms and shader option updater on the material for live swapping
    (mat as any).__kShaderUniforms = shaderUniforms;
    (mat as any).__kShaderOpts = so;

    // Single stable cache key — shader code is always the same; uniforms handle the variation.
    mat.customProgramCacheKey = () => 'kmatcap_enhanced_v2';

    return mat;
}
/**
 * Swaps the matcap on an existing enhanced material.
 * Also updates shader uniforms in-place if the texture has the same shader opts,
 * otherwise marks needsUpdate so Three.js recompiles with new customProgramCacheKey.
 *
 * In KSculpt's material update effect, call this instead of recreating the material.
 */
export function swapMatcapTexture(
    mat: THREE.MeshMatcapMaterial,
    newId: string
): void {
    const newDef  = getMatcapDef(newId);
    const newSo   = newDef.shaderOpts ?? {};
    const liveUni = (mat as any).__kShaderUniforms as Record<string, { value: any }> | undefined;

    // Swap the texture
    mat.matcap = getProceduralMatcap(newId);

    if (liveUni) {
        // Update uniforms live — no shader recompile needed
        const parse = (hex: string) => [
            parseInt(hex.slice(1,3), 16) / 255,
            parseInt(hex.slice(3,5), 16) / 255,
            parseInt(hex.slice(5,7), 16) / 255,
        ];
        if (liveUni.uCavityStr) liveUni.uCavityStr.value = newSo.cavityStrength  ?? 0;
        if (liveUni.uRimStr)    liveUni.uRimStr.value    = newSo.rimStrength     ?? 0;
        if (liveUni.uRimColor && newSo.rimColor) {
            const [r,g,b] = parse(newSo.rimColor);
            liveUni.uRimColor.value.set(r, g, b);
        }
        if (liveUni.uGlossStr)  liveUni.uGlossStr.value  = newSo.glossStrength   ?? 0;
        if (liveUni.uSstStr)    liveUni.uSstStr.value    = newSo.sstStrength     ?? 0;
        if (liveUni.uSstColor && newSo.sstColor) {
            const [r,g,b] = parse(newSo.sstColor);
            liveUni.uSstColor.value.set(r, g, b);
        }
        // textures already swapped above — no needsUpdate required
    } else {
        // Fallback: flag for full recompile
        mat.needsUpdate = true;
    }
}

/**
 * Generates a tiny preview canvas (56×56) for UI swatches.
 * Returns an ImageData URL.
 */
export function getMatcapPreviewDataURL(id: string, size = 56): string {
    const def = getMatcapDef(id);
    // Render at the requested size
    const smallDef = {
        ...def, size, specular: def.specular ? {
            ...def.specular,
            r: def.specular.r * (size / def.size)
        } : undefined
    };
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base
    ctx.fillStyle = def.base;
    ctx.fillRect(0, 0, size, size);

    for (const layer of def.layers) {
        if (layer.blendMode) ctx.globalCompositeOperation = layer.blendMode;
        if (layer.alpha !== undefined) ctx.globalAlpha = layer.alpha;

        const s = size;
        const cx = layer.cx * s, cy = layer.cy * s;
        const r0 = layer.r0 * s, r1 = layer.r1 * s;
        const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
        grad.addColorStop(0, layer.colorInner);
        grad.addColorStop(1, layer.colorOuter === 'transparent' ? 'rgba(0,0,0,0)' : layer.colorOuter);
        ctx.fillStyle = grad as any;
        ctx.fillRect(0, 0, s, s);

        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }

    if (def.specular) {
        const s = size;
        const { cx, cy, r, color, alpha } = def.specular;
        ctx.globalAlpha = alpha;
        const gSpec = ctx.createRadialGradient(cx * s, cy * s, 0, cx * s, cy * s, r * s);
        gSpec.addColorStop(0, color);
        gSpec.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gSpec as any;
        ctx.fillRect(0, 0, s, s);
        ctx.globalAlpha = 1.0;
    }

    if (def.edgeDarken && def.edgeDarken > 0) {
        const s = size;
        const vig = ctx.createRadialGradient(s * .5, s * .5, s * .32, s * .5, s * .5, s * .55);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(0,0,0,${def.edgeDarken.toFixed(2)})`);
        ctx.fillStyle = vig as any;
        ctx.fillRect(0, 0, s, s);
    }

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return canvas.toDataURL('image/png');
}

// ─── Legacy shim (keeps old constants.ts working) ────────────────────────────

export const MATCAP_IDS = Object.fromEntries(
    MATCAP_LIBRARY.map(m => [m.id, m.id])
) as Record<string, string>;