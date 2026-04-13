/**
 * LeftPanel - Tool Picker & Settings
 * 
 * Pattern from sculpting/paint apps:
 * - Header with app info
 * - Tool/Brush selector
 * - Tool-specific controls
 * - Utility buttons
 */

import React from 'react';
import { Hammer, Settings, Undo } from 'lucide-react';

interface LeftPanelProps {
    activeTool: string;
    onToolChange: (toolId: string) => void;
}

export default function LeftPanel({ activeTool, onToolChange }: LeftPanelProps) {
    return (
        <div className="flex flex-col h-full bg-[#0f0f0f] p-4 space-y-6 overflow-y-auto custom-scrollbar">

            {/* HEADER */}
            <div className="border-b border-[#222] pb-4">
                <div className="flex items-center gap-2 text-cyan-500 mb-1">
                    <Hammer size={16} />
                    <span className="font-black tracking-[0.2em] text-xs">TEMPLATE</span>
                </div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest">
                    Your app description here
                </div>
            </div>

            {/* TOOLS */}
            <div className="space-y-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                    <Settings size={12} /> Tools
                </div>

                {/* Tool Grid Example */}
                <div className="grid grid-cols-2 gap-2">
                    {['Tool 1', 'Tool 2', 'Tool 3', 'Tool 4'].map((tool, i) => (
                        <button
                            key={i}
                            onClick={() => onToolChange(`tool${i + 1}`)}
                            className={`py-3 rounded text-[10px] font-bold transition-all ${activeTool === `tool${i + 1}`
                                    ? 'bg-cyan-500 text-black'
                                    : 'bg-[#222] text-gray-400 hover:bg-[#333]'
                                }`}
                        >
                            {tool}
                        </button>
                    ))}
                </div>
            </div>

            {/* UTILITY BUTTONS */}
            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[#222]">
                <button
                    onClick={() => console.log('Undo')}
                    className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[10px] font-bold flex items-center justify-center gap-2"
                >
                    <Undo size={12} /> UNDO
                </button>
                <button
                    onClick={() => console.log('Reset')}
                    className="py-2 bg-[#222] hover:bg-[#333] rounded text-gray-400 text-[10px] font-bold"
                >
                    RESET
                </button>
            </div>

        </div>
    );
}
