/**
 * K_OS Multi-Style Theme System
 * 
 * Defines theme tokens and multiple visual styles that can be applied per-app.
 * Supports: Classic, Glass (glassmorphism), Neon, Minimal
 */

export type ThemeStyle = 'classic' | 'glass' | 'neon' | 'minimal';

export interface ThemeTokens {
    // Surface colors
    surfacePrimary: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    surfaceOverlay: string;
    surfaceHover: string;
    surfaceActive: string;

    // Border colors
    borderPrimary: string;
    borderSecondary: string;
    borderAccent: string;
    borderHover: string;

    // Text colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textAccent: string;
    textInverse: string;

    // Accent colors
    accentPrimary: string;
    accentSecondary: string;
    accentGlow: string;
    accentMuted: string;

    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;

    // Effects
    blur: string;
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
    shadowGlow: string;

    // Radius
    radiusSm: string;
    radiusMd: string;
    radiusLg: string;
    radiusFull: string;

    // Transitions
    transitionFast: string;
    transitionBase: string;
    transitionSlow: string;
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

export const classicTheme: ThemeTokens = {
    // Surface - solid dark backgrounds
    surfacePrimary: 'rgba(8, 8, 8, 1)',
    surfaceSecondary: 'rgba(11, 11, 11, 1)',
    surfaceTertiary: 'rgba(17, 17, 17, 1)',
    surfaceOverlay: 'rgba(5, 5, 5, 0.95)',
    surfaceHover: 'rgba(26, 26, 26, 1)',
    surfaceActive: 'rgba(22, 22, 22, 1)',

    // Borders - subtle definition
    borderPrimary: 'rgba(34, 34, 34, 1)',
    borderSecondary: 'rgba(51, 51, 51, 1)',
    borderAccent: 'rgba(0, 255, 204, 0.3)',
    borderHover: 'rgba(74, 74, 74, 1)',

    // Text
    textPrimary: 'rgba(255, 255, 255, 0.95)',
    textSecondary: 'rgba(200, 200, 200, 0.9)',
    textMuted: 'rgba(128, 128, 128, 1)',
    textAccent: 'rgba(0, 255, 204, 1)',
    textInverse: 'rgba(0, 0, 0, 0.9)',

    // Accents - cyan/teal
    accentPrimary: 'rgba(0, 255, 204, 1)',
    accentSecondary: 'rgba(34, 211, 238, 1)',
    accentGlow: 'rgba(0, 255, 204, 0.15)',
    accentMuted: 'rgba(0, 255, 204, 0.5)',

    // Status
    success: 'rgba(34, 197, 94, 1)',
    warning: 'rgba(234, 179, 8, 1)',
    error: 'rgba(239, 68, 68, 1)',
    info: 'rgba(59, 130, 246, 1)',

    // Effects
    blur: '0px',
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.5)',
    shadowMd: '0 4px 8px rgba(0, 0, 0, 0.5)',
    shadowLg: '0 10px 30px rgba(0, 0, 0, 0.6)',
    shadowGlow: '0 0 20px rgba(0, 255, 204, 0.15)',

    // Radius
    radiusSm: '4px',
    radiusMd: '6px',
    radiusLg: '8px',
    radiusFull: '9999px',

    // Transitions
    transitionFast: '100ms',
    transitionBase: '200ms',
    transitionSlow: '300ms',
};

