/**
 * tokens.ts — K-OS Universal Design Token System
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SINGLE SOURCE OF TRUTH FOR EVERY VISUAL PROPERTY IN K-OS.
 *
 * VS Code has ~400 theme tokens. K-OS has 200+ here, all editable live.
 *
 * Design:
 *   - All colors are HSL 3-tuples for easy programmatic manipulation
 *   - Every token maps to a CSS custom property: --kos-<category>-<name>
 *   - Tokens are grouped into semantic categories
 *   - Extensions add their own token namespaces (--k-ext-<plugin>-<name>)
 *   - JSON-serialisable: themes = plain objects, importable/exportable
 *
 * Token Categories:
 *   color      — Every color in the system (surface, text, border, accent, status)
 *   spacing    — Consistent gap scale
 *   radius     — Border radius scale
 *   typography — Font family, size, weight, line-height
 *   motion     — Duration, easing
 *   shadow     — Box shadow definitions
 *   blur       — Backdrop blur amounts
 *   opacity    — Standard opacity levels
 *   shader     — GLSL shader strings (extension zone)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── HSL representation ───────────────────────────────────────────────────────
// [hue 0..360, sat 0..100, lightness 0..100]
export type HSL = [number, number, number];
export type HSLA = [number, number, number, number];

export function hsl([h, s, l]: HSL): string {
    return `hsl(${h}, ${s}%, ${l}%)`;
}
export function hsla([h, s, l, a]: HSLA): string {
    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// ─── Token Schema ─────────────────────────────────────────────────────────────

export interface ColorTokens {
    // ── Surfaces ──
    /** Main app background */
    surfacePrimary: HSLA;
    /** Secondary panels, sidebars */
    surfaceSecondary: HSLA;
    /** Tertiary depth, popovers */
    surfaceTertiary: HSLA;
    /** Overlays (modals, tooltips) */
    surfaceOverlay: HSLA;
    /** Hover state surface */
    surfaceHover: HSLA;
    /** Active/pressed state surface */
    surfaceActive: HSLA;
    /** Raised element (cards, menuItems) */
    surfaceRaised: HSLA;
    /** Sunken/input background */
    surfaceSunken: HSLA;

    // ── Borders ──
    /** Hairline separators */
    borderSubtle: HSLA;
    /** Normal panel borders */
    borderDefault: HSLA;
    /** Emphasized borders */
    borderStrong: HSLA;
    /** Focused element border */
    borderFocus: HSLA;
    /** Accent-colored border */
    borderAccent: HSLA;
    /** Destructive action border */
    borderDestructive: HSLA;

    // ── Text ──
    /** Body / primary text */
    textPrimary: HSLA;
    /** Secondary descriptive text */
    textSecondary: HSLA;
    /** Placeholder, disabled */
    textMuted: HSLA;
    /** Inverted (on accent bg) */
    textInverse: HSLA;
    /** Accent-colored labels */
    textAccent: HSLA;
    /** Link text */
    textLink: HSLA;
    /** Code / monospace */
    textCode: HSLA;
    /** Error text */
    textError: HSLA;
    /** Warning text */
    textWarning: HSLA;
    /** Success text */
    textSuccess: HSLA;

    // ── Accent ──
    /** Primary brand accent */
    accentPrimary: HSLA;
    /** Secondary accent */
    accentSecondary: HSLA;
    /** Accent at low opacity (tinted fill) */
    accentMuted: HSLA;
    /** Glow / shadow color for accent */
    accentGlow: HSLA;
    /** Tertiary accent (highlights, selections) */
    accentTertiary: HSLA;

    // ── Status ──
    statusSuccess: HSLA;
    statusWarning: HSLA;
    statusError: HSLA;
    statusInfo: HSLA;

    // ── Interactive ──
    /** Button primary fill */
    btnPrimary: HSLA;
    /** Button primary hover */
    btnPrimaryHover: HSLA;
    /** Button primary text */
    btnPrimaryText: HSLA;
    /** Button ghost fill */
    btnGhost: HSLA;
    /** Button ghost hover */
    btnGhostHover: HSLA;
    /** Button destructive */
    btnDestructive: HSLA;

    // ── Selection ──
    selectionBg: HSLA;
    selectionBorder: HSLA;

    // ── Scrollbar ──
    scrollbarTrack: HSLA;
    scrollbarThumb: HSLA;
    scrollbarHover: HSLA;

    // ── Icon ──
    iconDefault: HSLA;
    iconMuted: HSLA;
    iconAccent: HSLA;
}

