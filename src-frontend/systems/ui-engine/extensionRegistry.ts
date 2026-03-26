/**
 * extensionRegistry.ts — K-OS Extension Runtime Registry
 *
 * Central store for all installed extensions. Handles:
 *   - Extension registration (from manifest or runtime object)
 *   - Lifecycle: activate → active → deactivate
 *   - Building the KOSExtensionApi instance given to each plugin
 *   - Persisting enable/disable state to localStorage
 *   - Cross-extension event bus (extensions can talk to each other)
 */

import React from 'react';
import {
    type ExtensionManifest, type ExtensionModule, type RuntimeExtension,
    type KOSExtensionApi, type RegisteredCommand, type RegisteredPanel,
    type RegisteredTheme, type RegisteredShader, type FontContribution,
    type ThemeContribution,
} from './extensionApi';
import {
    type KOSTokens, BUILTIN_THEMES, DEFAULT_THEME_ID,
    mergeTheme, applyTokensToRoot, tokensToCssVars, parseTheme, serializeTheme,
} from './tokens';
import { hookBus, KOS_HOOK_REGISTRY } from './hooks/HookBus';
import { slotRegistry, KOS_SLOT_DEFINITIONS } from './slots/SlotSystem';
import { appApiRegistry } from './appApi/AppApiRegistry';

// ─── Tiny event emitter ───────────────────────────────────────────────────────

type Listener = (data: any) => void;

class EventBus {
    private _listeners: Map<string, Set<Listener>> = new Map();

    emit(event: string, data?: any): void {
        this._listeners.get(event)?.forEach(l => { try { l(data); } catch { } });
    }

    on(event: string, cb: Listener): () => void {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event)!.add(cb);
        return () => this._listeners.get(event)?.delete(cb);
    }
}

const globalBus = new EventBus();

// ─── Storage keys ─────────────────────────────────────────────────────────────

const EXT_DISABLED_KEY = 'kos_ext_disabled';
const EXT_ACTIVE_THEME = 'kos_active_theme_id';
const EXT_TOKEN_OVERRIDES = 'kos_token_overrides';
const CUSTOM_FONTS_KEY = 'kos_custom_fonts';

// ─── Registry Class ───────────────────────────────────────────────────────────

export class KOSExtensionRegistry {
    private extensions: Map<string, RuntimeExtension> = new Map();
    private commands: Map<string, RegisteredCommand> = new Map();
    private panels: Map<string, RegisteredPanel> = new Map();
    private themes: Map<string, KOSTokens> = new Map();
    private shaders: Map<string, RegisteredShader> = new Map();

    private activeThemeId: string;
    private tokenOverrides: Record<string, string> = {};
    private fontState: Record<'sans' | 'mono' | 'display', string>;
    private themeListeners: Set<(tokens: KOSTokens) => void> = new Set();

    constructor() {
        // Load active theme
        this.activeThemeId = localStorage.getItem(EXT_ACTIVE_THEME) ?? DEFAULT_THEME_ID;

        // Load token overrides
        try {
            const raw = localStorage.getItem(EXT_TOKEN_OVERRIDES);
            if (raw) this.tokenOverrides = JSON.parse(raw);
        } catch { }

        // Load custom fonts
        const defaultFonts = {
            sans: '"Inter", "Segoe UI", system-ui, sans-serif',
            mono: '"JetBrains Mono", "Fira Code", monospace',
            display: '"Inter", system-ui, sans-serif',
        };
        try {
            const raw = localStorage.getItem(CUSTOM_FONTS_KEY);
            this.fontState = raw ? { ...defaultFonts, ...JSON.parse(raw) } : defaultFonts;
        } catch {
            this.fontState = defaultFonts;
        }

        // Register built-in themes
        for (const [id, theme] of Object.entries(BUILTIN_THEMES)) {
            this.themes.set(id, theme);
        }
    }

    // ─── Theme API impl ───────────────────────────────────────────────────────

    getActiveTheme(): KOSTokens {
        let base = this.themes.get(this.activeThemeId) ?? BUILTIN_THEMES[DEFAULT_THEME_ID];
        // Apply font state to typography
        base = {
            ...base,
            typography: {
                ...base.typography,
                fontSans: this.fontState.sans,
                fontMono: this.fontState.mono,
                fontDisplay: this.fontState.display,
            },
        };
        return base;
    }