export const glassTheme: ThemeTokens = {
    // Surface - frosted glass with transparency
    surfacePrimary: 'rgba(15, 15, 25, 0.7)',
    surfaceSecondary: 'rgba(20, 20, 35, 0.6)',
    surfaceTertiary: 'rgba(30, 30, 50, 0.5)',
    surfaceOverlay: 'rgba(10, 10, 20, 0.85)',
    surfaceHover: 'rgba(40, 40, 60, 0.5)',
    surfaceActive: 'rgba(35, 35, 55, 0.6)',

    // Borders - subtle white edges
    borderPrimary: 'rgba(255, 255, 255, 0.08)',
    borderSecondary: 'rgba(255, 255, 255, 0.12)',
    borderAccent: 'rgba(147, 51, 234, 0.4)',
    borderHover: 'rgba(255, 255, 255, 0.18)',

    // Text
    textPrimary: 'rgba(255, 255, 255, 0.95)',
    textSecondary: 'rgba(200, 200, 220, 0.85)',
    textMuted: 'rgba(140, 140, 160, 0.7)',
    textAccent: 'rgba(167, 139, 250, 1)',
    textInverse: 'rgba(20, 20, 35, 0.95)',

    // Accents - purple/violet
    accentPrimary: 'rgba(139, 92, 246, 1)',
    accentSecondary: 'rgba(168, 85, 247, 1)',
    accentGlow: 'rgba(139, 92, 246, 0.25)',
    accentMuted: 'rgba(139, 92, 246, 0.5)',

    // Status
    success: 'rgba(74, 222, 128, 1)',
    warning: 'rgba(250, 204, 21, 1)',
    error: 'rgba(248, 113, 113, 1)',
    info: 'rgba(96, 165, 250, 1)',

    // Effects - heavy blur
    blur: '20px',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.2)',
    shadowMd: '0 8px 24px rgba(0, 0, 0, 0.25)',
    shadowLg: '0 16px 48px rgba(0, 0, 0, 0.35)',
    shadowGlow: '0 0 30px rgba(139, 92, 246, 0.2)',

    // Radius - softer corners
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '16px',
    radiusFull: '9999px',

    // Transitions
    transitionFast: '150ms',
    transitionBase: '250ms',
    transitionSlow: '350ms',
};

export const neonTheme: ThemeTokens = {
    // Surface - deep dark
    surfacePrimary: 'rgba(5, 5, 10, 1)',
    surfaceSecondary: 'rgba(8, 8, 15, 1)',
    surfaceTertiary: 'rgba(12, 12, 22, 1)',
    surfaceOverlay: 'rgba(3, 3, 8, 0.95)',
    surfaceHover: 'rgba(15, 15, 28, 1)',
    surfaceActive: 'rgba(12, 12, 24, 1)',

    // Borders - neon glow edges
    borderPrimary: 'rgba(0, 255, 136, 0.15)',
    borderSecondary: 'rgba(0, 255, 136, 0.25)',
    borderAccent: 'rgba(0, 255, 136, 0.6)',
    borderHover: 'rgba(0, 255, 136, 0.4)',

    // Text
    textPrimary: 'rgba(255, 255, 255, 0.98)',
    textSecondary: 'rgba(180, 255, 220, 0.9)',
    textMuted: 'rgba(100, 180, 150, 0.7)',
    textAccent: 'rgba(0, 255, 136, 1)',
    textInverse: 'rgba(5, 5, 10, 0.95)',

    // Accents - neon green + magenta
    accentPrimary: 'rgba(0, 255, 136, 1)',
    accentSecondary: 'rgba(255, 0, 128, 1)',
    accentGlow: 'rgba(0, 255, 136, 0.3)',
    accentMuted: 'rgba(0, 255, 136, 0.5)',

    // Status
    success: 'rgba(0, 255, 136, 1)',
    warning: 'rgba(255, 200, 0, 1)',
    error: 'rgba(255, 60, 100, 1)',
    info: 'rgba(0, 200, 255, 1)',

    // Effects - glow shadows
    blur: '0px',
    shadowSm: '0 0 8px rgba(0, 255, 136, 0.2)',
    shadowMd: '0 0 16px rgba(0, 255, 136, 0.25)',
    shadowLg: '0 0 32px rgba(0, 255, 136, 0.35)',
    shadowGlow: '0 0 40px rgba(0, 255, 136, 0.4)',

    // Radius - sharp
    radiusSm: '2px',
    radiusMd: '4px',
    radiusLg: '6px',
    radiusFull: '9999px',

    // Transitions
    transitionFast: '80ms',
    transitionBase: '150ms',
    transitionSlow: '250ms',
};

