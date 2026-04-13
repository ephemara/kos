/**
 * BevyLayerPanel - Universal Layer Panel for Bevy Viewport
 * 
 * Ported from egui layers_panel.rs to React.
 * Shows scene objects with visibility/lock toggles, selection, and rename.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Eye, EyeOff, Lock, Unlock, Trash2, Search, X } from 'lucide-react';

// Types matching Bevy's LayerInfo
interface LayerObject {
    entity: number;  // Bevy Entity ID
    name: string;
    order: number;
    visible: boolean;
    locked: boolean;
    selected: boolean;
}

interface BevyLayerPanelProps {
    isOpen?: boolean;
    onClose?: () => void;
    className?: string;
}

export function BevyLayerPanel({ isOpen = true, onClose, className = '' }: BevyLayerPanelProps) {
    const [layers, setLayers] = useState<LayerObject[]>([]);
    const [search, setSearch] = useState('');
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // ── Layer state: driven by Tauri push events ────────────────────────────────
    // Bevy emits 'leash://layers-changed' whenever the scene graph is mutated.
    useEffect(() => {
        if (!isOpen) return;

        let unlisten: (() => void) | null = null;
        let fallbackInterval: ReturnType<typeof setInterval> | null = null;

        const fetchLayers = async () => {
            try {
                const result = await invoke<LayerObject[]>('leash_get_layers');
                setLayers(result);
            } catch { /* Bevy not ready */ }
        };

        const setup = async () => {
            fetchLayers(); // Initial fetch

            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlisten = await listen('leash://layers-changed', fetchLayers);
            } catch {
                // Fall back to slow poll in dev/test environments
                fallbackInterval = setInterval(fetchLayers, 2000);
            }
        };

        setup();

        return () => {
            unlisten?.();
            if (fallbackInterval != null) clearInterval(fallbackInterval);
        };
    }, [isOpen]);

    const handleSelect = useCallback(async (entity: number, addToSelection: boolean = false) => {
        try {
            await invoke('leash_select_object', { entity, addToSelection });
        } catch (e) {
            console.error('Failed to select object:', e);
        }
    }, []);

    const handleToggleVisibility = useCallback(async (entity: number) => {
        try {
            await invoke('leash_toggle_visibility', { entity });
        } catch (e) {
            console.error('Failed to toggle visibility:', e);
        }
    }, []);

    const handleToggleLock = useCallback(async (entity: number) => {
        try {
            await invoke('leash_toggle_lock', { entity });
        } catch (e) {
            console.error('Failed to toggle lock:', e);
        }
    }, []);

    const handleDelete = useCallback(async () => {
        try {
            await invoke('leash_delete_selected');
        } catch (e) {
            console.error('Failed to delete:', e);
        }
    }, []);

    const handleRename = useCallback(async (entity: number, newName: string) => {
        if (!newName.trim()) return;
        try {
            await invoke('leash_rename_object', { entity, name: newName.trim() });
            setRenamingId(null);
        } catch (e) {
            console.error('Failed to rename:', e);
        }
    }, []);

    const startRename = useCallback((layer: LayerObject) => {
        setRenamingId(layer.entity);
        setRenameValue(layer.name);
    }, []);

    // Filter layers by search
    const filteredLayers = layers
        .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    const hasSelection = layers.some(l => l.selected);

    if (!isOpen) return null;

    return (
        <div className={`flex flex-col bg-[#1c1c23] border-l border-[#12121a] w-60 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#12121a]">
                <span className="text-cyan-400 font-semibold text-xs flex items-center gap-2">
                    📑 LAYERS
                </span>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-[#12121a]">
                <div className="flex items-center gap-2 bg-[#26262f] rounded px-2 py-1">
                    <Search size={12} className="text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter..."
                        className="bg-transparent text-xs text-white placeholder-gray-500 outline-none flex-1"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-b border-[#12121a]">
                <button
                    onClick={handleDelete}
                    disabled={!hasSelection}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${hasSelection
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-[#26262f] text-gray-600 cursor-not-allowed'
                        }`}
                >
                    <Trash2 size={12} />
                    Delete
                </button>
            </div>

            {/* Layer List */}
            <div className="flex-1 overflow-y-auto px-1 py-1">
                {filteredLayers.length === 0 ? (
                    <div className="text-gray-600 text-xs text-center py-4">
                        {layers.length === 0 ? 'No objects in scene' : 'No matches'}
                    </div>
                ) : (
                    filteredLayers.map((layer) => (
                        <div
                            key={layer.entity}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded mb-0.5 group ${layer.selected
                                    ? 'bg-purple-500/20 border border-purple-500/30'
                                    : 'hover:bg-[#26262f]'
                                }`}
                        >
                            {/* Visibility Toggle */}
                            <button
                                onClick={() => handleToggleVisibility(layer.entity)}
                                className={`p-1 rounded transition-colors ${layer.visible
                                        ? 'text-cyan-400 hover:text-cyan-300'
                                        : 'text-gray-600 hover:text-gray-400'
                                    }`}
                            >
                                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>

                            {/* Lock Toggle */}
                            <button
                                onClick={() => handleToggleLock(layer.entity)}
                                className={`p-1 rounded transition-colors ${layer.locked
                                        ? 'text-orange-400 hover:text-orange-300'
                                        : 'text-gray-600 hover:text-gray-400'
                                    }`}
                            >
                                {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>

                            {/* Name / Rename */}
                            {renamingId === layer.entity ? (
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={() => handleRename(layer.entity, renameValue)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename(layer.entity, renameValue);
                                        if (e.key === 'Escape') setRenamingId(null);
                                    }}
                                    autoFocus
                                    className="flex-1 bg-[#26262f] text-white text-xs px-2 py-1 rounded outline-none border border-cyan-500/50"
                                />
                            ) : (
                                <button
                                    onClick={() => handleSelect(layer.entity)}
                                    onDoubleClick={() => startRename(layer)}
                                    className={`flex-1 text-left text-xs truncate px-1 ${layer.selected ? 'text-white' : 'text-gray-300'
                                        }`}
                                >
                                    {layer.name}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default BevyLayerPanel;
