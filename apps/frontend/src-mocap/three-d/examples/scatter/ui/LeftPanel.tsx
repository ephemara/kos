import React from 'react';
import { Box, Circle, Dna, Triangle, Layers, HardDrive, LayoutGrid } from 'lucide-react';

interface LeftPanelProps {
    mode: 'primitives' | 'storage';
    activePrimitive: string;
    setActivePrimitive: (v: string) => void;
    updatePaletteFromPrimitive: (v: string) => void;
    activeStorageId: string | null;
    setActiveStorageId: (v: string) => void;
    updatePaletteFromStorage: (item: any) => void;
    sharedState: any;
}

const PRIMITIVES = [
    { id: 'CUBE', icon: Box },
    { id: 'SPHERE', icon: Circle },
    { id: 'CYLINDER', icon: Dna },
    { id: 'PYRAMID', icon: Triangle },
    { id: 'PLATE', icon: Layers },
];

export default function LeftPanel({
    mode,
    activePrimitive, setActivePrimitive, updatePaletteFromPrimitive,
    activeStorageId, setActiveStorageId, updatePaletteFromStorage,
    sharedState
}: LeftPanelProps) {
    return (
        <div className="flex flex-col h-full bg-[#0f0f0f]">
            {/* HEADER */}
            <div className="p-4 border-b border-[#222] bg-[#111] shrink-0">
                <div className="flex items-center gap-2 text-pink-500 mb-1">
                    <LayoutGrid size={16} />
                    <span className="font-black tracking-[0.2em] text-xs">K-SCATTER</span>
                </div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest">Instancing Engine</div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {mode === 'primitives' && (
                    <div className="grid grid-cols-4 gap-2">
                        {PRIMITIVES.map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setActivePrimitive(p.id);
                                    updatePaletteFromPrimitive(p.id);
                                }}
                                className={`aspect-square rounded border flex items-center justify-center transition-all ${activePrimitive === p.id
                                    ? 'bg-pink-900/20 border-pink-500 text-pink-400'
                                    : 'bg-[#111] border-[#222] text-gray-600 hover:text-white hover:border-gray-500'
                                    }`}
                                title={p.id}
                            >
                                <p.icon size={16} />
                            </button>
                        ))}
                    </div>
                )}

                {mode === 'storage' && (
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <HardDrive size={10} /> Available Assets
                        </div>

                        {(!sharedState?.storage || sharedState.storage.length === 0) ? (
                            <div className="text-[10px] text-gray-600 italic p-4 text-center border border-dashed border-[#222] rounded">
                                Kernel Memory Empty.<br />Commit objects from Sculpt/Greeble first.
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {sharedState.storage.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveStorageId(item.id);
                                            updatePaletteFromStorage(item);
                                        }}
                                        className={`relative aspect-square rounded border overflow-hidden transition-all group ${activeStorageId === item.id
                                            ? 'border-pink-500 ring-1 ring-pink-500'
                                            : 'border-[#222] hover:border-gray-500'
                                            }`}
                                    >
                                        {item.thumbnail ? (
                                            <img
                                                src={item.thumbnail}
                                                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                                alt={item.name}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-[#111]">
                                                <Box size={16} className="text-gray-600" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] text-center py-1 truncate px-1 text-gray-300">
                                            {item.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
