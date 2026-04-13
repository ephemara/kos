import React from 'react';
import {
    Plus, Hammer, MousePointer2, Film, Move,
    ClipboardCopy, Trash2, Zap, Activity,
    HardDrive, Circle, Square, Scaling, Paintbrush, Maximize, Minimize2, Box
} from 'lucide-react';
import { SHAPES } from '../KGreebleEngine';
import { TransformPanel } from '@/ui/shell/controls/transform/TransformPanel';

interface LeftPanelProps {
    mode: 'build' | 'edit' | 'animate';
    // Build mode props
    buildTab: 'PRIMITIVES' | 'KERNEL';
    setBuildTab: React.Dispatch<React.SetStateAction<'PRIMITIVES' | 'KERNEL'>>;
    activeShape: string;
    setActiveShape: React.Dispatch<React.SetStateAction<string>>;
    sharedState: any;
    loadFromStorage: (item: any) => void;
    // Edit mode props
    selectedObjectUUID: string | null;
    transformData: any;
    updateTransformFromUI: (key: string, value: number) => void;
    gizmoMode: 'translate' | 'rotate' | 'scale';
    setGizmoMode: React.Dispatch<React.SetStateAction<'translate' | 'rotate' | 'scale'>>;
    transformSpace: 'world' | 'local';
    setTransformSpace: React.Dispatch<React.SetStateAction<'world' | 'local'>>;
    snapEnabled: boolean;
    setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    handleChaosScatter: () => void;
    handleGlitch: () => void;
    handleDuplicateObject: () => void;
    handleDeleteSelected: () => void;
    // Animate mode props
    autoKey: boolean;
    setAutoKey: React.Dispatch<React.SetStateAction<boolean>>;
    motionTrail: boolean;
    setMotionTrail: React.Dispatch<React.SetStateAction<boolean>>;
    chaosTrack: number;
    setChaosTrack: React.Dispatch<React.SetStateAction<number>>;
    physicsSettings: any;
    setPhysicsSettings: React.Dispatch<React.SetStateAction<any>>;
    proceduralSettings: any;
    setProceduralSettings: React.Dispatch<React.SetStateAction<any>>;
    easingType: string;
    setEasingType: React.Dispatch<React.SetStateAction<string>>;
    onTogglePhysics: () => void;
    onDropSelected: () => void;
    onDropAll: () => void;
    onBakePhysics: () => void;
    // Common
    handleUndo: () => void;
    handleClear: () => void;
}

export default function LeftPanel(props: LeftPanelProps) {
    const { mode } = props;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {mode === 'build' && <BuildContent {...props} />}
            {mode === 'edit' && <EditContent {...props} />}
            {mode === 'animate' && <AnimateContent {...props} />}

            {/* Common Actions */}
            {mode !== 'animate' && (
                <section className="grid grid-cols-2 gap-2 pt-4 border-t border-red-900/20">
                    <button onClick={props.handleUndo} className="py-3 bg-[#161616]/50 hover:bg-[#222] text-gray-400 border border-[#222] rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 uppercase">
                        <ClipboardCopy size={14} /> Undo
                    </button>
                    <button onClick={props.handleClear} className="py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/40 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 uppercase">
                        <Trash2 size={10} /> RESET
                    </button>
                </section>
            )}
        </div>
    );
}

