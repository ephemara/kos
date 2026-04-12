import React from 'react';
import {
    BrainCircuit, Combine, CopyPlus, Crosshair, Settings, Download, Share2, Trash2
} from 'lucide-react';
import { UniversalLayerPanel, UniversalLayer } from '@/ui/layers';
import { UnifiedMaterialDock } from '@/ui/materials';
import { processImage } from '@/features/autopbr/KAutopbrEngine';
import { usePython } from '@/lib/hooks/usePython';

interface GreebleLayer {
    id: string;
    name: string;
    visible: boolean;
    color?: string;
    texture?: string;
    kId?: string; // K_OS Registry ID
}

interface RightPanelProps {
    tab: 'layers' | 'pbr' | 'modifiers' | 'python' | 'export';
    // Layers props
    layers: GreebleLayer[];
    activeLayerId: string;
    setActiveLayerId: any; // Complex signature: (id: string, multi: boolean) => void
    addLayer: () => void;
    duplicateLayer: (id: string) => void;
    deleteLayer: (id: string) => void;
    toggleVisibility: (id: string) => void;
    selectLayerObject: (id: string) => void;
    selectedLayerIds: Set<string>;
    handleMergeSelected: () => void;
    handleMergeAll: () => void;
    // PBR props
    materialLibrary: any[];
    commitMaterial: any; // Complex signature: (img: HTMLImageElement, name: string) => void
    removeMaterial: (id: string) => void;
    handleTextureUploadClick: () => void;
    handleTextureUpload: (e: any) => void;
    textureInputRef: any;
    matParams: any;
    setMatParams: (v: any) => void;
    downloadMap: (type: string) => void;
    downloadAll: () => void;
    // Modifiers props
    modifierMode: string;
    setModifierMode: any; // Complex signature: Dispatch<SetStateAction<"none" | "picking_boolean_target">>
    booleanTargetUUID: string | null;
    handleBooleanOp: (op: string) => void;
    arrayParams: { count: number; offset: { x: number; y: number; z: number } };
    setArrayParams: (v: any) => void;
    handleArrayOp: () => void;
    // Export props
    targetEngine: string;
    setTargetEngine: (v: string) => void;
    mergeOnExport: boolean;
    setMergeOnExport: (v: boolean) => void;
    includeBase: boolean;
    setIncludeBase: (v: boolean) => void;
    handleExport: (mode: string, format: string) => void;
}

export default function RightPanel(props: RightPanelProps) {
    const { tab } = props;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tab === 'layers' && <LayersContent {...props} />}
            {tab === 'pbr' && <PBRContent {...props} />}
            {tab === 'modifiers' && <ModifiersContent {...props} />}
            {tab === 'python' && <PythonContent />}
            {tab === 'export' && <ExportContent {...props} />}
        </div>
    );
}

// === LAYERS TAB ===
function LayersContent(props: RightPanelProps) {
    // Convert to UniversalLayer format
    const universalLayers: UniversalLayer[] = props.layers.map(l => ({
        id: l.kId || l.id, // Prefer kId for hot potato mode
        name: l.name,
        visible: l.visible,
        color: l.color,
        hasMaterial: !!l.texture,
        locked: false,
    }));

    return (
        <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-2xl relative h-full overflow-hidden">
            <UniversalLayerPanel
                layers={universalLayers}
                activeLayerId={props.activeLayerId}
                selectedLayerIds={props.selectedLayerIds}
                onSelect={(id, opts) => props.setActiveLayerId(id, opts?.multi)}
                onToggleVisibility={props.toggleVisibility}
                onDelete={props.deleteLayer}
                onAdd={props.addLayer}
                onDuplicate={props.duplicateLayer}
                onMergeSelected={props.handleMergeSelected}
                onMergeAll={props.handleMergeAll}
                features={{
                    add: true,
                    visibility: true,
                    delete: true,
                    rename: false,
                    lock: false,
                    solo: false,
                    reorder: false,
                    duplicate: true,
                    colorLabels: true, // KGreeble has color labels!
                    contextMenu: false,
                    materialIndicator: true, // Show MAT badge
                    mergeSelected: true,
                    mergeAll: true,
                }}
                accentColor="emerald"
                title="STRATA" // KGreeble's unique naming
                emptyMessage="No strata - add one to start"
                compact={false}
            />
        </div>
    );
}

