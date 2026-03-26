/**
 * extensionApi.ts — K-OS Extension / Plugin Public API
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SURFACE THAT THIRD-PARTY PLUGINS CALL INTO.
 *
 * Inspired by VS Code's extension API. Plugins:
 *   1. Declare a JSON manifest (or call registerExtension() at runtime)
 *   2. Register commands, panels, toolbar items via the API object
 *   3. Hook into lifecycle events (activate, deactivate, themeChange)
 *   4. Optionally inject GLSL shaders onto UI panels
 *   5. Optionally add custom theme tokens under their own namespace
 *
 * Security model (browser): extensions run in the same JS context but
 * can only interact with K-OS through this API surface.
 *
 * Extension example:
 * ─────────────────
 *   // my-plugin/index.ts
 *   import { kosExtensionApi } from '@/systems/ui-engine/extensionApi';
 *
 *   export const manifest: ExtensionManifest = {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'Does cool things',
 *     author: 'Alice',
 *     contributes: {
 *       commands:  [...],
 *       panels:    [...],
 *       themes:    [...],
 *       shaders:   [...],
 *     }
 *   };
 *
 *   export async function activate(api: KOSExtensionApi) {
 *     api.commands.register({ id: 'my-plugin.hello', label: 'Say Hello',
 *       action: () => console.log('Hello from plugin!') });
 *     api.ui.injectPanel({ location: 'left', component: MyPanel });
 *   }
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type { KOSTokens } from './tokens';

// ─── Manifest Types ───────────────────────────────────────────────────────────

export interface CommandContribution {
    id: string;
    label: string;
    shortcut?: string;
    icon?: string;   // lucide icon name
    category?: string;
}

export interface PanelContribution {
    id: string;
    label: string;
    icon?: string;
    location: 'left' | 'right' | 'bottom' | 'float' | 'toolbar' | 'statusbar';
    minWidth?: number;
    minHeight?: number;
}

export interface ThemeContribution {
    id: string;
    label: string;
    description?: string;
    /** Partial KOSTokens — merged onto base Forge theme */
    tokens: Partial<KOSTokens>;
}

export interface ShaderContribution {
    id: string;
    label: string;
    /** Target panel slot or 'global' */
    target: string;
    /** GLSL fragment shader source */
    glsl: string;
    /** Uniform defaults */
    uniforms?: Record<string, number | number[]>;
}

export interface MenuContribution {
    id: string;
    parentMenu: string;   // e.g. 'file', 'edit', 'view', 'help'
    label: string;
    icon?: string;
    commandId: string;
    separator?: boolean;
}

export interface TokenContribution {
    /** Extension namespace (will be prefixed --k-ext-<ns>-<key>) */
    namespace: string;
    tokens: Record<string, string>;
}

export interface FontContribution {
    family: string;
    /** URL or Google Fonts name */
    source: string;
    /** Replace which system font: 'sans' | 'mono' | 'display' */
    replaces?: 'sans' | 'mono' | 'display';
}

export interface ExtensionContributions {
    commands?: CommandContribution[];
    panels?: PanelContribution[];
    themes?: ThemeContribution[];
    shaders?: ShaderContribution[];
    menus?: MenuContribution[];
    tokens?: TokenContribution[];
    fonts?: FontContribution[];
}

export type ExtensionStatus = 'inactive' | 'activating' | 'active' | 'error' | 'disabled';

export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    icon?: string;
    tags?: string[];
    /** Minimum K-OS version required */
    minKosVersion?: string;
    contributes?: ExtensionContributions;
    /** Permission IDs requested from app APIs (e.g. 'sculpt.brush.add') */
    permissions?: string[];
    /** App APIs this plugin needs access to */
    requiresApps?: string[];
}

// ─── Runtime Registration Types ───────────────────────────────────────────────

export interface RegisteredCommand extends CommandContribution {
    action: (...args: any[]) => void | Promise<void>;
}

export interface RegisteredPanel extends PanelContribution {
    component: React.ComponentType<any>;
    props?: Record<string, any>;
}

export interface RegisteredTheme extends ThemeContribution { }

export interface RegisteredShader extends ShaderContribution {
    compiled?: WebGLProgram;
}

// ─── Extension API Surface ────────────────────────────────────────────────────

export interface KOSCommandAPI {
    /** Register a command callable from command palette / shortcuts */
    register(cmd: RegisteredCommand): void;
    /** Execute a command by ID */
    execute(id: string, ...args: any[]): Promise<void>;
    /** Get all registered commands */
    list(): RegisteredCommand[];
}

export interface KOSThemeAPI {
    /** Register a new theme */
    register(theme: ThemeContribution): void;
    /** Get the currently active theme tokens */
    getActive(): KOSTokens;
    /** Set active theme by ID */
    setTheme(id: string): void;
    /** Get all registered themes */
    list(): string[];
    /** Subscribe to theme changes */
    onChange(cb: (tokens: KOSTokens) => void): () => void;
}

