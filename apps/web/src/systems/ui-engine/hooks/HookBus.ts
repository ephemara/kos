/**
 * HookBus.ts — K-OS Hook / Delegate System
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE CORE OF K-OS EXTENSIBILITY. NOTHING IS LOCKED.
 *
 * Like UE5 delegates, but more powerful:
 *   - Synchronous hooks: pre/post/filter chains
 *   - Async hooks: pipeline stages that await each handler
 *   - Cancellable: any handler can abort the chain
 *   - Modifiable: handlers can transform data passing through
 *   - Priority ordering: hooks fire in priority order (0 = first)
 *   - Returns: post-hooks receive final result
 *   - Typed: full TypeScript generics on every hook
 *
 * Hook naming convention:
 *   <app>:<domain>:<action>:<timing>
 *   e.g.
 *     sculpt:brush:stroke:before     → can cancel/modify stroke
 *     sculpt:brush:stroke:after      → notified after stroke completes
 *     painter:layer:blend:filter     → transforms layer blend result
 *     quantum:sim:step:before        → called before each sim tick
 *     ui:panel:open:before           → can redirect panel open
 *     theme:change:after             → notified when theme changed
 *
 * Usage:
 *   // App side (declare hook point)
 *   const result = await hookBus.call('sculpt:brush:stroke:before', { brush, strength, mesh });
 *   if (result.cancelled) return;
 *   doActualStroke(result.data);
 *   hookBus.callSync('sculpt:brush:stroke:after', { brush, result });
 *
 *   // Plugin side (register handler)
 *   api.hooks.on('sculpt:brush:stroke:before', (ctx) => {
 *     ctx.data.strength *= 0.5; // halve all sculpt strength
 *     return ctx;
 *   }, { priority: 10 });
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Hook context ─────────────────────────────────────────────────────────────

export interface HookContext<T = unknown> {
    /** The data being passed through the hook chain */
    data: T;
    /** Set to true by any handler to abort the chain */
    cancelled: boolean;
    /** Reason for cancellation (optional) */
    cancelReason?: string;
    /** Extra metadata from the calling app */
    meta: Record<string, unknown>;
    /** Cancel the hook chain */
    cancel(reason?: string): void;
}

