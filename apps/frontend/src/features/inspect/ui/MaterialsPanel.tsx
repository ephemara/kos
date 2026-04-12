import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export type MaterialsPanelProps = {
    materials: any[];
    updateMaterialValue: (uuid: string, prop: string, val: number) => void;
};

export default function MaterialsPanel({ materials, updateMaterialValue }: MaterialsPanelProps) {
    return (
        <div className="space-y-4">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={10} /> Material Slots
            </div>
            <div className="space-y-4">
                {materials.map((mat, i) => (
                    <div key={mat.uuid} className="bg-[#111] border border-[#222] rounded p-3">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#222]">
                            <div
                                className="w-3 h-3 rounded-full border border-[#444]"
                                style={{ background: `#${mat.color.getHexString()}` }}
                            />
                            <span className="text-[10px] font-bold text-white flex-1 truncate">{mat.name || `Material_${i}`}</span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-gray-500"><span>ROUGHNESS</span><span>{mat.roughness.toFixed(2)}</span></div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={mat.roughness}
                                onChange={(e) => updateMaterialValue(mat.uuid, 'roughness', parseFloat(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"
                            />
                            <div className="flex justify-between text-[8px] text-gray-500"><span>METALNESS</span><span>{mat.metalness.toFixed(2)}</span></div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={mat.metalness}
                                onChange={(e) => updateMaterialValue(mat.uuid, 'metalness', parseFloat(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded accent-[#00ffcc]"
                            />
                        </div>
                    </div>
                ))}
                {materials.length === 0 ? (
                    <div className="text-[10px] text-gray-600 italic">No materials found</div>
                ) : null}
            </div>
        </div>
    );
}
