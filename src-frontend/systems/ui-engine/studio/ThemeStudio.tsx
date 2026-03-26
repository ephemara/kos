/**
 * ThemeStudio.tsx — K-OS Live Theme Editor
 *
 * VS Code-grade theme editing with:
 *   - Live token overrides (every color, every radius, every shadow)
 *   - HSL color editing with real-time preview
 *   - Typography / font picker (30+ Google Fonts, live preview)
 *   - Shader layer picker (choose + tune UI shaders live)
 *   - Import / Export theme as JSON
 *   - Community gallery of presets
 *   - Full undo/redo stack for token edits
 *   - Per-element preview pane showing every primitive
 */

import React, {
    useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Palette, Type, Layers, Zap, Download, Upload, RotateCcw,
    ChevronDown, ChevronRight, Check, Copy, X, Sliders, Search,
    Eye, EyeOff, Sparkles, Wand2, Plus, Trash2, Grid,
} from 'lucide-react';

import {
    type KOSTokens, type HSLA, type ColorTokens,
    BUILTIN_THEMES, mergeTheme, serializeTheme, parseTheme,
    applyTokensToRoot, tokensToCssVars,
} from '@/systems/ui-engine/tokens';
import {
    kosRegistry,
} from '@/systems/ui-engine/extensionRegistry';
import {
    FONT_CATALOGUE, type FontEntry,
    loadFontByFamily, applyFontState, saveFontState, loadFontState,
} from '@/systems/ui-engine/fontSystem';
import {
    BUILTIN_SHADER_PRESETS, shaderManager,
} from '@/systems/ui-engine/shaderLayer';

// ─── Types ────────────────────────────────────────────────────────────────────

type StudioTab = 'colors' | 'typography' | 'shaders' | 'import' | 'extensions';

// ─── Color groups (data-driven — add new group = add entry here) ──────────────

interface ColorGroup {
    id: string;
    label: string;
    keys: (keyof ColorTokens)[];
    icon: React.FC<any>;
}

const COLOR_GROUPS: ColorGroup[] = [
    {
        id: 'surface', label: 'Surfaces',
        icon: Layers,
        keys: ['surfacePrimary', 'surfaceSecondary', 'surfaceTertiary', 'surfaceOverlay',
            'surfaceHover', 'surfaceActive', 'surfaceRaised', 'surfaceSunken'],
    },
    {
        id: 'border', label: 'Borders',
        icon: Grid,
        keys: ['borderSubtle', 'borderDefault', 'borderStrong', 'borderFocus',
            'borderAccent', 'borderDestructive'],
    },
    {
        id: 'text', label: 'Text',
        icon: Type,
        keys: ['textPrimary', 'textSecondary', 'textMuted', 'textInverse',
            'textAccent', 'textLink', 'textCode', 'textError', 'textWarning', 'textSuccess'],
    },
    {
        id: 'accent', label: 'Accent',
        icon: Sparkles,
        keys: ['accentPrimary', 'accentSecondary', 'accentMuted', 'accentGlow', 'accentTertiary'],
    },
    {
        id: 'status', label: 'Status',
        icon: Check,
        keys: ['statusSuccess', 'statusWarning', 'statusError', 'statusInfo'],
    },
    {
        id: 'interactive', label: 'Buttons',
        icon: Zap,
        keys: ['btnPrimary', 'btnPrimaryHover', 'btnPrimaryText',
            'btnGhost', 'btnGhostHover', 'btnDestructive'],
    },
    {
        id: 'misc', label: 'Misc',
        icon: Sliders,
        keys: ['selectionBg', 'selectionBorder', 'scrollbarTrack', 'scrollbarThumb',
            'scrollbarHover', 'iconDefault', 'iconMuted', 'iconAccent'],
    },
];

// Humanize camelCase → "Surface Primary"
function humanize(key: string): string {
    return key.replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase());
}

