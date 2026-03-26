/**
 * SlotSystem.tsx — K-OS UI Slot Injection System
 *
 * ═══════════════════════════════════════════════════════════════════════
 * EVERY K-OS APP UI HAS NAMED SLOTS. PLUGINS FILL THEM.
 *
 * Like WordPress blocks or UE5 widget extensions — any plugin can inject
 * React components into named positions in any K-OS app.
 *
 * Slot naming:
 *   <app>.<region>.<position>
 *   e.g.
 *     sculpt.toolbar.left         → left side of KSculpt top bar
 *     sculpt.toolbar.right        → right side of KSculpt top bar
 *     sculpt.properties.top       → top of right properties panel
 *     sculpt.properties.bottom    → bottom of right properties panel
 *     sculpt.leftpanel.top        → top of left panel
 *     painter.toolbar.brushes     → brush selector area
 *     painter.layers.above        → above the layer list
 *     painter.sidebar.bottom      → bottom of painter sidebar
 *     quantum.sidebar.nodes       → custom sim node list
 *     quantum.toolbar.right       → quantum top bar right side
 *     universal.statusbar.left    → Universal Workspace status bar
 *     global.topbar.right         → global K-OS topbar right side
 *     global.statusbar.left       → global status bar
 *
 * Usage (in any K-OS component):
 *   <Slot id="sculpt.toolbar.right" />
 *
 * Plugin registers:
 *   api.slots.register('sculpt.toolbar.right', MyCustomTool, { priority: 10 });
 * ═══════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotComponent {
    id: string;
    slotId: string;
    component: React.ComponentType<SlotProps>;
    priority: number;
    owner: string;
    /** Extra props passed to the component */
    props?: Record<string, unknown>;
}

export interface SlotProps {
    /** Which slot this component is in */
    slot: string;
    /** The app this slot belongs to */
    app?: string;
    /** Index among all components in this slot */
    index: number;
    /** Total components in this slot */
    total: number;
    /** Any extra props from the slot definition */
    [key: string]: unknown;
}

// ─── Slot definition registry (data-driven) ───────────────────────────────────

export interface SlotDefinition {
    id: string;
    app: string;
    region: string;
    position: string;
    description: string;
    /** How components are laid out: 'row' | 'column' | 'overlay' | 'replace' */
    layout: 'row' | 'column' | 'overlay' | 'replace';
    /** Size constraint for injected components */
    maxWidth?: number;
    maxHeight?: number;
}