    getActiveThemeId(): string { return this.activeThemeId; }

    setActiveTheme(id: string): void {
        if (!this.themes.has(id)) return;
        this.activeThemeId = id;
        localStorage.setItem(EXT_ACTIVE_THEME, id);
        const tokens = this.getActiveTheme();
        applyTokensToRoot(tokens);
        this.applyTokenOverrides();
        this.themeListeners.forEach(l => l(tokens));
        globalBus.emit('theme:changed', { id, tokens });
    }

    registerTheme(theme: KOSTokens): void {
        this.themes.set(theme.id, theme);
        globalBus.emit('theme:registered', { id: theme.id });
    }

    listThemes(): KOSTokens[] {
        return Array.from(this.themes.values());
    }

    onThemeChange(cb: (tokens: KOSTokens) => void): () => void {
        this.themeListeners.add(cb);
        return () => this.themeListeners.delete(cb);
    }

    // ─── Token override API ───────────────────────────────────────────────────

    setTokenOverride(cssVar: string, value: string): void {
        this.tokenOverrides[cssVar] = value;
        document.documentElement.style.setProperty(cssVar, value);
        localStorage.setItem(EXT_TOKEN_OVERRIDES, JSON.stringify(this.tokenOverrides));
        globalBus.emit('token:override', { cssVar, value });
    }

    getTokenValue(cssVar: string): string {
        return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    }

    resetTokenOverrides(): void {
        this.tokenOverrides = {};
        localStorage.removeItem(EXT_TOKEN_OVERRIDES);
        // Re-apply base theme
        applyTokensToRoot(this.getActiveTheme());
        globalBus.emit('token:reset', {});
    }

    private applyTokenOverrides(): void {
        for (const [k, v] of Object.entries(this.tokenOverrides)) {
            document.documentElement.style.setProperty(k, v);
        }
    }

    registerTokenNamespace(ns: string, tokens: Record<string, string>): void {
        for (const [k, v] of Object.entries(tokens)) {
            const cssVar = `--k-ext-${ns}-${k}`;
            document.documentElement.style.setProperty(cssVar, v);
        }
    }

    // ─── Font API ─────────────────────────────────────────────────────────────

    async loadFont(font: FontContribution): Promise<void> {
        const isGoogleFont = !font.source.startsWith('http') || font.source.includes('fonts.googleapis');
        const url = isGoogleFont
            ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@300;400;500;600;700;900&display=swap`
            : font.source;

        if (!document.querySelector(`link[data-kos-font="${font.family}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.setAttribute('data-kos-font', font.family);
            document.head.appendChild(link);
        }

        if (font.replaces) {
            this.setFont(font.replaces, `"${font.family}", ${this.fontState[font.replaces]}`);
        }
    }

