import React from 'react';
import { Paintbrush } from 'lucide-react';
import { UnifiedMaterialDock } from '@/ui/materials';
import AlphaPanel from './AlphaPanel';

interface LeftPanelProps {
    brush: any;
    setBrush: (updater: any) => void;

    projectMaterials: any[];
    activeMaterial: any;
    setActiveMaterial: (mat: any) => void;
    handleChangeMesh: () => void;
    handleExport: () => void;

    alphas: any[];
    handleGenerateAlpha: () => void;
    handleImportAlpha: (e: any) => void;
    isGeneratingAlpha: boolean;
    alphaPrompt: string;
    setAlphaPrompt: (s: string) => void;
}

export default function LeftPanel({
    brush,
    setBrush,
    projectMaterials,
    activeMaterial,
    setActiveMaterial,
    handleChangeMesh,
    handleExport,
    alphas,
    handleGenerateAlpha,
    handleImportAlpha,
    isGeneratingAlpha,
    alphaPrompt,
    setAlphaPrompt,
}: LeftPanelProps) {
    return (
        <div className="-m-3 flex flex-col h-full bg-[#0f0f0f]">
            <div className="p-4 border-b border-[#222] bg-[#111] shrink-0">
                <div className="flex items-center gap-2 text-[#3daee9] mb-1">
                    <Paintbrush size={16} />
                    <span className="font-black tracking-[0.2em] text-xs">K-PAINTER</span>
                </div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest">PBR Texture Engine</div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <div className="space-y-4">
                        <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                            <Paintbrush size={12} /> Brush Engine
                        </div>

                        <AlphaPanel
                            alphas={alphas}
                            activeAlpha={brush.alphaMap}
                            onSelect={(alpha: any) => setBrush((prev: any) => ({ ...prev, alphaMap: alpha ? alpha.texture : null }))}
                            handleGenerateAlpha={handleGenerateAlpha}
                            handleImportAlpha={handleImportAlpha}
                            isGeneratingAlpha={isGeneratingAlpha}
                            alphaPrompt={alphaPrompt}
                            setAlphaPrompt={setAlphaPrompt}
                        />
                    </div>
                </div>

                <div className="h-1/3 min-h-[200px] border-t border-[#333] flex flex-col bg-[#111]">
                    <UnifiedMaterialDock
                        materials={projectMaterials}
                        activeMaterial={activeMaterial}
                        onSelect={setActiveMaterial}
                        mode="compact"
                        showPreview={true}
                        showFluxParams={false}
                        accentColor="blue"
                    />
                </div>
            </div>
        </div>
    );
}

