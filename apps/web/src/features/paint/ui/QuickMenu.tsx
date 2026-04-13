/**
 * QuickMenu.tsx - Unified Quick Menu for KPainter
 * 
 * Uses the reusable FloatingQuickMenu component from core/ui/shell.
 * TODO: Expand with brush presets, mods, etc.
 */

import React from 'react';
import { Paintbrush, Droplets, Sparkles, Circle } from 'lucide-react';
import { FloatingQuickMenu, type FloatingQuickMenuCommand } from '@/ui/shell/FloatingQuickMenu';
import { ButterSlider } from '@/ui/primitives/ButterSlider';

export interface KPainterQuickMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;

    brush: any;
    setBrush: (brush: any) => void;

    pinned: boolean;
    setPinned: (pinned: boolean) => void;

    // Legacy props (for gradual migration)
    alphas?: any[];
    blackHole?: any;
    setBlackHole?: (bh: any) => void;
    activeMods?: Record<string, boolean>;
    setActiveMods?: (mods: any) => void;
    modParams?: any;
    setModParams?: (params: any) => void;
}

const BRUSH_TYPES = [
    { id: 'standard', label: 'Standard', icon: Paintbrush, desc: 'Basic paint brush' },
    { id: 'INK', label: 'Ink', icon: Droplets, desc: 'Smooth ink strokes' },
    { id: 'airbrush', label: 'Airbrush', icon: Sparkles, desc: 'Soft spray' },
];

export function KPainterQuickMenu({
    open,
    onOpenChange,
    brush,
    setBrush,
    pinned,
    setPinned,
    alphas = [],
    activeMods = {},
    setActiveMods,
}: KPainterQuickMenuProps) {
    const commands: FloatingQuickMenuCommand[] = React.useMemo(
        () =>
            BRUSH_TYPES.map((b) => ({
                id: b.id,
                label: b.label,
                description: b.desc,
                icon: b.icon,
                keywords: [b.id, b.label, 'brush', 'paint'],
                action: () => setBrush((prev: any) => ({ ...prev, type: b.id })),
            })),
        [setBrush]
    );

    return (
        <FloatingQuickMenu
            open={open}
            onOpenChange={onOpenChange}
            title="K-PAINTER"
            placeholder="Search brushes..."
            commands={commands}
            isCommandActive={(c) => c.id === brush.type}
            pinned={pinned}
            onPinnedChange={setPinned}
            persistKey="kpainter:quickmenu-v1"
            footer={
                <div className="border-t border-white/10 bg-[#070707]/60 px-2 py-1.5 space-y-1">
                    <ButterSlider
                        label="SIZE"
                        value={brush.size}
                        onValueChange={(v) => setBrush((prev: any) => ({ ...prev, size: v }))}
                        min={1}
                        max={200}
                        step={1}
                        toneClassName="text-blue-400"
                    />
                    <ButterSlider
                        label="OPACITY"
                        value={brush.opacity}
                        onValueChange={(v) => setBrush((prev: any) => ({ ...prev, opacity: v }))}
                        min={0}
                        max={1}
                        step={0.01}
                        toneClassName="text-green-400"
                    />
                    <ButterSlider
                        label="FLOW"
                        value={brush.flow}
                        onValueChange={(v) => setBrush((prev: any) => ({ ...prev, flow: v }))}
                        min={0}
                        max={1}
                        step={0.01}
                        toneClassName="text-orange-400"
                    />
                </div>
            }
        />
    );
}

export default KPainterQuickMenu;