/** All named slot points across K-OS. Data-driven — add a new slot here → it appears in the UI. */
export const KOS_SLOT_DEFINITIONS: SlotDefinition[] = [
    // ── Global ────────────────────────────────────────────────────────────────
    { id: 'global.topbar.left', app: '*', region: 'topbar', position: 'left', layout: 'row', description: 'Left side of K-OS global topbar' },
    { id: 'global.topbar.right', app: '*', region: 'topbar', position: 'right', layout: 'row', description: 'Right side of K-OS global topbar' },
    { id: 'global.topbar.center', app: '*', region: 'topbar', position: 'center', layout: 'row', description: 'Center of K-OS global topbar' },
    { id: 'global.statusbar.left', app: '*', region: 'statusbar', position: 'left', layout: 'row', description: 'Left side of global status bar' },
    { id: 'global.statusbar.right', app: '*', region: 'statusbar', position: 'right', layout: 'row', description: 'Right side of global status bar' },
    { id: 'global.overlay', app: '*', region: 'overlay', position: 'full', layout: 'overlay', description: 'Full-screen overlay (modals, tooltips)' },

    // ── KSculpt ───────────────────────────────────────────────────────────────
    { id: 'sculpt.toolbar.left', app: 'ksculpt', region: 'toolbar', position: 'left', layout: 'row', description: 'Left tools in KSculpt toolbar' },
    { id: 'sculpt.toolbar.right', app: 'ksculpt', region: 'toolbar', position: 'right', layout: 'row', description: 'Right tools in KSculpt toolbar' },
    { id: 'sculpt.toolbar.center', app: 'ksculpt', region: 'toolbar', position: 'center', layout: 'row', description: 'Center of KSculpt toolbar (after brush buttons)' },
    { id: 'sculpt.leftpanel.top', app: 'ksculpt', region: 'leftpanel', position: 'top', layout: 'column', description: 'Top of KSculpt left panel' },
    { id: 'sculpt.leftpanel.bottom', app: 'ksculpt', region: 'leftpanel', position: 'bottom', layout: 'column', description: 'Bottom of KSculpt left panel' },
    { id: 'sculpt.properties.top', app: 'ksculpt', region: 'properties', position: 'top', layout: 'column', description: 'Top of KSculpt right properties panel' },
    { id: 'sculpt.properties.bottom', app: 'ksculpt', region: 'properties', position: 'bottom', layout: 'column', description: 'Bottom of KSculpt properties' },
    { id: 'sculpt.viewport.overlay', app: 'ksculpt', region: 'viewport', position: 'overlay', layout: 'overlay', description: 'Overlay on the 3D viewport (HUDs, stats, etc)' },
    { id: 'sculpt.brushpicker.after', app: 'ksculpt', region: 'brushpicker', position: 'after', layout: 'column', description: 'Below the brush picker — custom brush types' },

    // ── KPainter ──────────────────────────────────────────────────────────────
    { id: 'painter.toolbar.left', app: 'kpainter', region: 'toolbar', position: 'left', layout: 'row', description: 'Left side of KPainter toolbar' },
    { id: 'painter.toolbar.right', app: 'kpainter', region: 'toolbar', position: 'right', layout: 'row', description: 'Right side of KPainter toolbar' },
    { id: 'painter.toolbar.brushes', app: 'kpainter', region: 'toolbar', position: 'brushes', layout: 'row', description: 'After brush controls — custom brush types' },
    { id: 'painter.layers.above', app: 'kpainter', region: 'layers', position: 'above', layout: 'column', description: 'Above the layer list' },
    { id: 'painter.layers.below', app: 'kpainter', region: 'layers', position: 'below', layout: 'column', description: 'Below the layer list' },
    { id: 'painter.sidebar.top', app: 'kpainter', region: 'sidebar', position: 'top', layout: 'column', description: 'Top of KPainter right sidebar' },
    { id: 'painter.sidebar.bottom', app: 'kpainter', region: 'sidebar', position: 'bottom', layout: 'column', description: 'Bottom of KPainter sidebar' },
    { id: 'painter.viewport.overlay', app: 'kpainter', region: 'viewport', position: 'overlay', layout: 'overlay', description: 'Overlay on the paint canvas' },

    // ── KQuantum ──────────────────────────────────────────────────────────────
    { id: 'quantum.toolbar.left', app: 'kquantum', region: 'toolbar', position: 'left', layout: 'row', description: 'Left of KQuantum toolbar' },
    { id: 'quantum.toolbar.right', app: 'kquantum', region: 'toolbar', position: 'right', layout: 'row', description: 'Right of KQuantum toolbar' },
    { id: 'quantum.sidebar.nodes', app: 'kquantum', region: 'sidebar', position: 'nodes', layout: 'column', description: 'Custom simulation node list in KQuantum' },
    { id: 'quantum.sidebar.bottom', app: 'kquantum', region: 'sidebar', position: 'bottom', layout: 'column', description: 'Bottom of KQuantum sidebar' },
    { id: 'quantum.viewport.overlay', app: 'kquantum', region: 'viewport', position: 'overlay', layout: 'overlay', description: 'Overlay on KQuantum simulation viewport' },
    { id: 'quantum.controls.after', app: 'kquantum', region: 'controls', position: 'after', layout: 'column', description: 'After sim controls — custom force/field inputs' },

    // ── KRetopo ───────────────────────────────────────────────────────────────
    { id: 'retopo.toolbar.right', app: 'kretopo', region: 'toolbar', position: 'right', layout: 'row', description: 'Right of KRetopo toolbar' },
    { id: 'retopo.sidebar.top', app: 'kretopo', region: 'sidebar', position: 'top', layout: 'column', description: 'Top of KRetopo sidebar' },

    // ── KGraphos ──────────────────────────────────────────────────────────────
    { id: 'graphos.toolbar.right', app: 'kgraphos', region: 'toolbar', position: 'right', layout: 'row', description: 'Right of KGraphos toolbar' },
    { id: 'graphos.canvas.overlay', app: 'kgraphos', region: 'canvas', position: 'overlay', layout: 'overlay', description: 'Overlay on Graphos canvas' },

    // ── Universal Workspace ───────────────────────────────────────────────────
    { id: 'universal.topbar.left', app: 'universal', region: 'topbar', position: 'left', layout: 'row', description: 'Left of Universal Workspace topbar' },
    { id: 'universal.topbar.right', app: 'universal', region: 'topbar', position: 'right', layout: 'row', description: 'Right of Universal Workspace topbar' },
    { id: 'universal.statusbar.left', app: 'universal', region: 'statusbar', position: 'left', layout: 'row', description: 'Left of Universal Workspace status bar' },
    { id: 'universal.statusbar.right', app: 'universal', region: 'statusbar', position: 'right', layout: 'row', description: 'Right of Universal Workspace status bar' },
    { id: 'universal.panel.apppicker', app: 'universal', region: 'panel', position: 'apppicker', layout: 'column', description: 'Addition to Universal panel app picker' },

    // ── KAIN Language ────────────────────────────────────────────────────────
    { id: 'kain.console.main', app: 'kain', region: 'console', position: 'main', layout: 'column', description: 'KAINScript full IDE console panel' },
    { id: 'kain.console.sidebar', app: 'kain', region: 'console', position: 'sidebar', layout: 'column', description: 'KAINScript source registry sidebar' },
    { id: 'global.statusbar.kain', app: '*', region: 'statusbar', position: 'right', layout: 'row', description: 'KAIN version/status indicator in global status bar' },
];

