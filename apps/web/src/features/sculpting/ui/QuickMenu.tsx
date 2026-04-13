/**
 * QuickMenu.tsx - Unified Brush Quick Menu for KSculpt
 * 
 * Shows ALL brushes from the data-driven brush library in one unified menu.
 * Moved to ui/ folder for better organization.
 */

import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { FloatingQuickMenu, type FloatingQuickMenuCommand } from '@/ui/shell/FloatingQuickMenu';
import { ButterSlider } from '@/ui/primitives/ButterSlider';
import { brushClient, type KBrushAsset } from '@/services/brushClient';
import { ALL_BRUSHES, STANDARD_BRUSHES, SIMULATION_BRUSHES, type BrushDefinition } from '../constants';

export type KSculptQuickMenuProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;

    activeBrush: KBrushAsset | null;
    setActiveBrush: (brush: KBrushAsset) => void;

    intensity: number;
    setIntensity: (v: number) => void;

    radius: number;
    setRadius: (v: number) => void;

    gpuMode: boolean;
    setGpuMode: (v: boolean) => void;

    pinned: boolean;
    setPinned: (pinned: boolean) => void;

    onReset: () => void;

    /** Filter by category: 'all', 'standard', 'simulation' */
    filter?: 'all' | 'standard' | 'simulation';
};

export function KSculptQuickMenu({
    open,
    onOpenChange,
    activeBrush,
    setActiveBrush,
    intensity,
    setIntensity,
    radius,
    setRadius,
    gpuMode,
    setGpuMode,
    pinned,
    setPinned,
    onReset,
    filter = 'all',
}: KSculptQuickMenuProps) {
    // Data-driven brush state
    const [brushes, setBrushes] = useState<KBrushAsset[]>([]);
    const [loading, setLoading] = useState(true);

    // Load brushes from library
    useEffect(() => {
        const loadBrushes = async () => {
            try {
                if (!brushClient.isReady()) {
                    await brushClient.init();
                }
                
                const allBrushes = brushClient.getAllBrushes();
                setBrushes(allBrushes);
                setLoading(false);
            } catch (error) {
                console.error('[QuickMenu] Failed to load brushes:', error);
                setLoading(false);
            }
        };
        
        if (open) {
            loadBrushes();
        }
    }, [open]);

    // Filter brushes by category if needed
    const filteredBrushes = React.useMemo(() => {
        if (filter === 'all') return brushes;
        return brushes.filter(brush => 
            brush.category.toLowerCase().includes(filter.toLowerCase())
        );
    }, [brushes, filter]);

    // Icon mapping for data-driven brushes
    const getIconForBrush = (brush: KBrushAsset) => {
        // Use a simple default icon for now - can be enhanced later
        return RotateCcw; // Default icon
    };

    const commands: FloatingQuickMenuCommand[] = React.useMemo(
        () =>
            filteredBrushes.map((brush) => ({
                id: brush.id,
                label: brush.name,
                description: `${brush.category} • ${brush.kernel.family}`,
                icon: getIconForBrush(brush),
                keywords: [brush.id, brush.name, brush.category, 'sculpt', 'brush', ...brush.tags],
                // Simulation brushes require GPU mode
                disabled: brush.category.toLowerCase().includes('simulation') && !gpuMode,
                action: () => setActiveBrush(brush),
            })),
        [filteredBrushes, gpuMode, setActiveBrush]
    );

    return (
        <FloatingQuickMenu
            open={open}
            onOpenChange={onOpenChange}
            title="K-SCULPT"
            placeholder="Search brushes..."
            commands={commands}
            isCommandActive={(c) => activeBrush?.id === c.id}
            pinned={pinned}
            onPinnedChange={setPinned}
            persistKey="ksculpt:quickmenu-v4"
            headerRight={
                <button
                    onClick={() => setGpuMode(!gpuMode)}
                    className={
                        'px-2 py-1 rounded-full text-[8px] font-black tracking-wider border transition-all ' +
                        (gpuMode
                            ? 'bg-orange-500 text-black border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.35)]'
                            : 'bg-[#111] text-gray-500 border-[#333]')
                    }
                    title="Toggle simulation mode"
                >
                    {gpuMode ? 'SIM: ACTIVE' : 'SIM: PAUSED'}
                </button>
            }
            footer={
                <KSculptQuickMenuControls
                    intensity={intensity}
                    setIntensity={setIntensity}
                    radius={radius}
                    setRadius={setRadius}
                    onReset={onReset}
                />
            }
        />
    );
}

export function KSculptQuickMenuControls({
    intensity,
    setIntensity,
    radius,
    setRadius,
    onReset,
}: {
    intensity: number;
    setIntensity: (v: number) => void;
    radius: number;
    setRadius: (v: number) => void;
    onReset: () => void;
}) {
    return (
        <div className="border-t border-white/10 bg-[#070707]/60 px-2 py-1.5 space-y-1">
            <ButterSlider
                label="INTENSITY"
                value={intensity}
                onValueChange={setIntensity}
                min={0.1}
                max={5}
                step={0.1}
                toneClassName="text-orange-400"
                snapPoints={[0.5, 1, 2, 3, 5]}
            />

            <ButterSlider
                label="RADIUS"
                value={radius}
                onValueChange={setRadius}
                min={0.05}
                max={5}
                step={0.05}
                toneClassName="text-yellow-400"
                snapPoints={[0.25, 0.5, 1, 2, 3, 5]}
            />

            <button
                onClick={onReset}
                className="w-full px-2 py-1 bg-red-900/10 hover:bg-red-900/30 border border-red-900/50 text-red-400 rounded text-[9px] font-black tracking-wider flex items-center justify-center gap-1.5 transition-all"
            >
                <RotateCcw size={10} /> RESET
            </button>
        </div>
    );
}

// Legacy export for compatibility 
export { KSculptQuickMenu as KSculptSimQuickMenu };
