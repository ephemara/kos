import React, { useState } from 'react';
import {
    Stamp, CircuitBoard, Aperture, Package,
    Zap, ImageIcon, Download, UploadCloud, Share2, Palette
} from 'lucide-react';
import KGraphosAlphaTab from '../KGraphosAlphaTab';
import { BrushPresetSelector } from './BrushPresetSelector';
import { configService, BrushConfig } from '@/services/configService';


interface LeftPanelProps {
    tab: 'alpha' | 'gen' | 'filter' | 'export';
    // Alpha props
    alphas: any[];
    onAlphaCommit: (alpha: any) => void;
    brush: any;
    setBrush: (v: any) => void;
    onBrushCommit: (brush: any) => void;
    // Generator/Filter props
    engineRef: any;
    activeLayerId: string | null;
    // Export props
    handleExport: (type: 'PNG' | 'JPEG' | 'ALPHA' | 'SAMPLE') => void;
    // Shader lab
    onApplyCustomShader?: (fragmentShader: string) => void;
    onCompileKainShader?: (source: string) => Promise<string>;
}

export default function LeftPanel(props: LeftPanelProps) {
    const { tab } = props;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* HEADER */}
            <div className="p-4 border-b border-[#222] bg-[#111] shrink-0">
                <div className="flex items-center gap-2 text-rose-500 mb-1">
                    <Palette size={16} />
                    <span className="font-black tracking-[0.2em] text-xs">K-GRAPHOS</span>
                </div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest">Texture Engine</div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {tab === 'alpha' && <AlphaContent {...props} />}
                {tab === 'gen' && <GeneratorContent {...props} />}
                {tab === 'filter' && <FilterContent {...props} />}
                {tab === 'export' && <ExportContent {...props} />}
            </div>
        </div>
    );
}

// === ALPHA TAB ===
function AlphaContent(props: LeftPanelProps) {
    const handleBrushPresetSelect = (brushConfig: BrushConfig) => {
        // Apply brush preset to current brush state
        props.setBrush((prev: any) => ({
            ...prev,
            size: brushConfig.defaultSize * 500, // Scale to pixel size
            opacity: brushConfig.defaultStrength,
            hardness: brushConfig.parameters?.hardness?.default ?? prev.hardness,
            flow: brushConfig.parameters?.flow?.default ?? prev.flow,
            tool: brushConfig.id.toUpperCase(),
        }));
    };

    return (
        <div className="space-y-4">
            {/* Brush Preset Selector */}
            <BrushPresetSelector
                category="paint"
                selectedBrushId={props.brush.tool?.toLowerCase()}
                onSelectBrush={handleBrushPresetSelect}
            />
            
            {/* Alpha Tab Content */}
            <KGraphosAlphaTab
                alphas={props.alphas}
                onAlphaCommit={props.onAlphaCommit}
                brush={props.brush}
                setBrush={props.setBrush}
                onBrushCommit={props.onBrushCommit}
            />
        </div>
    );
}

