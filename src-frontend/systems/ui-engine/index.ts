/**
 * index.ts — K-OS UI Engine
 *
 * The unified extensible UI engine for K-OS.
 * Import from here throughout the app:
 *
 *   import { kosRegistry, useKOSTheme, ThemeStudio, hookBus, Slot, appApiRegistry } from '@/systems/ui-engine';
 */

// ─── Tokens ───────────────────────────────────────────────────────────────────
export * from './tokens';

// ─── Extension API types ──────────────────────────────────────────────────────
export * from './extensionApi';

// ─── Registry (singleton) ─────────────────────────────────────────────────────
export { kosRegistry, bootThemeEngine, getCurrentCssVars } from './extensionRegistry';

// ─── Hook Bus ─────────────────────────────────────────────────────────────────
export { hookBus, HookBus, KOS_HOOK_REGISTRY } from './hooks/HookBus';
export type { HookContext, HookHandler, HookRegistration, HookDefinition } from './hooks/HookBus';

// ─── Slot System ──────────────────────────────────────────────────────────────
export { Slot, SlotProvider, slotRegistry, useSlot, useSlotRegistry, KOS_SLOT_DEFINITIONS } from './slots/SlotSystem';
export type { SlotProps, SlotComponent, SlotDefinition } from './slots/SlotSystem';

// ─── App Extension APIs ───────────────────────────────────────────────────────
export { appApiRegistry, APP_CATALOGUE } from './appApi/AppApiRegistry';
export type {
    AppApiMap, AppMetadata, AppPermission,
    KSculptApi, KPainterApi, KQuantumApi, KRetopoApi, KGraphosApi,
    SculptBrushDef, SculptStrokeContext,
    PaintBrushDef, PaintStrokeContext,
    SimNodeDef, SimStepContext,
} from './appApi/AppApiRegistry';

// ─── Font system ──────────────────────────────────────────────────────────────
export {
    FONT_CATALOGUE,
    loadGoogleFont, loadFontByFamily,
    loadFontState, saveFontState, applyFontState,
    generateFontPreview,
} from './fontSystem';
export type { FontEntry, FontState } from './fontSystem';

// ─── Shader layer ─────────────────────────────────────────────────────────────
export {
    BUILTIN_SHADER_PRESETS,
    ShaderLayer, shaderManager,
    useShaderLayer,
} from './shaderLayer';
export type { ShaderLayerOptions, BuiltinShaderPreset } from './shaderLayer';

// ─── Studio components ────────────────────────────────────────────────────────
export { ThemeStudio }     from './studio/ThemeStudio';
export { ExtensionManager} from './studio/ExtensionManager';
export { PluginMatrix }    from './studio/PluginMatrix';

// ─── React hooks ──────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { kosRegistry as _reg } from './extensionRegistry';
import type { KOSTokens }      from './tokens';
import type { RuntimeExtension } from './extensionApi';

/**
 * Primary theme hook — returns current token set + setter + list.
 */
export function useKOSTheme() {
    const [tokens, setTokens] = useState<KOSTokens>(() => _reg.getActiveTheme());
    const [themeId, setThemeId] = useState(() => _reg.getActiveThemeId());

    useEffect(() => {
        return _reg.onThemeChange(t => {
            setTokens(t);
            setThemeId(t.id);
        });
    }, []);

    const setTheme = useCallback((id: string) => { _reg.setActiveTheme(id); }, []);

    return { tokens, themeId, setTheme, availableThemes: _reg.listThemes() };
}

/**
 * Live token override hook — injects a single CSS variable while mounted.
 */
export function useTokenOverride(cssVar: string, value: string): void {
    useEffect(() => { _reg.setTokenOverride(cssVar, value); }, [cssVar, value]);
}

/**
 * Extensions list hook — re-renders on install/uninstall/toggle.
 */
export function useExtensions(): RuntimeExtension[] {
    const [list, setList] = useState<RuntimeExtension[]>(() => _reg.listExtensions());

    useEffect(() => {
        const refresh = () => setList([..._reg.listExtensions()]);
        const unsubs = [
            _reg.bus.on('extension:activated',   refresh),
            _reg.bus.on('extension:deactivated', refresh),
            _reg.bus.on('extension:enabled',     refresh),
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    return list;
}

/**
 * Boot function — call once at app startup synchronously before React mounts.
 * Applies stored theme + font state to the DOM immediately (no flash).
 */
export function bootUIEngine(): void {
    import('./extensionRegistry').then(({ bootThemeEngine }) => bootThemeEngine());
    import('./fontSystem').then(({ loadFontState, applyFontState }) => {
        applyFontState(loadFontState());
    });
}
