import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { UniversalLayerPanel, UniversalLayer } from '@/ui/layers';
import KPainterTexturesPanel from './TexturesPanel';

interface PaintLayer {
    id: string;
    name: string;
    visible: boolean;
    kId?: string; // K_OS Object Registry ID
}

interface RightPanelProps {
    mode: 'layers' | 'sets' | 'textures';

    layers: PaintLayer[];
    activeLayerId: string | null;
    onAdd: () => void;
    onDelete: (id: string) => void;
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
    onFill: () => void;

    textureSets: any[];
    activeSetId: string | null;
    handleSetSelect: (id: string) => void;

    engineRef: any;
}

export default function RightPanel({
    mode,
    layers,
    activeLayerId,
    onAdd,
    onDelete,
    onToggle,
    onSelect,
    onFill,
    textureSets,
    activeSetId,
    handleSetSelect,
    engineRef,
}: RightPanelProps) {
    if (mode === 'layers') {
        // Convert to UniversalLayer format
        const universalLayers: UniversalLayer[] = layers.map(l => ({
            id: l.kId || l.id, // Prefer kId if available (registry ID)
            name: l.name,
            visible: l.visible,
            locked: false,
        }));

        return (
            <div className="-m-3 flex flex-col h-full">
                <UniversalLayerPanel
                    layers={universalLayers}
                    activeLayerId={activeLayerId}
                    onSelect={(id) => onSelect(id)}
                    onToggleVisibility={(id) => onToggle(id)}
                    onDelete={(id) => onDelete(id)}
                    onAdd={onAdd}
                    features={{
                        add: true,
                        visibility: true,
                        delete: true,
                        rename: false, // KPainter doesn't support rename yet
                        lock: false,
                        solo: false,
                        reorder: false,
                        duplicate: false,
                        colorLabels: false,
                        contextMenu: false,
                    }}
                    accentColor="blue"
                    title="PAINT LAYERS"
                    emptyMessage="No paint layers - add one to start painting"
                    compact={false}
                    headerActions={
                        <button
                            onClick={onFill}
                            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title="Fill Layer"
                        >
                            <span className="text-xs">FILL</span>
                        </button>
                    }
                />
            </div>
        );
    }

    if (mode === 'sets') {
        return (
            <div className="-m-3 flex flex-col h-full">
                <div className="p-3 border-b border-[#222] bg-[#1a1a1a] shrink-0">
                    <div className="flex items-center gap-2 text-white font-bold text-xs tracking-wider">
                        <LayoutGrid size={14} className="text-[#3daee9]" /> TEXTURE SETS
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-[#111]">
                    {textureSets && textureSets.map((set: any) => (
                        <div
                            key={set.id}
                            onClick={() => handleSetSelect(set.id)}
                            className={`p-2 rounded cursor-pointer border text-[10px] font-bold truncate transition-all ${activeSetId === set.id ? 'bg-[#3daee9]/20 border-[#3daee9] text-white' : 'bg-[#16181b] border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            {set.name}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return <KPainterTexturesPanel engineRef={engineRef} />;
}
