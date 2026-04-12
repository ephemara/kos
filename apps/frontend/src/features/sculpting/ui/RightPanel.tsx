import React from 'react';
import { Palette, X, Box, HardDrive, Circle, Activity, Square, Hexagon, Grid3x3 } from 'lucide-react';
import { UniversalLayerPanel, UniversalLayer } from '@/ui/layers';

const PRIMITIVES = [
    { id: 'SPHERE', label: 'Sphere', icon: Circle },
    { id: 'CUBE', label: 'Cube', icon: Box },
    { id: 'CYLINDER', label: 'Cylinder', icon: Activity },
    { id: 'TORUS', label: 'Torus', icon: Circle },
    { id: 'PLANE', label: 'Plane', icon: Square },
    { id: 'ICOSA', label: 'Icosa', icon: Hexagon },
];

interface SculptLayer {
    id: string;
    name: string;
    visible: boolean;
    polyCount?: number;
    mesh?: any;
    kId?: string; // K_OS Registry ID
}

interface RightPanelProps {
    mode: 'layers' | 'materials';
    // Layers
    layers: SculptLayer[];
    activeLayerId: string | null;
    setActiveLayerId: (id: string, multi?: boolean) => void;
    toggleVisibility: (id: string) => void;
    deleteLayer: (id: string) => void;
    mergeDown: (id: string) => void;
    mergeSelected: () => void;
    mergeAll: () => void;
    selectedLayerIds: Set<string>;
    // Assets
    loadPrimitive: (type: string) => void;
    loadFromStorage: (item: any) => void;
    sharedState: any;
    // Materials
    materialMode: 'CLAY' | 'PBR';
    setMaterialMode: (v: 'CLAY' | 'PBR') => void;
    activeMaterial: any;
    applyMaterial: (mat: any) => void;
    projectMaterials: any[];
    // Subdivision
    onSubdivide?: (levels: number) => void;
    subdivisionProgress?: { isSubdividing: boolean; progress: number; message: string } | null;
}

