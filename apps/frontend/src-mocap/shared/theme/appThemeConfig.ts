/**
 * Per-App Theme Configuration
 * 
 * Maps each K_OS app to its default theme style.
 * Users can override these defaults in settings.
 */

import type { ThemeStyle } from './theme';

/**
 * Default theme assignments for each app.
 * These can be overridden by user preferences stored in localStorage.
 */
export const defaultAppThemes: Record<string, ThemeStyle> = {
    // Sculpting / Modeling
    ksculpt: 'classic',
    ktecton: 'classic',
    kgreeble: 'classic',
    kcloner: 'classic',
    kscatter: 'classic',

    // Surface / Texturing
    kgraphos: 'glass',
    kpaint: 'glass',
    autopbr: 'glass',

    // Animation / Simulation
    kanim: 'neon',
    kquantum: 'neon',
    ksim: 'neon',

    // Utility / General
    katlas: 'minimal',
    kinspect: 'minimal',
    krender: 'minimal',
    kconsole: 'minimal',

    // Default fallback
    default: 'classic',
};

/**
 * Storage key for user theme overrides
 */
export const THEME_STORAGE_KEY = 'kos-theme-overrides';

/**
 * Storage key for global theme preference (used when no app-specific theme set)
 */
export const GLOBAL_THEME_KEY = 'kos-global-theme';

/**
 * Get the theme for a specific app, considering user overrides
 */
export function getAppTheme(appId: string): ThemeStyle {
    // Check localStorage for user override
    try {
        const overrides = localStorage.getItem(THEME_STORAGE_KEY);
        if (overrides) {
            const parsed = JSON.parse(overrides) as Record<string, ThemeStyle>;
            if (parsed[appId]) {
                return parsed[appId];
            }
        }

        // Check for global theme preference
        const globalTheme = localStorage.getItem(GLOBAL_THEME_KEY);
        if (globalTheme && ['classic', 'glass', 'neon', 'minimal'].includes(globalTheme)) {
            return globalTheme as ThemeStyle;
        }
    } catch {
        // Ignore localStorage errors
    }

    // Fall back to default
    return defaultAppThemes[appId] || defaultAppThemes.default;
}

/**
 * Set the theme override for a specific app
 */
export function setAppTheme(appId: string, theme: ThemeStyle): void {
    try {
        const overrides = localStorage.getItem(THEME_STORAGE_KEY);
        const parsed = overrides ? JSON.parse(overrides) : {};
        parsed[appId] = theme;
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Set the global theme preference (applies to all apps without specific override)
 */
export function setGlobalTheme(theme: ThemeStyle): void {
    try {
        localStorage.setItem(GLOBAL_THEME_KEY, theme);
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Get the global theme preference
 */
export function getGlobalTheme(): ThemeStyle | null {
    try {
        const theme = localStorage.getItem(GLOBAL_THEME_KEY);
        if (theme && ['classic', 'glass', 'neon', 'minimal'].includes(theme)) {
            return theme as ThemeStyle;
        }
    } catch {
        // Ignore localStorage errors
    }
    return null;
}

/**
 * Clear all theme overrides (reset to defaults)
 */
export function clearThemeOverrides(): void {
    try {
        localStorage.removeItem(THEME_STORAGE_KEY);
        localStorage.removeItem(GLOBAL_THEME_KEY);
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Get all current theme overrides
 */
export function getAllThemeOverrides(): Record<string, ThemeStyle> {
    try {
        const overrides = localStorage.getItem(THEME_STORAGE_KEY);
        return overrides ? JSON.parse(overrides) : {};
    } catch {
        return {};
    }
}