// ─── Slot Registry ────────────────────────────────────────────────────────────

class SlotRegistry {
    private slots: Map<string, SlotComponent[]> = new Map();
    private listeners: Set<() => void> = new Set();
    private idCounter = 0;

    register(
        slotId: string,
        component: React.ComponentType<SlotProps>,
        opts: { priority?: number; owner?: string; props?: Record<string, unknown> } = {}
    ): () => void {
        const entry: SlotComponent = {
            id: `sc_${++this.idCounter}`,
            slotId,
            component,
            priority: opts.priority ?? 100,
            owner: opts.owner ?? 'anonymous',
            props: opts.props,
        };

        if (!this.slots.has(slotId)) this.slots.set(slotId, []);
        const list = this.slots.get(slotId)!;
        list.push(entry);
        list.sort((a, b) => a.priority - b.priority);
        this.notify();

        return () => {
            const l = this.slots.get(slotId);
            if (!l) return;
            this.slots.set(slotId, l.filter(e => e.id !== entry.id));
            this.notify();
        };
    }

    getComponents(slotId: string): SlotComponent[] {
        return this.slots.get(slotId) ?? [];
    }

    removeOwner(owner: string): void {
        for (const [slotId, list] of this.slots) {
            this.slots.set(slotId, list.filter(e => e.owner !== owner));
        }
        this.notify();
    }

    subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify(): void {
        this.listeners.forEach(cb => cb());
    }

    /** All slots that have at least one registered component */
    getOccupiedSlots(): string[] {
        return Array.from(this.slots.entries())
            .filter(([, list]) => list.length > 0)
            .map(([id]) => id);
    }

    listByOwner(owner: string): { slotId: string; comp: SlotComponent }[] {
        const results: { slotId: string; comp: SlotComponent }[] = [];
        for (const [slotId, list] of this.slots) {
            for (const comp of list) {
                if (comp.owner === owner) results.push({ slotId, comp });
            }
        }
        return results;
    }
}

export const slotRegistry = new SlotRegistry();

// ─── React Context ────────────────────────────────────────────────────────────

interface SlotContextValue {
    registry: SlotRegistry;
    /** Current app ID — slots filter by this */
    appId: string;
}

const SlotContext = createContext<SlotContextValue>({
    registry: slotRegistry,
    appId: '*',
});

export function SlotProvider({ appId, children }: { appId: string; children: React.ReactNode }) {
    return (
        <SlotContext.Provider value={{ registry: slotRegistry, appId }}>
            {children}
        </SlotContext.Provider>
    );
}

export function useSlotRegistry() {
    return useContext(SlotContext);
}

// ─── <Slot> Component ─────────────────────────────────────────────────────────

interface SlotComponentProps {
    /** Slot identifier e.g. "sculpt.toolbar.right" */
    id: string;
    /** Extra props forwarded to all injected components */
    extraProps?: Record<string, unknown>;
    /** Wrapper className */
    className?: string;
    /** Show nothing if no components registered (default: true) */
    hideIfEmpty?: boolean;
}

export function Slot({ id, extraProps = {}, className, hideIfEmpty = true }: SlotComponentProps) {
    const { registry } = useContext(SlotContext);

    // Subscribe to registry changes (re-render when plugins install/uninstall)
    const [tick, setTick] = useState(0);
    useEffect(() => {
        return registry.subscribe(() => setTick(t => t + 1));
    }, [registry]);

    const components = registry.getComponents(id);

    if (components.length === 0 && hideIfEmpty) return null;

    const def = KOS_SLOT_DEFINITIONS.find(d => d.id === id);
    const layout = def?.layout ?? 'row';
    const direction = layout === 'column' ? 'flex-col' : 'flex-row';

    return (
        <div className={`flex ${direction} items-center gap-1 ${className ?? ''}`}
            data-kos-slot={id}>
            {components.map((entry, i) => {
                const Comp = entry.component;
                return (
                    <Comp
                        key={entry.id}
                        slot={id}
                        index={i}
                        total={components.length}
                        {...(entry.props ?? {})}
                        {...extraProps}
                    />
                );
            })}
        </div>
    );
}

// ─── useSlot hook ─────────────────────────────────────────────────────────────

/** Imperative: get slot components programmatically */
export function useSlot(slotId: string): SlotComponent[] {
    const { registry } = useContext(SlotContext);
    const [components, setComponents] = useState(() => registry.getComponents(slotId));

    useEffect(() => {
        return registry.subscribe(() => setComponents(registry.getComponents(slotId)));
    }, [registry, slotId]);

    return components;
}
