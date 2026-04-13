/**
 * BrushSelector.tsx — ZBrush-style compact icon grid
 * 
 * Tight 4-column icon grid with category tabs.
 * Uses all inline styles for the grid to avoid Tailwind/Radix conflicts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { brushClient, type KBrushAsset } from '@/services/brushClient';
import {
    Paintbrush, Circle, Move, Activity, Square, Maximize, Minimize2,
    PenTool, Eraser, Archive, Layers, Wind, Mountain,
    Tornado, Magnet, Sprout, Flame, Sun, Sparkles,
    Zap, Atom, ScanLine, Shuffle, Globe,
    Scissors, RotateCw, Flower, Feather,
    Thermometer, Snowflake, Droplet, Hash, Waves, Search, X,
    ChevronRight
} from 'lucide-react';

// ─── Icon map ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, any> = {
    clay: Circle, smooth: Activity, move: Move, flatten: Square,
    inflate: Maximize, pinch: Minimize2, draw: PenTool, scrape: Eraser,
    fill: Archive, paint: Paintbrush, layers: Layers, wind: Wind,
    mountain: Mountain, waves: Waves, tornado: Tornado, magnet: Magnet,
    sprout: Sprout, flame: Flame, sun: Sun, sparkles: Sparkles,
    zap: Zap, atom: Atom, scan: ScanLine, shuffle: Shuffle, globe: Globe,
    scissors: Scissors, rotate: RotateCw, flower: Flower, feather: Feather,
    thermometer: Thermometer, snowflake: Snowflake, droplet: Droplet,
    hash: Hash, crease: Scissors, cloth: Feather, default: Paintbrush,
};

function getIcon(brush: KBrushAsset): React.ComponentType<any> {
    if (!brush?.name) return ICON_MAP.default;
    const n = brush.name.toLowerCase();
    const c = (brush.category ?? '').toLowerCase();
    const k: string = ((brush.kernel as any)?.family ?? '').toLowerCase();
    for (const key of [n, c, k]) {
        if (key && ICON_MAP[key]) return ICON_MAP[key];
        for (const [mk, icon] of Object.entries(ICON_MAP)) {
            if (key && key.includes(mk)) return icon;
        }
    }
    return ICON_MAP.default;
}

function isKAIN(brush: KBrushAsset) {
    return (brush.kernel as any)?.family === 'spirv';
}

function shortLabel(s: string, maxLen = 9): string {
    const last = s.split('/').pop() ?? s;
    return last.length > maxLen ? last.slice(0, maxLen - 1) + '…' : last;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface BrushSelectorProps {
    selectedBrush: KBrushAsset;
    onBrushSelect: (brush: KBrushAsset) => void;
    className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const BrushSelector: React.FC<BrushSelectorProps> = ({
    selectedBrush,
    onBrushSelect,
    className = '',
}) => {
    const [brushes, setBrushes] = useState<KBrushAsset[]>([]);
    const [rawCats, setRawCats] = useState<string[]>([]);
    const [activeCat, setActiveCat] = useState('All');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        (async () => {
            try {
                if (!brushClient.isReady()) await brushClient.init();
                const all = brushClient.getAllBrushes();
                setBrushes(all);
                setRawCats(['All', ...Array.from(new Set(all.map(b => b.category)))]);
            } catch (e) {
                console.error('[BrushSelector]', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const categories = useMemo(() => [...rawCats, 'KAIN'], [rawCats]);

    const filtered = useMemo(() => {
        return brushes.filter(b => {
            if (!b?.name || !b?.category) return false;
            if (activeCat === 'KAIN') return isKAIN(b);
            const matchCat = activeCat === 'All' || b.category === activeCat;
            const q = search.toLowerCase();
            const matchQ = !q
                || b.name.toLowerCase().includes(q)
                || b.category.toLowerCase().includes(q)
                || (b.tags ?? []).some(t => t.toLowerCase().includes(q));
            return matchCat && matchQ;
        });
    }, [brushes, activeCat, search]);

    // ── Loading ────────────────────────────────────────────────────────────

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
            <div className="w-5 h-5 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
        </div>
    );

    const shortCat = (c: string) => c.split('/').pop() ?? c;

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }} className={className}>

            {/* ACTIVE BRUSH HEADER — prominent display of current brush */}
            {selectedBrush && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    borderBottom: '1px solid #1a1a1a',
                    background: 'rgba(249,115,22,0.06)',
                }}>
                    {React.createElement(getIcon(selectedBrush), {
                        size: 14,
                        style: { color: 'rgb(251,146,60)', flexShrink: 0 }
                    })}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#e5e5e5', letterSpacing: '0.04em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {selectedBrush.name}
                        </div>
                        <div style={{ fontSize: 8, color: '#555', marginTop: 1 }}>
                            {shortCat(selectedBrush.category)}
                            {isKAIN(selectedBrush) && <span style={{ marginLeft: 4, color: '#a78bfa' }}>KAIN</span>}
                        </div>
                    </div>
                    <ChevronRight size={10} style={{ color: '#444', flexShrink: 0 }} />
                </div>
            )}

            {/* SEARCH */}
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #161616' }}>
                <div style={{ position: 'relative' }}>
                    <Search
                        size={9}
                        style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }}
                    />
                    <input
                        type="text"
                        placeholder="Search…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            paddingLeft: 22, paddingRight: search ? 22 : 8, paddingTop: 4, paddingBottom: 4,
                            background: '#080808', border: '1px solid #1e1e1e', borderRadius: 5,
                            fontSize: 10, color: '#ccc', outline: 'none',
                            fontFamily: 'inherit',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(249,115,22,0.4)')}
                        onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}
                        >
                            <X size={9} />
                        </button>
                    )}
                </div>
            </div>

            {/* CATEGORY TABS — horizontal scroll */}
            <div style={{ overflowX: 'auto', borderBottom: '1px solid #161616', scrollbarWidth: 'none' }}>
                <div style={{ display: 'flex', gap: 4, padding: '5px 8px', minWidth: 'max-content' }}>
                    {categories.map(cat => {
                        const active = activeCat === cat;
                        const special = cat === 'KAIN';
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCat(cat)}
                                style={{
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    border: '1px solid',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    letterSpacing: '0.05em',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'inherit',
                                    transition: 'all 120ms',
                                    background: active
                                        ? special ? 'rgba(139,92,246,0.15)' : 'rgba(249,115,22,0.12)'
                                        : 'transparent',
                                    borderColor: active
                                        ? special ? 'rgba(139,92,246,0.4)' : 'rgba(249,115,22,0.35)'
                                        : '#222',
                                    color: active
                                        ? special ? '#c4b5fd' : '#fdba74'
                                        : special ? '#6d28d9' : '#555',
                                }}
                            >
                                {shortCat(cat)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* BRUSH GRID — 4 columns, ZBrush-style compact icons */}
            {filtered.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 9, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    No brushes
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 3,
                    padding: 8,
                }}>
                    {filtered.map(brush => {
                        if (!brush) return null;
                        const Icon = getIcon(brush);
                        const sel = selectedBrush?.id === brush.id;
                        const spirv = isKAIN(brush);

                        return (
                            <button
                                key={brush.id ?? brush.name}
                                onClick={() => onBrushSelect(brush)}
                                title={brush.name}
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 3,
                                    padding: '8px 2px 6px',
                                    borderRadius: 6,
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    background: sel ? 'rgba(249,115,22,0.1)' : '#0a0a0a',
                                    borderColor: sel ? 'rgba(249,115,22,0.5)' : '#1c1c1c',
                                    transition: 'all 100ms',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => {
                                    if (!sel) {
                                        (e.currentTarget as HTMLElement).style.background = '#131313';
                                        (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!sel) {
                                        (e.currentTarget as HTMLElement).style.background = '#0a0a0a';
                                        (e.currentTarget as HTMLElement).style.borderColor = '#1c1c1c';
                                    }
                                }}
                            >
                                {/* KAIN dot */}
                                {spirv && (
                                    <span style={{
                                        position: 'absolute', top: 2, right: 2,
                                        width: 4, height: 4, borderRadius: '50%',
                                        background: '#8b5cf6',
                                    }} />
                                )}
                                <Icon
                                    size={15}
                                    style={{ color: sel ? 'rgb(251,146,60)' : '#555', display: 'block' }}
                                />
                                <span style={{
                                    fontSize: 7,
                                    fontWeight: 700,
                                    color: sel ? '#fdba74' : '#4a4a4a',
                                    letterSpacing: '0.02em',
                                    lineHeight: 1.2,
                                    textAlign: 'center',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    padding: '0 2px',
                                }}>
                                    {shortLabel(brush.name)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