    setFont(role: 'sans' | 'mono' | 'display', family: string): void {
        this.fontState[role] = family;
        localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(this.fontState));
        // Apply immediately via CSS var
        const varMap: Record<string, string> = {
            sans: '--kos-font-sans', mono: '--kos-font-mono', display: '--kos-font-display'
        };
        document.documentElement.style.setProperty(varMap[role], family);
        globalBus.emit('font:changed', { role, family });
    }

    getFont(role: 'sans' | 'mono' | 'display'): string {
        return this.fontState[role];
    }

    // ─── Command API ──────────────────────────────────────────────────────────

    registerCommand(cmd: RegisteredCommand): void {
        this.commands.set(cmd.id, cmd);
        globalBus.emit('command:registered', { id: cmd.id });
    }

    async executeCommand(id: string, ...args: any[]): Promise<void> {
        const cmd = this.commands.get(id);
        if (!cmd) throw new Error(`Command not found: ${id}`);
        await cmd.action(...args);
    }

    listCommands(): RegisteredCommand[] {
        return Array.from(this.commands.values());
    }

    // ─── Panel API ────────────────────────────────────────────────────────────

    registerPanel(panel: RegisteredPanel): void {
        this.panels.set(panel.id, panel);
        globalBus.emit('panel:registered', { id: panel.id });
    }

    listPanels(): RegisteredPanel[] {
        return Array.from(this.panels.values());
    }

    getPanelsForLocation(loc: string): RegisteredPanel[] {
        return Array.from(this.panels.values()).filter(p => p.location === loc);
    }

    // ─── Shader API ───────────────────────────────────────────────────────────

    registerShader(shader: RegisteredShader): void {
        this.shaders.set(shader.id, shader);
        globalBus.emit('shader:registered', { id: shader.id, target: shader.target });
    }

    removeShader(id: string): void {
        this.shaders.delete(id);
        globalBus.emit('shader:removed', { id });
    }

    getShadersForTarget(target: string): RegisteredShader[] {
        return Array.from(this.shaders.values()).filter(s => s.target === target || s.target === 'global');
    }

    setShaderUniform(shaderId: string, name: string, value: number | number[]): void {
        const shader = this.shaders.get(shaderId);
        if (!shader) return;
        if (!shader.uniforms) shader.uniforms = {};
        shader.uniforms[name] = value;
        globalBus.emit('shader:uniform', { shaderId, name, value });
    }

    // ─── Extension Lifecycle ──────────────────────────────────────────────────

    private getDisabledSet(): Set<string> {
        try {
            const raw = localStorage.getItem(EXT_DISABLED_KEY);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch { return new Set(); }
    }

    private saveDisabledSet(disabled: Set<string>): void {
        localStorage.setItem(EXT_DISABLED_KEY, JSON.stringify([...disabled]));
    }

    isEnabled(id: string): boolean {
        return !this.getDisabledSet().has(id);
    }

    setEnabled(id: string, enabled: boolean): void {
        const disabled = this.getDisabledSet();
        if (enabled) { disabled.delete(id); } else { disabled.add(id); }
        this.saveDisabledSet(disabled);
        globalBus.emit('extension:enabled', { id, enabled });
    }

    async registerExtension(mod: ExtensionModule): Promise<void> {
        const { manifest, activate, deactivate } = mod;
        const ext: RuntimeExtension = {
            manifest,
            status: 'inactive',
            module: mod,
            runtime: { commands: [], panels: [], themes: [], shaders: [] },
        };
        this.extensions.set(manifest.id, ext);

        if (!this.isEnabled(manifest.id)) {
            ext.status = 'disabled';
            return;
        }

        if (!activate) { ext.status = 'active'; return; }

        ext.status = 'activating';
        try {
            const api = this.buildApi(manifest.id, ext);
            ext.api = api;
            await activate(api);
            ext.status = 'active';
            globalBus.emit('extension:activated', { id: manifest.id });
        } catch (err: any) {
            ext.status = 'error';
            ext.error = String(err?.message ?? err);
            console.error(`[KOS] Extension ${manifest.id} failed to activate:`, err);
        }
    }

    async deactivateExtension(id: string): Promise<void> {
        const ext = this.extensions.get(id);
        if (!ext || ext.status !== 'active') return;
        if (ext.module?.deactivate) await ext.module.deactivate();
        ext.status = 'inactive';
        // Clean up runtime contributions
        for (const cmd of ext.runtime.commands) this.commands.delete(cmd.id);
        for (const panel of ext.runtime.panels) this.panels.delete(panel.id);
        for (const shader of ext.runtime.shaders) this.shaders.delete(shader.id);
        // Clean up hook handlers and slot components owned by this extension
        hookBus.removeOwner(id);
        slotRegistry.removeOwner(id);
        globalBus.emit('extension:deactivated', { id });
    }

    listExtensions(): RuntimeExtension[] {
        return Array.from(this.extensions.values());
    }

    getExtension(id: string): RuntimeExtension | undefined {
        return this.extensions.get(id);
    }

    // ─── API Builder ──────────────────────────────────────────────────────────

    private buildApi(extId: string, ext: RuntimeExtension): KOSExtensionApi {
        const self = this;

        const storagePrefix = `kos_ext_${extId}_`;

        return {
            extensionId: extId,

            commands: {
                register(cmd) {
                    const full = { ...cmd, action: cmd.action };
                    self.registerCommand(full);
                    ext.runtime.commands.push(full);
                },
                execute: (id, ...args) => self.executeCommand(id, ...args),
                list: () => self.listCommands(),
            },

            theme: {
                register(contribution) {
                    const full = mergeTheme(BUILTIN_THEMES[DEFAULT_THEME_ID], contribution.tokens as any);
                    full.id = contribution.id;
                    full.name = contribution.label;
                    self.registerTheme(full);
                    ext.runtime.themes.push(contribution as any);
                },
                getActive: () => self.getActiveTheme(),
                setTheme: (id) => self.setActiveTheme(id),
                list: () => Array.from(self.themes.keys()),
                onChange: (cb) => self.onThemeChange(cb),
            },

            panels: {
                register(panel) {
                    self.registerPanel(panel);
                    ext.runtime.panels.push(panel);
                },
                show: (id) => globalBus.emit('panel:show', { id }),
                hide: (id) => globalBus.emit('panel:hide', { id }),
                list: () => self.listPanels(),
            },

            shaders: {
                register(shader) {
                    self.registerShader(shader);
                    ext.runtime.shaders.push(shader);
                },
                remove: (id) => self.removeShader(id),
                getForTarget: (t) => self.getShadersForTarget(t),
                setUniform: (id, name, val) => self.setShaderUniform(id, name, val),
            },

            fonts: {
                load: (f) => self.loadFont(f),
                setFont: (role, fam) => self.setFont(role, fam),
                getFont: (role) => self.getFont(role),
            },

            tokens: {
                set: (cssVar, val) => self.setTokenOverride(cssVar, val),
                get: (cssVar) => self.getTokenValue(cssVar),
                registerNamespace: (ns, tokens) => self.registerTokenNamespace(ns, tokens),
                resetExtensions: () => self.resetTokenOverrides(),
            },

            storage: {
                get<T>(key: string): T | null {
                    try {
                        const raw = localStorage.getItem(storagePrefix + key);
                        return raw ? JSON.parse(raw) : null;
                    } catch { return null; }
                },
                set<T>(key: string, value: T): void {
                    localStorage.setItem(storagePrefix + key, JSON.stringify(value));
                },
                remove(key: string): void {
                    localStorage.removeItem(storagePrefix + key);
                },
            },

            events: {
                emit: (event, data) => globalBus.emit(`ext:${extId}:${event}`, data),
                on: (event, cb) => globalBus.on(`ext:${extId}:${event}`, cb),
            },

            // ──────────────────────────────────────────────────────────────
            // HOOKS — intercept any K-OS operation
            // ──────────────────────────────────────────────────────────────
            hooks: {
                on(hook, handler, opts = {}) {
                    return hookBus.on(hook, handler, { ...opts, owner: extId });
                },
                fire(hook, data) {
                    hookBus.fire(hook, data);
                },
                listAvailable() {
                    return KOS_HOOK_REGISTRY.map(h => h.hook);
                },
                handlerCount(hook) {
                    return hookBus.listHandlers(hook).length;
                },
            },

            // ──────────────────────────────────────────────────────────────
            // SLOTS — inject React components into app UIs
            // ──────────────────────────────────────────────────────────────
            slots: {
                register(slotId, component, opts = {}) {
                    return slotRegistry.register(slotId, component, { ...opts, owner: extId });
                },
                listAvailable() {
                    return KOS_SLOT_DEFINITIONS.map(s => s.id);
                },
                listOwned() {
                    return slotRegistry.listByOwner(extId).map(e => e.slotId);
                },
            },

            // ──────────────────────────────────────────────────────────────
            // APP — access live app extension APIs
            // ──────────────────────────────────────────────────────────────
            app: {
                get(appId) {
                    return appApiRegistry.get(appId);
                },
                whenReady(appId, cb) {
                    return appApiRegistry.whenMounted(appId, cb);
                },
                mounted() {
                    return appApiRegistry.mountedApps();
                },
            },
        };
    }

    // ─── Global access ────────────────────────────────────────────────────────

    get bus(): EventBus { return globalBus; }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const kosRegistry = new KOSExtensionRegistry();

/** Boot — apply stored theme immediately on startup */
export function bootThemeEngine(): void {
    const tokens = kosRegistry.getActiveTheme();
    applyTokensToRoot(tokens);
}

/** Convenience: get current theme as CSS custom properties */
export function getCurrentCssVars(): Record<string, string> {
    return tokensToCssVars(kosRegistry.getActiveTheme());
}