// === GENERATOR TAB ===
function GeneratorContent({ engineRef, activeLayerId }: LeftPanelProps) {
    const [params, setParams] = useState({
        noiseScale: 3.0, noiseDetail: 4.0,
        patternScale: 10.0, patternMode: 0,
        gradientMode: 0, gradientAngle: 0, gradientColorA: '#000000', gradientColorB: '#ffffff',
        seamlessBlend: 0.25,
        aoRadius: 5.0, aoIntensity: 2.0,
        curvatureStrength: 5.0
    });

    const runGen = (type: string) => {
        if (!engineRef.current || !activeLayerId) return;
        const p = params;
        if (type === 'NOISE') engineRef.current.applyGenerator(activeLayerId, 'NOISE', { scale: p.noiseScale, detail: p.noiseDetail, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'PATTERN') engineRef.current.applyGenerator(activeLayerId, 'PATTERN', { scale: p.patternScale, mode: p.patternMode, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'VORONOI') engineRef.current.applyGenerator(activeLayerId, 'VORONOI', { scale: p.noiseScale, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'FBM') engineRef.current.applyGenerator(activeLayerId, 'FBM', { scale: p.noiseScale, colorA: '#000000', colorB: '#ffffff' });
        if (type === 'GRADIENT') engineRef.current.applyGenerator(activeLayerId, 'GRADIENT', { mode: p.gradientMode, angle: p.gradientAngle, colorA: p.gradientColorA, colorB: p.gradientColorB });
        if (type === 'SEAMLESS') engineRef.current.applyGenerator(activeLayerId, 'SEAMLESS', { blend: p.seamlessBlend });
        if (type === 'AO') engineRef.current.applyGenerator(activeLayerId, 'AO', { radius: p.aoRadius, intensity: p.aoIntensity });
        if (type === 'CURVATURE') engineRef.current.applyGenerator(activeLayerId, 'CURVATURE', { strength: p.curvatureStrength });
    };

    return (
        <div className="space-y-4 animate-in slide-in-from-left-4">
            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-2">
                <CircuitBoard size={12} /> Procedural Generators
            </div>

            {/* NOISE */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase">Noise</div>
                <SliderRow label="Scale" value={params.noiseScale} min={1} max={20} step={0.1} onChange={v => setParams({ ...params, noiseScale: v })} />
                <SliderRow label="Detail" value={params.noiseDetail} min={1} max={8} step={1} onChange={v => setParams({ ...params, noiseDetail: v })} />
                <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => runGen('NOISE')} className="py-2 bg-rose-600 text-white rounded text-[9px] font-bold hover:bg-rose-500">SIMPLEX</button>
                    <button onClick={() => runGen('FBM')} className="py-2 bg-[#161616] text-rose-300 border border-rose-500/30 rounded text-[9px] font-bold hover:bg-rose-900/20">FBM</button>
                    <button onClick={() => runGen('VORONOI')} className="py-2 bg-[#161616] text-gray-400 border border-[#333] rounded text-[9px] font-bold hover:bg-[#222]">VORONOI</button>
                </div>
            </div>

            {/* PATTERN */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase">Pattern</div>
                <SliderRow label="Scale" value={params.patternScale} min={1} max={50} step={1} onChange={v => setParams({ ...params, patternScale: v })} />
                <div className="flex bg-[#0a0a0a] p-0.5 rounded border border-[#222]">
                    {['GRID', 'CHECKER', 'DOTS', 'CIRCUIT'].map((m, i) => (
                        <button key={m} onClick={() => setParams({ ...params, patternMode: i })} className={`flex-1 py-1 text-[8px] rounded font-bold ${params.patternMode === i ? 'bg-cyan-900/30 text-cyan-400' : 'text-gray-500'}`}>{m}</button>
                    ))}
                </div>
                <button onClick={() => runGen('PATTERN')} className="w-full py-2 bg-[#161616] border border-cyan-500/30 text-cyan-300 rounded text-[9px] font-bold hover:bg-cyan-900/20">GENERATE</button>
            </div>

            {/* GRADIENT */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase">Gradient</div>
                <div className="flex bg-[#0a0a0a] p-0.5 rounded border border-[#222]">
                    {['LINEAR', 'RADIAL', 'ANGULAR'].map((m, i) => (
                        <button key={m} onClick={() => setParams({ ...params, gradientMode: i })} className={`flex-1 py-1 text-[8px] rounded font-bold ${params.gradientMode === i ? 'bg-purple-900/30 text-purple-400' : 'text-gray-500'}`}>{m}</button>
                    ))}
                </div>
                <div className="flex gap-2 items-center">
                    <input type="color" value={params.gradientColorA} onChange={e => setParams({ ...params, gradientColorA: e.target.value })} className="w-8 h-6 bg-transparent border border-[#333] rounded cursor-pointer" />
                    <div className="flex-1 h-4 rounded" style={{ background: `linear-gradient(to right, ${params.gradientColorA}, ${params.gradientColorB})` }} />
                    <input type="color" value={params.gradientColorB} onChange={e => setParams({ ...params, gradientColorB: e.target.value })} className="w-8 h-6 bg-transparent border border-[#333] rounded cursor-pointer" />
                </div>
                <button onClick={() => runGen('GRADIENT')} className="w-full py-2 bg-[#161616] border border-purple-500/30 text-purple-300 rounded text-[9px] font-bold hover:bg-purple-900/20">GENERATE</button>
            </div>

            {/* UTILITY */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase">Utility</div>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => runGen('SEAMLESS')} className="py-2 bg-[#161616] border border-emerald-500/30 text-emerald-300 rounded text-[9px] font-bold hover:bg-emerald-900/20">SEAMLESS</button>
                    <button onClick={() => runGen('CURVATURE')} className="py-2 bg-[#161616] border border-sky-500/30 text-sky-300 rounded text-[9px] font-bold hover:bg-sky-900/20">CURVATURE</button>
                </div>
            </div>
        </div>
    );
}

// === FILTER TAB ===
function FilterContent({ engineRef, activeLayerId, onCompileKainShader }: LeftPanelProps) {
    const [params, setParams] = useState({
        blurStrength: 2.0, normalStrength: 1.0,
        levelsMin: 0.0, levelsMax: 1.0, levelsGamma: 1.0, levelsInvert: false,
        pixelSortThreshold: 0.5,
        sharpenStrength: 1.0,
        hueShift: 0.0, saturation: 1.0, lightness: 0.0,
        posterizeLevels: 4,
        embossStrength: 2.0,
        thresholdValue: 0.5
    });

    const runFilter = (type: string) => {
        if (!engineRef.current || !activeLayerId) return;
        const p = params;
        if (type === 'BLUR') engineRef.current.applyFilter(activeLayerId, 'BLUR', { strength: p.blurStrength });
        if (type === 'NORMAL') engineRef.current.applyFilter(activeLayerId, 'NORMAL', { strength: p.normalStrength });
        if (type === 'LEVELS') engineRef.current.applyFilter(activeLayerId, 'LEVELS', { min: p.levelsMin, max: p.levelsMax, gamma: p.levelsGamma, invert: p.levelsInvert });
        if (type === 'PIXEL_SORT') engineRef.current.applyFilter(activeLayerId, 'PIXEL_SORT', { threshold: p.pixelSortThreshold });
        if (type === 'EDGE') engineRef.current.applyFilter(activeLayerId, 'EDGE', {});
        if (type === 'SHARPEN') engineRef.current.applyFilter(activeLayerId, 'SHARPEN', { strength: p.sharpenStrength });
        if (type === 'HSL') engineRef.current.applyFilter(activeLayerId, 'HSL', { hue: p.hueShift, saturation: p.saturation, lightness: p.lightness });
        if (type === 'POSTERIZE') engineRef.current.applyFilter(activeLayerId, 'POSTERIZE', { levels: p.posterizeLevels });
        if (type === 'EMBOSS') engineRef.current.applyFilter(activeLayerId, 'EMBOSS', { strength: p.embossStrength });
        if (type === 'THRESHOLD') engineRef.current.applyFilter(activeLayerId, 'THRESHOLD', { threshold: p.thresholdValue });
    };

    const [customShader, setCustomShader] = useState(`uniform sampler2D tInput;
uniform vec2 uResolution;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tInput, vUv);
  vec3 g = vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114)));
  gl_FragColor = vec4(g, c.a);
}`);
    const [kainSource, setKainSource] = useState(`shader graphos_custom {
  // Kain source placeholder
  // compile to spirv and dispatch in backend
}`);
    const [shaderStatus, setShaderStatus] = useState('');

    return (
        <div className="space-y-4 animate-in slide-in-from-left-4">
            <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider flex items-center gap-2">
                <Aperture size={12} /> Processing Filters
            </div>

            {/* GLITCH */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-yellow-500 uppercase flex items-center gap-1"><Zap size={10} /> Glitch Logic</div>
                <SliderRow label="Threshold" value={params.pixelSortThreshold} min={0} max={1} step={0.01} onChange={v => setParams({ ...params, pixelSortThreshold: v })} />
                <button onClick={() => runFilter('PIXEL_SORT')} className="w-full py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded text-[9px] font-bold hover:bg-yellow-500/30">PIXEL SORT</button>
            </div>

            {/* BASIC FILTERS */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-2">
                    <SliderRow label="Blur" value={params.blurStrength} min={0} max={10} step={0.1} onChange={v => setParams({ ...params, blurStrength: v })} />
                    <button onClick={() => runFilter('BLUR')} className="w-full py-1.5 bg-[#161616] border border-[#333] text-gray-300 rounded text-[8px] font-bold hover:bg-[#222]">BLUR</button>
                </div>
                <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-2">
                    <SliderRow label="Bump" value={params.normalStrength} min={0.1} max={5} step={0.1} onChange={v => setParams({ ...params, normalStrength: v })} />
                    <button onClick={() => runFilter('NORMAL')} className="w-full py-1.5 bg-[#161616] border border-[#333] text-gray-300 rounded text-[8px] font-bold hover:bg-[#222]">NORMAL</button>
                </div>
            </div>

            {/* HSL */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase">HSL Adjust</div>
                <SliderRow label="Hue" value={params.hueShift} min={-0.5} max={0.5} step={0.01} onChange={v => setParams({ ...params, hueShift: v })} />
                <SliderRow label="Saturation" value={params.saturation} min={0} max={2} step={0.05} onChange={v => setParams({ ...params, saturation: v })} />
                <SliderRow label="Lightness" value={params.lightness} min={-0.5} max={0.5} step={0.01} onChange={v => setParams({ ...params, lightness: v })} />
                <button onClick={() => runFilter('HSL')} className="w-full py-2 bg-gradient-to-r from-rose-600 to-emerald-600 text-white rounded text-[9px] font-bold">APPLY HSL</button>
            </div>

            {/* MORE FILTERS */}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => runFilter('EDGE')} className="py-2 bg-[#161616] border border-[#333] text-gray-300 rounded text-[9px] font-bold hover:bg-[#222]">EDGE DETECT</button>
                <button onClick={() => runFilter('SHARPEN')} className="py-2 bg-[#161616] border border-cyan-500/30 text-cyan-300 rounded text-[9px] font-bold hover:bg-cyan-900/20">SHARPEN</button>
                <button onClick={() => runFilter('POSTERIZE')} className="py-2 bg-[#161616] border border-pink-500/30 text-pink-300 rounded text-[9px] font-bold hover:bg-pink-900/20">POSTERIZE</button>
                <button onClick={() => runFilter('THRESHOLD')} className="py-2 bg-[#161616] border border-white/20 text-white rounded text-[9px] font-bold hover:bg-white/5">THRESHOLD</button>
            </div>

            {/* SHADER LAB */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-2">
                <div className="text-[9px] font-bold text-cyan-400 uppercase">Shader Lab (GLSL/Kain)</div>
                <textarea
                    value={customShader}
                    onChange={(e) => setCustomShader(e.target.value)}
                    className="w-full h-28 bg-[#0a0a0a] border border-[#2a2a2a] rounded p-2 text-[10px] font-mono text-cyan-200"
                />
                <button
                    onClick={() => {
                        (engineRef as any)?.current?.applyCustomShader?.(activeLayerId, customShader, {});
                        setShaderStatus('Custom GLSL applied');
                    }}
                    className="w-full py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded text-[9px] font-bold hover:bg-cyan-500/30"
                >
                    APPLY CUSTOM GLSL
                </button>
                <textarea
                    value={kainSource}
                    onChange={(e) => setKainSource(e.target.value)}
                    className="w-full h-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded p-2 text-[10px] font-mono text-purple-200"
                />
                <button
                    onClick={async () => {
                        setShaderStatus('Compiling Kain...');
                        try {
                            const res = await onCompileKainShader?.(kainSource);
                            setShaderStatus(res || 'Kain compile submitted');
                        } catch (e) {
                            setShaderStatus(`Kain compile failed: ${String(e)}`);
                        }
                    }}
                    className="w-full py-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded text-[9px] font-bold hover:bg-purple-500/30"
                >
                    COMPILE KAIN (SPIR-V)
                </button>
                {shaderStatus && <div className="text-[9px] text-gray-400">{shaderStatus}</div>}
            </div>
        </div>
    );
}

// === EXPORT TAB ===
function ExportContent({ handleExport }: LeftPanelProps) {
    return (
        <div className="space-y-4 animate-in slide-in-from-left-4">
            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                <Package size={12} /> Output Pipeline
            </div>

            <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase">Final Composite</div>
                <button onClick={() => handleExport('PNG')} className="w-full py-3 bg-[#161616] border border-[#333] text-gray-300 rounded-lg text-[10px] font-bold hover:bg-[#222] flex items-center justify-center gap-2">
                    <ImageIcon size={14} /> DOWNLOAD PNG
                </button>
                <button onClick={() => handleExport('JPEG')} className="w-full py-3 bg-[#161616] border border-[#333] text-gray-300 rounded-lg text-[10px] font-bold hover:bg-[#222] flex items-center justify-center gap-2">
                    <Download size={14} /> DOWNLOAD JPEG
                </button>
            </div>

            <div className="bg-[#111] p-4 rounded-lg border border-rose-900/30 space-y-3">
                <div className="text-[9px] font-bold text-rose-400 uppercase">Kernel Storage</div>
                <button onClick={() => handleExport('ALPHA')} className="w-full py-3 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2">
                    <UploadCloud size={14} /> COMMIT AS ALPHA
                </button>
            </div>

            <div className="bg-[#111] p-4 rounded-lg border border-indigo-900/30 space-y-3">
                <div className="text-[9px] font-bold text-indigo-400 uppercase">External Apps</div>
                <button onClick={() => handleExport('SAMPLE')} className="w-full py-3 bg-[#161616] border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-bold hover:bg-indigo-900/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] flex items-center justify-center gap-2">
                    <Share2 size={14} /> SEND TO K-SAMPLE
                </button>
            </div>
        </div>
    );
}

// Helper component
function SliderRow({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
    return (
        <div>
            <div className="flex justify-between text-[8px] text-gray-400 font-bold mb-1">
                <span>{label.toUpperCase()}</span>
                <span className="text-rose-400">{value.toFixed(step < 1 ? 2 : 0)}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-rose-500" />
        </div>
    );
}
