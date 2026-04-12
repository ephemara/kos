import React from 'react';
import {
    AppTopBar,
    AppTopBarGroup,
    AppTopBarSeparator,
    AppTopBarButton,
    AppTopBarToggleGroup,
    AppTopBarToggleItem,
    AppTopBarSlider
} from '@/ui/shell/AppTopBar';
import {
    Pipette, Globe, BoxSelect, Box, LayoutGrid, Lightbulb, UploadCloud, Share2
} from 'lucide-react';
import { usePainter } from '../PainterContext';
import { openKainAuthoringSession } from '@/kain';

export default function TopBar() {
    const {
        brush, setBrush,
        activeChannels, setActiveChannels,
        viewChannel, setViewChannel,
        handleExport,
        viewMode, setViewMode,
        symmetry, setSymmetry,
        lighting, setLighting
    } = usePainter();

    const openPaintKain = () => {
        openKainAuthoringSession({
            path: 'crates/k-os-kain/domains/paint/paint_surface_filter.kn',
            target: 'spirv',
            domain: 'paint',
            label: 'KPainter Surface Filter',
            description: 'Author KPainter GPU paint/filter logic in the crate-owned KAIN paint domain.',
        });
    };

    return (
        <AppTopBar>
            {/* LEFT: PAINT MODES & BRUSH CONTROLS */}
            <AppTopBarGroup align="start">
                <AppTopBarToggleGroup
                    type="multiple"
                    value={[
                        brush.isPicking ? 'picking' : '',
                        brush.projectionMode ? 'projection' : '',
                        brush.isSeamless ? 'seamless' : ''
                    ].filter(Boolean)}
                >
                    <AppTopBarToggleItem
                        value="picking"
                        onClick={() => setBrush((b: any) => ({ ...b, isPicking: !b.isPicking }))}
                        tooltip="Eyedropper (I)"
                        icon={<Pipette size={14} />}
                        className={brush.isPicking ? "bg-yellow-500/20 text-yellow-400" : ""}
                    />
                    <AppTopBarToggleItem
                        value="projection"
                        onClick={() => setBrush((b: any) => ({ ...b, projectionMode: !b.projectionMode }))}
                        tooltip="3D Projection Paint (P)"
                        icon={<Globe size={14} />}
                        className={brush.projectionMode ? "bg-pink-500/20 text-pink-400" : ""}
                    />
                    <AppTopBarToggleItem
                        value="seamless"
                        onClick={() => setBrush((b: any) => ({ ...b, isSeamless: !b.isSeamless }))}
                        tooltip="Seamless Tiling Mode"
                        icon={<BoxSelect size={14} />}
                        className={brush.isSeamless ? "bg-green-500/20 text-green-400" : ""}
                    />
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                <AppTopBarSlider
                    label="SIZE"
                    value={brush.size}
                    min={1}
                    max={200}
                    step={1}
                    onChange={(v) => setBrush((b: any) => ({ ...b, size: v }))}
                    width="w-24"
                />

                <AppTopBarSlider
                    label="FLOW"
                    value={brush.flow}
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    onChange={(v) => setBrush((b: any) => ({ ...b, flow: v }))}
                    width="w-24"
                    formatValue={(v) => v.toFixed(2)}
                />
            </AppTopBarGroup>

            {/* CENTER: PBR CHANNELS */}
            <AppTopBarGroup align="center">
                <div className="flex gap-1 bg-[color:var(--kos-surface-secondary)] p-1 rounded-lg border border-[color:var(--kos-border-primary)]">
                    {[
                        { id: 'albedo', label: 'C', tooltip: 'Albedo/Color' },
                        { id: 'normal', label: 'N', tooltip: 'Normal Map' },
                        { id: 'roughness', label: 'R', tooltip: 'Roughness' },
                        { id: 'metalness', label: 'M', tooltip: 'Metalness' },
                        { id: 'emission', label: 'E', tooltip: 'Emission' }
                    ].map(ch => (
                        <button
                            key={ch.id}
                            onClick={() => setActiveChannels((p: any) => ({ ...p, [ch.id]: !p[ch.id] }))}
                            className={`w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold transition-all ${
                                activeChannels[ch.id]
                                    ? 'bg-[color:var(--kos-accent-primary)] text-black shadow-sm scale-105'
                                    : 'bg-transparent text-[color:var(--kos-text-muted)] hover:text-[color:var(--kos-text-primary)]'
                            }`}
                            title={ch.tooltip}
                        >
                            {ch.label}
                        </button>
                    ))}
                </div>
            </AppTopBarGroup>

            {/* RIGHT: VIEW & SYMMETRY */}
            <AppTopBarGroup align="end">
                {/* SYMMETRY */}
                <AppTopBarToggleGroup
                    type="multiple"
                    value={Object.entries(symmetry || {}).filter(([k, v]) => v && k !== 'radial' && k !== 'radialCount').map(([k]) => k)}
                >
                    {['x', 'y', 'z'].map(axis => (
                        <AppTopBarToggleItem
                            key={axis}
                            value={axis}
                            onClick={() => setSymmetry((prev: any) => ({ ...prev, [axis]: !prev[axis as keyof typeof prev] }))}
                            tooltip={`Symmetry ${axis.toUpperCase()}`}
                            label={axis.toUpperCase()}
                            className={symmetry[axis as keyof typeof symmetry] ? "text-cyan-400 bg-cyan-500/20" : ""}
                        />
                    ))}
                </AppTopBarToggleGroup>

                <AppTopBarSeparator />

                {/* LIGHTING */}
                <div className="flex items-center gap-2">
                    <Lightbulb size={12} className="text-yellow-400" />
                    <select
                        value={lighting.preset}
                        onChange={(e) => setLighting((prev: any) => ({ ...prev, preset: e.target.value }))}
                        className="bg-transparent border-none text-[10px] font-bold text-[color:var(--kos-text-secondary)] outline-none cursor-pointer hover:text-[color:var(--kos-text-primary)]"
                    >
                        <option value="studio">Studio</option>
                        <option value="outdoor">Outdoor</option>
                        <option value="dark">Dark</option>
                        <option value="neutral">Neutral</option>
                    </select>
                </div>

                <AppTopBarSeparator />

                {/* VIEW MODE */}
                <AppTopBarToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(v) => v && setViewMode(v as "3D" | "2D")}
                >
                    <AppTopBarToggleItem value="3D" tooltip="3D View" icon={<Box size={14} />} />
                    <AppTopBarToggleItem value="2D" tooltip="UV Layout" icon={<LayoutGrid size={14} />} />
                </AppTopBarToggleGroup>

                {/* VIEW CHANNEL */}
                <select
                    value={viewChannel}
                    onChange={(e) => setViewChannel(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-[color:var(--kos-text-secondary)] outline-none cursor-pointer hover:text-[color:var(--kos-text-primary)] ml-2"
                >
                    <option value="MATERIAL">Material</option>
                    <option value="BASE">Albedo</option>
                    <option value="ROUGHNESS">Roughness</option>
                    <option value="METALNESS">Metallic</option>
                    <option value="NORMAL">Normal</option>
                    <option value="EMISSION">Emission</option>
                </select>

                <AppTopBarSeparator />

                {/* UPLINK BUTTON */}
                <AppTopBarButton
                    onClick={handleExport}
                    tooltip="Export to Kernel/Asset Browser"
                    label="UPLINK"
                    icon={<Share2 size={12} />}
                    variant="outline"
                    className="border-orange-500/40 bg-orange-500/10 text-orange-200 hover:bg-orange-500/15"
                />
                <AppTopBarButton
                    onClick={openPaintKain}
                    tooltip="Open KAIN paint authoring"
                    label="KAIN IDE"
                    icon={<Lightbulb size={12} />}
                    variant="outline"
                    className="border-purple-500/35 bg-purple-500/10 text-purple-200 hover:bg-purple-500/15"
                />
            </AppTopBarGroup>
        </AppTopBar>
    );
}
