/**
 * K_OS Theme Provider
 * 
 * React context provider that injects theme CSS variables and provides
 * theme access to all child components.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
    type ThemeStyle,
    type ThemeTokens,
    themeRegistry,
    themeToCssVars,
    themeNames,
    themeDescriptions
} from './theme';
import {
    getAppTheme,
    setAppTheme as persistAppTheme,
    setGlobalTheme as persistGlobalTheme,
    getGlobalTheme,
    getAllThemeOverrides,
    clearThemeOverrides
} from './appThemeConfig';

interface ThemeContextValue {
    /** Current active theme style */
    currentTheme: ThemeStyle;

    /** Current theme tokens */
    tokens: ThemeTokens;

    /** All available theme styles */
    availableThemes: ThemeStyle[];

    /** Get theme display name */
    getThemeName: (style: ThemeStyle) => string;

    /** Get theme description */
    getThemeDescription: (style: ThemeStyle) => string;

    /** Set theme for current app */
    setTheme: (style: ThemeStyle) => void;

    /** Set global theme (applies to all apps) */
    setGlobalTheme: (style: ThemeStyle) => void;

    /** Get global theme if set */
    globalTheme: ThemeStyle | null;

    /** Current app ID */
    appId: string;

    /** Get all overrides */
    getOverrides: () => Record<string, ThemeStyle>;

    /** Reset all overrides */
    resetToDefaults: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
    /** Current app ID (e.g., 'ksculpt', 'kgraphos') */
    appId: string;

    /** Optional theme override (bypasses persistence) */
    themeOverride?: ThemeStyle;

    children: React.ReactNode;
}

/**
 * Injects CSS variables to document root
 */
function injectCssVariables(tokens: ThemeTokens): void {
    const cssVars = themeToCssVars(tokens);
    const root = document.documentElement;

    Object.entries(cssVars).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
}

export function ThemeProvider({ appId, themeOverride, children }: ThemeProviderProps) {
    const [currentTheme, setCurrentThemeState] = useState<ThemeStyle>(() => {
        if (themeOverride) return themeOverride;
        return getAppTheme(appId);
    });

    const [globalTheme, setGlobalThemeState] = useState<ThemeStyle | null>(() => {
        return getGlobalTheme();
    });

    const tokens = useMemo(() => themeRegistry[currentTheme], [currentTheme]);

    // Inject CSS variables when theme changes
    useEffect(() => {
        injectCssVariables(tokens);

        // Also set a data attribute for CSS selectors
        document.documentElement.setAttribute('data-kos-theme', currentTheme);
    }, [tokens, currentTheme]);

    // Update theme when app changes
    useEffect(() => {
        if (!themeOverride) {
            const newTheme = getAppTheme(appId);
            setCurrentThemeState(newTheme);
        }
    }, [appId, themeOverride]);

    const setTheme = useCallback((style: ThemeStyle) => {
        setCurrentThemeState(style);
        persistAppTheme(appId, style);
    }, [appId]);

    const setGlobalTheme = useCallback((style: ThemeStyle) => {
        setGlobalThemeState(style);
        persistGlobalTheme(style);
        // Also apply immediately
        setCurrentThemeState(style);
    }, []);

    const getThemeName = useCallback((style: ThemeStyle) => {
        return themeNames[style];
    }, []);

    const getThemeDescription = useCallback((style: ThemeStyle) => {
        return themeDescriptions[style];
    }, []);

    const getOverrides = useCallback(() => {
        return getAllThemeOverrides();
    }, []);

    const resetToDefaults = useCallback(() => {
        clearThemeOverrides();
        setGlobalThemeState(null);
        const defaultTheme = getAppTheme(appId);
        setCurrentThemeState(defaultTheme);
    }, [appId]);

    const availableThemes: ThemeStyle[] = ['classic', 'glass', 'neon', 'minimal'];

    const value: ThemeContextValue = useMemo(() => ({
        currentTheme,
        tokens,
        availableThemes,
        getThemeName,
        getThemeDescription,
        setTheme,
        setGlobalTheme,
        globalTheme,
        appId,
        getOverrides,
        resetToDefaults,
    }), [
        currentTheme,
        tokens,
        getThemeName,
        getThemeDescription,
        setTheme,
        setGlobalTheme,
        globalTheme,
        appId,
        getOverrides,
        resetToDefaults,
    ]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

/**
 * Hook to safely access theme context (returns null if not in provider)
 */
export function useThemeSafe(): ThemeContextValue | null {
    return useContext(ThemeContext);
}

/**
 * Hook to get just the current tokens (for performance)
 */
export function useThemeTokens(): ThemeTokens {
    const context = useTheme();
    return context.tokens;
}

/**
 * Component that auto-applies glass effect based on theme
 */
export function GlassPanel({
    children,
    className = '',
    intensity = 'normal'
}: {
    children: React.ReactNode;
    className?: string;
    intensity?: 'light' | 'normal' | 'heavy';
}) {
    const { currentTheme, tokens } = useTheme();

    const blurValues = {
        light: '10px',
        normal: tokens.blur,
        heavy: '30px',
    };

    const blur = currentTheme === 'glass' ? blurValues[intensity] : '0px';

    return (
        <div
            className={className}
            style={{
                backdropFilter: `blur(${blur})`,
                WebkitBackdropFilter: `blur(${blur})`,
            }}
        >
            {children}
        </div>
    );
}
