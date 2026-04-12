import React, { useState, useEffect, useRef } from 'react';
import {
    Palette, Sliders, Layers, RefreshCw, Plus, Trash2, Pipette
} from 'lucide-react';
import { UnifiedMaterialDock } from '@/ui/materials';
import { processImage } from '../../autopbr/KAutopbrEngine';


interface RightPanelProps {
    tab: 'color' | 'materials' | 'layers';
    // Color props
    brush: any;
    setBrush: (v: any) => void;
    // Material props
    projectMaterials: any[];
    activeMaterial: any;
    setActiveMaterial: (v: any) => void;
    materialMode: boolean;
    setMaterialMode: (v: boolean) => void;
    materialChannels: any;
    setMaterialChannels: (v: any) => void;
    engineRef: any;
    onMaterialCommit: (mat: any) => void;
    // Layer props
    layers: any[];
    activeLayerId: string | null;
    setActiveLayerId: (v: string) => void;
    onLayerAdd: () => void;
    onLayerDelete: (id: string) => void;
    onLayerVisibility: (id: string, solo: boolean) => void;
    onLayerOpacity: (id: string, opacity: number) => void;
    onLayerBlendMode: (id: string, mode: GlobalCompositeOperation) => void;
}

export default function RightPanel(props: RightPanelProps) {
    const { tab } = props;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0a]">
            {tab === 'color' && <ColorContent {...props} />}
            {tab === 'materials' && <MaterialsContent {...props} />}
            {tab === 'layers' && <LayersContent {...props} />}
        </div>
    );
}

// === COLOR TAB ===
import { HexColorPicker } from 'react-colorful';
import { Slider } from '@/ui/primitives/Slider';