// === BUILD MODE ===
function BuildContent(props: LeftPanelProps) {
    // Primitive shapes to display (core ones only, no procedurals)
    const CORE_PRIMITIVES = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'pyramid', 'capsule', 'ring', 'icosa', 'wall', 'platform', 'pillar', 'tower', 'arc'];

    return (
        <>
            <div className="flex bg-[#1a1a1a]/50 p-1 rounded border border-[#333] mb-4">
                <button onClick={() => props.setBuildTab('PRIMITIVES')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${props.buildTab === 'PRIMITIVES' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>PRIMITIVES</button>
                <button onClick={() => props.setBuildTab('KERNEL')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${props.buildTab === 'KERNEL' ? 'bg-orange-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>KERNEL</button>
            </div>

            {props.buildTab === 'PRIMITIVES' && (
                <section>
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                        <Box size={12} /> Primitives
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {CORE_PRIMITIVES.map((s: string) => (
                            <button
                                key={s}
                                onClick={() => props.setActiveShape(s)}
                                className={`relative aspect-square rounded-xl border overflow-hidden group transition-all duration-200 ${props.activeShape === s ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-[#222] hover:border-[#333]'}`}
                            >
                                <div className="absolute inset-0 bg-[#161616]" />
                                <div
                                    className="absolute inset-2 bg-contain bg-center bg-no-repeat opacity-50 group-hover:opacity-80 transition-opacity duration-300 grayscale group-hover:grayscale-0"
                                    style={{ backgroundImage: `url(/primitives/${s.toLowerCase()}.png)` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${props.activeShape === s ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                        {s}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {props.buildTab === 'KERNEL' && (
                <section>
                    <div className="text-[10px] font-bold text-orange-500 uppercase mb-3 flex items-center gap-2 tracking-widest"><HardDrive size={12} /> Kernel Storage</div>
                    {(!props.sharedState?.storage || props.sharedState.storage.length === 0) ? (
                        <div className="p-4 border border-dashed border-[#222] rounded text-center text-[10px] text-gray-600 italic">
                            Kernel Memory Empty.<br />Commit artifacts from other modules.
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {props.sharedState.storage.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => props.loadFromStorage(item)}
                                    className={`relative aspect-square rounded border overflow-hidden transition-all group ${props.activeShape === `import_${item.id}` ? 'border-orange-500 ring-1 ring-orange-500' : 'border-[#222] hover:border-gray-500'}`}
                                >
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={item.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#111]"><Box size={16} className="text-gray-600" /></div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] text-center py-1 truncate px-1 text-gray-300">
                                        {item.name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </>
    );
}

// === EDIT MODE ===
function EditContent(props: LeftPanelProps) {
    return (
        <section className="space-y-4">
            <div className="text-[10px] font-bold text-blue-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Move size={12} /> Transform Matrix</div>

            <TransformPanel
                hasSelection={Boolean(props.selectedObjectUUID)}
                mode={props.gizmoMode}
                onModeChange={(m) => props.setGizmoMode(m)}
                space={props.transformSpace}
                onSpaceChange={(s) => props.setTransformSpace(s)}
                snapEnabled={props.snapEnabled}
                onSnapEnabledChange={(v) => props.setSnapEnabled(v)}
                value={props.transformData}
                onChange={(key, value) => props.updateTransformFromUI(key, value)}
                hint={
                    <span>
                        💡 Hold <strong className="text-white">SHIFT</strong> to Elevate (Y-Axis)
                    </span>
                }
                translateMin={-100}
                translateMax={100}
                translateStep={0.1}
                rotateMinDeg={0}
                rotateMaxDeg={360}
                rotateStepDeg={1}
                scaleMin={0.001}
                scaleMax={10}
                scaleStep={0.01}
            />

            {props.selectedObjectUUID ? (
                <div className="space-y-2 pt-2">
                    <div className="space-y-2 pt-4 border-t border-[#222]/50">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-1">Destructive Operations</div>
                        <button onClick={props.handleChaosScatter} className="w-full py-3 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-900/50 rounded flex items-center justify-center gap-2 text-xs font-bold text-indigo-400"><Zap size={14} /> CHAOS SCATTER</button>
                        <button onClick={props.handleGlitch} className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded flex items-center justify-center gap-2 text-xs font-bold text-red-400"><Activity size={14} /> GLITCH GEOMETRY</button>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <button onClick={props.handleDuplicateObject} className="py-2 bg-[#0a0a0a]/50 hover:bg-[#222] border border-[#222] rounded flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300"><ClipboardCopy size={12} /> DUPLICATE</button>
                            <button onClick={props.handleDeleteSelected} className="py-2 bg-[#0a0a0a]/50 hover:bg-red-900/10 border border-[#222] rounded flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300 hover:text-red-400"><Trash2 size={12} /> DELETE</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

// === ANIMATE MODE ===
function AnimateContent(props: LeftPanelProps) {
    return (
        <div className="p-4 border border-pink-900/30 bg-pink-900/10 rounded-lg text-center space-y-4">
            <Film size={24} className="mx-auto text-pink-500 mb-2" />
            <div className="text-[10px] text-pink-400 font-bold">ANIMATION MODE ACTIVE</div>
            <div className="text-[9px] text-gray-500 mt-1">Use the floating timeline below to sequence motion.</div>

            <button
                onClick={() => props.setAutoKey(!props.autoKey)}
                className={`mt-2 px-3 py-1 rounded text-[9px] font-bold border transition-all ${props.autoKey ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
            >
                ● AUTO-KEY: {props.autoKey ? 'ON' : 'OFF'}
            </button>

            {/* EXPERIMENTAL */}
            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                <div className="text-[9px] text-pink-500 font-bold mb-2">EXPERIMENTAL</div>
                <div className="space-y-2">
                    <button
                        onClick={() => props.setMotionTrail(!props.motionTrail)}
                        className={`w-full py-1 rounded text-[9px] font-bold border transition-all ${props.motionTrail ? 'bg-pink-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                    >
                        MOTION TRAIL
                    </button>
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                            <span>CHAOS TRACK</span>
                            <span>{props.chaosTrack.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0" max="5" step="0.1" value={props.chaosTrack} onChange={(e) => props.setChaosTrack(parseFloat(e.target.value))} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500" />
                    </div>
                </div>
            </div>

            {/* PHYSICS ENGINE */}
            <div className="mt-4 pt-4 border-t border-cyan-900/30 w-full text-left">
                <div className="text-[9px] text-cyan-500 font-bold mb-2 flex items-center gap-2">
                    ⚡ RAPIER PHYSICS ENGINE
                    {props.physicsSettings.isSimulating && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[9px] text-gray-400"><span>GRAVITY</span><span>{props.physicsSettings.gravity.toFixed(1)}</span></div>
                    <input type="range" min="-20" max="0" step="0.1" value={props.physicsSettings.gravity} onChange={e => props.setPhysicsSettings({ ...props.physicsSettings, gravity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-cyan-500" />

                    <div className="flex justify-between text-[9px] text-gray-400"><span>BOUNCE</span><span>{props.physicsSettings.bounciness.toFixed(2)}</span></div>
                    <input type="range" min="0" max="1" step="0.05" value={props.physicsSettings.bounciness} onChange={e => props.setPhysicsSettings({ ...props.physicsSettings, bounciness: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-cyan-500" />

                    <div className="grid grid-cols-2 gap-1 pt-2">
                        <button onClick={props.onTogglePhysics} className={`py-2 rounded text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${props.physicsSettings.isSimulating ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-cyan-900/30 border-cyan-500 text-cyan-400'}`}>
                            {props.physicsSettings.isSimulating ? '⏹ STOP' : '▶ SIMULATE'}
                        </button>
                        <button onClick={props.onDropSelected} className="py-2 bg-orange-900/30 border border-orange-500 text-orange-400 rounded text-[9px] font-bold">🪂 DROP</button>
                    </div>

                    <button onClick={props.onDropAll} className="w-full py-2 bg-purple-900/30 border border-purple-500 text-purple-400 rounded text-[9px] font-bold">🌧 DROP ALL</button>
                    <button onClick={props.onBakePhysics} className="w-full py-2 mt-1 bg-pink-900/30 border border-pink-500 text-pink-400 rounded text-[9px] font-bold">⏺ BAKE TO KEYFRAMES</button>
                </div>
            </div>

            {/* PROCEDURAL */}
            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                <div className="text-[9px] text-pink-500 font-bold mb-2">PROCEDURAL MODIFIERS</div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[9px] text-gray-400"><span>PULSE SPEED</span><span>{props.proceduralSettings.pulseSpeed}</span></div>
                    <input type="range" min="0" max="5" step="0.1" value={props.proceduralSettings.pulseSpeed} onChange={e => props.setProceduralSettings({ ...props.proceduralSettings, pulseSpeed: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500" />

                    <div className="flex justify-between text-[9px] text-gray-400"><span>SPIN SPEED</span><span>{props.proceduralSettings.spinSpeed}</span></div>
                    <input type="range" min="0" max="5" step="0.1" value={props.proceduralSettings.spinSpeed} onChange={e => props.setProceduralSettings({ ...props.proceduralSettings, spinSpeed: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500" />
                </div>
            </div>

            {/* EASING */}
            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                <div className="text-[9px] text-pink-500 font-bold mb-2">INTERPOLATION</div>
                <div className="flex gap-1">
                    {['linear', 'smooth', 'elastic'].map(e => (
                        <button key={e} onClick={() => props.setEasingType(e)} className={`flex-1 py-1 rounded text-[8px] font-bold border ${props.easingType === e ? 'bg-pink-500 text-white border-pink-500' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                            {e.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
