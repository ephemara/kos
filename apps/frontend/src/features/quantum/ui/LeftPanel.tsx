import React from 'react';
import {
    Grid, Activity, Zap, Wind, Disc, Speaker, Droplets
} from 'lucide-react';
import { PHYSICS_CATEGORIES, MODIFIER_CONFIG } from '../KQuantumPresets';
import { cn } from '@/ui/primitives/cn';

// --- LIBRARY TAB ---
interface LibraryTabProps {
    currentMode: number;
    setMode: (m: number) => void;
}

export function LibraryTab({ currentMode, setMode }: LibraryTabProps) {
    return (
        <div className="flex flex-col gap-4 p-4">
            {Object.entries(PHYSICS_CATEGORIES).map(([category, items]) => (
                <div key={category} className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-500 tracking-wider pl-1">
                        {category}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                        {items.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setMode(item.id)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded text-left transition-all border",
                                    currentMode === item.id
                                        ? "bg-blue-900/20 border-blue-500/30 text-blue-100"
                                        : "bg-[#111] border-[#222] text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                                )}
                            >
                                <item.icon size={14} className={currentMode === item.id ? "text-blue-400" : "text-gray-600"} />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold">{item.label}</span>
                                    <span className="text-[9px] text-gray-600 leading-tight">{item.desc}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// --- SIMULATION TAB ---
interface SimulationTabProps {
    simRes: number; setSimRes: (v: number) => void;
    speed: number; setSpeed: (v: number) => void;
    chaos: number; setChaos: (v: number) => void;
    damping: number; setDamping: (v: number) => void;

    // Fluid Sim Toggle
    fluidSimEnabled: boolean; setFluidSimEnabled: (v: boolean) => void;

    // Particle Life System
    particleLifeEnabled: boolean; setParticleLifeEnabled: (v: boolean) => void;
    lifeDecayRate: number; setLifeDecayRate: (v: number) => void;
    respawnBounds: number; setRespawnBounds: (v: number) => void;

    // Force Controls
    forceMultiplier: number; setForceMultiplier: (v: number) => void;
    curlStrength: number; setCurlStrength: (v: number) => void;
    centerPull: number; setCenterPull: (v: number) => void;
    maxVelocity: number; setMaxVelocity: (v: number) => void;

    // Modifiers
    activeModifiers: string[];
    setActiveModifiers: (m: string[]) => void;
    modParams: any;
    setModParams: (p: any) => void;

    // Audio
    audioSensitivity: { bass: number; high: number; vol: number; };
    setAudioSensitivity: (v: any) => void;
    handleAudioUpload: (e: any) => void;
}

export function SimulationTab({
    simRes, setSimRes,
    speed, setSpeed, chaos, setChaos, damping, setDamping,
    fluidSimEnabled, setFluidSimEnabled,
    particleLifeEnabled, setParticleLifeEnabled,
    lifeDecayRate, setLifeDecayRate, respawnBounds, setRespawnBounds,
    forceMultiplier, setForceMultiplier, curlStrength, setCurlStrength,
    centerPull, setCenterPull, maxVelocity, setMaxVelocity,
    activeModifiers, setActiveModifiers, modParams, setModParams,
    audioSensitivity, setAudioSensitivity, handleAudioUpload
}: SimulationTabProps) {


    const toggleModifier = (id: string) => {
        if (activeModifiers.includes(id)) {
            setActiveModifiers(activeModifiers.filter(m => m !== id));
        } else {
            setActiveModifiers([...activeModifiers, id]);
        }
    };

    const updateModParam = (modId: string, param: string, val: number) => {
        setModParams({ ...modParams, [`${modId}_${param}`]: val });
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* RESOLUTION */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Grid size={12} /> SIMULATION RES
                </div>
                <div className="grid grid-cols-5 gap-1">
                    {[256, 512, 1024, 2048, 4096].map((res) => (
                        <button
                            key={res}
                            onClick={() => setSimRes(res)}
                            className={cn(
                                "text-[9px] font-mono py-1 rounded border transition-all",
                                simRes === res
                                    ? "bg-blue-600 text-white border-blue-400"
                                    : "bg-[#111] border-[#222] text-gray-500 hover:bg-[#222]"
                            )}
                        >
                            {res >= 1024 ? (res / 1024) + 'K' : res}
                        </button>
                    ))}
                </div>
            </div>

            {/* PHYSICS GLOBALS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Activity size={12} /> GLOBAL PHYSICS
                </div>

                <div className="space-y-4 bg-[#111] border border-[#222] p-3 rounded">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>TIMESCALE</span>
                            <span>{speed.toFixed(1)}x</span>
                        </div>
                        <input type="range" min="0" max="3" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                            className="w-full accent-blue-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>ENTROPY (CHAOS)</span>
                            <span>{chaos.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0" max="2" step="0.05" value={chaos} onChange={e => setChaos(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>DAMPING (FRICTION)</span>
                            <span>{damping.toFixed(3)}</span>
                        </div>
                        <input type="range" min="0.8" max="1.0" step="0.001" value={damping} onChange={e => setDamping(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    </div>

                    {/* Fluid Sim Toggle */}
                    <div className="pt-3 mt-3 border-t border-[#222]">
                        <button
                            onClick={() => setFluidSimEnabled(!fluidSimEnabled)}
                            className={cn(
                                "w-full flex items-center justify-between py-2 px-3 rounded border transition-all",
                                fluidSimEnabled
                                    ? "bg-cyan-900/30 border-cyan-500/40 text-cyan-300"
                                    : "bg-[#0a0a0a] border-[#1a1a1a] text-gray-600 hover:bg-[#111] hover:text-gray-400"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Wind size={12} />
                                <span className="text-[10px] font-bold">NAVIER-STOKES FLUID</span>
                            </div>
                            <span className={cn(
                                "text-[8px] font-mono px-2 py-0.5 rounded",
                                fluidSimEnabled ? "bg-cyan-500/20 text-cyan-300" : "bg-[#111] text-gray-600"
                            )}>
                                {fluidSimEnabled ? 'ON' : 'OFF'}
                            </span>
                        </button>
                        <div className="text-[8px] text-gray-600 mt-1 px-1">
                            Couples particles with fluid velocity field. May interfere with other physics.
                        </div>
                    </div>
                </div>
            </div>

            {/* PARTICLE LIFE SYSTEM */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Activity size={12} /> PARTICLE LIFE
                </div>
                <div className="space-y-4 bg-[#111] border border-[#222] p-3 rounded">
                    {/* Life Toggle */}
                    <button
                        onClick={() => setParticleLifeEnabled(!particleLifeEnabled)}
                        className={cn(
                            "w-full flex items-center justify-between py-2 px-3 rounded border transition-all",
                            particleLifeEnabled
                                ? "bg-rose-900/30 border-rose-500/40 text-rose-300"
                                : "bg-[#0a0a0a] border-[#1a1a1a] text-gray-600 hover:bg-[#111] hover:text-gray-400"
                        )}
                    >
                        <span className="text-[10px] font-bold">LIFE DECAY</span>
                        <span className={cn(
                            "text-[8px] font-mono px-2 py-0.5 rounded",
                            particleLifeEnabled ? "bg-rose-500/20 text-rose-300" : "bg-[#111] text-gray-600"
                        )}>
                            {particleLifeEnabled ? 'MORTAL' : 'IMMORTAL'}
                        </span>
                    </button>
                    <div className="text-[8px] text-gray-600 -mt-2 px-1">
                        OFF = particles never die/respawn. ON = particles have lifespan.
                    </div>

                    {particleLifeEnabled && (
                        <>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>DECAY RATE</span>
                                    <span>{lifeDecayRate.toFixed(4)}</span>
                                </div>
                                <input type="range" min="0.001" max="0.02" step="0.001" value={lifeDecayRate}
                                    onChange={e => setLifeDecayRate(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-rose-500" />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>RESPAWN BOUNDS</span>
                                    <span>{respawnBounds.toFixed(0)}</span>
                                </div>
                                <input type="range" min="20" max="200" step="10" value={respawnBounds}
                                    onChange={e => setRespawnBounds(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-rose-500" />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* FORCE CONTROLS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Zap size={12} /> FORCE TUNING
                </div>
                <div className="space-y-4 bg-[#111] border border-[#222] p-3 rounded">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>FORCE MULTIPLIER</span>
                            <span>{forceMultiplier.toFixed(2)}x</span>
                        </div>
                        <input type="range" min="0" max="3" step="0.1" value={forceMultiplier}
                            onChange={e => setForceMultiplier(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>CURL/TURBULENCE</span>
                            <span>{curlStrength.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="3" step="0.1" value={curlStrength}
                            onChange={e => setCurlStrength(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>CENTER PULL</span>
                            <span>{centerPull.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={centerPull}
                            onChange={e => setCenterPull(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>MAX VELOCITY</span>
                            <span>{maxVelocity.toFixed(0)}</span>
                        </div>
                        <input type="range" min="5" max="100" step="5" value={maxVelocity}
                            onChange={e => setMaxVelocity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    </div>
                </div>
            </div>

            {/* MODIFIERS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Zap size={12} /> ACTIVE FORCES
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {[...MODIFIER_CONFIG.RHYTHMIC, ...MODIFIER_CONFIG.FORCES].map(mod => {
                        const isActive = activeModifiers.includes(mod.id);
                        return (
                            <button
                                key={mod.id}
                                onClick={() => toggleModifier(mod.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-2 rounded border transition-all gap-1",
                                    isActive
                                        ? "bg-orange-900/20 border-orange-500/40 text-orange-200"
                                        : "bg-[#111] border-[#222] text-gray-500 hover:text-gray-300"
                                )}
                            >
                                <mod.icon size={16} className={isActive ? "text-orange-400" : "opacity-50"} />
                                <span className="text-[9px] font-bold">{mod.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* MODIFIER PARAMS (Conditional) */}
                {activeModifiers.map(modId => {
                    const mod = [...MODIFIER_CONFIG.RHYTHMIC, ...MODIFIER_CONFIG.FORCES].find(m => m.id === modId);
                    if (!mod) return null;
                    return (
                        <div key={modId} className="bg-[#111] border border-[#222] p-2 rounded space-y-2 animate-in fade-in slide-in-from-top-2">
                            <div className="text-[9px] font-bold text-orange-400 flex items-center gap-1">
                                <mod.icon size={10} /> {mod.name.toUpperCase()} PARAMS
                            </div>
                            {Object.entries(mod.params).map(([key, cfg]: [string, any]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-500 w-12">{key.toUpperCase()}</span>
                                    <input
                                        type="range" min={cfg.min} max={cfg.max} step={cfg.step}
                                        value={modParams[`${modId}_${key}`] ?? cfg.val}
                                        onChange={(e) => updateModParam(modId, key, parseFloat(e.target.value))}
                                        className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* AUDIO SOURCE */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Speaker size={12} /> AUDIO REACTIVITY
                </div>

                <div className="bg-[#111] border border-[#222] p-3 rounded flex flex-col gap-3">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition border border-dashed border-[#333] hover:border-gray-500">
                        <Disc size={14} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400">Upload Audio File...</span>
                        <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                    </label>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>BASS SENSITIVITY</span>
                            <span>{audioSensitivity.bass.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0" max="5" step="0.1"
                            value={audioSensitivity.bass}
                            onChange={e => setAudioSensitivity({ ...audioSensitivity, bass: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}


// --- CFD TAB ---
interface CFDTabProps {
    cfdResolution: number; setCfdResolution: (v: number) => void;
    cfdViscosity: number; setCfdViscosity: (v: number) => void;
    cfdBuoyancy: number; setCfdBuoyancy: (v: number) => void;
    cfdVorticityConfinement: number; setCfdVorticityConfinement: (v: number) => void;
    cfdDissipation: number; setCfdDissipation: (v: number) => void;
    cfdFluidType: string; setCfdFluidType: (v: string) => void;
    cfdEmitterRadius: number; setCfdEmitterRadius: (v: number) => void;
    cfdEmitterVelocity: number; setCfdEmitterVelocity: (v: number) => void;
    cfdEmitterTemperature: number; setCfdEmitterTemperature: (v: number) => void;
}

export function CFDTab({
    cfdResolution, setCfdResolution,
    cfdViscosity, setCfdViscosity,
    cfdBuoyancy, setCfdBuoyancy,
    cfdVorticityConfinement, setCfdVorticityConfinement,
    cfdDissipation, setCfdDissipation,
    cfdFluidType, setCfdFluidType,
    cfdEmitterRadius, setCfdEmitterRadius,
    cfdEmitterVelocity, setCfdEmitterVelocity,
    cfdEmitterTemperature, setCfdEmitterTemperature,
}: CFDTabProps) {
    return (
        <div className="flex flex-col gap-6 p-4">
            {/* FLUID TYPE PRESETS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Droplets size={12} /> FLUID TYPE
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {['Smoke', 'Fire', 'Liquid', 'Gas', 'Viscous'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setCfdFluidType(type)}
                            className={cn(
                                "text-[10px] font-bold py-2 rounded border transition-all",
                                cfdFluidType === type
                                    ? "bg-cyan-600 text-white border-cyan-400"
                                    : "bg-[#111] border-[#222] text-gray-500 hover:bg-[#222]"
                            )}
                        >
                            {type.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* GRID RESOLUTION */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Grid size={12} /> GRID RESOLUTION
                </div>
                <div className="grid grid-cols-4 gap-1">
                    {[32, 64, 96, 128].map((res) => (
                        <button
                            key={res}
                            onClick={() => setCfdResolution(res)}
                            className={cn(
                                "text-[9px] font-mono py-1 rounded border transition-all",
                                cfdResolution === res
                                    ? "bg-cyan-600 text-white border-cyan-400"
                                    : "bg-[#111] border-[#222] text-gray-500 hover:bg-[#222]"
                            )}
                        >
                            {res}³
                        </button>
                    ))}
                </div>
                <div className="text-[8px] text-gray-600 px-1">
                    Higher resolution = more detail but slower. 64³ recommended for real-time.
                </div>
            </div>

            {/* FLUID PROPERTIES */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Activity size={12} /> FLUID PROPERTIES
                </div>

                <div className="space-y-4 bg-[#111] border border-[#222] p-3 rounded">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>VISCOSITY</span>
                            <span>{cfdViscosity.toFixed(4)}</span>
                        </div>
                        <input type="range" min="0" max="0.1" step="0.001" value={cfdViscosity}
                            onChange={e => setCfdViscosity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                        <div className="text-[8px] text-gray-600">Thickness/resistance to flow</div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>BUOYANCY</span>
                            <span>{cfdBuoyancy.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="10" step="0.1" value={cfdBuoyancy}
                            onChange={e => setCfdBuoyancy(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                        <div className="text-[8px] text-gray-600">Hot fluid rises (fire/smoke)</div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>VORTICITY</span>
                            <span>{cfdVorticityConfinement.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0" max="5" step="0.1" value={cfdVorticityConfinement}
                            onChange={e => setCfdVorticityConfinement(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                        <div className="text-[8px] text-gray-600">Preserves swirls/turbulence</div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>DISSIPATION</span>
                            <span>{cfdDissipation.toFixed(3)}</span>
                        </div>
                        <input type="range" min="0.9" max="1.0" step="0.001" value={cfdDissipation}
                            onChange={e => setCfdDissipation(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-500" />
                        <div className="text-[8px] text-gray-600">How fast fluid fades (1.0 = never)</div>
                    </div>
                </div>
            </div>

            {/* EMITTER CONTROLS */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Wind size={12} /> EMITTER
                </div>

                <div className="space-y-4 bg-[#111] border border-[#222] p-3 rounded">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>RADIUS</span>
                            <span>{cfdEmitterRadius.toFixed(1)}</span>
                        </div>
                        <input type="range" min="1" max="20" step="0.5" value={cfdEmitterRadius}
                            onChange={e => setCfdEmitterRadius(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>VELOCITY</span>
                            <span>{cfdEmitterVelocity.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0" max="50" step="1" value={cfdEmitterVelocity}
                            onChange={e => setCfdEmitterVelocity(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>TEMPERATURE</span>
                            <span>{cfdEmitterTemperature.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0" max="100" step="1" value={cfdEmitterTemperature}
                            onChange={e => setCfdEmitterTemperature(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                        <div className="text-[8px] text-gray-600">Higher = more buoyancy</div>
                    </div>
                </div>
            </div>

            {/* INFO */}
            <div className="bg-cyan-900/20 border border-cyan-500/30 p-3 rounded">
                <div className="text-[10px] font-bold text-cyan-300 mb-1">CFD MODE</div>
                <div className="text-[9px] text-cyan-400/70 leading-relaxed">
                    Navier-Stokes grid-based fluid simulation. Click to add emitters. 
                    Supports smoke, fire, liquid, and gas dynamics with real-time visualization.
                </div>
            </div>
        </div>
    );
}
