/**
 * fontSystem.ts — K-OS Universal Font System
 *
 * Manages:
 *   - Google Fonts loading (runtime, no build step needed)
 *   - Local / CDN font loading
 *   - Variable font support
 *   - Font preview generation (canvas-based rasterization)
 *   - Per-role (sans/mono/display) assignment
 *   - Persistence to localStorage
 */

// ─── Font catalogue (curated for DCC UIs) ────────────────────────────────────

export interface FontEntry {
    family: string;
    source: 'google' | 'system' | 'custom';
    category: 'sans' | 'mono' | 'display' | 'any';
    variable: boolean;
    weights: number[];
    preview?: string;   // Sample text
}

/**
 * Data-driven font catalogue.
 * Adding a new font = add an entry here. Zero code changes elsewhere.
 */
export const FONT_CATALOGUE: FontEntry[] = [
    // ── Sans / UI fonts ──
    { family: 'Inter', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700, 900] },
    { family: 'Geist', source: 'google', category: 'sans', variable: false, weights: [300, 400, 500, 600, 700, 900] },
    { family: 'DM Sans', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700] },
    { family: 'Outfit', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700, 900] },
    { family: 'Plus Jakarta Sans', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700, 800] },
    { family: 'Space Grotesk', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700] },
    { family: 'Manrope', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700, 800] },
    { family: 'Rubik', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700, 900] },
    { family: 'IBM Plex Sans', source: 'google', category: 'sans', variable: false, weights: [300, 400, 500, 600, 700] },
    { family: 'Nunito', source: 'google', category: 'sans', variable: true, weights: [300, 400, 500, 600, 700, 800, 900] },

    // ── Display fonts ──
    { family: 'Syne', source: 'google', category: 'display', variable: true, weights: [400, 500, 600, 700, 800] },
    { family: 'Bebas Neue', source: 'google', category: 'display', variable: false, weights: [400] },
    { family: 'Oswald', source: 'google', category: 'display', variable: true, weights: [300, 400, 500, 600, 700] },
    { family: 'Rajdhani', source: 'google', category: 'display', variable: false, weights: [300, 400, 500, 600, 700] },
    { family: 'Exo 2', source: 'google', category: 'display', variable: true, weights: [300, 400, 500, 600, 700, 800, 900] },
    { family: 'Orbitron', source: 'google', category: 'display', variable: true, weights: [400, 500, 600, 700, 800, 900] },

    // ── Monospace fonts ──
    { family: 'JetBrains Mono', source: 'google', category: 'mono', variable: true, weights: [300, 400, 500, 600, 700, 800] },
    { family: 'Fira Code', source: 'google', category: 'mono', variable: true, weights: [300, 400, 500, 600, 700] },
    { family: 'Source Code Pro', source: 'google', category: 'mono', variable: true, weights: [300, 400, 500, 600, 700, 900] },
    { family: 'IBM Plex Mono', source: 'google', category: 'mono', variable: false, weights: [300, 400, 500, 600, 700] },
    { family: 'Inconsolata', source: 'google', category: 'mono', variable: true, weights: [300, 400, 500, 600, 700, 900] },
    { family: 'Roboto Mono', source: 'google', category: 'mono', variable: true, weights: [300, 400, 500, 600, 700] },
    { family: 'Space Mono', source: 'google', category: 'mono', variable: false, weights: [400, 700] },
    { family: 'Geist Mono', source: 'google', category: 'mono', variable: false, weights: [300, 400, 500, 600, 700, 800, 900] },

    // ── System fonts (no load needed) ──
    { family: 'system-ui', source: 'system', category: 'sans', variable: false, weights: [400, 700] },
    { family: '-apple-system', source: 'system', category: 'sans', variable: false, weights: [400, 700] },
    { family: 'Segoe UI', source: 'system', category: 'sans', variable: false, weights: [300, 400, 600, 700] },
];

// ─── Google Fonts loader ──────────────────────────────────────────────────────

const LOADED_FAMILIES: Set<string> = new Set();

function buildGoogleUrl(entry: FontEntry): string {
    const weights = entry.variable
        ? `wdth,wght@75..125,${entry.weights.join(';')}`
        : entry.weights.map(w => `0,${w}`).join(';');
    const q = entry.variable
        ? `family=${encodeURIComponent(entry.family)}:${weights}`
        : `family=${encodeURIComponent(entry.family)}:wght@${entry.weights.join(';')}`;
    return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export async function loadGoogleFont(entry: FontEntry): Promise<void> {
    if (LOADED_FAMILIES.has(entry.family)) return;
    LOADED_FAMILIES.add(entry.family);

    const url = buildGoogleUrl(entry);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-kos-gfont', entry.family);
    document.head.appendChild(link);

    // Wait for font to be ready (500ms max)
    await Promise.race([
        document.fonts.load(`400 12px "${entry.family}"`),
        new Promise<void>(r => setTimeout(r, 500)),
    ]);
}

export async function loadFontByFamily(family: string): Promise<void> {
    const entry = FONT_CATALOGUE.find(f => f.family === family);
    if (!entry || entry.source === 'system') return;
    await loadGoogleFont(entry);
}

// ─── Font picker state (persisted) ───────────────────────────────────────────

const FONT_STATE_KEY = 'kos_font_state';

export interface FontState {
    sans: string;
    mono: string;
    display: string;
    size: number;   // Base font size in px (default 12)
    weight: number;   // Default weight (400)
    lineHeight: string;
}

const DEFAULT_FONT_STATE: FontState = {
    sans: '"Inter", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
    display: '"Inter", system-ui, sans-serif',
    size: 12,
    weight: 400,
    lineHeight: '1.4',
};

export function loadFontState(): FontState {
    try {
        const raw = localStorage.getItem(FONT_STATE_KEY);
        return raw ? { ...DEFAULT_FONT_STATE, ...JSON.parse(raw) } : DEFAULT_FONT_STATE;
    } catch { return DEFAULT_FONT_STATE; }
}

export function saveFontState(state: FontState): void {
    localStorage.setItem(FONT_STATE_KEY, JSON.stringify(state));
}

export function applyFontState(state: FontState, el = document.documentElement): void {
    el.style.setProperty('--kos-font-sans', state.sans);
    el.style.setProperty('--kos-font-mono', state.mono);
    el.style.setProperty('--kos-font-display', state.display);
    el.style.setProperty('--kos-type-text-base', `${state.size}px`);
    el.style.setProperty('--kos-font-size-base', `${state.size}px`);
    el.style.setProperty('--kos-font-weight-base', String(state.weight));
    el.style.setProperty('--kos-type-line-normal', state.lineHeight);
    // Also set the actual body font
    document.body.style.fontFamily = state.sans;
    document.body.style.fontSize = `${state.size}px`;
}

// ─── Canvas preview ───────────────────────────────────────────────────────────

export function generateFontPreview(
    family: string,
    text = 'The quick brown fox 0123',
    size = 13,
    color = '#e2e2e2',
): string {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${size}px "${family}", system-ui`;
    ctx.fillStyle = color;
    ctx.fillText(text, 4, 24);
    return canvas.toDataURL();
}
