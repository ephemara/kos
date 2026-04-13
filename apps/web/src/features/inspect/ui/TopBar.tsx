import React, { useRef } from 'react';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarSeparator,
    AppTopBarButton,
    AppTopBarToggleGroup,
    AppTopBarToggleItem
} from '@/ui/shell/AppTopBar';
import { UploadCloud, FileOutput, Grid3X3, Shapes, Sparkles, RotateCw, Share2, Scan } from 'lucide-react';
import type { RenderSettings } from '@/features/inspect/HighFidelityRenderer';

export type KInspectTopBarProps = {
    status: string;
    hasModel: boolean;
    isExporting: boolean;
    onImportFile: (file: File) => void;
    onExport: () => void;
    settings: RenderSettings;
    setSettings: React.Dispatch<React.SetStateAction<RenderSettings>>;
};

export default function TopBar({
    status,
    hasModel,
    isExporting,
    onImportFile,
    onExport,
    settings,
    setSettings,
}: KInspectTopBarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <AppTopBar>
            {/* LEFT: APP NAME & STATUS */}
            <AppTopBarGroup align="start">
                <div className="flex items-center gap-2">
                    <Scan size={14} className="text-[color:var(--kos-accent-primary)]" />
                    <span className="text-[11px] font-black tracking-wide text-[color:var(--kos-text-primary)]">K-INSPECT</span>
                    <span className="text-[10px] font-mono text-[color:var(--kos-text-muted)] truncate max-w-[200px]">{status}</span>
                </div>

                <AppTopBarSeparator />

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".gltf,.glb,.obj,.fbx"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onImportFile(f);
                        e.currentTarget.value = '';
                    }}
                />

                <AppTopBarButton
                    onClick={() => fileInputRef.current?.click()}
                    tooltip="Import 3D Model"
                    shortcut="Ctrl+O"
                    label="IMPORT"
                    icon={<UploadCloud size={12} />}
                    variant="ghost"
                />

                <AppTopBarButton
                    onClick={onExport}
                    disabled={!hasModel || isExporting}
                    tooltip="Export Model"
                    shortcut="Ctrl+E"
                    label={isExporting ? 'EXPORTING...' : 'EXPORT'}
                    icon={<FileOutput size={12} />}
                    variant="ghost"
                />
            </AppTopBarGroup>

            {/* CENTER: VIEW SETTINGS */}
            <AppTopBarGroup align="center">
                <AppTopBarToggleGroup
                    type="multiple"
                    value={[
                        settings.grid ? 'grid' : '',
                        settings.wireframe ? 'wireframe' : '',
                        settings.clayMode ? 'clay' : '',
                        settings.autoRotate ? 'rotate' : ''
                    ].filter(Boolean)}
                >
                    <AppTopBarToggleItem
                        value="grid"
                        onClick={() => setSettings((s: any) => ({ ...s, grid: !s.grid }))}
                        tooltip="Toggle Grid"
                        icon={<Grid3X3 size={14} />}
                    />
                    <AppTopBarToggleItem
                        value="wireframe"
                        onClick={() => setSettings((s: any) => ({ ...s, wireframe: !s.wireframe }))}
                        tooltip="Toggle Wireframe"
                        icon={<Shapes size={14} />}
                    />
                    <AppTopBarToggleItem
                        value="clay"
                        onClick={() => setSettings((s: any) => ({ ...s, clayMode: !s.clayMode }))}
                        tooltip="Toggle Clay Mode"
                        icon={<Sparkles size={14} />}
                    />
                    <AppTopBarToggleItem
                        value="rotate"
                        onClick={() => setSettings((s: any) => ({ ...s, autoRotate: !s.autoRotate }))}
                        tooltip="Toggle Auto Rotate"
                        icon={<RotateCw size={14} />}
                    />
                </AppTopBarToggleGroup>
            </AppTopBarGroup>

            {/* RIGHT: UPLINK BUTTON */}
            <AppTopBarGroup align="end">
                <AppTopBarButton
                    onClick={onExport}
                    disabled={!hasModel || isExporting}
                    tooltip="Export to Kernel/Asset Browser"
                    shortcut="Ctrl+S"
                    label="UPLINK"
                    icon={<Share2 size={12} />}
                    variant="outline"
                    className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
                />
            </AppTopBarGroup>
        </AppTopBar>
    );
}