// HSLA → displayable css
function hslaToDisplay([h, s, l, a]: HSLA): string {
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(2)})`;
}

function hslaToHex([h, s, l]: HSLA): string {
    const sl = s / 100, ll = l / 100;
    const c = (1 - Math.abs(2 * ll - 1)) * sl;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ll - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ─── HSL sliders ──────────────────────────────────────────────────────────────

function ColorRow({
    label, value, onChange,
}: {
    label: string;
    value: HSLA;
    onChange: (v: HSLA) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [h, s, l, a] = value;

    return (
        <div className="border-b border-white/[0.04] last:border-0">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] transition-colors group"
            >
                {/* Color swatch */}
                <div
                    className="w-5 h-5 rounded-md border border-white/[0.12] flex-shrink-0 shadow-sm"
                    style={{ background: hslaToDisplay(value) }}
                />
                <span className="flex-1 text-left text-[9px] font-mono text-white/60 group-hover:text-white/80 truncate">
                    {label}
                </span>
                <span className="text-[8px] font-mono text-white/25 tabular-nums">
                    {hslaToHex(value)}
                </span>
                <ChevronRight size={8} className={`text-white/20 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2">
                            {/* Preview bar */}
                            <div className="h-6 rounded-md w-full border border-white/[0.08]"
                                style={{ background: hslaToDisplay(value) }} />

                            {[
                                { label: 'H', sub: 'Hue', min: 0, max: 360, val: h, set: (v: number) => onChange([v, s, l, a]) },
                                { label: 'S', sub: 'Saturation', min: 0, max: 100, val: s, set: (v: number) => onChange([h, v, l, a]) },
                                { label: 'L', sub: 'Lightness', min: 0, max: 100, val: l, set: (v: number) => onChange([h, s, v, a]) },
                                { label: 'A', sub: 'Alpha', min: 0, max: 1, val: a, set: (v: number) => onChange([h, s, l, v]), step: 0.01 },
                            ].map(({ label: lbl, sub, min, max, val, set, step = 1 }) => (
                                <div key={lbl} className="flex items-center gap-2">
                                    <span className="text-[8px] font-mono text-white/40 w-3 text-center">{lbl}</span>
                                    <input
                                        type="range" min={min} max={max} step={step}
                                        value={val}
                                        onChange={e => set(parseFloat(e.target.value))}
                                        className="flex-1 h-1 accent-orange-500 cursor-pointer"
                                    />
                                    <input
                                        type="number" min={min} max={max} step={step}
                                        value={typeof val === 'number' ? Math.round(val * 100) / 100 : val}
                                        onChange={e => set(parseFloat(e.target.value))}
                                        className="w-12 bg-white/[0.04] border border-white/[0.08] rounded px-1
                                                   text-[8px] font-mono text-white/70 outline-none
                                                   focus:border-orange-500/50 text-right tabular-nums"
                                    />
                                </div>
                            ))}

                            {/* Native color wheel (hex input fallback) */}
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[8px] text-white/30">Hex</span>
                                <input
                                    type="color" value={hslaToHex(value)}
                                    onChange={e => {
                                        const hex = e.target.value;
                                        const r = parseInt(hex.slice(1, 3), 16) / 255;
                                        const g = parseInt(hex.slice(3, 5), 16) / 255;
                                        const b = parseInt(hex.slice(5, 7), 16) / 255;
                                        const max = Math.max(r, g, b), min = Math.min(r, g, b);
                                        const ld = (max + min) / 2;
                                        const sd = max === min ? 0 : (max - min) / (1 - Math.abs(2 * ld - 1));
                                        let hd = 0;
                                        if (max !== min) {
                                            if (max === r) hd = ((g - b) / (max - min)) % 6;
                                            else if (max === g) hd = (b - r) / (max - min) + 2;
                                            else hd = (r - g) / (max - min) + 4;
                                            hd = (hd * 60 + 360) % 360;
                                        }
                                        onChange([hd, sd * 100, ld * 100, a]);
                                    }}
                                    className="h-6 w-10 rounded cursor-pointer border-0 bg-transparent p-0"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Color section ────────────────────────────────────────────────────────────

