/**
 * VAT Export Dialog for KQuantum
 * Configurable export settings for Vertex Animation Textures
 */

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/ui/primitives/cn';
import { vatExportClient, VATExportOptions } from '@/services/vatExportClient';

interface VATExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    simId: number | null;
    onExportComplete?: () => void;
}

export function VATExportDialog({
    open,
    onOpenChange,
    simId,
    onExportComplete,
}: VATExportDialogProps) {
    const [frameCount, setFrameCount] = useState(120);
    const [frameRate, setFrameRate] = useState(30);
    const [textureResolution, setTextureResolution] = useState(1024);
    const [exportPosition, setExportPosition] = useState(true);
    const [exportNormal, setExportNormal] = useState(true);
    const [normalizePositions, setNormalizePositions] = useState(true);
    const [boundsPadding, setBoundsPadding] = useState(0.1);
    
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        if (!simId) {
            setError('No active simulation');
            return;
        }

        setExporting(true);
        setError(null);
        setProgress(0);

        try {
            const options: VATExportOptions = {
                frameCount,
                frameRate,
                textureResolution,
                exportPosition,
                exportNormal,
                normalizePositions,
                boundsPadding,
            };

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            
            await vatExportClient.exportToFiles(
                simId,
                options,
                `kquantum_vat_${timestamp}`,
                (prog, msg) => {
                    setProgress(prog);
                    setProgressMessage(msg);
                }
            );

            onExportComplete?.();
            
            // Close dialog after short delay
            setTimeout(() => {
                onOpenChange(false);
                setExporting(false);
                setProgress(0);
                setProgressMessage('');
            }, 1500);

        } catch (err) {
            console.error('VAT export failed:', err);
            setError(err instanceof Error ? err.message : String(err));
            setExporting(false);
        }
    };

    const estimatedDuration = frameCount / frameRate;
    const resolutions = [256, 512, 1024, 2048, 4096];

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border border-purple-500/30 rounded-lg shadow-2xl animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
                        <Dialog.Title className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                            VAT Export Settings
                        </Dialog.Title>
                        <Dialog.Close className="text-gray-500 hover:text-gray-300 transition">
                            <X size={16} />
                        </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {/* Info Banner */}
                        <div className="bg-purple-900/20 border border-purple-500/30 rounded p-3 text-[10px] text-purple-300 space-y-1">
                            <div className="font-bold">Vertex Animation Texture Export</div>
                            <div className="text-purple-400/80">
                                Bakes particle animation into textures for real-time playback in game engines (Unreal Engine, Unity, etc.)
                            </div>
                        </div>

                        {/* Animation Settings */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Animation</div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-400">Frame Count</span>
                                    <span className="text-gray-200 font-mono">{frameCount}</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="500"
                                    step="10"
                                    value={frameCount}
                                    onChange={(e) => setFrameCount(parseInt(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-400">Frame Rate (FPS)</span>
                                    <span className="text-gray-200 font-mono">{frameRate}</span>
                                </div>
                                <input
                                    type="range"
                                    min="15"
                                    max="120"
                                    step="15"
                                    value={frameRate}
                                    onChange={(e) => setFrameRate(parseInt(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            <div className="text-[9px] text-gray-600">
                                Duration: {estimatedDuration.toFixed(2)}s
                            </div>
                        </div>

                        {/* Texture Settings */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Texture</div>
                            
                            <div className="space-y-2">
                                <div className="text-[10px] text-gray-400 mb-1">Resolution</div>
                                <div className="grid grid-cols-5 gap-1">
                                    {resolutions.map((res) => (
                                        <button
                                            key={res}
                                            onClick={() => setTextureResolution(res)}
                                            className={cn(
                                                "py-1 text-[9px] font-bold rounded border transition-all",
                                                textureResolution === res
                                                    ? "bg-purple-600 text-white border-purple-400"
                                                    : "bg-[#111] border-[#333] text-gray-500 hover:text-gray-300"
                                            )}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] text-gray-400 mb-1">Bounds Padding</div>
                                <input
                                    type="range"
                                    min="0"
                                    max="0.5"
                                    step="0.05"
                                    value={boundsPadding}
                                    onChange={(e) => setBoundsPadding(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <div className="text-[9px] text-gray-600">{(boundsPadding * 100).toFixed(0)}%</div>
                            </div>
                        </div>

                        {/* Export Options */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Export</div>
                            
                            <div className="space-y-2">
                                <button
                                    onClick={() => setExportPosition(!exportPosition)}
                                    className={cn(
                                        "w-full flex items-center justify-between py-2 px-3 rounded border transition-all text-[10px]",
                                        exportPosition
                                            ? "bg-purple-900/30 border-purple-500/40 text-purple-300"
                                            : "bg-[#111] border-[#333] text-gray-500"
                                    )}
                                >
                                    <span>Position Texture</span>
                                    <div className={cn("w-2 h-2 rounded-full", exportPosition ? "bg-purple-400" : "bg-gray-600")} />
                                </button>

                                <button
                                    onClick={() => setExportNormal(!exportNormal)}
                                    className={cn(
                                        "w-full flex items-center justify-between py-2 px-3 rounded border transition-all text-[10px]",
                                        exportNormal
                                            ? "bg-purple-900/30 border-purple-500/40 text-purple-300"
                                            : "bg-[#111] border-[#333] text-gray-500"
                                    )}
                                >
                                    <span>Normal Texture</span>
                                    <div className={cn("w-2 h-2 rounded-full", exportNormal ? "bg-purple-400" : "bg-gray-600")} />
                                </button>

                                <button
                                    onClick={() => setNormalizePositions(!normalizePositions)}
                                    className={cn(
                                        "w-full flex items-center justify-between py-2 px-3 rounded border transition-all text-[10px]",
                                        normalizePositions
                                            ? "bg-purple-900/30 border-purple-500/40 text-purple-300"
                                            : "bg-[#111] border-[#333] text-gray-500"
                                    )}
                                >
                                    <span>Normalize Positions</span>
                                    <div className={cn("w-2 h-2 rounded-full", normalizePositions ? "bg-purple-400" : "bg-gray-600")} />
                                </button>
                            </div>
                        </div>

                        {/* Progress */}
                        {exporting && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] text-purple-300">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                                    {progressMessage}
                                </div>
                                <div className="h-1 bg-[#111] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="bg-red-900/20 border border-red-500/30 rounded p-3 flex items-start gap-2">
                                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                <div className="text-[10px] text-red-300">{error}</div>
                            </div>
                        )}

                        {/* Success */}
                        {progress === 100 && !error && (
                            <div className="bg-green-900/20 border border-green-500/30 rounded p-3 flex items-center gap-2">
                                <CheckCircle size={14} className="text-green-400" />
                                <div className="text-[10px] text-green-300">Export complete!</div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-2 p-4 border-t border-purple-500/20">
                        <button
                            onClick={() => onOpenChange(false)}
                            disabled={exporting}
                            className="flex-1 py-2 px-4 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-bold text-gray-400 hover:text-gray-200 transition disabled:opacity-50"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting || !exportPosition && !exportNormal}
                            className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 border border-purple-400 rounded text-[10px] font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {exporting ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    EXPORTING...
                                </>
                            ) : (
                                <>
                                    <Download size={12} />
                                    EXPORT VAT
                                </>
                            )}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