export interface KOSPanelAPI {
    /** Register a UI panel injectable into a layout slot */
    register(panel: RegisteredPanel): void;
    /** Show a panel */
    show(id: string): void;
    /** Hide a panel */
    hide(id: string): void;
    /** List all registered panels */
    list(): RegisteredPanel[];
}

export interface KOSShaderAPI {
    /** Register a GLSL shader layer onto a UI panel slot */
    register(shader: RegisteredShader): void;
    /** Remove a shader overlay */
    remove(id: string): void;
    /** Get all active shaders for a target slot */
    getForTarget(target: string): RegisteredShader[];
    /** Update shader uniform value live */
    setUniform(shaderId: string, name: string, value: number | number[]): void;
}

export interface KOSFontAPI {
    /** Load a font from URL or Google Fonts */
    load(font: FontContribution): Promise<void>;
    /** Set the active font for a role */
    setFont(role: 'sans' | 'mono' | 'display', family: string): void;
    /** Get the current font family string for a role */
    getFont(role: 'sans' | 'mono' | 'display'): string;
}

export interface KOSTokenAPI {
    /** Override individual token values */
    set(cssVar: string, value: string): void;
    /** Get current token value */
    get(cssVar: string): string;
    /** Register a namespace of custom tokens */
    registerNamespace(ns: string, tokens: Record<string, string>): void;
    /** Reset all extension-injected tokens */
    resetExtensions(): void;
}

export interface KOSStorageAPI {
    /** Get extension-scoped value */
    get<T>(key: string): T | null;
    /** Set extension-scoped value (persisted to localStorage) */
    set<T>(key: string, value: T): void;
    /** Remove key */
    remove(key: string): void;
}

export interface KOSEventAPI {
    /** Emit a named event */
    emit(event: string, data?: any): void;
    /** Listen for a named event */
    on(event: string, cb: (data: any) => void): () => void;
}

import type { HookHandler } from './hooks/HookBus';
import type { SlotProps } from './slots/SlotSystem';
import type { AppApiMap } from './appApi/AppApiRegistry';

export interface KOSHookAPI {
    /**
     * Register a hook handler. Returns unsubscribe function.
     * The hook is automatically cleaned up when the extension deactivates.
     */
    on<T = unknown>(
        hook: string,
        handler: HookHandler<T>,
        opts?: { priority?: number }
    ): () => void;
    /** Fire-and-forget: emit event data to all hook handlers */
    fire<T = unknown>(hook: string, data: T): void;
    /** List all available K-OS hook points */
    listAvailable(): string[];
    /** Get handler count for a specific hook */
    handlerCount(hook: string): number;
}

export interface KOSSlotAPI {
    /**
     * Inject a React component into a named UI slot.
     * Returns unregister function (auto-called on extension deactivate).
     */
    register(
        slotId: string,
        component: React.ComponentType<SlotProps>,
        opts?: { priority?: number; props?: Record<string, unknown> }
    ): () => void;
    /** List all available K-OS UI slots */
    listAvailable(): string[];
    /** List slots this extension has filled */
    listOwned(): string[];
}

export interface KOSAppAPI {
    /**
     * Get a specific app's extension API.
     * Returns null if that app is not currently mounted.
     * @example api.app.get('ksculpt')?.addBrush(def)
     */
    get<K extends keyof AppApiMap>(appId: K): AppApiMap[K] | null;
    /**
     * Wait for an app to mount, then call the callback.
     * Returns an unsubscribe function.
     */
    whenReady<K extends keyof AppApiMap>(
        appId: K,
        cb: (api: AppApiMap[K]) => void
    ): () => void;
    /** List currently mounted app IDs */
    mounted(): string[];
}

export interface KOSExtensionApi {
    /** Extension ID this API instance belongs to */
    readonly extensionId: string;

    commands: KOSCommandAPI;
    theme: KOSThemeAPI;
    panels: KOSPanelAPI;
    shaders: KOSShaderAPI;
    fonts: KOSFontAPI;
    tokens: KOSTokenAPI;
    storage: KOSStorageAPI;
    events: KOSEventAPI;
    /** Hook into any K-OS application event (sculpt:brush:stroke:before, etc.) */
    hooks: KOSHookAPI;
    /** Inject React components into named UI slots (sculpt.toolbar.right, etc.) */
    slots: KOSSlotAPI;
    /** Access running app APIs (KSculpt, KPainter, KQuantum, etc.) */
    app: KOSAppAPI;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export interface ExtensionModule {
    manifest: ExtensionManifest;
    activate?: (api: KOSExtensionApi) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
}

// ─── Runtime extension record ─────────────────────────────────────────────────

export interface RuntimeExtension {
    manifest: ExtensionManifest;
    status: ExtensionStatus;
    error?: string;
    api?: KOSExtensionApi;
    module?: ExtensionModule;
    /** Registered contributions at runtime */
    runtime: {
        commands: RegisteredCommand[];
        panels: RegisteredPanel[];
        themes: RegisteredTheme[];
        shaders: RegisteredShader[];
    };
}
