/**
 * KGraphosEngine - Enhanced engine with GPU simulations and symmetry
 */

import * as THREE from 'three';
import { SimpleCanvas, SimpleLayer, SimpleBrush, SelectionMode } from './core/SimpleCanvas';
import {
    QUAD_VERT, GEN_NOISE_FRAG, GEN_PATTERN_FRAG, GEN_VORONOI_FRAG, GEN_FBM_FRAG,
    FILTER_BLUR_FRAG, FILTER_NORMAL_FRAG, FILTER_LEVELS_FRAG, FILTER_PIXEL_SORT_FRAG, FILTER_EDGE_FRAG,
    SIM_DRIP_FRAG, SIM_BLEED_FRAG,
    SIM_WIND_FRAG, SIM_MAGNETIC_FRAG, SIM_DATAMOSH_FRAG,
    SIM_NEBULA_FRAG, SIM_THERMAL_FRAG, SIM_SORT_FRAG, SIM_LIFE_FRAG,
    GEN_GRADIENT_FRAG, GEN_SEAMLESS_FRAG, GEN_AO_FRAG, GEN_CURVATURE_FRAG,
    FILTER_SHARPEN_FRAG, FILTER_HSL_FRAG, FILTER_POSTERIZE_FRAG, FILTER_EMBOSS_FRAG, FILTER_THRESHOLD_FRAG
} from './GraphosShaders';

// Self-contained sim shaders (no external velocity buffer needed)
const SIM_LIQUIFY_STANDALONE = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uTime; varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float nx = hash(vUv + uTime * 0.001) - 0.5;
    float ny = hash(vUv.yx + uTime * 0.001 + 1.7) - 0.5;
    vec2 offset = vec2(nx, ny) * 0.003 * uSpeed;
    gl_FragColor = texture2D(tInput, clamp(vUv + offset, 0.001, 0.999));
  }
`;

const SIM_VORTEX_STANDALONE = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uTime; varying vec2 vUv;
  float snoise2(vec2 v) { return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0; }
  void main() {
    vec2 uv = vUv;
    float scale = 5.0;
    float n1 = snoise2(uv * scale + uTime * 0.05);
    float n2 = snoise2(uv.yx * scale + uTime * 0.05 + 3.7);
    vec2 vel = vec2(n1, n2) * 0.006 * uSpeed;
    gl_FragColor = texture2D(tInput, clamp(vUv - vel, 0.001, 0.999));
  }
`;

const SIM_RIVULET_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; varying vec2 vUv;
  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 self  = texture2D(tInput, vUv);
    vec4 above = texture2D(tInput, vUv + vec2(0.0,  texel.y));
    vec4 left  = texture2D(tInput, vUv + vec2(-texel.x, 0.0));
    vec4 right = texture2D(tInput, vUv + vec2( texel.x, 0.0));
    float gravity = above.a * uSpeed * 0.008;
    float jitter  = sin(vUv.x * 80.0 + above.r * 5.0) * 0.0005;
    vec2 flow = vec2(jitter, gravity);
    vec4 src = texture2D(tInput, vUv + flow);
    gl_FragColor = mix(self, src, 0.15);
    gl_FragColor.a = max(self.a, src.a * 0.98);
  }
`;

const SIM_GROWTH_FRAG = `
  uniform sampler2D tInput; uniform vec2 uResolution; uniform float uSpeed; uniform float uTime; varying vec2 vUv;
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 self = texture2D(tInput, vUv);
    // Cellular automaton growth: spread towards brightest neighbour
    vec4 best = self;
    for (float y = -1.0; y <= 1.0; y++) {
      for (float x = -1.0; x <= 1.0; x++) {
        vec4 n = texture2D(tInput, vUv + vec2(x, y) * texel);
        if (dot(n.rgb, vec3(0.299, 0.587, 0.114)) > dot(best.rgb, vec3(0.299, 0.587, 0.114))) best = n;
      }
    }
    gl_FragColor = mix(self, best, 0.02 * uSpeed);
  }
