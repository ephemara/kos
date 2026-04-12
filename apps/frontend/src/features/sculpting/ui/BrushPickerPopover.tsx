/**
 * BrushPickerPopover.tsx
 * 
 * ZBrush-style brush picker: compact button in the top bar that opens a
 * floating popover with a searchable icon grid. Click to pick, disappears.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { brushClient, type KBrushAsset } from '@/services/brushClient';
import {
    Paintbrush, Circle, Move, Activity, Square, Maximize, Minimize2,
    PenTool, Eraser, Archive, Layers, Wind, Mountain,
    Tornado, Magnet, Sprout, Flame, Sun, Sparkles,
    Zap, Atom, ScanLine, Shuffle, Globe,
    Scissors, RotateCw, Flower, Feather,
    Thermometer, Snowflake, Droplet, Hash, Waves, Search, X,
    ChevronDown
} from 'lucide-react';

// ─── Icon map ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<any>> = {
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
        if (!key) continue;
        if (ICON_MAP[key]) return ICON_MAP[key];
        for (const [mk, icon] of Object.entries(ICON_MAP)) {
            if (key.includes(mk)) return icon;
        }
    }
    return ICON_MAP.default;
}

function isKAIN(brush: KBrushAsset) {
    return (brush.kernel as any)?.family === 'spirv';
}

function shortLabel(s: string): string {
    const last = s.split('/').pop() ?? s;
    return last.length > 8 ? last.slice(0, 7) + '…' : last;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface BrushPickerPopoverProps {
    activeBrush: KBrushAsset;
    setActiveBrush: (brush: KBrushAsset) => void;
    brushesLoaded?: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BrushPickerPopover({ activeBrush, setActiveBrush, brushesLoaded }: BrushPickerPopoverProps) {
    const [open, setOpen] = useState(false);
    const [brushes, setBrushes] = useState<KBrushAsset[]>([]);
    const [rawCats, setRawCats] = useState<string[]>(['All']);
    const [activeCat, setActiveCat] = useState('All');
    const [search, setSearch] = useState('');
    const [loaded, setLoaded] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Load brushes once on first open
    useEffect(() => {
        if (!open || loaded) return;
        (async () => {
            try {
                if (!brushClient.isReady()) await brushClient.init();
                const all = brushClient.getAllBrushes();
                setBrushes(all);
                setRawCats(['All', ...Array.from(new Set(all.map(b => b.category)))]);
                setLoaded(true);
            } catch (e) {
                console.error('[BrushPickerPopover]', e);
            }
        })();
    }, [open, loaded]);

    // Focus search on open
    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 80);
    }, [open]);

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

    const shortCat = (c: string) => c.split('/').pop() ?? c;

    const ActiveIcon = activeBrush ? getIcon(activeBrush) : Paintbrush;

    // ── Trigger button: compact square showing active brush ──────────────────

    const trigger = (
        <Popover.Trigger asChild>
            <button
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 10px', height: 32,
                    background: open ? 'rgba(249,115,22,0.12)' : '#111',
                    border: `1px solid ${open ? 'rgba(249,115,22,0.45)' : '#2a2a2a'}`,
                    borderRadius: 6, cursor: 'pointer',
                    transition: 'all 140ms',
                    outline: 'none', fontFamily: 'inherit',
                }}
                title="Pick brush (B)"
            >
                {/* Brush icon */}
                <div style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <ActiveIcon size={12} style={{ color: 'rgb(251,146,60)' }} />
                </div>
                {/* Name */}
                {activeBrush?.name && (
                    <span style={{
                        fontSize: 10, fontWeight: 800, color: '#ccc',
                        letterSpacing: '0.04em', maxWidth: 72,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {shortLabel(activeBrush.name)}
                    </span>
                )}
                <ChevronDown size={9} style={{ color: '#555', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>
        </Popover.Trigger>
    );

    // ── Popover content ───────────────────────────────────────────────────────

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            {trigger}

            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    style={{
                        width: 340,
                        maxHeight: 480,
                        background: '#0d0d0d',
                        border: '1px solid #222',
                        borderRadius: 10,
                        boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 9999,
                        fontFamily: 'inherit',
                    }}
                >
                    {/* HEADER */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderBottom: '1px solid #1a1a1a',
                        background: '#090909',
                    }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                            Brush Library
                        </span>
                        {/* SEARCH */}
                        <div style={{ position: 'relative', flex: 1, maxWidth: 180, marginLeft: 10 }}>
                            <Search size={9} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    paddingLeft: 22, paddingRight: search ? 22 : 8,
                                    paddingTop: 3, paddingBottom: 3,
                                    background: '#111', border: '1px solid #222',
                                    borderRadius: 5, fontSize: 10, color: '#ddd',
                                    outline: 'none', fontFamily: 'inherit',
                                }}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 0 }}
                                >
                                    <X size={9} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* CATEGORY TABS */}
                    <div style={{ overflowX: 'auto', borderBottom: '1px solid #161616', scrollbarWidth: 'none', background: '#090909' }}>
                        <div style={{ display: 'flex', gap: 3, padding: '5px 8px', minWidth: 'max-content' }}>
                            {categories.map(cat => {
                                const isActive = activeCat === cat;
                                const isSpecial = cat === 'KAIN';
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCat(cat)}
                                        style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            border: '1px solid',
                                            fontSize: 8, fontWeight: 800,
                                            letterSpacing: '0.06em',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            fontFamily: 'inherit',
                                            transition: 'all 100ms',
                                            background: isActive
                                                ? isSpecial ? 'rgba(139,92,246,0.15)' : 'rgba(249,115,22,0.12)'
                                                : 'transparent',
                                            borderColor: isActive
                                                ? isSpecial ? 'rgba(139,92,246,0.4)' : 'rgba(249,115,22,0.35)'
                                                : '#222',
                                            color: isActive
                                                ? isSpecial ? '#c4b5fd' : '#fdba74'
                                                : isSpecial ? '#6d28d9' : '#555',
                                        }}
                                    >
                                        {shortCat(cat)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* BRUSH GRID — scrollable */}
                    <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
                        {!loaded ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                                <div className="w-5 h-5 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 9, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                No brushes found
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: 4,
                            }}>
                                {filtered.map(brush => {
                                    if (!brush) return null;
                                    const Icon = getIcon(brush);
                                    const sel = activeBrush?.id === brush.id;
                                    const spirv = isKAIN(brush);

                                    return (
                                        <button
                                            key={brush.id ?? brush.name}
                                            onClick={() => {
                                                setActiveBrush(brush);
                                                setOpen(false);
                                                setSearch('');
                                            }}
                                            title={brush.name}
                                            style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 4,
                                                padding: '10px 4px 7px',
                                                borderRadius: 7,
                                                border: '1px solid',
                                                cursor: 'pointer',
                                                background: sel ? '#1a0e06' : '#0d0d0d',
                                                borderColor: sel ? 'rgba(249,115,22,0.6)' : '#1c1c1c',
                                                boxShadow: sel ? '0 0 0 1px rgba(249,115,22,0.2) inset' : 'none',
                                                outline: 'none',
                                                fontFamily: 'inherit',
                                                transition: 'all 80ms',
                                            }}
                                            onMouseEnter={e => {
                                                if (!sel) {
                                                    const el = e.currentTarget as HTMLElement;
                                                    el.style.background = '#151515';
                                                    el.style.borderColor = '#2e2e2e';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!sel) {
                                                    const el = e.currentTarget as HTMLElement;
                                                    el.style.background = '#0d0d0d';
                                                    el.style.borderColor = '#1c1c1c';
                                                }
                                            }}
                                        >
                                            {spirv && (
                                                <span style={{
                                                    position: 'absolute', top: 3, right: 3,
                                                    width: 4, height: 4, borderRadius: '50%',
                                                    background: '#8b5cf6',
                                                }} />
                                            )}
                                            <Icon
                                                size={16}
                                                style={{ color: sel ? 'rgb(251,146,60)' : '#505050' }}
                                            />
                                            <span style={{
                                                fontSize: 7, fontWeight: 700,
                                                color: sel ? '#fdba74' : '#454545',
                                                letterSpacing: '0.02em',
                                                lineHeight: 1.2,
                                                textAlign: 'center',
                                                width: '100%',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                padding: '0 3px',
                                            }}>
                                                {shortLabel(brush.name)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ACTIVE BRUSH FOOTER */}
                    {activeBrush && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 10px',
                            borderTop: '1px solid #1a1a1a',
                            background: '#090909',
                        }}>
                            {React.createElement(getIcon(activeBrush), {
                                size: 12,
                                style: { color: 'rgb(251,146,60)', flexShrink: 0 }
                            })}
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {activeBrush.name}
                            </span>
                            {isKAIN(activeBrush) && (
                                <span style={{
                                    fontSize: 7, fontWeight: 800, color: '#a78bfa',
                                    padding: '1px 5px', borderRadius: 3,
                                    background: 'rgba(139,92,246,0.15)',
                                    border: '1px solid rgba(139,92,246,0.3)',
                                    letterSpacing: '0.08em',
                                }}>
                                    KAIN
                                </span>
                            )}
                            <span style={{ fontSize: 8, color: '#444', fontVariantNumeric: 'tabular-nums' }}>
                                R {activeBrush.params.radius.toFixed(2)} · S {activeBrush.params.strength.toFixed(2)}
                            </span>
                        </div>
                    )}

                    <Popover.Arrow style={{ fill: '#222' }} />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
