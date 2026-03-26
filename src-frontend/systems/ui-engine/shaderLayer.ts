/**
 * shaderLayer.ts — K-OS UI Shader Layer
 *
 * Renders GLSL fragment shaders as a WebGL canvas overlay on top of
 * any UI panel or the entire workspace. Used by plugins to add:
 *   - Animated grain/noise overlays
 *   - Scan-line effects
 *   - Color grading / LUT effects
 *   - Custom glow / vignette
 *   - Interactive pointer-reactive shaders
 *   - Data visualization in the UI chrome itself
 *
 * Architecture:
 *   - Each ShaderLayer instance owns a <canvas> positioned absolute
 *   - Uses requestAnimationFrame for live animation
 *   - Standard uniforms passed to all shaders:
 *       u_time       — seconds since start
 *       u_resolution — canvas width/height
 *       u_mouse      — normalised mouse position [0..1, 0..1]
 *       u_accent     — current theme accent color as vec4
 *   - Extensions add custom uniforms via setUniform()
 *
 * GLSL template:
 * ─────────────
 *   precision mediump float;
 *   uniform float u_time;
 *   uniform vec2  u_resolution;
 *   uniform vec2  u_mouse;
 *   uniform vec4  u_accent;
 *   // + any custom uniforms declared by extension
 *
 *   void main() {
 *     vec2 uv = gl_FragCoord.xy / u_resolution;
 *     // ... your effect ...
 *     gl_FragColor = vec4(rgb, alpha);
 *   }
 */

// ─── Built-in shader effects ──────────────────────────────────────────────────

/** Data-driven catalogue of built-in shader presets */
export interface BuiltinShaderPreset {
    id: string;
    label: string;
    description: string;
    category: 'grain' | 'glow' | 'grid' | 'wave' | 'vignette' | 'custom';
    glsl: string;
    defaultUniforms: Record<string, number[]>;
}

export const BUILTIN_SHADER_PRESETS: BuiltinShaderPreset[] = [
    {
        id: 'grain', label: 'Film Grain', category: 'grain',
        description: 'Subtle animated noise overlay',
        defaultUniforms: { u_strength: [0.04] },
        glsl: `
precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_strength;
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float n = rand(uv + fract(u_time * 0.7));
    gl_FragColor = vec4(vec3(n), n * u_strength);
}`,
    },
    {
        id: 'scanlines', label: 'Scanlines', category: 'grid',
        description: 'Retro CRT horizontal scan lines',
        defaultUniforms: { u_spacing: [3.0], u_opacity: [0.06] },
        glsl: `
precision mediump float;
uniform vec2  u_resolution;
uniform float u_spacing;
uniform float u_opacity;
void main() {
    float y = mod(gl_FragCoord.y, u_spacing * 2.0);
    float line = step(u_spacing, y) * u_opacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, line);
}`,
    },
    {
        id: 'vignette', label: 'Vignette', category: 'vignette',
        description: 'Soft edge darkening',
        defaultUniforms: { u_strength: [0.5], u_radius: [0.7] },
        glsl: `
precision mediump float;
uniform vec2  u_resolution;
uniform float u_strength;
uniform float u_radius;
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 d  = uv - 0.5;
    float v = smoothstep(u_radius, 0.0, dot(d, d) * 2.0);
    gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - v) * u_strength);
}`,
    },
    {
        id: 'grid', label: 'Grid Lines', category: 'grid',
        description: 'Subtle graph-paper grid overlay',
        defaultUniforms: { u_cell: [32.0], u_opacity: [0.04] },
        glsl: `
precision mediump float;
uniform vec2  u_resolution;
uniform float u_cell;
uniform float u_opacity;
void main() {
    vec2 uv  = gl_FragCoord.xy;
    vec2 g   = abs(fract(uv / u_cell) - 0.5);
    float line = max(step(0.48, g.x), step(0.48, g.y));
    gl_FragColor = vec4(1.0, 1.0, 1.0, line * u_opacity);
}`,
    },
    {
        id: 'accent_glow', label: 'Accent Glow', category: 'glow',
        description: 'Theme-accent-colored radial bloom from cursor',
        defaultUniforms: { u_strength: [0.3] },
        glsl: `
precision mediump float;
uniform vec2  u_resolution;
uniform vec2  u_mouse;
uniform vec4  u_accent;
uniform float u_strength;
void main() {
    vec2 uv   = gl_FragCoord.xy / u_resolution;
    vec2 dm   = uv - u_mouse;
    float dist = length(dm);
    float glow = exp(-dist * 6.0) * u_strength;
    gl_FragColor = vec4(u_accent.rgb, glow * u_accent.a);
}`,
    },
    {
        id: 'plasma_wave', label: 'Plasma Wave', category: 'wave',
        description: 'Animated sinusoidal color plasma',
        defaultUniforms: { u_strength: [0.06], u_speed: [1.0] },
        glsl: `
precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform vec4  u_accent;
uniform float u_strength;
uniform float u_speed;
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * u_speed;
    float v = sin(uv.x * 12.0 + t) * sin(uv.y * 8.0 + t * 1.3)
            + sin((uv.x + uv.y) * 10.0 + t * 0.7);
    float a = (v * 0.5 + 0.5) * u_strength;
    gl_FragColor = vec4(u_accent.rgb, a);
}`,
    },
];