function ColorsTab({ tokens, onTokenChange, search }: {
    tokens: KOSTokens;
    onTokenChange: (path: (keyof ColorTokens), value: HSLA) => void;
    search: string;
}) {
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['surface', 'accent']));

    const toggleGroup = (id: string) =>
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const q = search.toLowerCase();

    return (
        <div className="space-y-0.5">
            {COLOR_GROUPS.map(group => {
                const keys = q
                    ? group.keys.filter(k => k.toLowerCase().includes(q) || humanize(k).toLowerCase().includes(q))
                    : group.keys;
                if (keys.length === 0) return null;
                const Icon = group.icon;
                const open = openGroups.has(group.id);

                return (
                    <div key={group.id} className="border border-white/[0.04] rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleGroup(group.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02]
                                       hover:bg-white/[0.04] transition-colors"
                        >
                            <Icon size={10} className="text-white/40" />
                            <span className="flex-1 text-left text-[9px] font-mono text-white/70 uppercase tracking-wider">
                                {group.label}
                            </span>
                            <span className="text-[7px] text-white/25">{keys.length}</span>
                            <ChevronDown size={9} className={`text-white/30 transition-transform ${open ? '' : '-rotate-90'}`} />
                        </button>

                        <AnimatePresence>
                            {open && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="overflow-hidden"
                                >
                                    {keys.map(key => (
                                        <ColorRow
                                            key={key}
                                            label={humanize(key)}
                                            value={tokens.color[key] as HSLA}
                                            onChange={v => onTokenChange(key, v)}
                                        />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Typography tab ───────────────────────────────────────────────────────────

function TypographyTab({ tokens, onFontChange, onSizeChange }: {
    tokens: KOSTokens;
    onFontChange: (role: 'sans' | 'mono' | 'display', family: string) => void;
    onSizeChange: (size: number) => void;
}) {
    const [search, setSearch] = useState('');
    const [loadedPreviews, setLoadedPreviews] = useState<Set<string>>(new Set());
    const q = search.toLowerCase();

    const ROLES: Array<{ role: 'sans' | 'mono' | 'display', label: string, cat: FontEntry['category'] }> = [
        { role: 'sans', label: 'UI Font (Sans)', cat: 'sans' },
        { role: 'mono', label: 'Code Font (Mono)', cat: 'mono' },
        { role: 'display', label: 'Display / Brand Font', cat: 'display' },
    ];

    const filtered = FONT_CATALOGUE.filter(f =>
        q === '' || f.family.toLowerCase().includes(q) || f.category.includes(q)
    );

    const loadPreview = async (family: string) => {
        if (loadedPreviews.has(family)) return;
        await loadFontByFamily(family);
        setLoadedPreviews(prev => new Set([...prev, family]));
    };

    const fontState = loadFontState();

    return (
        <div className="space-y-4">
            {/* Role pickers */}
            {ROLES.map(({ role, label, cat }) => (
                <div key={role}>
                    <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1.5">{label}</p>
                    <div className="flex items-center gap-2 p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-white/70 truncate"
                                style={{ fontFamily: fontState[role] }}>
                                The quick brown fox — {role}
                            </p>
                        </div>
                        <span className="text-[8px] font-mono text-white/30 flex-shrink-0">
                            {fontState[role].split(',')[0].replace(/"/g, '')}
                        </span>
                    </div>
                </div>
            ))}

            {/* Base size */}
            <div>
                <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Base Size</p>
                <div className="flex items-center gap-2">
                    <input
                        type="range" min={10} max={16} step={0.5}
                        defaultValue={fontState.size}
                        onChange={e => onSizeChange(parseFloat(e.target.value))}
                        className="flex-1 h-1 accent-orange-500"
                    />
                    <span className="text-[8px] font-mono text-white/50 w-8 tabular-nums">{fontState.size}px</span>
                </div>
            </div>

            <div className="border-t border-white/[0.05] pt-3">
                <input
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5
                               text-[9px] font-mono text-white/70 placeholder-white/20 outline-none
                               focus:border-orange-500/40 transition-colors mb-2"
                    placeholder="Search fonts..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />

                <div className="space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                    {filtered.slice(0, 40).map(font => (
                        <div
                            key={font.family}
                            className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer
                                       hover:bg-white/[0.05] transition-colors"
                            onMouseEnter={() => loadPreview(font.family)}
                        >
                            <span
                                className="flex-1 text-[11px] text-white/60 group-hover:text-white/85"
                                style={{ fontFamily: loadedPreviews.has(font.family) ? `"${font.family}"` : 'inherit' }}
                            >
                                {font.family}
                            </span>
                            <span className="text-[7px] text-white/20 uppercase">{font.category}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {(['sans', 'mono', 'display'] as const).filter(r =>
                                    (font.category as string) === 'any' || (font.category as string) === r
                                ).map(role => (
                                    <button
                                        key={role}
                                        onClick={() => onFontChange(role, `"${font.family}"`)}
                                        className="text-[7px] font-mono px-1 py-0.5 rounded bg-orange-500/20
                                                   text-orange-300 border border-orange-500/30 hover:bg-orange-500/30"
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Shader tab ───────────────────────────────────────────────────────────────

function ShadersTab({
    activeShader, onShaderSelect, uniforms, onUniformChange,
}: {
    activeShader: string | null;
    onShaderSelect: (id: string | null) => void;
    uniforms: Record<string, number>;
    onUniformChange: (name: string, val: number) => void;
}) {
    const active = BUILTIN_SHADER_PRESETS.find(p => p.id === activeShader);

    return (
        <div className="space-y-3">
            <p className="text-[8px] text-white/30 leading-relaxed">
                Apply GLSL shader overlays to the UI chrome. Plugins can register additional shaders.
            </p>

            {/* Preset grid */}
            <div className="grid grid-cols-2 gap-1.5">
                <button
                    onClick={() => onShaderSelect(null)}
                    className={`p-2 rounded-lg border text-left transition-all ${activeShader === null
                        ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                        }`}
                >
                    <p className="text-[8px] font-mono uppercase">None</p>
                    <p className="text-[7px] text-white/25 mt-0.5">No overlay</p>
                </button>

                {BUILTIN_SHADER_PRESETS.map(preset => (
                    <button
                        key={preset.id}
                        onClick={() => onShaderSelect(preset.id)}
                        className={`p-2 rounded-lg border text-left transition-all ${activeShader === preset.id
                            ? 'border-orange-500/50 bg-orange-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/12'
                            }`}
                    >
                        <p className={`text-[8px] font-mono uppercase ${activeShader === preset.id ? 'text-orange-300' : 'text-white/60'}`}>
                            {preset.label}
                        </p>
                        <p className="text-[7px] text-white/25 mt-0.5 leading-snug">{preset.description}</p>
                    </button>
                ))}
            </div>

            {/* Shader uniform controls */}
            {active && (
                <div className="border-t border-white/[0.05] pt-3 space-y-2">
                    <p className="text-[8px] font-mono text-white/40 uppercase tracking-wider">Parameters</p>
                    {Object.entries(active.defaultUniforms).map(([name, def]) => {
                        const currentVal = uniforms[name] ?? def[0];
                        const isFloat01 = def[0] <= 1;
                        const max = isFloat01 ? 1 : Math.max(def[0] * 4, 20);
                        const step = isFloat01 ? 0.01 : 0.1;

                        return (
                            <div key={name} className="flex items-center gap-2">
                                <span className="text-[8px] font-mono text-white/40 w-20 truncate">{name.replace('u_', '')}</span>
                                <input
                                    type="range" min={0} max={max} step={step}
                                    value={currentVal}
                                    onChange={e => onUniformChange(name, parseFloat(e.target.value))}
                                    className="flex-1 h-1 accent-orange-500"
                                />
                                <span className="text-[8px] font-mono text-white/40 w-8 tabular-nums text-right">
                                    {currentVal.toFixed(step < 0.1 ? 2 : 1)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Import / Export tab ──────────────────────────────────────────────────────

function ImportExportTab({ current, onImport }: {
    current: KOSTokens;
    onImport: (tokens: KOSTokens) => void;
}) {
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const json = useMemo(() => serializeTheme(current), [current]);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleCopy = () => {
        navigator.clipboard.writeText(json);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleDownload = () => {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${current.id}-theme.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const theme = parseTheme(ev.target?.result as string);
                onImport(theme);
                setError('');
            } catch (err: any) {
                setError(String(err?.message ?? 'Invalid theme file'));
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04]
                               border border-white/[0.08] text-[9px] font-mono text-white/60
                               hover:text-white/80 transition-colors"
                >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04]
                               border border-white/[0.08] text-[9px] font-mono text-white/60
                               hover:text-white/80 transition-colors"
                >
                    <Download size={10} /> Export .json
                </button>
                <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10
                               border border-orange-500/30 text-[9px] font-mono text-orange-300
                               hover:bg-orange-500/20 transition-colors"
                >
                    <Upload size={10} /> Import
                </button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
            </div>

            {error && (
                <p className="text-[8px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">{error}</p>
            )}

            {/* JSON preview */}
            <div className="bg-black/40 rounded-lg border border-white/[0.05] p-2 max-h-64 overflow-y-auto">
                <pre className="text-[7px] font-mono text-white/40 whitespace-pre-wrap leading-relaxed">
                    {json.slice(0, 1200)}{json.length > 1200 ? '\n...' : ''}
                </pre>
            </div>

            {/* Built-in gallery */}
            <div>
                <p className="text-[8px] font-mono text-white/40 uppercase tracking-wider mb-1.5">Built-in Gallery</p>
                <div className="grid grid-cols-3 gap-1.5">
                    {Object.values(BUILTIN_THEMES).map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => onImport(theme)}
                            className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]
                                       hover:border-white/15 hover:bg-white/[0.04] transition-all text-left"
                        >
                            <div className="flex gap-0.5 mb-1">
                                {(['accentPrimary', 'surfacePrimary', 'textPrimary'] as const).map(k => (
                                    <div key={k} className="h-2 flex-1 rounded-sm"
                                        style={{ background: `hsla(${theme.color[k].join(',').replace(/,(?=[^,]*$)/, '%,').replace(/,/g, '%,').replace(/%,/g, ', ')}` }} />
                                ))}
                            </div>
                            <p className="text-[8px] font-mono text-white/60">{theme.name}</p>
                            <p className="text-[7px] text-white/25 truncate">{theme.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Main ThemeStudio component ───────────────────────────────────────────────

export interface ThemeStudioProps {
    onClose?: () => void;
    /** If embedded, no close button / absolute positioning */
    embedded?: boolean;
}

export function ThemeStudio({ onClose, embedded = false }: ThemeStudioProps) {
    const [tab, setTab] = useState<StudioTab>('colors');
    const [search, setSearch] = useState('');
    const [preview, setPreview] = useState(true);

    // Working copy of the current token set
    const [tokens, setTokens] = useState<KOSTokens>(() => kosRegistry.getActiveTheme());

    // Undo/redo stack
    const historyRef = useRef<KOSTokens[]>([]);
    const historyIdxRef = useRef(0);

    const pushHistory = useCallback((t: KOSTokens) => {
        const stack = historyRef.current.slice(0, historyIdxRef.current + 1);
        stack.push(t);
        historyRef.current = stack.slice(-50);  // keep 50 states
        historyIdxRef.current = historyRef.current.length - 1;
    }, []);

    const undo = useCallback(() => {
        if (historyIdxRef.current <= 0) return;
        historyIdxRef.current -= 1;
        const t = historyRef.current[historyIdxRef.current];
        setTokens(t);
        if (preview) applyTokensToRoot(t);
    }, [preview]);

    const redo = useCallback(() => {
        if (historyIdxRef.current >= historyRef.current.length - 1) return;
        historyIdxRef.current += 1;
        const t = historyRef.current[historyIdxRef.current];
        setTokens(t);
        if (preview) applyTokensToRoot(t);
    }, [preview]);

    // Keyboard undo/redo
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
            if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [undo, redo]);

    const updateTokens = useCallback((next: KOSTokens) => {
        setTokens(next);
        pushHistory(next);
        if (preview) applyTokensToRoot(next);
    }, [preview, pushHistory]);

    const handleColorChange = useCallback((key: keyof ColorTokens, value: HSLA) => {
        setTokens(prev => {
            const next = { ...prev, color: { ...prev.color, [key]: value } };
            pushHistory(next);
            if (preview) applyTokensToRoot(next);
            return next;
        });
    }, [preview, pushHistory]);

    const handleFontChange = useCallback((role: 'sans' | 'mono' | 'display', family: string) => {
        loadFontByFamily(family.replace(/"/g, ''));
        setTokens(prev => {
            const roleKey = { sans: 'fontSans', mono: 'fontMono', display: 'fontDisplay' }[role] as keyof typeof prev.typography;
            const next = { ...prev, typography: { ...prev.typography, [roleKey]: `${family}, ${prev.typography[roleKey]}` } };
            const state = loadFontState();
            state[role] = family;
            saveFontState(state);
            applyFontState(state);
            pushHistory(next);
            return next;
        });
    }, [pushHistory]);

    const handleSizeChange = useCallback((size: number) => {
        const state = loadFontState();
        state.size = size;
        saveFontState(state);
        applyFontState(state);
    }, []);

    // Shader state
    const [activeShader, setActiveShader] = useState<string | null>(null);
    const [shaderUniforms, setShaderUniforms] = useState<Record<string, number>>({});
    const bodyRef = useRef<HTMLElement>(document.body);

    useEffect(() => {
        if (!activeShader) {
            shaderManager.detach('studio_overlay');
            return;
        }
        const preset = BUILTIN_SHADER_PRESETS.find(p => p.id === activeShader);
        if (!preset) return;
        const defaults = Object.fromEntries(Object.entries(preset.defaultUniforms).map(([k, v]) => [k, v[0]]));
        setShaderUniforms(defaults);
        shaderManager.attach('studio_overlay', document.body, {
            glsl: preset.glsl, uniforms: Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, [v]])),
            blendMode: 'screen', opacity: 0.5, zIndex: 9998,
        });
        return () => { shaderManager.detach('studio_overlay'); };
    }, [activeShader]);

    const handleUniformChange = useCallback((name: string, val: number) => {
        setShaderUniforms(prev => ({ ...prev, [name]: val }));
        shaderManager.updateUniform('studio_overlay', name, [val]);
    }, []);

    const handleImport = useCallback((t: KOSTokens) => {
        updateTokens(t);
        applyTokensToRoot(t);
        kosRegistry.setActiveTheme(t.id);
    }, [updateTokens]);

    const handleApply = useCallback(() => {
        kosRegistry.registerTheme(tokens);
        applyTokensToRoot(tokens);
        kosRegistry.setActiveTheme(tokens.id);
    }, [tokens]);

    const handleReset = useCallback(() => {
        const t = kosRegistry.getActiveTheme();
        setTokens(t);
        applyTokensToRoot(t);
    }, []);

    // ─── Tabs config ──────────────────────────────────────────────────────────
    const TABS: Array<{ id: StudioTab; label: string; icon: React.FC<any> }> = [
        { id: 'colors', label: 'Colors', icon: Palette },
        { id: 'typography', label: 'Fonts', icon: Type },
        { id: 'shaders', label: 'Shaders', icon: Zap },
        { id: 'import', label: 'Import/Export', icon: Download },
    ];

    const wrapperCls = embedded
        ? 'flex flex-col w-full h-full bg-[#090910] border border-white/[0.06] rounded-xl overflow-hidden'
        : 'flex flex-col w-[340px] min-h-[520px] max-h-[85vh] bg-[#090910] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden';

    return (
        <div className={wrapperCls}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] shrink-0">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500/30 to-pink-500/20
                                border border-orange-500/30 flex items-center justify-center">
                    <Palette size={11} className="text-orange-400" />
                </div>
                <span className="text-[10px] font-mono text-white/80 tracking-widest uppercase flex-1">
                    Theme Studio
                </span>

                {/* Preview toggle */}
                <button
                    onClick={() => setPreview(v => {
                        if (v) handleReset(); else applyTokensToRoot(tokens);
                        return !v;
                    })}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono transition-colors ${preview ? 'text-orange-300 bg-orange-500/10' : 'text-white/30 hover:text-white/50'
                        }`}
                >
                    {preview ? <Eye size={9} /> : <EyeOff size={9} />}
                    Live
                </button>

                {/* Undo/Redo */}
                <button onClick={undo} className="p-1 text-white/30 hover:text-white/60 transition-colors" title="Undo (Ctrl+Z)">
                    <RotateCcw size={10} />
                </button>

                {!embedded && onClose && (
                    <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60 ml-1">
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* Active theme info */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.04] shrink-0">
                <div className="flex gap-1">
                    {(['accentPrimary', 'surfaceSecondary', 'textPrimary'] as const).map(k => (
                        <div key={k} className="w-3 h-3 rounded-full"
                            style={{ background: `hsla(${tokens.color[k].join(',').replace(/(\d+\.?\d*),(\d+\.?\d*),(\d+\.?\d*),(\d+\.?\d*)/, '$1, $2%, $3%, $4')})` }} />
                    ))}
                </div>
                <select
                    className="flex-1 text-[8px] font-mono text-white/50 bg-transparent outline-none"
                    value={tokens.id}
                    onChange={e => {
                        const t = (BUILTIN_THEMES as Record<string, KOSTokens>)[e.target.value];
                        if (t) { updateTokens(t); kosRegistry.setActiveTheme(t.id); }
                    }}
                >
                    {(Object.values(BUILTIN_THEMES) as KOSTokens[]).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <button
                    onClick={handleApply}
                    className="px-2 py-0.5 rounded text-[8px] font-mono bg-orange-500/20
                               border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-colors"
                >
                    Apply
                </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/[0.05] shrink-0">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[8px] font-mono
                                        uppercase tracking-wider transition-colors ${active ? 'text-orange-300 border-b border-orange-500/60 bg-orange-500/[0.06]'
                                    : 'text-white/30 hover:text-white/55'
                                }`}
                        >
                            <Icon size={9} />
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Search (colors only) */}
            {tab === 'colors' && (
                <div className="px-2 py-1.5 border-b border-white/[0.04] shrink-0">
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06]
                                    rounded-lg px-2 py-1">
                        <Search size={9} className="text-white/30" />
                        <input
                            className="flex-1 bg-transparent text-[9px] font-mono text-white/60
                                       placeholder-white/20 outline-none"
                            placeholder="Search tokens..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
                {tab === 'colors' && (
                    <ColorsTab tokens={tokens} onTokenChange={handleColorChange} search={search} />
                )}
                {tab === 'typography' && (
                    <TypographyTab
                        tokens={tokens}
                        onFontChange={handleFontChange}
                        onSizeChange={handleSizeChange}
                    />
                )}
                {tab === 'shaders' && (
                    <ShadersTab
                        activeShader={activeShader}
                        onShaderSelect={setActiveShader}
                        uniforms={shaderUniforms}
                        onUniformChange={handleUniformChange}
                    />
                )}
                {tab === 'import' && (
                    <ImportExportTab current={tokens} onImport={handleImport} />
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.04] shrink-0">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-[8px] font-mono text-white/30
                               hover:text-white/55 transition-colors"
                >
                    <RotateCcw size={8} /> Reset
                </button>
                <div className="flex-1" />
                <p className="text-[7px] font-mono text-white/20">
                    Ctrl+Z undo · Ctrl+Y redo
                </p>
            </div>
        </div>
    );
}

export default ThemeStudio;
