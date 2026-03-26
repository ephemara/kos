/**
 * ConsolePanel - Real-time Bevy Log Viewer
 * 
 * Features:
 * - Color-coded by severity (ERROR=red, WARN=yellow, INFO=blue)
 * - Filterable by level and target
 * - Searchable
 * - Pause/Resume streaming
 * - Auto-scroll with manual override
 * - Ring buffer (oldest logs dropped)
 */

import React, { useRef, useEffect, useState } from 'react';
import {
    Terminal, X, Pause, Play, Trash2, Filter,
    AlertCircle, AlertTriangle, Info, Bug, ChevronDown
} from 'lucide-react';
import {
    useConsoleLogs,
    useConsoleControls,
    useConsoleFilters,
    useLogStats,
    logLevelColor,
    type LogLevel,
} from '@/lib/kos-proto/consoleStore';

interface ConsolePanelProps {
    className?: string;
}

const LEVEL_OPTIONS: LogLevel[] = ['Error', 'Warn', 'Info', 'Debug', 'Trace'];

function LevelIcon({ level }: { level: LogLevel }) {
    const size = 12;
    const color = logLevelColor(level);

    switch (level) {
        case 'Error': return <AlertCircle size={size} color={color} />;
        case 'Warn': return <AlertTriangle size={size} color={color} />;
        case 'Info': return <Info size={size} color={color} />;
        case 'Debug': return <Bug size={size} color={color} />;
        default: return <Terminal size={size} color={color} />;
    }
}

export function ConsolePanel({ className = '' }: ConsolePanelProps) {
    const logs = useConsoleLogs();
    const { isOpen, isPaused, autoScroll, setIsOpen, togglePause, setAutoScroll, clearLogs } = useConsoleControls();
    const { filters, setFilter } = useConsoleFilters();
    const stats = useLogStats();

    const scrollRef = useRef<HTMLDivElement>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    // Handle scroll to detect manual scrolling
    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        if (isAtBottom !== autoScroll) {
            setAutoScroll(isAtBottom);
        }
    };

    const formatTimestamp = (ts: number) => {
        const mins = Math.floor(ts / 60);
        const secs = (ts % 60).toFixed(2);
        return `${mins}:${secs.padStart(5, '0')}`;
    };

    const shortenTarget = (target: string) => {
        // "k_os_gpu_pipeline::atlas" -> "atlas"
        const parts = target.split('::');
        if (parts.length > 2) {
            return parts.slice(-2).join('::');
        }
        return target;
    };

    if (!isOpen) {
        // Collapsed state - just show stats badge
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors ${className}`}
            >
                <Terminal size={16} className="text-gray-400" />
                <span className="text-xs text-gray-400">Console</span>
                {stats.errors > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">
                        {stats.errors}
                    </span>
                )}
                {stats.warns > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
                        {stats.warns}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className={`fixed bottom-0 left-0 right-0 h-64 bg-[#0d0d0d] border-t border-[#333] flex flex-col ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-[#333]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Terminal size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-white">Console</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 text-[10px]">
                        {stats.errors > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                                {stats.errors} errors
                            </span>
                        )}
                        {stats.warns > 0 && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                {stats.warns} warnings
                            </span>
                        )}
                        <span className="text-gray-500">{stats.total} total</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors ${showFilters ? 'bg-white/10' : ''}`}
                        title="Filters"
                    >
                        <Filter size={14} className="text-gray-400" />
                    </button>

                    {/* Pause/Resume */}
                    <button
                        onClick={togglePause}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isPaused ? 'text-yellow-400' : 'text-gray-400'}`}
                        title={isPaused ? 'Resume' : 'Pause'}
                    >
                        {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>

                    {/* Clear */}
                    <button
                        onClick={clearLogs}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 transition-colors"
                        title="Clear"
                    >
                        <Trash2 size={14} />
                    </button>

                    {/* Close */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 transition-colors"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            {showFilters && (
                <div className="flex items-center gap-3 px-3 py-2 bg-[#151515] border-b border-[#333]">
                    {/* Level Filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 uppercase">Level:</span>
                        <select
                            value={filters.minLevel}
                            onChange={(e) => setFilter({ minLevel: e.target.value as LogLevel })}
                            className="bg-[#222] border border-[#333] rounded px-2 py-0.5 text-xs text-white"
                        >
                            {LEVEL_OPTIONS.map((level) => (
                                <option key={level} value={level}>{level}+</option>
                            ))}
                        </select>
                    </div>

                    {/* Target Filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 uppercase">Target:</span>
                        <input
                            type="text"
                            value={filters.targetFilter || ''}
                            onChange={(e) => setFilter({ targetFilter: e.target.value || null })}
                            placeholder="e.g., gpu, sculpt"
                            className="bg-[#222] border border-[#333] rounded px-2 py-0.5 text-xs text-white w-32"
                        />
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-1 flex-1">
                        <span className="text-[10px] text-gray-500 uppercase">Search:</span>
                        <input
                            type="text"
                            value={filters.searchQuery}
                            onChange={(e) => setFilter({ searchQuery: e.target.value })}
                            placeholder="Search logs..."
                            className="bg-[#222] border border-[#333] rounded px-2 py-0.5 text-xs text-white flex-1"
                        />
                    </div>
                </div>
            )}

            {/* Log List */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto font-mono text-xs"
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No logs yet. Bevy will stream logs here in real-time.
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div
                            key={`${log.timestamp}-${i}`}
                            className="flex items-start gap-2 px-3 py-0.5 hover:bg-white/5 border-b border-[#222]"
                        >
                            {/* Timestamp */}
                            <span className="text-gray-600 w-14 flex-shrink-0">
                                {formatTimestamp(log.timestamp)}
                            </span>

                            {/* Level Icon */}
                            <span className="flex-shrink-0 w-4">
                                <LevelIcon level={log.level} />
                            </span>

                            {/* Target */}
                            <span className="text-purple-400 w-24 flex-shrink-0 truncate" title={log.target}>
                                {shortenTarget(log.target)}
                            </span>

                            {/* Message */}
                            <span
                                className="flex-1 break-all"
                                style={{ color: logLevelColor(log.level) }}
                            >
                                {log.message}
                            </span>

                            {/* Frame */}
                            {log.frame !== undefined && log.frame !== null && (
                                <span className="text-gray-600 text-[10px] flex-shrink-0">
                                    f{String(log.frame)}
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Scroll indicator */}
            {!autoScroll && (
                <button
                    onClick={() => {
                        setAutoScroll(true);
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }
                    }}
                    className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-[10px] rounded hover:bg-cyan-500/30 transition-colors"
                >
                    <ChevronDown size={12} />
                    Scroll to bottom
                </button>
            )}
        </div>
    );
}

export default ConsolePanel;