// ─── WebGL helpers ────────────────────────────────────────────────────────────

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[KOS Shader]', gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function createProgram(gl: WebGLRenderingContext, fragSrc: string): WebGLProgram | null {
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('[KOS Shader] Link error:', gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

// ─── ShaderLayer ──────────────────────────────────────────────────────────────

export interface ShaderLayerOptions {
    /** GLSL fragment source */
    glsl: string;
    /** CSS z-index for the shader canvas overlay */
    zIndex?: number;
    /** Mix mode (default: 'screen' for additive light effects) */
    blendMode?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
    /** Pointer events passthrough */
    passthrough?: boolean;
    /** Custom uniforms */
    uniforms?: Record<string, number[]>;
    /** Accent color [r,g,b,a] 0..1 */
    accent?: [number, number, number, number];
    /** Opacity 0..1 */
    opacity?: number;
}

export class ShaderLayer {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private rafId: number = 0;
    private startTime = performance.now();
    private mouse: [number, number] = [0.5, 0.5];
    private opts: ShaderLayerOptions;
    private error: string | null = null;

    constructor(private container: HTMLElement, opts: ShaderLayerOptions) {
        this.opts = { zIndex: 10, blendMode: 'screen', passthrough: true, opacity: 1, ...opts };
        this.canvas = document.createElement('canvas');
        this.setupCanvas();
        this.init();
    }

    private setupCanvas(): void {
        const c = this.canvas;
        c.style.position = 'absolute';
        c.style.inset = '0';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.zIndex = String(this.opts.zIndex);
        c.style.pointerEvents = this.opts.passthrough ? 'none' : 'auto';
        c.style.mixBlendMode = this.opts.blendMode ?? 'screen';
        c.style.opacity = String(this.opts.opacity ?? 1);
        this.container.style.position = 'relative';
        this.container.appendChild(c);
    }

    private init(): void {
        const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
        if (!gl) { this.error = 'WebGL not available'; return; }
        this.gl = gl;

        this.program = createProgram(gl, this.opts.glsl);
        if (!this.program) { this.error = 'Shader compilation failed'; return; }

        // Full-screen quad
        const buf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

        const pos = gl.getAttribLocation(this.program, 'a_position');
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(pos);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Mouse tracking
        this.container.addEventListener('mousemove', this.onMouse);

        this.render();
    }

    private onMouse = (e: MouseEvent): void => {
        const rect = this.container.getBoundingClientRect();
        this.mouse = [
            (e.clientX - rect.left) / rect.width,
            1.0 - (e.clientY - rect.top) / rect.height,
        ];
    };

    private render = (): void => {
        const { gl, program, canvas, container } = this;
        if (!gl || !program) return;

        const w = container.clientWidth;
        const h = container.clientHeight;

        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        const t = (performance.now() - this.startTime) / 1000;

        // Standard uniforms
        this.setF('u_time', [t]);
        this.setF('u_resolution', [w, h]);
        this.setF('u_mouse', this.mouse);
        this.setF('u_accent', this.opts.accent ?? [0.0, 1.0, 0.75, 1.0]);

        // Custom uniforms
        for (const [name, val] of Object.entries(this.opts.uniforms ?? {})) {
            this.setF(name, val);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.rafId = requestAnimationFrame(this.render);
    };

    private setF(name: string, values: number[]): void {
        if (!this.gl || !this.program) return;
        const loc = this.gl.getUniformLocation(this.program, name);
        if (!loc) return;
        const gl = this.gl;
        switch (values.length) {
            case 1: gl.uniform1f(loc, values[0]); break;
            case 2: gl.uniform2f(loc, values[0], values[1]); break;
            case 3: gl.uniform3f(loc, values[0], values[1], values[2]); break;
            case 4: gl.uniform4f(loc, values[0], values[1], values[2], values[3]); break;
        }
    }

    /** Update a uniform value live */
    setUniform(name: string, value: number[]): void {
        if (!this.opts.uniforms) this.opts.uniforms = {};
        this.opts.uniforms[name] = value;
    }

    /** Update accent color from theme */
    setAccent(rgba: [number, number, number, number]): void {
        this.opts.accent = rgba;
    }

    setOpacity(opacity: number): void {
        this.opts.opacity = opacity;
        this.canvas.style.opacity = String(opacity);
    }

    getError(): string | null { return this.error; }

    destroy(): void {
        cancelAnimationFrame(this.rafId);
        this.container.removeEventListener('mousemove', this.onMouse);
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }
        this.canvas.remove();
    }
}

// ─── Shader manager singleton ─────────────────────────────────────────────────

class ShaderManager {
    private layers: Map<string, ShaderLayer> = new Map();

    attach(id: string, container: HTMLElement, opts: ShaderLayerOptions): ShaderLayer {
        this.detach(id);
        const layer = new ShaderLayer(container, opts);
        this.layers.set(id, layer);
        return layer;
    }

    detach(id: string): void {
        this.layers.get(id)?.destroy();
        this.layers.delete(id);
    }

    getLayer(id: string): ShaderLayer | undefined {
        return this.layers.get(id);
    }

    updateUniform(id: string, name: string, value: number[]): void {
        this.layers.get(id)?.setUniform(name, value);
    }

    /** Update accent color on all layers when theme changes */
    updateAccent(rgba: [number, number, number, number]): void {
        for (const layer of this.layers.values()) layer.setAccent(rgba);
    }

    destroyAll(): void {
        for (const layer of this.layers.values()) layer.destroy();
        this.layers.clear();
    }
}

export const shaderManager = new ShaderManager();

// ─── React hook for shader overlays ──────────────────────────────────────────

import { useRef, useEffect } from 'react';

export function useShaderLayer(
    containerRef: React.RefObject<HTMLElement>,
    presetId: string | null,
    uniforms: Record<string, number[]> = {},
    accent: [number, number, number, number] = [0, 1, 0.75, 1],
): void {
    const layerRef = useRef<ShaderLayer | null>(null);
    const instanceId = useRef(`shader_${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
        if (!presetId || !containerRef.current) {
            shaderManager.detach(instanceId.current);
            layerRef.current = null;
            return;
        }

        const preset = BUILTIN_SHADER_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        layerRef.current = shaderManager.attach(instanceId.current, containerRef.current, {
            glsl: preset.glsl,
            uniforms: { ...preset.defaultUniforms, ...uniforms },
            accent,
            blendMode: 'screen',
            opacity: 0.6,
        });

        return () => {
            shaderManager.detach(instanceId.current);
            layerRef.current = null;
        };
    }, [presetId, containerRef]);

    // Update uniforms live without re-creating the layer
    useEffect(() => {
        if (!layerRef.current) return;
        for (const [k, v] of Object.entries(uniforms)) {
            layerRef.current.setUniform(k, v);
        }
    }, [uniforms]);
}

// ─── Re-export for convenience ────────────────────────────────────────────────
import React from 'react';
