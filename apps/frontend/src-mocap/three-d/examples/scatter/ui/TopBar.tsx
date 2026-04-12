import React from 'react';
import { Share2, RotateCw, Merge, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@mocap/shared/primitives/Button';
import { Slider } from '@mocap/shared/primitives/Slider';

interface TopBarProps {
    objectCount: number;
    setObjectCount: (v: number) => void;
    scatterRadius: number;
    setScatterRadius: (v: number) => void;
    minScale: number;
    setMinScale: (v: number) => void;
    maxScale: number;
    setMaxScale: (v: number) => void;
    autoRotate: boolean;
    setAutoRotate: (v: boolean) => void;
    weldGeometry: boolean;
    setWeldGeometry: (v: boolean) => void;
    distributionEnabled: boolean;
    setDistributionEnabled: (v: boolean) => void;
    onUplink: () => void;
}

export default function TopBar({
    objectCount, setObjectCount,
    scatterRadius, setScatterRadius,
    minScale, setMinScale,
    maxScale, setMaxScale,
    autoRotate, setAutoRotate,
    weldGeometry, setWeldGeometry,
    distributionEnabled, setDistributionEnabled,
    onUplink
}: TopBarProps) {
    return (
        <div className="h-14 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#333]/50 rounded-2xl flex items-center justify-between px-5 shadow-2xl">
            <div className="flex items-center gap-5 min-w-0">
                <div className="flex flex-col w-28 gap-1">
                    <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-wider">
                        <span>Density</span>
                        <span className="text-pink-400">{objectCount}</span>
                    </div>
                    <Slider
                        value={objectCount}
                        onValueChange={setObjectCount}
                        min={10}
                        max={2000}
                        step={10}
                        rangeClassName="bg-pink-500/60"
                        thumbClassName="border-pink-500/60"
                    />
                </div>

                <div className="flex flex-col w-28 gap-1">
                    <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-wider">
                        <span>Spread</span>
                        <span className="text-pink-400">{scatterRadius.toFixed(1)}</span>
                    </div>
                    <Slider
                        value={scatterRadius}
                        onValueChange={setScatterRadius}
                        min={0.5}
                        max={20}
                        step={0.5}
                        rangeClassName="bg-pink-500/60"
                        thumbClassName="border-pink-500/60"
                    />
                </div>

                <div className="h-7 w-px bg-[#333]" />

                <div className="flex items-center gap-3">
                    <div className="flex flex-col w-20 gap-1">
                        <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-wider">
                            <span>Min</span>
                            <span className="text-cyan-400">{minScale.toFixed(2)}</span>
                        </div>
                        <Slider
                            value={minScale}
                            onValueChange={setMinScale}
                            min={0.01}
                            max={0.5}
                            step={0.01}
                            rangeClassName="bg-cyan-500/60"
                            thumbClassName="border-cyan-500/60"
                        />
                    </div>

                    <div className="flex flex-col w-20 gap-1">
                        <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-wider">
                            <span>Max</span>
                            <span className="text-cyan-400">{maxScale.toFixed(2)}</span>
                        </div>
                        <Slider
                            value={maxScale}
                            onValueChange={setMaxScale}
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            rangeClassName="bg-cyan-500/60"
                            thumbClassName="border-cyan-500/60"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant={autoRotate ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={autoRotate ? 'text-pink-300 border-pink-500/40 bg-pink-500/10' : ''}
                >
                    <RotateCw size={12} className={autoRotate ? 'animate-spin' : ''} />
                    SPIN
                </Button>

                <Button
                    variant={weldGeometry ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setWeldGeometry(!weldGeometry)}
                    className={weldGeometry ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : ''}
                >
                    <Merge size={12} />
                    {weldGeometry ? 'WELD' : 'INST'}
                </Button>

                <Button
                    variant={distributionEnabled ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setDistributionEnabled(!distributionEnabled)}
                    className={distributionEnabled ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10' : ''}
                >
                    {distributionEnabled ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    R-ROBIN
                </Button>

                <div className="w-px h-7 bg-[#333] mx-1" />

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onUplink}
                    className="border border-pink-500/40 bg-pink-500/10 text-pink-200 hover:bg-pink-500/15"
                >
                    <Share2 size={12} />
                    UPLINK
                </Button>
            </div>
        </div>
    );
}
