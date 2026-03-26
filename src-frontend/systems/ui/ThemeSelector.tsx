/**
 * Theme Selector Component
 * 
 * UI for switching between themes, either globally or per-app.
 */

import React from 'react';
import { useTheme, type ThemeStyle } from '@/systems/ui';
import { cn } from '@/ui/primitives/cn';
import { Check, Palette, Monitor, Sparkles, Minimize2 } from 'lucide-react';

interface ThemeSelectorProps {
    /** Mode: 'global' applies to all apps, 'app' applies only to current app */
    mode?: 'global' | 'app';
    /** Compact layout */
    compact?: boolean;
    /** Additional CSS classes */
    className?: string;
}

const themeIcons: Record<ThemeStyle, React.ReactNode> = {
    classic: <Monitor size={16} />,
    glass: <Sparkles size={16} />,
    neon: <Palette size={16} />,
    minimal: <Minimize2 size={16} />,
};

const themePreviewColors: Record<ThemeStyle, { bg: string; accent: string; border: string }> = {
    classic: {
        bg: 'bg-[#0b0b0b]',
        accent: 'bg-cyan-400',
        border: 'border-[#333]',
    },
    glass: {
        bg: 'bg-purple-900/40',
        accent: 'bg-purple-400',
        border: 'border-white/10',
    },
    neon: {
        bg: 'bg-[#050510]',
        accent: 'bg-green-400',
        border: 'border-green-500/30',
    },
    minimal: {
        bg: 'bg-neutral-900',
        accent: 'bg-white',
        border: 'border-white/5',
    },
};

export function ThemeSelector({ mode = 'app', compact = false, className }: ThemeSelectorProps) {
    const {
        currentTheme,
        availableThemes,
        getThemeName,
        getThemeDescription,
        setTheme,
        setGlobalTheme,
        appId
    } = useTheme();

    const handleSelect = (theme: ThemeStyle) => {
        if (mode === 'global') {
            setGlobalTheme(theme);
        } else {
            setTheme(theme);
        }
    };

    if (compact) {
        return (
            <div className={cn('flex gap-1', className)}>
                {availableThemes.map((theme) => {
                    const isActive = currentTheme === theme;
                    const colors = themePreviewColors[theme];

                    return (
                        <button
                            key={theme}
                            onClick={() => handleSelect(theme)}
                            className={cn(
                                'w-8 h-8 rounded-md border-2 transition-all relative',
                                colors.bg,
                                isActive ? 'border-white scale-110' : colors.border + ' hover:scale-105',
                            )}
                            title={getThemeName(theme)}
                        >
                            <div className={cn(
                                'absolute bottom-1 right-1 w-2 h-2 rounded-full',
                                colors.accent
                            )} />
                            {isActive && (
                                <Check size={12} className="absolute top-1 left-1 text-white" />
                            )}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
            <div className="text-[10px] font-black tracking-wider text-[color:var(--kos-text-muted)] mb-3">
                {mode === 'global' ? 'GLOBAL THEME' : `THEME FOR ${appId.toUpperCase()}`}
            </div>

            <div className="grid grid-cols-2 gap-2">
                {availableThemes.map((theme) => {
                    const isActive = currentTheme === theme;
                    const colors = themePreviewColors[theme];

                    return (
                        <button
                            key={theme}
                            onClick={() => handleSelect(theme)}
                            className={cn(
                                'p-3 rounded-lg border-2 transition-all text-left kos-theme-transition',
                                colors.bg,
                                isActive
                                    ? 'border-[color:var(--kos-accent-primary)] ring-2 ring-[color:var(--kos-accent-glow)]'
                                    : colors.border + ' hover:border-[color:var(--kos-border-hover)]',
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className={cn(
                                    'w-6 h-6 rounded flex items-center justify-center',
                                    colors.accent,
                                    'text-black'
                                )}>
                                    {themeIcons[theme]}
                                </div>
                                <span className="font-bold text-[11px] text-white">
                                    {getThemeName(theme)}
                                </span>
                                {isActive && (
                                    <Check size={14} className="ml-auto text-[color:var(--kos-accent-primary)]" />
                                )}
                            </div>
                            <p className="text-[9px] text-gray-400 leading-tight">
                                {getThemeDescription(theme)}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Inline theme toggle for toolbar use
 */
export function ThemeToggle({ className }: { className?: string }) {
    const { currentTheme, availableThemes, setTheme, getThemeName } = useTheme();

    const currentIndex = availableThemes.indexOf(currentTheme);
    const nextTheme = availableThemes[(currentIndex + 1) % availableThemes.length];

    return (
        <button
            onClick={() => setTheme(nextTheme)}
            className={cn(
                'px-2 py-1 rounded text-[10px] font-bold',
                'bg-[color:var(--kos-surface-tertiary)]',
                'border border-[color:var(--kos-border-primary)]',
                'hover:bg-[color:var(--kos-surface-hover)]',
                'hover:border-[color:var(--kos-border-hover)]',
                'transition-colors',
                className
            )}
            title={`Switch to ${getThemeName(nextTheme)}`}
        >
            <span className="flex items-center gap-1.5">
                {themeIcons[currentTheme]}
                <span className="uppercase">{getThemeName(currentTheme)}</span>
            </span>
        </button>
    );
}
