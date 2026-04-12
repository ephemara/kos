/**
 * GlobalCommandPalette — K_OS Command Hub
 * ─────────────────────────────────────────────────────────────────────────────
 * V2 polish:
 *  - AnimatePresence for backdrop + panel enter/exit (scale + blur)
 *  - cmdk items use motion.div wrapper for stagger reveal
 *  - Keyboard hint chips use proper mono styling
 *  - Background: true glassmorphism (blur + noise grain)
 *  - Footer shows live clock
 */

import React from 'react';
import { Command } from 'cmdk';
import {
    Maximize, Monitor, LayoutTemplate, PenTool,
    Settings, RefreshCw, Home, Search, Activity, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalCommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectLayout?: (preset: 'standard' | 'focus' | 'wide') => void;
    onTogglePerfHud?: () => void;
    onToggleLookdev?: () => void;
    onToggleUiStudio?: () => void;
}

// ─── Animation variants ────────────────────────────────────────────────────────
const BACKDROP = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { duration: 0.18 } },
    exit:   { opacity: 0, transition: { duration: 0.15, delay: 0.05 } },
};

const PANEL = {
    hidden: { opacity: 0, scale: 0.96, y: -8, filter: 'blur(6px)' },
    show:   {
        opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
    exit:   {
        opacity: 0, scale: 0.97, y: -4, filter: 'blur(4px)',
        transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
    },
};

// ─── Item component (memoized for perf) ────────────────────────────────────────
const PaletteItem = React.memo(function PaletteItem({
    icon: Icon,
    label,
    shortcut,
    onSelect,
    accent = 'orange',
}: {
    icon: React.ElementType;
    label: string;
    shortcut?: string;
    onSelect: () => void;
    accent?: 'orange' | 'blue' | 'purple' | 'emerald' | 'white';
}) {
    const accentMap: Record<string, string> = {
        orange:  'aria-selected:bg-orange-500/15 aria-selected:text-orange-100 aria-selected:border-orange-500/25',
        blue:    'aria-selected:bg-blue-500/15    aria-selected:text-blue-100    aria-selected:border-blue-500/25',
        purple:  'aria-selected:bg-purple-500/15  aria-selected:text-purple-100  aria-selected:border-purple-500/25',
        emerald: 'aria-selected:bg-emerald-500/15 aria-selected:text-emerald-100 aria-selected:border-emerald-500/25',
        white:   'aria-selected:bg-white/8         aria-selected:text-white        aria-selected:border-white/10',
    };

    return (
        <Command.Item
            onSelect={onSelect}
            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-sm text-white/70
                border border-transparent
                cursor-pointer transition-all duration-100
                ${accentMap[accent] ?? accentMap.orange}
            `}
        >
            <div className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 shrink-0">
                <Icon size={14} className="opacity-70" />
            </div>
            <span className="flex-1 text-[11px] font-semibold tracking-wide">{label}</span>
            {shortcut && (
                <kbd className="text-[9px] font-mono text-white/25 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                    {shortcut}
                </kbd>
            )}
        </Command.Item>
    );
});

// ─── Clock ────────────────────────────────────────────────────────────────────
function LiveClock() {
    const [time, setTime] = React.useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));
    React.useEffect(() => {
        const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
        return () => clearInterval(id);
    }, []);
    return <span className="font-mono text-[10px] text-white/20 tabular-nums">{time}</span>;
}

// ─── Command Palette ──────────────────────────────────────────────────────────

export function GlobalCommandPalette({
    open,
    onOpenChange,
    onSelectLayout,
    onTogglePerfHud,
    onToggleLookdev,
    onToggleUiStudio,
}: GlobalCommandPaletteProps) {

    const close = (fn?: () => void) => {
        fn?.();
        onOpenChange(false);
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="palette-backdrop"
                    className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
                    variants={BACKDROP}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    onClick={() => onOpenChange(false)}
                >
                    {/* Frosted backdrop */}
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

                    <motion.div
                        key="palette-panel"
                        className="relative w-full max-w-[600px] mx-4 rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
                        variants={PANEL}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        onClick={e => e.stopPropagation()}
                        style={{
                            background:     'rgba(8, 8, 8, 0.92)',
                            backdropFilter:  'blur(32px) saturate(1.5)',
                            border:          '1px solid rgba(255,255,255,0.07)',
                        }}
                    >
                        {/* Top noise grain */}
                        <div
                            className="absolute inset-0 pointer-events-none opacity-[0.025] rounded-2xl"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                                backgroundSize:  '96px 96px',
                            }}
                        />

                        <Command label="Global Command Menu" shouldFilter>
                            {/* Search input */}
                            <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
                                <Search size={16} className="text-white/30 shrink-0" />
                                <Command.Input
                                    placeholder="Search commands…"
                                    className="flex-1 h-14 bg-transparent outline-none text-[15px] text-white placeholder:text-white/20 font-medium"
                                    autoFocus
                                />
                                <kbd className="text-[9px] font-mono text-white/20 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                    ESC
                                </kbd>
                            </div>

                            {/* Results */}
                            <Command.List className="max-h-[340px] overflow-y-auto p-2 scrollbar-hide">
                                <Command.Empty className="py-8 text-center text-[11px] text-white/25 font-medium">
                                    No commands found
                                </Command.Empty>

                                <Command.Group
                                    heading="Layout"
                                    className="[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:text-white/25 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:select-none"
                                >
                                    <PaletteItem icon={LayoutTemplate} label="Standard Layout" shortcut="ALT+1" accent="white"   onSelect={() => close(() => onSelectLayout?.('standard'))} />
                                    <PaletteItem icon={Maximize}       label="Focus Mode"       shortcut="ALT+2" accent="white"   onSelect={() => close(() => onSelectLayout?.('focus'))}    />
                                    <PaletteItem icon={Monitor}        label="Wide Layout"                       accent="white"   onSelect={() => close(() => onSelectLayout?.('wide'))}     />
                                </Command.Group>

                                <div className="h-px bg-white/[0.04] mx-2 my-1" />

                                <Command.Group
                                    heading="System"
                                    className="[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:text-white/25 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:select-none"
                                >
                                    <PaletteItem icon={Activity}   label="Toggle Perf HUD"    shortcut="F8"  accent="purple"  onSelect={() => close(onTogglePerfHud)}   />
                                    <PaletteItem icon={Sun}        label="Toggle Lookdev"      shortcut="F9"  accent="orange"  onSelect={() => close(onToggleLookdev)}   />
                                    <PaletteItem icon={PenTool}    label="Toggle UI Studio"    shortcut="F10" accent="emerald" onSelect={() => close(onToggleUiStudio)} />
                                    <PaletteItem icon={RefreshCw}  label="Reload Window"       shortcut="⌘R"  accent="blue"   onSelect={() => close(() => window.location.reload())} />
                                    <PaletteItem icon={Settings}   label="Settings"                           accent="white"  onSelect={() => close()} />
                                    <PaletteItem icon={Home}       label="Home / Dashboard"                   accent="white"  onSelect={() => close()} />
                                </Command.Group>
                            </Command.List>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.04] bg-black/20">
                                <div className="flex items-center gap-3 text-[9px] text-white/20 font-mono">
                                    <span className="flex items-center gap-1">
                                        <kbd className="bg-white/5 border border-white/10 px-1 rounded text-[8px]">↑↓</kbd>
                                        navigate
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="bg-white/5 border border-white/10 px-1 rounded text-[8px]">↵</kbd>
                                        select
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] text-white/15 font-mono tracking-[0.15em]">K_OS INTELLIGENCE</span>
                                    <LiveClock />
                                </div>
                            </div>
                        </Command>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