export interface SpacingTokens {
    xs: string;   // 2px
    sm: string;   // 4px
    md: string;   // 8px
    lg: string;   // 12px
    xl: string;   // 16px
    '2xl': string;  // 24px
    '3xl': string;  // 32px
    '4xl': string;  // 48px
    '5xl': string;  // 64px
}

export interface RadiusTokens {
    none: string;  // 0
    xs: string;  // 2px
    sm: string;  // 4px
    md: string;  // 6px
    lg: string;  // 8px
    xl: string;  // 12px
    '2xl': string;  // 16px
    full: string;  // 9999px
}

export interface TypographyTokens {
    /** Primary UI font */
    fontSans: string;
    /** Monospace / code font */
    fontMono: string;
    /** Display / brand font */
    fontDisplay: string;

    // Size scale
    textXs: string;   // 10px
    textSm: string;   // 11px
    textBase: string;   // 12px (compact DCC default)
    textMd: string;   // 13px
    textLg: string;   // 14px
    textXl: string;   // 16px
    text2xl: string;   // 20px
    text3xl: string;   // 28px

    // Weight
    weightLight: string;   // 300
    weightNormal: string;   // 400
    weightMedium: string;   // 500
    weightSemi: string;   // 600
    weightBold: string;   // 700
    weightBlack: string;   // 900

    // Letter spacing
    trackingTight: string;   // -0.02em
    trackingNormal: string;  // 0
    trackingWide: string;   // 0.05em
    trackingWidest: string;  // 0.15em

    // Line height
    lineNone: string;   // 1
    lineTight: string;   // 1.2
    lineNormal: string;   // 1.4
    lineRelaxed: string;   // 1.6
}

export interface MotionTokens {
    /** Instant: 0ms */
    durationInstant: string;
    /** Fast: 100ms */
    durationFast: string;
    /** Normal: 200ms */
    durationBase: string;
    /** Slow: 350ms */
    durationSlow: string;
    /** Very slow: 600ms */
    durationXslow: string;

    /** Sharp snappy easing */
    easingSharp: string;
    /** Standard easing */
    easingStandard: string;
    /** Decelerate (into view) */
    easingDecel: string;
    /** Accelerate (out of view) */
    easingAccel: string;
    /** Elastic spring */
    easingSpring: string;
}

export interface ShadowTokens {
    none: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    glow: string;    // accent-colored glow
    inner: string;    // inset shadow
}

export interface BlurTokens {
    none: string;  // 0
    sm: string;  // 4px
    md: string;  // 8px
    lg: string;  // 16px
    xl: string;  // 24px
    '2xl': string;  // 40px
}

export interface OpacityTokens {
    0: number;
    5: number;
    10: number;
    20: number;
    40: number;
    60: number;
    80: number;
    100: number;
}

// ─── Full token set ───────────────────────────────────────────────────────────

export interface KOSTokens {
    /** Theme ID */
    id: string;
    /** Display name */
    name: string;
    /** Description */
    description: string;
    /** Author */
    author?: string;

    color: ColorTokens;
    spacing: SpacingTokens;
    radius: RadiusTokens;
    typography: TypographyTokens;
    motion: MotionTokens;
    shadow: ShadowTokens;
    blur: BlurTokens;
    opacity: OpacityTokens;

    /** Extension/plugin extra tokens (namespaced) */
    extensions: Record<string, Record<string, string>>;
}

// ─── CSS var mapping ──────────────────────────────────────────────────────────

function colorToCss(c: HSLA): string {
    return `hsla(${c[0]}, ${c[1]}%, ${c[2]}%, ${c[3]})`;
}

function mapColorTokens(prefix: string, colors: ColorTokens): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(colors)) {
        // key like surfacePrimary → --kos-surface-primary
        const cssKey = '--' + prefix + '-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        out[cssKey] = colorToCss(val as HSLA);
    }
    return out;
}