function ColorContent({ brush, setBrush }: RightPanelProps) {
    const [harmonies, setHarmonies] = useState<string[]>([]);

    // Generate harmonies when color changes
    useEffect(() => {
        setHarmonies(generateHarmonies(brush.color));
    }, [brush.color]);

    return (
        <div className="p-4 space-y-6 animate-in slide-in-from-right-4">
            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-2">
                <Palette size={12} /> Color Studio
            </div>

            {/* REACT-COLORFUL WHEEL */}
            <div className="flex justify-center">
                <div className="custom-color-picker w-full">
                    <style>{`
                        .react-colorful { width: 100%; height: 200px; border-radius: 12px; border: 1px solid #333; }
                        .react-colorful__saturation { border-radius: 12px 12px 0 0; }
                        .react-colorful__hue { height: 24px; border-radius: 0 0 12px 12px; }
                        .react-colorful__pointer { width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                    `}</style>
                    <HexColorPicker color={brush.color} onChange={(c) => setBrush({ ...brush, color: c })} />
                </div>
            </div>

            {/* CURRENT COLOR */}
            <div className="flex items-center gap-3 bg-[#111] p-3 rounded-lg border border-[#222]">
                <div className="w-10 h-10 rounded-lg border border-[#333]" style={{ backgroundColor: brush.color }} />
                <div className="flex-1">
                    <div className="text-[8px] font-bold text-gray-500 uppercase">Active Color</div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500">#</span>
                        <input
                            type="text"
                            value={brush.color.replace('#', '').toUpperCase()}
                            onChange={e => {
                                const val = e.target.value;
                                if (/^[0-9A-F]{0,6}$/i.test(val)) {
                                    setBrush({ ...brush, color: '#' + val });
                                }
                            }}
                            className="bg-transparent text-[14px] font-mono font-bold text-white outline-none w-full tracking-widest"
                            maxLength={6}
                        />
                    </div>
                </div>
                <button onClick={() => setBrush({ ...brush, isPicking: !brush.isPicking })} title="Pick Color (I)" className="text-gray-500 hover:text-white transition-colors">
                    <Pipette size={16} />
                </button>
            </div>

            {/* HARMONIES */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-2">
                <div className="flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase">
                    <span>Harmonies</span>
                    <button onClick={() => setHarmonies(generateHarmonies(brush.color))} className="p-1 hover:text-white">
                        <RefreshCw size={10} />
                    </button>
                </div>
                <div className="flex gap-1 h-8">
                    {harmonies.map((c, i) => (
                        <button
                            key={i}
                            onClick={() => setBrush({ ...brush, color: c })}
                            className="flex-1 h-full rounded-sm border border-transparent hover:border-white transition-all hover:scale-105 active:scale-95"
                            style={{ backgroundColor: c }}
                            title={c}
                        />
                    ))}
                </div>
            </div>

            {/* PARAMS */}
            <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-4">
                <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Sliders size={10} /> Brush Control
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] font-bold text-gray-400">
                        <span>HARDNESS</span>
                        <span className="text-rose-400">{(brush.hardness * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                        value={brush.hardness * 100}
                        onValueChange={(v) => setBrush({ ...brush, hardness: v / 100 })}
                        max={100} step={1}
                        rangeClassName="bg-rose-500"
                        thumbClassName="bg-rose-500 border-rose-300"
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] font-bold text-gray-400">
                        <span>FLOW</span>
                        <span className="text-rose-400">{(brush.flow * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                        value={brush.flow * 100}
                        onValueChange={(v) => setBrush({ ...brush, flow: v / 100 })}
                        max={100} step={1}
                        rangeClassName="bg-rose-500"
                        thumbClassName="bg-rose-500 border-rose-300"
                    />
                </div>
            </div>
        </div>
    );
}

// === MATERIALS TAB ===
function MaterialsContent(props: RightPanelProps) {
    return (
        <UnifiedMaterialDock
            materials={props.projectMaterials}
            activeMaterial={props.activeMaterial}
            onSelect={props.setActiveMaterial}
            onCommit={props.onMaterialCommit}
            mode="full"
            showPreview={true}
            showFluxParams={true}
            showChannelToggles={true}
            showQuickPresets={true}
            currentColor={props.brush?.color}
            processImage={processImage}
            channels={props.materialChannels}
            onChannelsChange={props.setMaterialChannels}
            accentColor="rose"
        />
    );
}

// === LAYERS TAB ===
import { UniversalLayerPanel, UniversalLayer } from '@/ui/layers';

function LayersContent(props: RightPanelProps) {
    // Convert to UniversalLayer format
    const universalLayers: UniversalLayer[] = props.layers.map(l => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity ?? 1.0,
        locked: false,
    }));

    return (
        <div className="p-4 space-y-4 animate-in slide-in-from-right-4 h-full flex flex-col">
            <UniversalLayerPanel
                layers={universalLayers}
                activeLayerId={props.activeLayerId}
                onSelect={(id) => props.setActiveLayerId(id)}
                onToggleVisibility={(id) => props.onLayerVisibility(id, false)}
                onDelete={props.onLayerDelete}
                onAdd={props.onLayerAdd}
                onOpacityChange={props.onLayerOpacity}
                features={{
                    add: true,
                    visibility: true,
                    delete: true,
                    rename: false,
                    lock: false,
                    solo: true, // KGraphos has solo
                    reorder: false,
                    opacity: true, // KGraphos has opacity slider
                    duplicate: false,
                    colorLabels: false,
                    contextMenu: false,
                }}
                accentColor="rose"
                title="LAYER STACK"
                emptyMessage="No layers active"
                compact={false}
            />

            {props.activeLayerId && (
                <div className="bg-[#111] p-3 rounded-lg border border-[#222] space-y-2">
                    <div className="text-[9px] text-gray-500 uppercase font-bold">Blend Mode</div>
                    <select
                        value={(props.layers.find(l => l.id === props.activeLayerId)?.blendMode ?? 'source-over')}
                        onChange={(e) => props.onLayerBlendMode(props.activeLayerId!, e.target.value as GlobalCompositeOperation)}
                        className="w-full bg-[#0b0b0b] border border-[#333] rounded px-2 py-1.5 text-[11px] text-gray-200"
                    >
                        <option value="source-over">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                        <option value="color-dodge">Color Dodge</option>
                        <option value="color-burn">Color Burn</option>
                        <option value="hard-light">Hard Light</option>
                        <option value="soft-light">Soft Light</option>
                        <option value="difference">Difference</option>
                        <option value="exclusion">Exclusion</option>
                    </select>
                </div>
            )}
        </div>
    );
}

// === COLOR UTILS ===
function hexToHsl(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0.5];
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
    h = h / 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h * 12) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function generateHarmonies(baseHex: string): string[] {
    const [h, s, l] = hexToHsl(baseHex);
    return [
        hslToHex((h + 30) % 360, s, l),
        hslToHex((h + 60) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 210) % 360, s, l),
        hslToHex((h + 270) % 360, s, l),
    ];
}