`;

export interface GraphosConfig {
    width: number;
    height: number;
}

export const initGraphosEngine = (canvas: HTMLCanvasElement, viewport: HTMLElement, config: GraphosConfig = { width: 2048, height: 2048 }) => {
    const simpleCanvas = new SimpleCanvas(canvas, viewport, config.width, config.height);

    // Track loaded textures (for PBR support)
    let loadedTextures: any = null;

    // Time for animated simulations
    let time = 0;

    // Create shader materials for simulations
    const createSimMaterial = (fragmentShader: string, uniforms: Record<string, any> = {}) => {
        return new THREE.ShaderMaterial({
            vertexShader: QUAD_VERT,
            fragmentShader,
            uniforms: {
                tInput: { value: null },
                uResolution: { value: new THREE.Vector2(config.width, config.height) },
                uTime: { value: 0 },
                uSpeed: { value: 1.0 },
                ...uniforms
            }
        });
    };

    const applyCustomShader = (layerId: string, fragmentShader: string, uniforms: Record<string, any> = {}) => {
        const uniformDefs: Record<string, any> = {};
        for (const [k, v] of Object.entries(uniforms)) {
            uniformDefs[k] = { value: v };
        }
        const material = createSimMaterial(fragmentShader, uniformDefs);
        simpleCanvas.applySimulation(layerId, material);
        material.dispose();
    };

    // Simulation materials
    const simMaterials = {
        drip: createSimMaterial(SIM_DRIP_FRAG, { uThreshold: { value: 0.1 } }),
        bleed: createSimMaterial(SIM_BLEED_FRAG),
        wind: createSimMaterial(SIM_WIND_FRAG, { uWindDir: { value: new THREE.Vector2(1, 0) } }),
        nebula: createSimMaterial(SIM_NEBULA_FRAG, { uChaos: { value: 1.0 }, uScale: { value: 1.0 } }),
        thermal: createSimMaterial(SIM_THERMAL_FRAG, { uDecay: { value: 0.99 } }),
        life: createSimMaterial(SIM_LIFE_FRAG, { uChaos: { value: 1.0 } }),
        sort: createSimMaterial(SIM_SORT_FRAG, { uChaos: { value: 0.0 } }),
        magnetic: createSimMaterial(SIM_MAGNETIC_FRAG),
        datamosh: createSimMaterial(SIM_DATAMOSH_FRAG),
        pixelSort: createSimMaterial(FILTER_PIXEL_SORT_FRAG, { uThreshold: { value: 0.2 } }),
        // Previously-missing sims — now self-contained
        liquify: createSimMaterial(SIM_LIQUIFY_STANDALONE),
        vortex: createSimMaterial(SIM_VORTEX_STANDALONE),
        rivulet: createSimMaterial(SIM_RIVULET_FRAG),
        growth: createSimMaterial(SIM_GROWTH_FRAG),
    };

    // Generator materials
    const genMaterials = {
        noise: createSimMaterial(GEN_NOISE_FRAG, {
            uScale: { value: 1.0 },
            uDetail: { value: 4.0 },
            uSeed: { value: 0.0 },
            uColorA: { value: new THREE.Color(0, 0, 0) },
            uColorB: { value: new THREE.Color(1, 1, 1) }
        }),
        pattern: createSimMaterial(GEN_PATTERN_FRAG, {
            uScale: { value: 10.0 },
            uMode: { value: 0 },
            uColorA: { value: new THREE.Color(0, 0, 0) },
            uColorB: { value: new THREE.Color(1, 1, 1) }
        }),
        voronoi: createSimMaterial(GEN_VORONOI_FRAG, {
            uScale: { value: 5.0 },
            uSeed: { value: 0.0 },
            uColorA: { value: new THREE.Color(0, 0, 0) },
            uColorB: { value: new THREE.Color(1, 1, 1) }
        }),
        fbm: createSimMaterial(GEN_FBM_FRAG, {
            uScale: { value: 2.0 },
            uSeed: { value: 0.0 },
            uColorA: { value: new THREE.Color(0, 0, 0) },
            uColorB: { value: new THREE.Color(1, 1, 1) }
        }),
        gradient: createSimMaterial(GEN_GRADIENT_FRAG, {
            uMode: { value: 0 },
            uAngle: { value: 0.0 },
            uColorA: { value: new THREE.Color(0, 0, 0) },
            uColorB: { value: new THREE.Color(1, 1, 1) },
            uCenter: { value: new THREE.Vector2(0.5, 0.5) }
        })
    };

    // Filter materials
    const filterMaterials = {
        blur: createSimMaterial(FILTER_BLUR_FRAG, {
            uStrength: { value: 1.0 },
            uDirection: { value: new THREE.Vector2(1, 0) }
        }),
        normal: createSimMaterial(FILTER_NORMAL_FRAG, { uStrength: { value: 1.0 } }),
        levels: createSimMaterial(FILTER_LEVELS_FRAG, {
            uMin: { value: 0.0 },
            uMax: { value: 1.0 },
            uGamma: { value: 1.0 },
            uInvert: { value: false }
        }),
        sharpen: createSimMaterial(FILTER_SHARPEN_FRAG, { uStrength: { value: 1.0 } }),
        hsl: createSimMaterial(FILTER_HSL_FRAG, {
            uHue: { value: 0.0 },
            uSaturation: { value: 1.0 },
            uLightness: { value: 0.0 }
        }),
        posterize: createSimMaterial(FILTER_POSTERIZE_FRAG, { uLevels: { value: 4.0 } }),
        threshold: createSimMaterial(FILTER_THRESHOLD_FRAG, { uThreshold: { value: 0.5 } }),
        edge: createSimMaterial(FILTER_EDGE_FRAG),
        emboss: createSimMaterial(FILTER_EMBOSS_FRAG, { uStrength: { value: 2.0 } })
    };

    // Run simulation on layer
    const runSim = (layerId: string, type: string, params: any = {}) => {
        time += 0.016;
        let mat: THREE.ShaderMaterial | null = null;

        switch (type.toUpperCase()) {
            case 'DRIP':
                mat = simMaterials.drip;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uThreshold.value = params.threshold || 0.1;
                break;
            case 'BLEED':
                mat = simMaterials.bleed;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                break;
            case 'LIQUIFY':
                mat = simMaterials.liquify;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uTime.value = time;
                break;
            case 'RIVULET':
                mat = simMaterials.rivulet;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                break;
            case 'GROWTH':
                mat = simMaterials.growth;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uTime.value = time;
                break;
            case 'WIND':
                mat = simMaterials.wind;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uWindDir.value.set(params.dirX || 1, params.dirY || 0);
                break;
            case 'NEBULA':
                mat = simMaterials.nebula;
                mat.uniforms.uTime.value = time;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uChaos.value = params.chaos || 1.0;
                mat.uniforms.uScale.value = params.scale || 1.0;
                break;
            case 'THERMAL':
                mat = simMaterials.thermal;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uDecay.value = params.decay || 0.99;
                break;
            case 'LIFE':
                mat = simMaterials.life;
                mat.uniforms.uTime.value = time;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uChaos.value = params.chaos || 1.0;
                break;
            case 'SORT':
                mat = simMaterials.sort;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uChaos.value = params.chaos || 0.0;
                break;
            case 'MAGNETIC':
                mat = simMaterials.magnetic;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                break;
            case 'DATAMOSH':
                mat = simMaterials.datamosh;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                break;
            case 'VORTEX':
                mat = simMaterials.vortex;
                mat.uniforms.uSpeed.value = params.speed || 1.0;
                mat.uniforms.uTime.value = time;
                break;
            case 'PIXEL_SORT':
                mat = simMaterials.pixelSort;
                mat.uniforms.uThreshold.value = params.threshold || 0.2;
                break;
            default:
                console.warn('[KGraphos] Unknown sim type:', type);
                return;
        }

        if (mat) simpleCanvas.applySimulation(layerId, mat);
    };

    // Apply generator to layer
    const applyGenerator = (layerId: string, type: string, params: any = {}) => {
        let mat: THREE.ShaderMaterial | null = null;

        switch (type.toUpperCase()) {
            case 'NOISE':
                mat = genMaterials.noise;
                mat.uniforms.uScale.value = params.scale || 1.0;
                mat.uniforms.uDetail.value = params.detail || 4.0;
                mat.uniforms.uSeed.value = params.seed || Math.random() * 1000;
                break;
            case 'PATTERN':
                mat = genMaterials.pattern;
                mat.uniforms.uScale.value = params.scale || 10.0;
                mat.uniforms.uMode.value = params.mode || 0;
                break;
            case 'VORONOI':
                mat = genMaterials.voronoi;
                mat.uniforms.uScale.value = params.scale || 5.0;
                mat.uniforms.uSeed.value = params.seed || Math.random() * 1000;
                break;
            case 'FBM':
                mat = genMaterials.fbm;
                mat.uniforms.uScale.value = params.scale || 2.0;
                mat.uniforms.uSeed.value = params.seed || Math.random() * 1000;
                break;
            case 'GRADIENT':
                mat = genMaterials.gradient;
                mat.uniforms.uMode.value = params.mode || 0;
                mat.uniforms.uAngle.value = params.angle || 0;
                break;
            default:
                console.warn('Unknown generator type:', type);
                return;
        }

        if (mat) {
            simpleCanvas.applySimulation(layerId, mat);
        }
    };

    // Apply filter to layer
    const applyFilter = (layerId: string, type: string, params: any = {}) => {
        let mat: THREE.ShaderMaterial | null = null;

        switch (type.toUpperCase()) {
            case 'BLUR':
                mat = filterMaterials.blur;
                mat.uniforms.uStrength.value = params.strength || 1.0;
                // Two-pass blur
                mat.uniforms.uDirection.value.set(1, 0);
                simpleCanvas.applySimulation(layerId, mat);
                mat.uniforms.uDirection.value.set(0, 1);
                simpleCanvas.applySimulation(layerId, mat);
                return;
            case 'NORMAL':
                mat = filterMaterials.normal;
                mat.uniforms.uStrength.value = params.strength || 1.0;
                break;
            case 'LEVELS':
                mat = filterMaterials.levels;
                mat.uniforms.uMin.value = params.min ?? 0;
                mat.uniforms.uMax.value = params.max ?? 1;
                mat.uniforms.uGamma.value = params.gamma ?? 1;
                break;
            case 'SHARPEN':
                mat = filterMaterials.sharpen;
                mat.uniforms.uStrength.value = params.strength || 1.0;
                break;
            case 'HSL':
                mat = filterMaterials.hsl;
                mat.uniforms.uHue.value = params.hue || 0;
                mat.uniforms.uSaturation.value = params.saturation ?? 1;
                mat.uniforms.uLightness.value = params.lightness || 0;
                break;
            case 'POSTERIZE':
                mat = filterMaterials.posterize;
                mat.uniforms.uLevels.value = params.levels || 4;
                break;
            case 'THRESHOLD':
                mat = filterMaterials.threshold;
                mat.uniforms.uThreshold.value = params.threshold ?? 0.5;
                break;
            case 'EDGE':
                mat = filterMaterials.edge;
                break;
            case 'EMBOSS':
                mat = filterMaterials.emboss;
                mat.uniforms.uStrength.value = params.strength || 2.0;
                break;
            default:
                console.warn('Unknown filter type:', type);
                return;
        }

        if (mat) {
            simpleCanvas.applySimulation(layerId, mat);
        }
    };

    // Return the engine interface
    return {
        // Transform
        get zoom() { return simpleCanvas.zoom; },
        get pan() { return simpleCanvas.pan; },

        setTransform(z: number, p: THREE.Vector2 | { x: number; y: number }) {
            simpleCanvas.setTransform(z, p.x, p.y);
        },

        fitToScreen() {
            simpleCanvas.fitToScreen();
        },

        // Layers
        layers: simpleCanvas.getLayers(),

        addLayer(id: string, name: string, initialColor?: number[]) {
            const color = initialColor
                ? `rgba(${Math.round(initialColor[0] * 255)}, ${Math.round(initialColor[1] * 255)}, ${Math.round(initialColor[2] * 255)}, ${initialColor[3] ?? 1})`
                : undefined;
            return simpleCanvas.addLayer(id, name, color);
        },

        deleteLayer(id: string) {
            simpleCanvas.deleteLayer(id);
        },

        getLayer(id: string) {
            return simpleCanvas.getLayer(id);
        },

        setLayerBlendMode(id: string, mode: GlobalCompositeOperation) {
            simpleCanvas.setLayerBlendMode(id, mode);
        },

        // Painting with symmetry support
        startStroke() {
            simpleCanvas.startStroke();
        },

        continueStroke(uv: THREE.Vector2 | { x: number; y: number }, pressure: number, brush: any, layerId: string | null) {
            if (!layerId) return;

            const simpleBrush: SimpleBrush = {
                size: brush.size || 50,
                opacity: brush.opacity ?? 1.0,
                hardness: brush.hardness ?? 0.5,
                color: brush.color || '#000000',
                spacing: brush.spacing || 0.1,
                erase: brush.erase || false,
                // Map 'NONE' to 'OFF' for our internal representation
                symmetry: (brush.symmetry === 'NONE' || !brush.symmetry) ? 'OFF' : brush.symmetry,
                radialSegments: brush.radialSegments || 8
            };

            const u = 'x' in uv ? uv.x : (uv as any).x;
            const v = 'y' in uv ? uv.y : (uv as any).y;

            simpleCanvas.continueStroke(u, v, pressure, simpleBrush, layerId);
        },

        endStroke(layerId: string | null) {
            simpleCanvas.endStroke();
        },

        // Selection
        selectMarquee(layerId: string, u0: number, v0: number, u1: number, v1: number, mode: SelectionMode = 'replace') {
            simpleCanvas.selectMarquee(layerId, u0, v0, u1, v1, mode);
        },

        selectLasso(layerId: string, pointsUV: Array<{ u: number; v: number }>, mode: SelectionMode = 'replace') {
            simpleCanvas.selectLasso(layerId, pointsUV, mode);
        },

        selectMagicWand(layerId: string, u: number, v: number, tolerance = 24, mode: SelectionMode = 'replace') {
            simpleCanvas.selectMagicWand(layerId, u, v, tolerance, mode);
        },

        clearSelection() {
            simpleCanvas.clearSelection();
        },

        getSelectionBounds() {
            return simpleCanvas.getSelectionBoundsUV();
        },

        hasSelection() {
            return simpleCanvas.hasSelection();
        },

        // Rendering
        compose() {
            simpleCanvas.compose();
        },

        render() {
            // No-op for SimpleCanvas (immediate mode rendering)
        },

        // GPU FX
        runSim,
        applyGenerator,
        applyFilter,
        applyCustomShader,

        // Utilities
        resize(w: number, h: number) {
            simpleCanvas.resize(w, h);
        },

        exportImage(callback: (blob: Blob) => void, type?: 'PNG' | 'JPEG') {
            simpleCanvas.exportImage(callback, type);
        },

        undo() {
            return simpleCanvas.undo();
        },

        redo() {
            return simpleCanvas.redo();
        },

        canUndo() {
            return simpleCanvas.canUndo();
        },

        canRedo() {
            return simpleCanvas.canRedo();
        },

        dispose() {
            simpleCanvas.dispose();
        },

        // Properties
        get loadedTextures() { return loadedTextures; },
        set loadedTextures(v: any) { loadedTextures = v; },
        needsUpdate: false,

        // Expose internals for compatibility
        paintEngine: {
            clearLayer(layer: any) {
                if (layer?.id) simpleCanvas.clear(layer.id);
            },
            fillLayer(layer: any, colors: any) {
                if (layer?.id && colors?.albedo) {
                    const c = colors.albedo;
                    const color = `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3] ?? 1})`;
                    simpleCanvas.fill(layer.id, color);
                }
            }
        }
    };
};