// === PBR TAB ===
function PBRContent(props: RightPanelProps) {
    // Get active layer's texture for preview
    const activeLayer = props.layers.find((l: any) => l.id === props.activeLayerId);

    return (
        <div className="p-4 bg-[#0a0a0a] flex-1 overflow-y-auto custom-scrollbar space-y-4">
            {/* Material Library via UnifiedMaterialDock */}
            <UnifiedMaterialDock
                materials={props.materialLibrary}
                activeMaterial={null}
                onSelect={(mat) => {
                    // When selecting from library, apply to active layer
                    if (mat && props.commitMaterial) {
                        const img = new Image();
                        img.onload = () => props.commitMaterial(img, mat.name);
                        img.src = mat.preview || mat.base;
                    }
                }}
                mode="compact"
                showPreview={false}
                showFluxParams={true}
                accentColor="emerald"
            />

            {/* Active Layer Material Preview */}
            {activeLayer?.texture && (
                <div className="border-t border-[#222] pt-4">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Active Layer Material</div>
                    <div className="relative aspect-video rounded-lg border border-[#222] overflow-hidden bg-black shadow-lg shadow-emerald-900/10 group">
                        <img src={activeLayer.texture} className="w-full h-full object-cover opacity-80" alt="Active Material" />
                        <div className="absolute bottom-0 w-full bg-black/80 text-[8px] text-emerald-500 text-center p-0.5 font-mono tracking-widest">
                            MAT_{props.activeLayerId.slice(-4).toUpperCase()}
                        </div>
                        <button
                            onClick={() => props.removeMaterial(props.activeLayerId)}
                            className="absolute top-2 right-2 p-1.5 bg-red-900/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove Material"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// === MODIFIERS TAB ===
function ModifiersContent(props: RightPanelProps) {
    return (
        <div className="flex-1 p-4 bg-[#0a0a0a]/20 space-y-6">
            {/* BOOLEAN SECTION */}
            <div className="space-y-3">
                <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-yellow-900/30">
                    <Combine size={12} /> Boolean Operations
                </div>

                <div className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg space-y-3">
                    <div className="text-[9px] text-gray-400">
                        1. Select <strong>Subject</strong> mesh.<br />
                        2. Click <strong>PICK TARGET</strong>.<br />
                        3. Select <strong>Target</strong> mesh to cut/add.<br />
                        4. Choose Operation.
                    </div>

                    <button
                        onClick={() => props.setModifierMode(props.modifierMode === 'picking_boolean_target' ? 'none' : 'picking_boolean_target')}
                        className={`w-full py-2 rounded text-[10px] font-bold border transition-all flex items-center justify-center gap-2 ${props.modifierMode === 'picking_boolean_target' ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse' : 'bg-[#161616] border-[#333] text-gray-400 hover:text-white'}`}
                    >
                        {props.modifierMode === 'picking_boolean_target' ? 'PICKING TARGET...' : 'PICK TARGET'}
                        <Crosshair size={12} />
                    </button>

                    {props.booleanTargetUUID && (
                        <div className="text-[9px] text-emerald-400 font-bold text-center bg-emerald-900/20 py-1 rounded border border-emerald-900/50">
                            TARGET SELECTED
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-1">
                        <button onClick={() => props.handleBooleanOp('UNION')} disabled={!props.booleanTargetUUID} className="py-2 bg-[#161616] border border-[#333] hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-[9px] font-bold text-gray-300 rounded hover:text-yellow-400 transition-colors">UNION</button>
                        <button onClick={() => props.handleBooleanOp('SUBTRACT')} disabled={!props.booleanTargetUUID} className="py-2 bg-[#161616] border border-[#333] hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-[9px] font-bold text-gray-300 rounded hover:text-yellow-400 transition-colors">SUBTRACT</button>
                        <button onClick={() => props.handleBooleanOp('INTERSECT')} disabled={!props.booleanTargetUUID} className="py-2 bg-[#161616] border border-[#333] hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-[9px] font-bold text-gray-300 rounded hover:text-yellow-400 transition-colors">INTERSECT</button>
                    </div>
                </div>
            </div>

            {/* ARRAY SECTION */}
            <div className="space-y-3">
                <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-blue-900/30">
                    <CopyPlus size={12} /> Array Modifier
                </div>

                <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg space-y-3">
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">COUNT <span className="text-blue-400">{props.arrayParams.count}</span></div>
                        <input type="range" min="1" max="50" step="1" value={props.arrayParams.count} onChange={e => props.setArrayParams({ ...props.arrayParams, count: parseInt(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-blue-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-gray-500">OFFSET (X/Y/Z)</div>
                        <div className="grid grid-cols-3 gap-1">
                            {['x', 'y', 'z'].map(axis => (
                                <div key={axis} className="bg-[#0a0a0a] p-1 rounded border border-[#222]">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={props.arrayParams.offset[axis as keyof typeof props.arrayParams.offset]}
                                        onChange={e => props.setArrayParams({ ...props.arrayParams, offset: { ...props.arrayParams.offset, [axis]: parseFloat(e.target.value) } })}
                                        className="w-full bg-transparent text-[9px] text-center text-gray-300 outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <button onClick={props.handleArrayOp} className="w-full py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/50 text-blue-400 text-[9px] font-bold rounded transition-colors uppercase">
                        Create Array
                    </button>
                </div>
            </div>
        </div>
    );
}

// === PYTHON TAB ===
function PythonContent() {
    const { callScript, loading: pythonLoading } = usePython();

    return (
        <div className="flex-1 p-4 bg-[#0a0a0a]/20 space-y-6">
            <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-yellow-900/30">
                <BrainCircuit size={12} /> Python Bridge Test
            </div>

            <div className="p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-lg space-y-4">
                <div className="text-[9px] text-yellow-400 font-bold uppercase">🔬 Connection Test</div>

                <button
                    onClick={async () => {
                        console.log("🔵 Testing Python bridge...");
                        try {
                            const result = await callScript('hello', 'test', {});
                            console.log("✅ Python Response:", result);
                            alert(`SUCCESS!\n\n${JSON.stringify(result, null, 2)}`);
                        } catch (err: any) {
                            console.error("❌ Python Error:", err);
                            alert(`FAILED!\n\n${err.toString()}`);
                        }
                    }}
                    disabled={pythonLoading}
                    className="w-full py-4 rounded text-[11px] font-bold border bg-yellow-500 border-yellow-400 text-black hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all uppercase"
                >
                    {pythonLoading ? 'Testing...' : '🚀 Test Python Connection'}
                </button>

                <div className="text-[8px] text-gray-500 text-center space-y-1">
                    <div>Click button to test Python bridge.</div>
                    <div>Opens alert with result or error.</div>
                </div>
            </div>

            <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-[8px] text-gray-500 space-y-1">
                <div className="text-red-400 font-bold mb-2">DEBUG</div>
                <div>• Check console for Python logs</div>
                <div>• Python sidecar must be running</div>
                <div>• Start with: <code className="bg-black p-1 text-yellow-400">npm run tauri:dev</code></div>
            </div>
        </div>
    );
}

// === EXPORT TAB ===
function ExportContent(props: RightPanelProps) {
    return (
        <div className="flex-1 p-4 bg-[#0a0a0a]/20 space-y-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Settings size={12} /> Export Configuration</div>

            <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-500">TARGET ENGINE</label>
                <div className="flex bg-[#161616] p-1 rounded border border-[#222]">
                    {['GENERIC', 'UNREAL', 'UNITY'].map(t => (
                        <button key={t} onClick={() => props.setTargetEngine(t)} className={`flex-1 py-1.5 rounded text-[8px] font-bold transition-all ${props.targetEngine === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-[#161616] rounded border border-[#222]">
                    <span className="text-[9px] font-bold text-gray-400">WELD GEOMETRY</span>
                    <button onClick={() => props.setMergeOnExport(!props.mergeOnExport)} className={`w-8 h-4 rounded-full transition-colors ${props.mergeOnExport ? 'bg-emerald-600' : 'bg-gray-700'} relative`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform`} style={{ left: props.mergeOnExport ? 'auto' : '2px', right: props.mergeOnExport ? '2px' : 'auto' }} />
                    </button>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#161616] rounded border border-[#222]">
                    <span className="text-[9px] font-bold text-gray-400">INCLUDE BASE MESH</span>
                    <button onClick={() => props.setIncludeBase(!props.includeBase)} className={`w-8 h-4 rounded-full transition-colors ${props.includeBase ? 'bg-emerald-600' : 'bg-gray-700'} relative`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform`} style={{ left: props.includeBase ? 'auto' : '2px', right: props.includeBase ? '2px' : 'auto' }} />
                    </button>
                </div>
            </div>

            <div className="pt-4 border-t border-[#222]">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => props.handleExport('download', 'glb')} className="bg-[#161616] hover:bg-[#222] text-gray-400 border border-[#222] py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-colors shadow-lg"><Download size={14} /> .GLB</button>
                    <button onClick={() => props.handleExport('download', 'obj')} className="bg-[#161616] hover:bg-[#222] text-gray-400 border border-[#222] py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-colors shadow-lg"><Download size={14} /> .OBJ</button>
                </div>
                <div className="mt-2 text-[8px] text-gray-600 text-center italic">
                    Exports current scene state. Animation included in GLB if present.
                </div>
            </div>
        </div>
    );
}
