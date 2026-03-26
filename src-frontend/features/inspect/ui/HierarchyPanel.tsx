import React from 'react';
import { Workflow, Eye, EyeOff } from 'lucide-react';

export type HierarchyPanelProps = {
    hierarchy: Array<{ uuid: string; name: string; type: string; depth: number; visible: boolean }>;
    selectedUuid: string | null;
    onSelect: (uuid: string) => void;
    onToggleVisible: (uuid: string) => void;
};

export default function HierarchyPanel({ hierarchy, selectedUuid, onSelect, onToggleVisible }: HierarchyPanelProps) {
    return (
        <div className="space-y-3">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Workflow size={10} /> Scene Graph
            </div>
            <div className="bg-[#111] border border-[#222] rounded p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {hierarchy.length === 0 ? (
                    <div className="text-[10px] text-gray-600 italic p-2">No hierarchy</div>
                ) : null}

                {hierarchy.map((n) => {
                    const active = n.uuid === selectedUuid;
                    return (
                        <div
                            key={n.uuid}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            style={{ paddingLeft: 8 + n.depth * 10 }}
                        >
                            <button
                                onClick={() => onSelect(n.uuid)}
                                className={`flex-1 min-w-0 text-left text-[10px] font-mono ${active ? 'text-[#00ffcc]' : 'text-gray-300'}`}
                                title={n.type}
                            >
                                <span className="truncate block">{n.name}</span>
                            </button>
                            <button
                                onClick={() => onToggleVisible(n.uuid)}
                                className="h-7 w-7 rounded border border-white/10 hover:bg-white/10 text-gray-300 flex items-center justify-center"
                                title={n.visible ? 'Hide' : 'Show'}
                            >
                                {n.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