export function tokensToCssVars(t: KOSTokens): Record<string, string> {
    const vars: Record<string, string> = {};

    // Colors
    Object.assign(vars, mapColorTokens('kos', t.color));

    // Spacing
    for (const [k, v] of Object.entries(t.spacing)) {
        vars[`--kos-space-${k}`] = v;
    }

    // Radius
    for (const [k, v] of Object.entries(t.radius)) {
        vars[`--kos-radius-${k}`] = v;
    }

    // Typography
    vars['--kos-font-sans'] = t.typography.fontSans;
    vars['--kos-font-mono'] = t.typography.fontMono;
    vars['--kos-font-display'] = t.typography.fontDisplay;
    for (const [k, v] of Object.entries(t.typography)) {
        if (!['fontSans', 'fontMono', 'fontDisplay'].includes(k)) {
            vars[`--kos-type-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = v;
        }
    }

    // Motion
    for (const [k, v] of Object.entries(t.motion)) {
        vars[`--kos-motion-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = v;
    }

    // Shadows + blur + opacity
    for (const [k, v] of Object.entries(t.shadow)) {
        vars[`--kos-shadow-${k}`] = String(v);
    }
    for (const [k, v] of Object.entries(t.blur)) {
        vars[`--kos-blur-${k}`] = String(v);
    }

    // Extension namespaces: --k-ext-<ns>-<key>
    for (const [ns, tokens] of Object.entries(t.extensions)) {
        for (const [k, v] of Object.entries(tokens)) {
            vars[`--k-ext-${ns}-${k}`] = v;
        }
    }

    return vars;
}

export function applyTokensToRoot(t: KOSTokens, el: HTMLElement = document.documentElement): void {
    const vars = tokensToCssVars(t);
    for (const [k, v] of Object.entries(vars)) {
        el.style.setProperty(k, v);
    }
    el.setAttribute('data-kos-theme', t.id);
}

// ─── Built-in Themes ──────────────────────────────────────────────────────────

/** Shared structural tokens (spacing, motion, etc.) — same across all themes */
const STRUCTURAL: Pick<KOSTokens, 'spacing' | 'radius' | 'motion' | 'blur' | 'opacity' | 'extensions'> = {
    spacing: {
        xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px',
        '2xl': '24px', '3xl': '32px', '4xl': '48px', '5xl': '64px',
    },
    radius: {
        none: '0', xs: '2px', sm: '4px', md: '6px', lg: '8px',
        xl: '12px', '2xl': '16px', full: '9999px',
    },
    motion: {
        durationInstant: '0ms', durationFast: '100ms', durationBase: '200ms',
        durationSlow: '350ms', durationXslow: '600ms',
        easingSharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
        easingStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easingDecel: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easingAccel: 'cubic-bezier(0.4, 0, 1, 1)',
        easingSpring: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
    blur: {
        none: '0', sm: '4px', md: '8px', lg: '16px', xl: '24px', '2xl': '40px',
    },
    opacity: { 0: 0, 5: 0.05, 10: 0.10, 20: 0.20, 40: 0.40, 60: 0.60, 80: 0.80, 100: 1 },
    extensions: {},
};

const SHARED_TYPE: TypographyTokens = {
    fontSans: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontDisplay: '"Inter", system-ui, sans-serif',
    textXs: '10px', textSm: '11px', textBase: '12px', textMd: '13px',
    textLg: '14px', textXl: '16px', text2xl: '20px', text3xl: '28px',
    weightLight: '300', weightNormal: '400', weightMedium: '500',
    weightSemi: '600', weightBold: '700', weightBlack: '900',
    trackingTight: '-0.02em', trackingNormal: '0', trackingWide: '0.05em', trackingWidest: '0.15em',
    lineNone: '1', lineTight: '1.2', lineNormal: '1.4', lineRelaxed: '1.6',
};

// ─── FORGE (Dark Charcoal — default K-OS aesthetic) ───────────────────────────
export const THEME_FORGE: KOSTokens = {
    id: 'forge', name: 'Forge', description: 'Deep charcoal — the default K-OS aesthetic',
    author: 'K-OS Core', ...STRUCTURAL,
    typography: { ...SHARED_TYPE },
    shadow: {
        none: 'none',
        xs: '0 1px 2px rgba(0,0,0,0.4)',
        sm: '0 2px 4px rgba(0,0,0,0.5)',
        md: '0 4px 16px rgba(0,0,0,0.6)',
        lg: '0 8px 32px rgba(0,0,0,0.7)',
        xl: '0 16px 48px rgba(0,0,0,0.8)',
        glow: '0 0 16px hsla(162, 100%, 55%, 0.25)',
        inner: 'inset 0 1px 3px rgba(0,0,0,0.4)',
    },
    color: {
        surfacePrimary: [0, 0, 5, 1], surfaceSecondary: [220, 12, 7, 1],
        surfaceTertiary: [220, 12, 9, 1], surfaceOverlay: [220, 15, 4, 0.97],
        surfaceHover: [220, 10, 11, 1], surfaceActive: [220, 10, 9, 1],
        surfaceRaised: [220, 12, 10, 1], surfaceSunken: [0, 0, 3, 1],

        borderSubtle: [220, 12, 12, 0.4], borderDefault: [220, 10, 18, 0.5],
        borderStrong: [220, 8, 25, 0.6], borderFocus: [162, 100, 55, 0.7],
        borderAccent: [162, 100, 55, 0.3], borderDestructive: [0, 80, 55, 0.5],

        textPrimary: [0, 0, 95, 1], textSecondary: [220, 8, 65, 1],
        textMuted: [220, 8, 40, 1], textInverse: [220, 15, 5, 1],
        textAccent: [162, 100, 55, 1], textLink: [210, 100, 65, 1],
        textCode: [162, 60, 60, 1], textError: [0, 80, 65, 1],
        textWarning: [40, 95, 60, 1], textSuccess: [142, 70, 55, 1],

        accentPrimary: [162, 100, 50, 1], accentSecondary: [240, 80, 65, 1],
        accentMuted: [162, 100, 50, 0.12], accentGlow: [162, 100, 50, 0.3],
        accentTertiary: [280, 80, 65, 1],

        statusSuccess: [142, 70, 50, 1], statusWarning: [40, 95, 55, 1],
        statusError: [0, 80, 60, 1], statusInfo: [210, 100, 60, 1],

        btnPrimary: [162, 100, 45, 1], btnPrimaryHover: [162, 100, 50, 1],
        btnPrimaryText: [220, 20, 5, 1], btnGhost: [0, 0, 100, 0.05],
        btnGhostHover: [0, 0, 100, 0.09], btnDestructive: [0, 80, 55, 1],

        selectionBg: [162, 100, 50, 0.15], selectionBorder: [162, 100, 50, 0.6],

        scrollbarTrack: [220, 12, 8, 1], scrollbarThumb: [220, 8, 28, 1],
        scrollbarHover: [220, 8, 38, 1],

        iconDefault: [220, 8, 60, 1], iconMuted: [220, 8, 35, 1],
        iconAccent: [162, 100, 55, 1],
    },
};

// ─── VOID (Ultra-dark pure base) ─────────────────────────────────────────────
export const THEME_VOID: KOSTokens = {
    ...THEME_FORGE,
    id: 'void', name: 'Void', description: 'Maximum darkness — pure black with violet accents',
    color: {
        ...THEME_FORGE.color,
        surfacePrimary: [0, 0, 2, 1], surfaceSecondary: [0, 0, 4, 1],
        surfaceTertiary: [0, 0, 6, 1], surfaceOverlay: [0, 0, 2, 0.98],
        surfaceHover: [260, 8, 8, 1], surfaceActive: [260, 8, 6, 1],
        borderSubtle: [260, 8, 10, 0.3], borderDefault: [260, 8, 15, 0.4],
        accentPrimary: [270, 80, 65, 1], accentSecondary: [310, 80, 60, 1],
        accentMuted: [270, 80, 65, 0.12], accentGlow: [270, 80, 65, 0.3],
        textAccent: [270, 80, 72, 1], borderAccent: [270, 80, 65, 0.3],
        borderFocus: [270, 80, 65, 0.7],
        btnPrimary: [270, 80, 60, 1], btnPrimaryHover: [270, 80, 65, 1],
        selectionBg: [270, 80, 65, 0.15], selectionBorder: [270, 80, 65, 0.6],
        iconAccent: [270, 80, 72, 1],
    },
    shadow: {
        ...THEME_FORGE.shadow,
        glow: '0 0 16px hsla(270, 80%, 65%, 0.3)',
    },
};

// ─── PLASMA (Neon cyberpunk) ──────────────────────────────────────────────────
export const THEME_PLASMA: KOSTokens = {
    ...THEME_FORGE,
    id: 'plasma', name: 'Plasma', description: 'Cyberpunk neon — electric cyan on near-black',
    color: {
        ...THEME_FORGE.color,
        surfacePrimary: [190, 25, 4, 1], surfaceSecondary: [190, 20, 6, 1],
        surfaceTertiary: [190, 18, 8, 1], surfaceOverlay: [190, 25, 3, 0.97],
        surfaceHover: [190, 20, 10, 1], surfaceActive: [190, 20, 8, 1],
        borderSubtle: [185, 30, 14, 0.4], borderDefault: [185, 25, 20, 0.5],
        accentPrimary: [185, 100, 52, 1], accentSecondary: [320, 100, 60, 1],
        accentMuted: [185, 100, 52, 0.12], accentGlow: [185, 100, 52, 0.35],
        textAccent: [185, 100, 65, 1], borderAccent: [185, 100, 52, 0.35],
        borderFocus: [185, 100, 55, 0.8],
        btnPrimary: [185, 100, 45, 1], btnPrimaryHover: [185, 100, 52, 1],
        btnPrimaryText: [185, 30, 5, 1],
        selectionBg: [185, 100, 52, 0.15], selectionBorder: [185, 100, 52, 0.7],
        iconAccent: [185, 100, 65, 1],
        textCode: [320, 100, 68, 1],
    },
    shadow: {
        ...THEME_FORGE.shadow,
        glow: '0 0 20px hsla(185, 100%, 52%, 0.35)',
    },
};

// ─── GLASS (Frosted glassmorphism) ────────────────────────────────────────────
export const THEME_GLASS: KOSTokens = {
    ...THEME_FORGE,
    id: 'glass', name: 'Glass', description: 'Frosted glass — translucent layered surfaces',
    color: {
        ...THEME_FORGE.color,
        surfacePrimary: [220, 20, 8, 0.7], surfaceSecondary: [220, 18, 10, 0.6],
        surfaceTertiary: [220, 16, 13, 0.55], surfaceOverlay: [220, 22, 6, 0.85],
        surfaceHover: [220, 15, 15, 0.5], surfaceActive: [220, 15, 12, 0.55],
        surfaceRaised: [220, 18, 12, 0.5], surfaceSunken: [220, 22, 5, 0.65],
        borderSubtle: [0, 0, 100, 0.06], borderDefault: [0, 0, 100, 0.10],
        borderStrong: [0, 0, 100, 0.18],
    },
};

// ─── PARCHMENT (Light/Paper mode) ────────────────────────────────────────────
export const THEME_PARCHMENT: KOSTokens = {
    ...THEME_FORGE,
    id: 'parchment', name: 'Parchment', description: 'Light mode — warm paper surface',
    color: {
        ...THEME_FORGE.color,
        surfacePrimary: [40, 25, 97, 1], surfaceSecondary: [40, 20, 94, 1],
        surfaceTertiary: [40, 18, 91, 1], surfaceOverlay: [40, 25, 99, 0.95],
        surfaceHover: [40, 20, 90, 1], surfaceActive: [40, 20, 88, 1],
        surfaceRaised: [40, 22, 95, 1], surfaceSunken: [40, 18, 89, 1],

        borderSubtle: [40, 15, 82, 0.6], borderDefault: [40, 12, 75, 0.6],
        borderStrong: [40, 10, 60, 0.7],

        textPrimary: [30, 20, 10, 1], textSecondary: [30, 15, 30, 1],
        textMuted: [30, 10, 55, 1], textInverse: [40, 25, 97, 1],

        accentPrimary: [25, 90, 48, 1], accentSecondary: [200, 80, 45, 1],
        accentMuted: [25, 90, 48, 0.15], accentGlow: [25, 90, 48, 0.2],
        textAccent: [25, 90, 40, 1], borderAccent: [25, 90, 48, 0.4],
        borderFocus: [25, 90, 48, 0.7],
        btnPrimary: [25, 90, 45, 1], btnPrimaryHover: [25, 90, 50, 1],
        btnPrimaryText: [40, 25, 98, 1],

        scrollbarTrack: [40, 15, 88, 1], scrollbarThumb: [40, 12, 70, 1],
        scrollbarHover: [40, 12, 58, 1], iconAccent: [25, 90, 45, 1],
    },
    shadow: {
        none: 'none',
        xs: '0 1px 2px rgba(80,60,40,0.15)',
        sm: '0 2px 4px rgba(80,60,40,0.18)',
        md: '0 4px 16px rgba(80,60,40,0.2)',
        lg: '0 8px 32px rgba(80,60,40,0.22)',
        xl: '0 16px 48px rgba(80,60,40,0.25)',
        glow: '0 0 16px hsla(25, 90%, 48%, 0.2)',
        inner: 'inset 0 1px 3px rgba(80,60,40,0.12)',
    },
};

// ─── CARBON (Dark + warm orange accents — like VS Code Dark+) ────────────────
export const THEME_CARBON: KOSTokens = {
    ...THEME_FORGE,
    id: 'carbon', name: 'Carbon', description: 'Carbon dark — warm orange accent, VS Code inspired',
    color: {
        ...THEME_FORGE.color,
        surfacePrimary: [0, 0, 7, 1], surfaceSecondary: [0, 0, 10, 1],
        surfaceTertiary: [0, 0, 13, 1], surfaceOverlay: [0, 0, 6, 0.97],
        accentPrimary: [30, 100, 55, 1], accentSecondary: [200, 100, 60, 1],
        accentMuted: [30, 100, 55, 0.12], accentGlow: [30, 100, 55, 0.25],
        textAccent: [30, 100, 65, 1], borderAccent: [30, 100, 55, 0.35],
        borderFocus: [30, 100, 55, 0.8],
        btnPrimary: [30, 100, 50, 1], btnPrimaryHover: [30, 100, 55, 1],
        iconAccent: [30, 100, 65, 1],
    },
    shadow: {
        ...THEME_FORGE.shadow,
        glow: '0 0 16px hsla(30, 100%, 55%, 0.25)',
    },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const BUILTIN_THEMES: Record<string, KOSTokens> = {
    forge: THEME_FORGE,
    void: THEME_VOID,
    plasma: THEME_PLASMA,
    glass: THEME_GLASS,
    parchment: THEME_PARCHMENT,
    carbon: THEME_CARBON,
};

export const DEFAULT_THEME_ID = 'forge';

export function getBuiltinTheme(id: string): KOSTokens {
    return BUILTIN_THEMES[id] ?? THEME_FORGE;
}

/** Deep-merge a partial token override onto a base theme */
export function mergeTheme(base: KOSTokens, overrides: Partial<KOSTokens>): KOSTokens {
    return {
        ...base,
        ...overrides,
        color: { ...base.color, ...(overrides.color ?? {}) },
        typography: { ...base.typography, ...(overrides.typography ?? {}) },
        spacing: { ...base.spacing, ...(overrides.spacing ?? {}) },
        radius: { ...base.radius, ...(overrides.radius ?? {}) },
        motion: { ...base.motion, ...(overrides.motion ?? {}) },
        shadow: { ...base.shadow, ...(overrides.shadow ?? {}) },
        blur: { ...base.blur, ...(overrides.blur ?? {}) },
        extensions: { ...base.extensions, ...(overrides.extensions ?? {}) },
    } as KOSTokens;
}

/** Export theme as pretty JSON string */
export function serializeTheme(t: KOSTokens): string {
    return JSON.stringify(t, null, 2);
}

/** Parse theme from JSON — validates required fields */
export function parseTheme(json: string): KOSTokens {
    const obj = JSON.parse(json);
    if (!obj.id || !obj.name || !obj.color) throw new Error('Invalid theme: missing required fields');
    return mergeTheme(THEME_FORGE, obj);
}