export default function RightPanel({
    mode,
    layers, activeLayerId, setActiveLayerId, toggleVisibility, deleteLayer,
    mergeDown, mergeSelected, mergeAll, selectedLayerIds,
    loadPrimitive, loadFromStorage, sharedState,
    materialMode, setMaterialMode, activeMaterial, applyMaterial, projectMaterials,
    onSubdivide,
    subdivisionProgress
}: RightPanelProps) {
    const [assetMode, setAssetMode] = React.useState<'PRIMS' | 'STORAGE'>('PRIMS');
    const [subdivisionLevel, setSubdivisionLevel] = React.useState(1);

    // Get active layer for subdivision
    const activeLayer = layers.find(l => l.id === activeLayerId);
    const canSubdivide = activeLayer && !subdivisionProgress?.isSubdividing;

    if (mode === 'layers') {
        // Convert to UniversalLayer format
        const universalLayers: UniversalLayer[] = layers.map(l => ({
            id: l.kId || l.id, // Prefer kId (registry ID) for hot potato mode
            name: l.name,
            visible: l.visible,
            polyCount: l.polyCount,
            locked: false,
        }));

        return (
            <div className="flex flex-col h-full w-full bg-[#0f0f0f] overflow-hidden">
                {/* LAYERS - Now using universal layer panel */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <UniversalLayerPanel
                        layers={universalLayers}
                        activeLayerId={activeLayerId}
                        selectedLayerIds={selectedLayerIds}
                        onSelect={(id, opts) => setActiveLayerId(id, opts?.multi)}
                        onToggleVisibility={toggleVisibility}
                        onDelete={deleteLayer}
                        onMergeDown={mergeDown}
                        onMergeSelected={mergeSelected}
                        onMergeAll={mergeAll}
                        features={{
                            add: false, // KSculpt adds via primitives below
                            visibility: true,
                            delete: true,
                            rename: false, // TODO: Add rename support
                            lock: false,
                            solo: false,
                            reorder: false, // TODO: Add reorder
                            duplicate: false,
                            colorLabels: false,
                            contextMenu: false,
                            polyCount: true,
                            mergeDown: true,
                            mergeSelected: true,
                            mergeAll: true,
                        }}
                        accentColor="orange"
                        title="LAYERS"
                        emptyMessage="No geometry loaded - spawn a primitive or import from kernel"
                        compact={false}
                    />
                </div>

                {/* SUBDIVISION CONTROLS */}
                {activeLayer && (
                    <div className="border-t border-[#333] p-3 shrink-0 bg-[#0a0a0a]">
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Grid3x3 size={10} /> SUBDIVISION
                        </div>
                        
                        {subdivisionProgress?.isSubdividing ? (
                            <div className="space-y-2">
                                <div className="bg-[#161616] rounded border border-[#222] p-2">
                                    <div className="text-[9px] text-gray-400 mb-1">{subdivisionProgress.message}</div>
                                    <div className="w-full bg-[#111] rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300"
                                            style={{ width: `${subdivisionProgress.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-400 min-w-[40px]">LEVEL:</span>
                                    <div className="flex-1 flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map(level => (
                                            <button
                                                key={level}
                                                onClick={() => setSubdivisionLevel(level)}
                                                className={`flex-1 py-1 text-[9px] font-bold rounded transition-all ${
                                                    subdivisionLevel === level 
                                                        ? 'bg-orange-500 text-black' 
                                                        : 'bg-[#161616] text-gray-500 hover:text-gray-300 border border-[#222]'
                                                }`}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => onSubdivide?.(subdivisionLevel)}
                                    disabled={!canSubdivide}
                                    className={`w-full py-2 text-[9px] font-bold rounded transition-all flex items-center justify-center gap-1.5 ${
                                        canSubdivide
                                            ? 'bg-orange-500 hover:bg-orange-600 text-black'
                                            : 'bg-[#161616] text-gray-600 cursor-not-allowed border border-[#222]'
                                    }`}
                                    title={!activeLayer ? 'Select a layer to subdivide' : 'Subdivide active layer'}
                                >
                                    <Grid3x3 size={10} />
                                    SUBDIVIDE {subdivisionLevel}x
                                </button>

                                {activeLayer && (
                                    <div className="text-[8px] text-gray-600 text-center">
                                        Current: {activeLayer.polyCount?.toLocaleString() || 0} verts
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ASSETS - Primitives and Storage */}
                <div className="border-t border-[#333] p-3 shrink-0 bg-[#0a0a0a]">
                    <div className="flex items-center gap-1 mb-2 bg-[#161616] p-0.5 rounded border border-[#222]">
                        <button
                            onClick={() => setAssetMode('PRIMS')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold rounded transition-all ${assetMode === 'PRIMS' ? 'bg-[#333] text-orange-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Box size={10} /> PRIMS
                        </button>
                        <div className="w-px h-4 bg-[#333]" />
                        <button
                            onClick={() => setAssetMode('STORAGE')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold rounded transition-all ${assetMode === 'STORAGE' ? 'bg-[#333] text-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <HardDrive size={10} /> KERNEL
                        </button>
                    </div>

                    <div className="h-32 overflow-y-auto custom-scrollbar bg-[#111] rounded border border-[#222] p-2">
                        {assetMode === 'PRIMS' ? (
                            <div className="grid grid-cols-4 gap-1.5">
                                {PRIMITIVES.map(prim => (
                                    <button
                                        key={prim.id}
                                        onClick={() => loadPrimitive(prim.id)}
                                        className="aspect-square flex flex-col items-center justify-center gap-1.5 bg-[#161616] border border-[#222] hover:border-orange-500/50 hover:bg-[#222] rounded transition-all text-gray-500 hover:text-orange-100 group"
                                        title={prim.label}
                                    >
                                        <prim.icon size={14} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <>
                                {(!sharedState?.storage || sharedState.storage.length === 0) ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-[9px] text-gray-600 italic px-4">
                                        <HardDrive size={16} className="mb-2 opacity-20" />
                                        Kernel Memory Empty.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {sharedState.storage.map((item: any) => (
                                            <button
                                                key={item.id}
                                                onClick={() => loadFromStorage(item)}
                                                className="relative aspect-square rounded border border-[#222] overflow-hidden hover:border-purple-500 transition-all group bg-[#000]"
                                                title={item.name}
                                            >
                                                {item.thumbnail ? (
                                                    <img src={item.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={item.name} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-[#111]"><Box size={14} className="text-gray-600" /></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // mode === 'materials'
    return (
        <div className="flex flex-col h-full bg-[#0f0f0f] p-4 space-y-6 overflow-y-auto custom-scrollbar">
            {/* MODE TOGGLE */}
            <div className="bg-[#161616] p-1 rounded border border-[#222] flex">
                <button onClick={() => setMaterialMode('CLAY')} className={`flex-1 py-2 text-[9px] font-bold rounded transition-all ${materialMode === 'CLAY' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-white'}`}>CLAY (SCULPT)</button>
                <button onClick={() => setMaterialMode('PBR')} className={`flex-1 py-2 text-[9px] font-bold rounded transition-all ${materialMode === 'PBR' ? 'bg-pink-500 text-black' : 'text-gray-500 hover:text-white'}`}>PBR (SHOW)</button>
            </div>

            {materialMode === 'PBR' && (
                <div className="space-y-4">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Palette size={10} /> Project Materials</div>
                    {(!projectMaterials || projectMaterials.length === 0) ? (
                        <div className="p-4 border border-dashed border-[#222] rounded text-center text-[9px] text-gray-600 italic">No Materials in Kernel. Create in K-Autopbr first.</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {projectMaterials.map((mat: any) => (
                                <button
                                    key={mat.id}
                                    onClick={() => applyMaterial(mat)}
                                    className={`relative aspect-square rounded border overflow-hidden group transition-all ${activeMaterial?.id === mat.id ? 'border-pink-500 ring-1 ring-pink-500' : 'border-[#222] hover:border-gray-500'}`}
                                >
                                    <img src={mat.preview} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-[8px] font-bold text-white text-center px-1">{mat.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {activeMaterial && (
                        <div className="p-2 bg-[#222] rounded flex items-center justify-between text-[9px]">
                            <span className="text-gray-400">Active: <span className="text-white font-bold">{activeMaterial.name}</span></span>
                            <button onClick={() => applyMaterial(null)} className="text-gray-500 hover:text-red-400"><X size={12} /></button>
                        </div>
                    )}
                </div>
            )}

            {materialMode === 'CLAY' && (
                <div className="p-4 border border-dashed border-[#222] rounded text-center text-[10px] text-gray-600">
                    Vertex Painting & Sculpting Mode Active.<br />Materials hidden.
                </div>
            )}
        </div>
    );
}
