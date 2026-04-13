/**
 * FloatingMaterialPicker - Floating popup version of UnifiedMaterialDock
 * 
 * For use in radial menus, hotkey popups, etc.
 */

import React from 'react';
import { X } from 'lucide-react';
import UnifiedMaterialDock from './UnifiedMaterialDock';
import type { KMaterialAsset } from '@mocap/three-d/systems/materials/KMaterialAsset';

export interface FloatingMaterialPickerProps {
    visible: boolean;
    position: { x: number; y: number };
    materials: KMaterialAsset[];
    activeMaterial: KMaterialAsset | null;
    onSelect: (mat: KMaterialAsset) => void;
    onClose: () => void;
    onMaterialMode?: (enabled: boolean) => void;
    accentColor?: 'rose' | 'blue' | 'emerald' | 'purple' | 'amber';
}

export default function FloatingMaterialPicker({
    visible,
    position,
    materials,
    activeMaterial,
    onSelect,
    onClose,
    onMaterialMode,
    accentColor = 'rose',
}: FloatingMaterialPickerProps) {
    if (!visible) return null;

    const handleSelect = (mat: KMaterialAsset) => {
        onSelect(mat);
        if (onMaterialMode) onMaterialMode(true); // Auto-activate material mode
        onClose();
    };

    const accentClasses = {
        rose: { border: 'border-rose-500/50', shadow: 'shadow-rose-900/50', text: 'text-rose-400', dot: 'bg-rose-500' },
        blue: { border: 'border-blue-500/50', shadow: 'shadow-blue-900/50', text: 'text-blue-400', dot: 'bg-blue-500' },
        emerald: { border: 'border-emerald-500/50', shadow: 'shadow-emerald-900/50', text: 'text-emerald-400', dot: 'bg-emerald-500' },
        purple: { border: 'border-purple-500/50', shadow: 'shadow-purple-900/50', text: 'text-purple-400', dot: 'bg-purple-500' },
        amber: { border: 'border-amber-500/50', shadow: 'shadow-amber-900/50', text: 'text-amber-400', dot: 'bg-amber-500' },
    };

    const theme = accentClasses[accentColor];

    return (
        <div
            className="fixed z-[9999] pointer-events-auto animate-in zoom-in-95 fade-in duration-150"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
            }}
        >
            <div className={`bg-[#0a0a0a]/95 backdrop-blur-xl border-2 ${theme.border} rounded-2xl shadow-2xl ${theme.shadow} overflow-hidden min-w-[380px] max-w-[420px]`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#222] bg-[#111]/50">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${theme.dot} animate-pulse`} />
                        <span className={`text-[10px] font-bold ${theme.text} uppercase tracking-widest`}>
                            PBR Material Browser
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[#333] rounded-lg transition-all text-gray-500 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Material Grid */}
                <div className="p-3 max-h-[350px] overflow-y-auto custom-scrollbar">
                    <UnifiedMaterialDock
                        materials={materials}
                        activeMaterial={activeMaterial}
                        onSelect={handleSelect}
                        mode="picker"
                        accentColor={accentColor}
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-[#222] bg-[#111]/50">
                    <div className="text-[7px] text-gray-600 text-center">
                        Press <kbd className={`px-1 py-0.5 bg-[#222] rounded ${theme.text}`}>M</kbd> to close
                        <span className="mx-2">•</span>
                        {materials.length} materials available
                    </div>
                </div>
            </div>
        </div>
    );
}
