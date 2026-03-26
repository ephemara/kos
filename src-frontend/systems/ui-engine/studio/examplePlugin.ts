/**
 * examplePlugin.ts — K-OS Example Plugin (Demo of full plugin system)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HOW TO WRITE A K-OS PLUGIN — COMPLETE REFERENCE
 *
 * This plugin demonstrates EVERY capability of the K-OS Plugin Matrix:
 *   1.  Hooks      — intercept sculpt brush strokes, cancel ops, transform data
 *   2.  Slots      — inject UI components into KSculpt toolbar, KPainter sidebar
 *   3.  App APIs   — add custom brushes to KSculpt, custom nodes to KQuantum
 *   4.  Commands   — register palette commands
 *   5.  Themes     — register a custom color theme
 *   6.  Shaders    — add a UI shader preset
 *   7.  Storage    — persist plugin settings
 *   8.  Events     — communicate with other plugins
 *
 * To register this plugin:
 *   import { examplePluginModule } from '@/systems/ui-engine/studio/examplePlugin';
 *   await kosRegistry.registerExtension(examplePluginModule);
 * ═══════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type { ExtensionModule, KOSExtensionApi } from '@/systems/ui-engine/extensionApi';
import type { SlotProps } from '@/systems/ui-engine/slots/SlotSystem';
import type { SculptBrushDef, SculptStrokeContext } from '@/systems/ui-engine/appApi/AppApiRegistry';

// ─── Custom brush: "Quantum Flatten" ─────────────────────────────────────────
// This brush levels geometry around the stroke center using a field equation.

const QUANTUM_FLATTEN_BRUSH: SculptBrushDef = {
    id: 'example-plugin.quantum-flatten',
    label: 'Quantum Flatten',
    category: 'plugin',
    key: 'Q',
    defaultStrength: 0.4,
    defaultRadius: 0.15,

    apply(ctx: SculptStrokeContext) {
        // Find average Y of vertices within radius, flatten toward it
        const verts = ctx.vertices;
        let sumY = 0, count = 0;
        const r2 = ctx.radius * ctx.radius;

        for (let i = 0; i < verts.length; i += 3) {
            const dx = verts[i] - ctx.position[0];
            const dy = verts[i + 1] - ctx.position[1];
            const dz = verts[i + 2] - ctx.position[2];
            if (dx * dx + dy * dy + dz * dz < r2) { sumY += verts[i + 1]; count++; }
        }
        if (count === 0) return;

        const avgY = sumY / count;
        const str = ctx.strength;

        for (let i = 0; i < verts.length; i += 3) {
            const dx = verts[i] - ctx.position[0];
            const dy = verts[i + 1] - ctx.position[1];
            const dz = verts[i + 2] - ctx.position[2];
            if (dx * dx + dy * dy + dz * dz < r2) {
                // Smooth falloff based on distance from center
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const falloff = 1 - (dist / ctx.radius);
                verts[i + 1] += (avgY - verts[i + 1]) * str * falloff;
            }
        }
        ctx.commit();
    },

    // Custom properties panel shown in KSculpt's left panel
    PropertiesPanel({ brushDef }) {
        return React.createElement('div', {
            style: { padding: '8px', fontFamily: 'monospace', fontSize: '9px', color: '#ccc' }
        }, [
            React.createElement('p', { key: 'title', style: { color: '#f97316' } }, '⚛ Quantum Flatten'),
            React.createElement('p', { key: 'desc', style: { color: '#666', marginTop: '4px' } },
                'Flattens geometry by computing the local average height field around the stroke.'
            ),
        ]);
    },
};

// ─── Slot component: Watermark in KSculpt viewport ───────────────────────────

const SculptViewportWatermark: React.FC<SlotProps> = () => {
    return React.createElement('div', {
        style: {
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            fontFamily: 'monospace',
            fontSize: '8px',
            color: 'rgba(249, 115, 22, 0.3)',
            pointerEvents: 'none',
            userSelect: 'none',
        }
    }, '⚡ Example Plugin Active');
};

// ─── Slot component: Extra button in KSculpt toolbar ─────────────────────────

const SculptToolbarButton: React.FC<SlotProps> = () => {
    const [active, setActive] = React.useState(false);
    return React.createElement('button', {
        onClick: () => setActive(v => !v),
        style: {
            padding: '2px 6px',
            background: active ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${active ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '4px',
            color: active ? '#f97316' : '#888',
            fontSize: '8px',
            fontFamily: 'monospace',
            cursor: 'pointer',
        }
    }, active ? '⚡ QF ON' : '⚡ QF');
};

// ─── Plugin activate function ─────────────────────────────────────────────────

async function activate(api: KOSExtensionApi): Promise<void> {
    const id = api.extensionId;
    console.log(`[${id}] Activating K-OS example plugin...`);

    // ── 1. HOOKS — intercept sculpt strokes ───────────────────────────────────
    api.hooks.on<{ strength: number; radius: number; brush: any }>(
        'sculpt:brush:stroke:before',
        (ctx) => {
            // Log every stroke (could also call ctx.cancel() to abort)
            console.log(`[${id}] Intercepted stroke: strength=${ctx.data.strength.toFixed(2)}`);

            // Example: if brush radius is enormous, reduce strength
            if (ctx.data.radius > 0.8) {
                ctx.data.strength = Math.min(ctx.data.strength, 0.3);
                console.log(`[${id}] Large radius detected — clamped strength to 0.3`);
            }
            return ctx;
        },
        { priority: 50 }
    );

    api.hooks.on('theme:change:after', (ctx) => {
        console.log(`[${id}] Theme changed to:`, (ctx.data as any).themeId);
        return ctx;
    });

    // ── 2. SLOTS — inject UI into K-OS apps ───────────────────────────────────
    api.slots.register('sculpt.viewport.overlay', SculptViewportWatermark, { priority: 200 });
    api.slots.register('sculpt.toolbar.right', SculptToolbarButton, { priority: 10 });

    // ── 3. APP APIS — add brush to KSculpt ────────────────────────────────────
    // Register brush immediately if KSculpt is already mounted, or wait for it:
    api.app.whenReady('ksculpt', (sculpt) => {
        const unregister = sculpt.addBrush(QUANTUM_FLATTEN_BRUSH);
        console.log(`[${id}] Registered "Quantum Flatten" brush in KSculpt`);

        // Subscribe to all strokes
        sculpt.onStroke((ctx) => {
            if (ctx.brush.id === QUANTUM_FLATTEN_BRUSH.id) {
                // Persist stroke count for stats
                const count = (api.storage.get<number>('strokeCount') ?? 0) + 1;
                api.storage.set('strokeCount', count);
            }
        });
    });

    // ── 4. COMMANDS ───────────────────────────────────────────────────────────
    api.commands.register({
        id: `${id}.hello`,
        label: 'Example Plugin: Hello',
        category: 'Example',
        action() {
            console.log(`[${id}] Hello from Example Plugin!`);
            const count = api.storage.get<number>('strokeCount') ?? 0;
            alert(`Example Plugin active! Total QF strokes: ${count}`);
        },
    });

    api.commands.register({
        id: `${id}.reset-stroke-count`,
        label: 'Example Plugin: Reset Stroke Count',
        category: 'Example',
        action() {
            api.storage.set('strokeCount', 0);
            console.log(`[${id}] Stroke count reset`);
        },
    });

    // ── 5. THEME ──────────────────────────────────────────────────────────────
    api.theme.register({
        id: `${id}.neon-orange`,
        label: 'Neon Orange (Example Plugin)',
        description: 'Warm neon theme contributed by Example Plugin',
        tokens: {
            color: {
                accentPrimary: [30, 100, 55, 1] as [number, number, number, number],
                accentSecondary: [50, 100, 50, 1] as [number, number, number, number],
                surfacePrimary: [20, 12, 6, 1] as [number, number, number, number],
            },
        } as any,
    });

    // ── 6. SHADER ─────────────────────────────────────────────────────────────
    api.shaders.register({
        id: `${id}.ember`,
        label: 'Ember (Example Plugin)',
        target: 'global',
        glsl: `
            precision mediump float;
            uniform float u_time;
            uniform float u_intensity;
            varying vec2 vUv;
            void main() {
                float flicker = sin(u_time * 3.0 + vUv.y * 15.0) * 0.5 + 0.5;
                vec3 ember = vec3(0.97, 0.45, 0.08) * flicker * u_intensity;
                gl_FragColor = vec4(ember, flicker * 0.05 * u_intensity);
            }
        `,
        uniforms: { u_intensity: 0.6 },
    });

    // ── 7. EVENTS — communicate with other plugins ────────────────────────────
    api.events.emit('ready', { version: '1.0.0' });
    api.events.on('greet', (data) => {
        console.log(`[${id}] Got greet from another plugin:`, data);
    });

    console.log(`[${id}] Example plugin activated successfully!`);
    console.log(`[${id}] Available hooks: ${api.hooks.listAvailable().length}`);
    console.log(`[${id}] Available slots: ${api.slots.listAvailable().length}`);
    console.log(`[${id}] Mounted apps:    `, api.app.mounted());
}

async function deactivate(): Promise<void> {
    console.log('[example-plugin] Deactivating...');
    // All hooks, slots are automatically cleaned up by the registry
}

// ─── Module export ────────────────────────────────────────────────────────────

export const examplePluginModule: ExtensionModule = {
    manifest: {
        id: 'example-plugin',
        name: 'Example Plugin',
        version: '1.0.0',
        description: 'Demonstrates every K-OS plugin capability: hooks, slots, app APIs, themes, shaders',
        author: 'K-OS Team',
        icon: '⚡',
        tags: ['example', 'demo', 'sculpt'],
        permissions: [
            'sculpt.brush.add',
            'sculpt.mesh.read',
        ],
        requiresApps: ['ksculpt'],
        contributes: {
            commands: [
                { id: 'example-plugin.hello', label: 'Example Plugin: Hello', category: 'Example' },
                { id: 'example-plugin.reset-stroke-count', label: 'Example Plugin: Reset Stroke Count', category: 'Example' },
            ],
            themes: [
                { id: 'example-plugin.neon-orange', label: 'Neon Orange', tokens: {} as any },
            ],
            shaders: [
                { id: 'example-plugin.ember', label: 'Ember', target: 'global', glsl: '' },
            ],
        },
    },
    activate,
    deactivate,
};