function makeContext<T>(data: T, meta: Record<string, unknown> = {}): HookContext<T> {
    const ctx: HookContext<T> = {
        data, cancelled: false, meta,
        cancel(reason) {
            ctx.cancelled = true;
            ctx.cancelReason = reason;
        },
    };
    return ctx;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export type HookHandler<T> = (
    ctx: HookContext<T>
) => HookContext<T> | void | Promise<HookContext<T> | void>;

export interface HookRegistration<T> {
    id: string;
    hook: string;
    handler: HookHandler<T>;
    priority: number;
    /** Extension / plugin that registered this */
    owner: string;
    once: boolean;
}

// ─── HookBus ──────────────────────────────────────────────────────────────────

export class HookBus {
    /** hookName → sorted registrations */
    private registry: Map<string, HookRegistration<any>[]> = new Map();
    private idCounter = 0;

    // ─── Registration ──────────────────────────────────────────────────────────

    /**
     * Register a hook handler.
     * Returns an unsubscribe function.
     */
    on<T = unknown>(
        hook: string,
        handler: HookHandler<T>,
        opts: { priority?: number; owner?: string; once?: boolean } = {}
    ): () => void {
        const reg: HookRegistration<T> = {
            id: `h_${++this.idCounter}`,
            hook,
            handler,
            priority: opts.priority ?? 100,
            owner: opts.owner ?? 'anonymous',
            once: opts.once ?? false,
        };

        if (!this.registry.has(hook)) this.registry.set(hook, []);
        const list = this.registry.get(hook)!;
        list.push(reg);
        list.sort((a, b) => a.priority - b.priority);

        return () => this.off(reg.id, hook);
    }

    /** Register a one-shot handler (auto-removed after first call) */
    once<T = unknown>(hook: string, handler: HookHandler<T>, opts: { priority?: number; owner?: string } = {}): () => void {
        return this.on<T>(hook, handler, { ...opts, once: true });
    }

    /** Remove a handler by registration ID */
    off(id: string, hook?: string): void {
        if (hook) {
            const list = this.registry.get(hook);
            if (!list) return;
            this.registry.set(hook, list.filter(r => r.id !== id));
        } else {
            for (const [h, list] of this.registry) {
                this.registry.set(h, list.filter(r => r.id !== id));
            }
        }
    }

    /** Remove all handlers registered by a specific owner (e.g. on plugin deactivate) */
    removeOwner(owner: string): void {
        for (const [hook, list] of this.registry) {
            this.registry.set(hook, list.filter(r => r.owner !== owner));
        }
    }

    // ─── Calling hooks ─────────────────────────────────────────────────────────

    /**
     * Call a hook asynchronously. Handlers fire in priority order.
     * Any handler can cancel, modify ctx.data, or let it pass through.
     */
    async call<T = unknown>(hook: string, data: T, meta: Record<string, unknown> = {}): Promise<HookContext<T>> {
        const ctx = makeContext<T>(data, meta);
        const list = this.registry.get(hook);
        if (!list?.length) return ctx;

        const toRemove: string[] = [];

        for (const reg of list) {
            if (ctx.cancelled) break;
            try {
                const result = await reg.handler(ctx);
                if (result) Object.assign(ctx, result);
            } catch (err) {
                console.error(`[KOS HookBus] Handler error on "${hook}" (owner: ${reg.owner}):`, err);
            }
            if (reg.once) toRemove.push(reg.id);
        }

        for (const id of toRemove) this.off(id, hook);
        return ctx;
    }

    /**
     * Call a hook synchronously. Use when you cannot await (render paths, etc.).
     * Async handlers are called but their result is not awaited.
     */
    callSync<T = unknown>(hook: string, data: T, meta: Record<string, unknown> = {}): HookContext<T> {
        const ctx = makeContext<T>(data, meta);
        const list = this.registry.get(hook);
        if (!list?.length) return ctx;

        const toRemove: string[] = [];

        for (const reg of list) {
            if (ctx.cancelled) break;
            try {
                const result = reg.handler(ctx);
                // If it returns a plain object (non-Promise), handle it
                if (result && !(result instanceof Promise)) {
                    Object.assign(ctx, result);
                }
            } catch (err) {
                console.error(`[KOS HookBus] Sync handler error on "${hook}" (owner: ${reg.owner}):`, err);
            }
            if (reg.once) toRemove.push(reg.id);
        }

        for (const id of toRemove) this.off(id, hook);
        return ctx;
    }

    /**
     * Fire-and-forget: notify all handlers, don't care about return value.
     * Like UE5 multicast delegates.
     */
    fire<T = unknown>(hook: string, data: T, meta: Record<string, unknown> = {}): void {
        this.call(hook, data, meta).catch(() => { });
    }

    // ─── Introspection ─────────────────────────────────────────────────────────

    /** Get all registered hooks (for plugin manager display) */
    listHooks(): string[] {
        return Array.from(this.registry.keys());
    }

    /** Get all handlers for a specific hook */
    listHandlers(hook: string): HookRegistration<any>[] {
        return this.registry.get(hook) ?? [];
    }

    /** Get all handlers registered by an owner */
    listByOwner(owner: string): { hook: string; reg: HookRegistration<any> }[] {
        const results: { hook: string; reg: HookRegistration<any> }[] = [];
        for (const [hook, list] of this.registry) {
            for (const reg of list) {
                if (reg.owner === owner) results.push({ hook, reg });
            }
        }
        return results;
    }

    /** Total handler count */
    get size(): number {
        let total = 0;
        for (const list of this.registry.values()) total += list.length;
        return total;
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const hookBus = new HookBus();

// ─── All built-in K-OS hook point definitions ─────────────────────────────────
// Data-driven: every hook point is declared here. Add new hook = add one entry.

export interface HookDefinition {
    hook: string;
    description: string;
    area: string;    // e.g. 'sculpt', 'painter', 'ui', 'theme'
    timing: 'before' | 'after' | 'filter' | 'event';
    dataType: string;    // Description of the data shape
    cancellable: boolean;
}

export const KOS_HOOK_REGISTRY: HookDefinition[] = [
    // ── Sculpt ──────────────────────────────────────────────────────────────
    {
        hook: 'sculpt:brush:stroke:before', area: 'sculpt', timing: 'before', cancellable: true,
        description: 'Before a brush stroke is applied to the mesh. Modify strength/radius/data or cancel.',
        dataType: '{ brush: BrushDef, strength: number, radius: number, position: Vec3, mesh: MeshData }'
    },
    {
        hook: 'sculpt:brush:stroke:after', area: 'sculpt', timing: 'after', cancellable: false,
        description: 'After a brush stroke completes.',
        dataType: '{ brush: BrushDef, verticesAffected: number }'
    },
    {
        hook: 'sculpt:brush:register', area: 'sculpt', timing: 'event', cancellable: false,
        description: 'Fired when a new brush type is registered (built-in or plugin).',
        dataType: 'BrushDef'
    },
    {
        hook: 'sculpt:mesh:subdivide:before', area: 'sculpt', timing: 'before', cancellable: true,
        description: 'Before mesh subdivision. Can cancel or change subdivision level.',
        dataType: '{ level: number, algorithm: string }'
    },
    {
        hook: 'sculpt:mesh:import:after', area: 'sculpt', timing: 'after', cancellable: false,
        description: 'After a mesh is imported into KSculpt.',
        dataType: '{ filename: string, vertexCount: number }'
    },
    {
        hook: 'sculpt:tool:activate', area: 'sculpt', timing: 'event', cancellable: false,
        description: 'When user activates a sculpt tool.',
        dataType: '{ toolId: string }'
    },

    // ── Painter ─────────────────────────────────────────────────────────────
    {
        hook: 'painter:brush:stroke:before', area: 'painter', timing: 'before', cancellable: true,
        description: 'Before a paint stroke. Modify color/opacity/blend or cancel.',
        dataType: '{ brush: PaintBrushDef, color: RGBA, opacity: number, blendMode: string }'
    },
    {
        hook: 'painter:brush:stroke:after', area: 'painter', timing: 'after', cancellable: false,
        description: 'After a paint stroke completes.',
        dataType: '{ brush: PaintBrushDef, pixelsAffected: number }'
    },
    {
        hook: 'painter:layer:create:before', area: 'painter', timing: 'before', cancellable: true,
        description: 'Before a new layer is created. Modify layer config or cancel.',
        dataType: '{ name: string, blendMode: string, opacity: number }'
    },
    {
        hook: 'painter:layer:blend:filter', area: 'painter', timing: 'filter', cancellable: false,
        description: 'Transform the composited layer blend result (custom blending).',
        dataType: '{ pixels: Uint8ClampedArray, width: number, height: number }'
    },
    {
        hook: 'painter:export:before', area: 'painter', timing: 'before', cancellable: true,
        description: 'Before exporting. Can modify format or add metadata.',
        dataType: '{ format: string, path: string, layers: LayerDef[] }'
    },

    // ── Quantum / Simulation ─────────────────────────────────────────────────
    {
        hook: 'quantum:sim:step:before', area: 'quantum', timing: 'before', cancellable: true,
        description: 'Before each simulation tick. Inject custom forces or modify state.',
        dataType: '{ dt: number, particles: ParticleState[], frame: number }'
    },
    {
        hook: 'quantum:sim:step:after', area: 'quantum', timing: 'after', cancellable: false,
        description: 'After each simulation tick.',
        dataType: '{ dt: number, frame: number }'
    },
    {
        hook: 'quantum:node:register', area: 'quantum', timing: 'event', cancellable: false,
        description: 'Fired when a simulation node type is registered.',
        dataType: 'SimNodeDef'
    },
    {
        hook: 'quantum:cfd:start', area: 'quantum', timing: 'event', cancellable: true,
        description: 'Before CFD simulation starts.',
        dataType: '{ resolution: number, viscosity: number }'
    },

    // ── UI / Layout ──────────────────────────────────────────────────────────
    {
        hook: 'ui:panel:open:before', area: 'ui', timing: 'before', cancellable: true,
        description: 'Before a panel opens. Can redirect to different app/mode.',
        dataType: '{ panelId: string, appId: string }'
    },
    {
        hook: 'ui:panel:close:before', area: 'ui', timing: 'before', cancellable: true,
        description: 'Before a panel closes. Can prevent close.',
        dataType: '{ panelId: string }'
    },
    {
        hook: 'ui:command:execute:before', area: 'ui', timing: 'before', cancellable: true,
        description: 'Before any K-OS command executes.',
        dataType: '{ commandId: string, args: unknown[] }'
    },
    {
        hook: 'ui:hotkey:before', area: 'ui', timing: 'before', cancellable: true,
        description: 'Before a hotkey is processed. Custom hotkey handling.',
        dataType: '{ key: string, modifiers: { ctrl: boolean, shift: boolean, alt: boolean } }'
    },

    // ── Theme ────────────────────────────────────────────────────────────────
    {
        hook: 'theme:change:before', area: 'theme', timing: 'before', cancellable: true,
        description: 'Before theme changes. Can redirect to different theme.',
        dataType: '{ fromId: string, toId: string }'
    },
    {
        hook: 'theme:change:after', area: 'theme', timing: 'after', cancellable: false,
        description: 'After theme has changed.',
        dataType: '{ themeId: string, tokens: KOSTokens }'
    },
    {
        hook: 'theme:token:override', area: 'theme', timing: 'filter', cancellable: false,
        description: 'Transform a token value before it is applied to CSS.',
        dataType: '{ cssVar: string, value: string }'
    },

    // ── Asset / File ─────────────────────────────────────────────────────────
    {
        hook: 'asset:import:before', area: 'asset', timing: 'before', cancellable: true,
        description: 'Before any asset is imported. Can transform or reject.',
        dataType: '{ path: string, type: string, size: number }'
    },
    {
        hook: 'asset:export:before', area: 'asset', timing: 'before', cancellable: true,
        description: 'Before any asset is exported.',
        dataType: '{ path: string, type: string, data: unknown }'
    },
    {
        hook: 'asset:thumbnail:generate', area: 'asset', timing: 'filter', cancellable: false,
        description: 'Override thumbnail generation for custom asset types.',
        dataType: '{ assetId: string, width: number, height: number }'
    },

    // ── Kernel / Tauri ───────────────────────────────────────────────────────
    {
        hook: 'kernel:ready', area: 'kernel', timing: 'event', cancellable: false,
        description: 'Tauri kernel backend is ready and connected.',
        dataType: 'null'
    },
    {
        hook: 'kernel:gpu:error', area: 'kernel', timing: 'event', cancellable: false,
        description: 'GPU error detected. Custom error recovery.',
        dataType: '{ error: string, severity: string }'
    },
];
