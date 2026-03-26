import React, { useEffect } from 'react';
import {
    Play, Pause, SkipBack, Disc, Clock, Film, Layers,
    Repeat, ChevronRight, ChevronLeft
} from 'lucide-react';

export default function KTectonSequencer({
    isRecording, setIsRecording,
    isPlaying, setIsPlaying,
    playhead, setPlayhead,
    maxFrames, setMaxFrames,
    timeDilation, setTimeDilation,
    overwriteMode, setOverwriteMode,
    timelineRef,
    frameStats,
    onExportGLB,
    onExportZIP,
    onExportHeightmap
}: any) {
    const [showHeightmapExport, setShowHeightmapExport] = React.useState(false);
    const [heightmapFormat, setHeightmapFormat] = React.useState<'png8' | 'png16' | 'exr'>('png16');
    const [heightmapResolution, setHeightmapResolution] = React.useState(2048);

    const handleHeightmapExport = () => {
        if (onExportHeightmap) {
            onExportHeightmap(heightmapFormat, heightmapResolution);
            setShowHeightmapExport(false);
        }
    };
    // Draw frame markers on timeline
    useEffect(() => {
        if (!timelineRef.current) return;
        const canvas = timelineRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw frame markers every 10 frames
        const frameInterval = 10;
        const totalMarkers = Math.floor(maxFrames / frameInterval);
        
        ctx.strokeStyle = '#333';
        ctx.fillStyle = '#666';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';

        for (let i = 0; i <= totalMarkers; i++) {
            const frame = i * frameInterval;
            const x = (frame / maxFrames) * width;
            
            // Draw tick mark
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height * 0.2);
            ctx.stroke();

            // Draw frame number
            if (i % 2 === 0) {
                ctx.fillText(frame.toString(), x, height * 0.35);
            }
        }

        // Draw recorded frames indicator
        if (frameStats && frameStats.length > 0) {
            ctx.fillStyle = '#10b981';
            const recordedWidth = (frameStats.length / maxFrames) * width;
            ctx.fillRect(0, height * 0.5, recordedWidth, height * 0.1);
        }
    }, [maxFrames, frameStats, timelineRef]);

    return (
        <div className="w-full h-full bg-[#080808] border-t border-[#1a1a1a] flex flex-col font-sans select-none">

            {/* TOP BAR */}
            <div className="h-9 bg-[#050505] flex items-center justify-between px-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 tracking-widest uppercase">
                    <Film size={12} /> Geo-Sequencer
                </div>
                <div className="text-[9px] text-gray-600 font-mono flex items-center gap-2">
                    <Layers size={10} />
                    <span className="text-gray-500">BUFFER:</span>
                    <span className="text-emerald-400 font-bold">{frameStats?.length || 0}</span>
                    <span className="text-gray-600">/</span>
                    <input
                        type="number" 
                        value={maxFrames}
                        onChange={(e) => setMaxFrames(Math.max(100, parseInt(e.target.value) || 100))}
                        className="bg-transparent border-b border-gray-700 w-16 text-center text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <span className="text-gray-500">FRAMES</span>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="h-14 border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsRecording(!isRecording)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black tracking-wider transition-all ${
                            isRecording 
                                ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                                : 'bg-[#151515] border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#1a1a1a]'
                        }`}
                    >
                        <Disc size={12} className={isRecording ? "animate-pulse" : ""} />
                        {isRecording ? "REC" : "RECORD"}
                    </button>

                    <div className="h-8 w-px bg-[#222]"></div>

                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setPlayhead(0)} 
                            className="p-2 hover:bg-[#222] rounded text-emerald-400 transition-all active:scale-95"
                            title="Jump to Start"
                        >
                            <SkipBack size={14} />
                        </button>

                        <button 
                            onClick={() => {
                                setPlayhead(Math.max(0, playhead - 1));
                                setIsPlaying(false);
                            }} 
                            className="p-2 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-all active:scale-95"
                            title="Previous Frame"
                        >
                            <ChevronLeft size={14} />
                        </button>

                        <button 
                            onClick={() => setIsPlaying(!isPlaying)} 
                            className={`p-2.5 rounded text-emerald-400 transition-all active:scale-95 ${
                                isPlaying 
                                    ? 'bg-emerald-900/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                    : 'hover:bg-[#222]'
                            }`}
                            title={isPlaying ? "Pause" : "Play"}
                        >
                            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                        </button>

                        <button 
                            onClick={() => {
                                setPlayhead(Math.min(playhead + 1, (frameStats?.length || maxFrames) - 1));
                                setIsPlaying(false);
                            }} 
                            className="p-2 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-all active:scale-95"
                            title="Next Frame"
                        >
                            <ChevronRight size={14} />
                        </button>

                        <button 
                            className="p-2 hover:bg-[#222] rounded text-gray-500 hover:text-white transition-all opacity-50 cursor-not-allowed"
                            title="Loop (Coming Soon)"
                        >
                            <Repeat size={14} />
                        </button>
                    </div>

                    <div className="h-8 w-px bg-[#222]"></div>

                    <div className="flex items-center gap-3 text-[10px] font-mono bg-[#050505] px-4 py-2 rounded-lg border border-[#222]">
                        <span className="text-gray-500 font-bold uppercase tracking-wider">Frame</span>
                        <span className="text-emerald-400 font-bold text-xl tabular-nums">{String(Math.floor(playhead)).padStart(4, '0')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Clock size={14} className="text-gray-600" />
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Playback Rate</span>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="range" 
                                    min="0.1" 
                                    max="4.0" 
                                    step="0.1"
                                    value={timeDilation} 
                                    onChange={(e) => setTimeDilation(parseFloat(e.target.value))}
                                    className="w-28 h-1.5 bg-[#222] rounded appearance-none accent-emerald-500 cursor-pointer"
                                />
                                <span className="text-[10px] text-emerald-400 w-10 font-mono tabular-nums">{timeDilation.toFixed(1)}x</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-[#222]"></div>

                    <button 
                        onClick={() => setOverwriteMode(!overwriteMode)} 
                        className={`text-[9px] font-bold px-4 py-2 rounded-lg border tracking-wider transition-all ${
                            overwriteMode 
                                ? 'bg-red-900/20 border-red-500 text-red-400 shadow-lg shadow-red-900/20' 
                                : 'border-[#333] bg-[#151515] text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'
                        }`}
                        title={overwriteMode ? "Overwrite existing frames" : "Append new frames"}
                    >
                        {overwriteMode ? 'OVERWRITE' : 'APPEND'}
                    </button>

                    <div className="h-8 w-px bg-[#222]"></div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onExportGLB} 
                            className="text-[9px] font-bold px-4 py-2 rounded-lg bg-emerald-900/40 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                            title="Export terrain mesh as GLB"
                        >
                            <Layers size={10} /> GLB
                        </button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setShowHeightmapExport(!showHeightmapExport)} 
                                className="text-[9px] font-bold px-4 py-2 rounded-lg bg-blue-900/40 border border-blue-500/50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
                                title="Export heightmap as PNG/EXR"
                            >
                                <Layers size={10} /> HEIGHTMAP
                            </button>
                            
                            {showHeightmapExport && (
                                <div className="absolute bottom-full right-0 mb-2 bg-[#0a0a0a] border border-[#333] rounded-lg p-4 shadow-2xl z-50 min-w-[280px]">
                                    <div className="text-[10px] font-bold text-emerald-400 mb-3 uppercase tracking-wider">
                                        Heightmap Export
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-2">
                                                Format
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setHeightmapFormat('png8')}
                                                    className={`flex-1 text-[9px] font-bold px-3 py-2 rounded border transition-all ${
                                                        heightmapFormat === 'png8'
                                                            ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                                                            : 'bg-[#151515] border-[#333] text-gray-400 hover:text-white'
                                                    }`}
                                                >
                                                    PNG 8-bit
                                                </button>
                                                <button
                                                    onClick={() => setHeightmapFormat('png16')}
                                                    className={`flex-1 text-[9px] font-bold px-3 py-2 rounded border transition-all ${
                                                        heightmapFormat === 'png16'
                                                            ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                                                            : 'bg-[#151515] border-[#333] text-gray-400 hover:text-white'
                                                    }`}
                                                >
                                                    PNG 16-bit
                                                </button>
                                                <button
                                                    onClick={() => setHeightmapFormat('exr')}
                                                    className={`flex-1 text-[9px] font-bold px-3 py-2 rounded border transition-all ${
                                                        heightmapFormat === 'exr'
                                                            ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                                                            : 'bg-[#151515] border-[#333] text-gray-400 hover:text-white'
                                                    }`}
                                                >
                                                    EXR 32-bit
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-2">
                                                Resolution
                                            </label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {[512, 1024, 2048, 4096, 8192].map(res => (
                                                    <button
                                                        key={res}
                                                        onClick={() => setHeightmapResolution(res)}
                                                        className={`text-[9px] font-bold px-2 py-2 rounded border transition-all ${
                                                            heightmapResolution === res
                                                                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                                                                : 'bg-[#151515] border-[#333] text-gray-400 hover:text-white'
                                                        }`}
                                                    >
                                                        {res}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={handleHeightmapExport}
                                                className="flex-1 text-[9px] font-bold px-4 py-2 rounded-lg bg-emerald-900/40 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                            >
                                                Export
                                            </button>
                                            <button
                                                onClick={() => setShowHeightmapExport(false)}
                                                className="flex-1 text-[9px] font-bold px-4 py-2 rounded-lg bg-[#151515] border border-[#333] text-gray-400 hover:text-white transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <button 
                            onClick={onExportZIP} 
                            className="text-[9px] font-bold px-4 py-2 rounded-lg bg-[#151515] border border-[#333] text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-all flex items-center gap-2"
                            title="Export as ZIP (Coming Soon)"
                        >
                            <Layers size={10} /> ZIP
                        </button>
                    </div>
                </div>
            </div>

            {/* TIMELINE VISUALIZER */}
            <div className="flex-1 relative bg-[#050505] group overflow-hidden">
                {/* Grid Background */}
                <div className="absolute inset-0 flex justify-between px-2 opacity-10 pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="w-px h-full bg-[#444]"></div>
                    ))}
                </div>

                {/* Timeline Canvas */}
                <div className="absolute inset-0 top-2 bottom-2 px-4">
                    <canvas 
                        ref={timelineRef} 
                        width={1200} 
                        height={100} 
                        className="w-full h-full opacity-90 block" 
                    />
                </div>

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-20 pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.6)] transition-all duration-75"
                    style={{ left: `${(playhead / maxFrames) * 100}%` }}
                >
                    <div className="absolute top-0 -left-2 w-5 h-5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)' }}></div>
                </div>

                {/* Scrubber Area */}
                <input
                    type="range"
                    min="0" 
                    max={maxFrames}
                    value={playhead}
                    onChange={(e) => {
                        setIsPlaying(false);
                        setIsRecording(false);
                        setPlayhead(parseFloat(e.target.value));
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                    title="Scrub Timeline"
                />

                {/* Frame Info Overlay */}
                <div className="absolute bottom-2 left-4 text-[8px] text-gray-600 font-mono pointer-events-none">
                    Frame {Math.floor(playhead)} / {maxFrames}
                </div>
            </div>
        </div>
    );
}