export const minimalTheme: ThemeTokens = {
    // Surface - subtle grays
    surfacePrimary: 'rgba(12, 12, 12, 1)',
    surfaceSecondary: 'rgba(18, 18, 18, 1)',
    surfaceTertiary: 'rgba(24, 24, 24, 1)',
    surfaceOverlay: 'rgba(8, 8, 8, 0.98)',
    surfaceHover: 'rgba(28, 28, 28, 1)',
    surfaceActive: 'rgba(24, 24, 24, 1)',

    // Borders - barely visible
    borderPrimary: 'rgba(255, 255, 255, 0.04)',
    borderSecondary: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(255, 255, 255, 0.15)',
    borderHover: 'rgba(255, 255, 255, 0.12)',

    // Text
    textPrimary: 'rgba(255, 255, 255, 0.9)',
    textSecondary: 'rgba(200, 200, 200, 0.7)',
    textMuted: 'rgba(128, 128, 128, 0.5)',
    textAccent: 'rgba(255, 255, 255, 1)',
    textInverse: 'rgba(12, 12, 12, 0.95)',

    // Accents - monochrome
    accentPrimary: 'rgba(255, 255, 255, 0.9)',
    accentSecondary: 'rgba(200, 200, 200, 0.8)',
    accentGlow: 'rgba(255, 255, 255, 0.05)',
    accentMuted: 'rgba(255, 255, 255, 0.4)',

    // Status
    success: 'rgba(134, 239, 172, 1)',
    warning: 'rgba(253, 224, 71, 1)',
    error: 'rgba(252, 165, 165, 1)',
    info: 'rgba(147, 197, 253, 1)',

    // Effects - minimal
    blur: '0px',
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    shadowMd: '0 4px 12px rgba(0, 0, 0, 0.35)',
    shadowLg: '0 8px 24px rgba(0, 0, 0, 0.4)',
    shadowGlow: '0 0 20px rgba(255, 255, 255, 0.03)',

    // Radius - soft
    radiusSm: '6px',
    radiusMd: '8px',
    radiusLg: '12px',
    radiusFull: '9999px',

    // Transitions
    transitionFast: '100ms',
    transitionBase: '200ms',
    transitionSlow: '300ms',
};

// Theme registry
export const themeRegistry: Record<ThemeStyle, ThemeTokens> = {
    classic: classicTheme,
    glass: glassTheme,
    neon: neonTheme,
    minimal: minimalTheme,
};

// Human-readable names
export const themeNames: Record<ThemeStyle, string> = {
    classic: 'Classic',
    glass: 'Glass',
    neon: 'Neon',
    minimal: 'Minimal',
};

// Theme descriptions
export const themeDescriptions: Record<ThemeStyle, string> = {
    classic: 'Sharp, solid dark interface with cyan accents',
    glass: 'Frosted glass with blur effects and purple tones',
    neon: 'Deep dark with vibrant neon glow effects',
    minimal: 'Clean, reduced chrome with subtle styling',
};

/**
 * Converts theme tokens to CSS custom properties
 */
export function themeToCssVars(tokens: ThemeTokens): Record<string, string> {
    return {
        '--kos-surface-primary': tokens.surfacePrimary,
        '--kos-surface-secondary': tokens.surfaceSecondary,
        '--kos-surface-tertiary': tokens.surfaceTertiary,
        '--kos-surface-overlay': tokens.surfaceOverlay,
        '--kos-surface-hover': tokens.surfaceHover,
        '--kos-surface-active': tokens.surfaceActive,

        '--kos-border-primary': tokens.borderPrimary,
        '--kos-border-secondary': tokens.borderSecondary,
        '--kos-border-accent': tokens.borderAccent,
        '--kos-border-hover': tokens.borderHover,

        '--kos-text-primary': tokens.textPrimary,
        '--kos-text-secondary': tokens.textSecondary,
        '--kos-text-muted': tokens.textMuted,
        '--kos-text-accent': tokens.textAccent,
        '--kos-text-inverse': tokens.textInverse,

        '--kos-accent-primary': tokens.accentPrimary,
        '--kos-accent-secondary': tokens.accentSecondary,
        '--kos-accent-glow': tokens.accentGlow,
        '--kos-accent-muted': tokens.accentMuted,

        '--kos-success': tokens.success,
        '--kos-warning': tokens.warning,
        '--kos-error': tokens.error,
        '--kos-info': tokens.info,

        '--kos-blur': tokens.blur,
        '--kos-shadow-sm': tokens.shadowSm,
        '--kos-shadow-md': tokens.shadowMd,
        '--kos-shadow-lg': tokens.shadowLg,
        '--kos-shadow-glow': tokens.shadowGlow,

        '--kos-radius-sm': tokens.radiusSm,
        '--kos-radius-md': tokens.radiusMd,
        '--kos-radius-lg': tokens.radiusLg,
        '--kos-radius-full': tokens.radiusFull,

        '--kos-transition-fast': tokens.transitionFast,
        '--kos-transition-base': tokens.transitionBase,
        '--kos-transition-slow': tokens.transitionSlow,
    };
}
