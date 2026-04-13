/**
 * KContentBrowser.tsx - K_OS Universal Asset Hub
 * 
 * The central hub for cross-app workflows. Press Ctrl+Space anywhere!
 * 
 * Features:
 * - SCENE: Live hierarchy from KObjectRegistry (auto-registered objects)
 * - MESHES: Saved mesh blobs from Storage
 * - MATERIALS: Quick access to project materials
 * - TEXTURES: Swappable textures (for PBR, references)
 * - ALPHAS: Brush alphas and textures
 * - Search by name or kId
 * - Right-click: Save to Storage, Open in App, Delete
 * 
 * @version 3.0 - Auto-register overhaul
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, Box, X, Palette, Image as ImageIcon, Layers, HardDrive,
    Paintbrush, ArrowRight, Trash2, Save, FolderOpen, ChevronRight, ChevronDown,
    Upload, Download, MoreHorizontal, Sparkles, Target, Eye, EyeOff
} from 'lucide-react';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '../../types/kernel';
import { kObjectRegistry, KObject } from '@/systems/objects/KObjectRegistry';

// ============================================================================
// TYPES
// ============================================================================

type TabId = 'scene' | 'meshes' | 'materials' | 'textures' | 'alphas';

interface KContentBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onDropAsset: (asset: any) => void;
    onImport?: (file: File) => void;
    onSaveToStorage?: (kObject: KObject) => void;
    onDeleteSceneObject?: (kObject: KObject) => void;
    artifacts: KernelArtifact[];
    materials: KernelMaterial[];
    alphas: KernelAlpha[];
    onOpenInApp?: (appId: string, item: any) => void;
    onDelete?: (item: any) => void;
    activeAppId?: string;
}

// App color mapping for visual identification
const APP_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    'KSculpt': { bg: 'bg-orange-900/30', border: 'border-orange-500/50', text: 'text-orange-400', icon: '🟠' },
    'KPainter': { bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-400', icon: '🔵' },
    'KGreeble': { bg: 'bg-emerald-900/30', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: '🟢' },
    'KGraphos': { bg: 'bg-rose-900/30', border: 'border-rose-500/50', text: 'text-rose-400', icon: '🌸' },
    'KAtlas': { bg: 'bg-purple-900/30', border: 'border-purple-500/50', text: 'text-purple-400', icon: '🟣' },
    'KCloner': { bg: 'bg-amber-900/30', border: 'border-amber-500/50', text: 'text-amber-400', icon: '🟡' },
    'default': { bg: 'bg-gray-900/30', border: 'border-gray-500/50', text: 'text-gray-400', icon: '⚪' },
};

const TABS: { id: TabId; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'scene', label: 'SCENE', icon: Layers, color: 'text-yellow-400' },
    { id: 'meshes', label: 'MESHES', icon: HardDrive, color: 'text-cyan-400' },
    { id: 'materials', label: 'MATERIALS', icon: Palette, color: 'text-green-400' },
    { id: 'textures', label: 'TEXTURES', icon: ImageIcon, color: 'text-pink-400' },
    { id: 'alphas', label: 'ALPHAS', icon: Paintbrush, color: 'text-purple-400' },
];

// ============================================================================
// HIERARCHY HELPERS
// ============================================================================

interface SceneNode {
    object: KObject;
    children: SceneNode[];
    isExpanded: boolean;
}

function buildHierarchy(objects: KObject[]): SceneNode[] {
    // Build a map of kId -> KObject
    const objectMap = new Map<string, KObject>();
    objects.forEach(obj => objectMap.set(obj.kId, obj));

    // Find root objects (no parent or parent not in list)
    const roots: SceneNode[] = [];
    const nodeMap = new Map<string, SceneNode>();

    // Create nodes for all objects
    objects.forEach(obj => {
        nodeMap.set(obj.kId, {
            object: obj,
            children: [],
            isExpanded: true
        });
    });

    // Build tree structure
    objects.forEach(obj => {
        const node = nodeMap.get(obj.kId)!;
        if (obj.parentKId && nodeMap.has(obj.parentKId)) {
            nodeMap.get(obj.parentKId)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function KContentBrowser({
    isOpen,
    onClose,
    onDropAsset,
    onImport,
    onSaveToStorage,
    onDeleteSceneObject,
    artifacts = [],
    materials = [],
    alphas = [],
    onOpenInApp,
    onDelete,
    activeAppId = 'unknown'
}: KContentBrowserProps) {
    const [activeTab, setActiveTab] = useState<TabId>('scene'); // Default to SCENE
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any; isSceneObject: boolean } | null>(null);
    const [sceneObjects, setSceneObjects] = useState<KObject[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid'); // Future tree view support

    // Refresh scene objects from registry
    const refreshSceneObjects = useCallback(() => {
        const objects = kObjectRegistry.query({ type: ['mesh', 'group'], isLoaded: true });
        setSceneObjects(objects);
    }, []);

    // Subscribe to registry changes for instant updates
    useEffect(() => {
        refreshSceneObjects(); // Initial load

        // Subscribe to registry events for instant sync
        const unsubscribe = kObjectRegistry.subscribe((event) => {
            // Refresh on any registry change
            if (['register', 'delete', 'update', 'restore'].includes(event.type)) {
                refreshSceneObjects();
            }
        });

        return () => unsubscribe();
    }, [refreshSceneObjects]);

    // Also refresh when opened (in case changes happened while closed)
    useEffect(() => {
        if (isOpen) {
            refreshSceneObjects();
        }
    }, [isOpen, refreshSceneObjects]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close context menu on click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, item: any, isSceneObject: boolean = false) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item, isSceneObject });
    };

    // Filter items based on search
    const filteredSceneObjects = useMemo(() => {
        if (!searchQuery.trim()) return sceneObjects;
        const q = searchQuery.toLowerCase();
        return sceneObjects.filter(obj =>
            obj.name.toLowerCase().includes(q) ||
            obj.kId.toLowerCase().includes(q) ||
            obj.createdBy?.toLowerCase().includes(q)
        );
    }, [sceneObjects, searchQuery]);

    const filteredArtifacts = useMemo(() => {
        if (!searchQuery.trim()) return artifacts;
        const q = searchQuery.toLowerCase();
        return artifacts.filter(a => a.name.toLowerCase().includes(q));
    }, [artifacts, searchQuery]);

    const filteredMaterials = useMemo(() => {
        if (!searchQuery.trim()) return materials;
        const q = searchQuery.toLowerCase();
        return materials.filter(m => m.name.toLowerCase().includes(q));
    }, [materials, searchQuery]);

    const filteredAlphas = useMemo(() => {
        if (!searchQuery.trim()) return alphas;
        const q = searchQuery.toLowerCase();
        return alphas.filter(a => a.name.toLowerCase().includes(q));
    }, [alphas, searchQuery]);

    // Build hierarchy for tree view (future use)
    const sceneHierarchy = useMemo(() => buildHierarchy(filteredSceneObjects), [filteredSceneObjects]);

    // Toggle node expansion
    const toggleNode = (kId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(kId)) next.delete(kId);
            else next.add(kId);
            return next;
        });
    };

    // Get current items based on tab
    const getTabContent = () => {
        switch (activeTab) {
            case 'scene':
                return viewMode === 'grid'
                    ? <SceneGrid objects={filteredSceneObjects} onContextMenu={handleContextMenu} onSelect={onDropAsset} onDelete={onDeleteSceneObject} />
                    : <SceneTree nodes={sceneHierarchy} expandedNodes={expandedNodes} onToggle={toggleNode} onContextMenu={handleContextMenu} onSelect={onDropAsset} />;
            case 'meshes':
                return <MeshesGrid items={filteredArtifacts} onContextMenu={handleContextMenu} onSelect={onDropAsset} />;
            case 'materials':
                return <MaterialsGrid items={filteredMaterials} onContextMenu={handleContextMenu} onSelect={onDropAsset} />;
            case 'textures':
                return <TexturesGrid items={[]} onContextMenu={handleContextMenu} onSelect={onDropAsset} />;
            case 'alphas':
                return <AlphasGrid items={filteredAlphas} onContextMenu={handleContextMenu} onSelect={onDropAsset} />;
            default:
                return null;
        }
    };

    const getTabCount = (tabId: TabId): number => {
        switch (tabId) {
            case 'scene': return sceneObjects.length;
            case 'meshes': return artifacts.length;
            case 'materials': return materials.length;
            case 'textures': return 0; // TODO: implement
            case 'alphas': return alphas.length;
            default: return 0;
        }
    };

    return (
        <div className={`
            fixed inset-x-4 bottom-4 top-auto h-[400px] 
            bg-[#0a0a0a]/95 backdrop-blur-xl
            border border-[#333] rounded-2xl
            shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_30px_rgba(100,100,100,0.1)]
            z-[100] transition-all duration-300 ease-out
            ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}
        `}>
            {/* GLASS HEADER */}
            <div className="h-14 border-b border-[#222] flex items-center px-4 gap-4 bg-gradient-to-r from-[#111] to-[#0a0a0a]">
                {/* LOGO / TITLE */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Sparkles size={16} className="text-black" />
                    </div>
                    <div>
                        <div className="text-xs font-black text-white tracking-wider">K_OS BROWSER</div>
                        <div className="text-[9px] text-gray-600 font-mono">Ctrl+Space</div>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex-1 flex items-center justify-center gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
                                ${activeTab === tab.id
                                    ? 'bg-white/10 text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }
                            `}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? tab.color : ''} />
                            {tab.label}
                            {getTabCount(tab.id) > 0 && (
                                <span className={`
                                    text-[9px] px-1.5 py-0.5 rounded-full font-mono
                                    ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-600'}
                                `}>
                                    {getTabCount(tab.id)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* SEARCH */}
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name or kId..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#111] border border-[#222] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#444] transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-2">
                    {/* View Mode Toggle (for future tree view) */}
                    {activeTab === 'scene' && (
                        <button
                            onClick={() => setViewMode(v => v === 'grid' ? 'tree' : 'grid')}
                            className="px-2 py-1.5 bg-[#1a1a1a] hover:bg-[#222] rounded-lg text-gray-400 hover:text-white text-[10px] font-bold border border-[#333] transition-all"
                            title={viewMode === 'grid' ? 'Switch to Tree View' : 'Switch to Grid View'}
                        >
                            {viewMode === 'grid' ? 'GRID' : 'TREE'}
                        </button>
                    )}
                    <label className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] rounded-lg text-gray-400 hover:text-white text-xs font-bold border border-[#333] cursor-pointer transition-all">
                        <Upload size={14} />
                        <span className="hidden xl:inline">IMPORT</span>
                        <input type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0] && onImport) onImport(e.target.files[0]) }} />
                    </label>
                </div>

                {/* CLOSE */}
                <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                    <X size={16} />
                </button>
            </div>

            {/* CONTENT AREA */}
            <div
                className="h-[calc(100%-56px)] overflow-y-auto custom-scrollbar p-4"
                onContextMenu={(e) => {
                    // Prevent browser context menu on empty areas
                    e.preventDefault();
                }}
            >
                {getTabContent()}
            </div>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    isSceneObject={contextMenu.isSceneObject}
                    onClose={() => setContextMenu(null)}
                    onOpenInApp={onOpenInApp}
                    onDelete={onDelete}
                    onDeleteSceneObject={onDeleteSceneObject}
                    onDropAsset={onDropAsset}
                    onSaveToStorage={onSaveToStorage}
                />
            )}
        </div>
    );
}

// ============================================================================
// SCENE GRID - Shows objects from KObjectRegistry (grouped by app)
// ============================================================================

function SceneGrid({ objects, onContextMenu, onSelect, onDelete }: {
    objects: KObject[];
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
    onDelete?: (object: KObject) => void;
}) {
    if (objects.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4">
                    <Layers size={32} className="text-yellow-500/50" />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-1">Scene Empty</div>
                <div className="text-xs text-gray-600 max-w-sm">
                    Objects appear here when you create or import meshes.
                    <br /><br />
                    <span className="text-gray-500">
                        Right-click to <strong>Save to Storage</strong> for persistence.
                    </span>
                </div>
            </div>
        );
    }

    // Group by source app
    const groupedByApp = objects.reduce((acc, obj) => {
        const app = obj.createdBy || 'Unknown';
        if (!acc[app]) acc[app] = [];
        acc[app].push(obj);
        return acc;
    }, {} as Record<string, KObject[]>);

    return (
        <div className="space-y-6">
            {Object.entries(groupedByApp).map(([appName, appObjects]) => {
                const colors = APP_COLORS[appName] || APP_COLORS.default;
                return (
                    <div key={appName}>
                        {/* App Header */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">{colors.icon}</span>
                            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                                {appName}
                            </span>
                            <span className="text-[9px] text-gray-600 font-mono">
                                ({appObjects.length})
                            </span>
                        </div>

                        {/* Objects Grid */}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                            {appObjects.map(obj => (
                                <SceneObjectCard
                                    key={obj.kId}
                                    object={obj}
                                    colors={colors}
                                    onContextMenu={onContextMenu}
                                    onSelect={onSelect}
                                    onDelete={onDelete}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SceneObjectCard({ object, colors, onContextMenu, onSelect, onDelete }: {
    object: KObject;
    colors: typeof APP_COLORS.default;
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
    onDelete?: (object: KObject) => void;
}) {
    const thumbnail = object.metadata?.thumbnail as string | undefined;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(object);
        }
    };

    return (
        <div
            className={`
                group p-3 rounded-xl border cursor-pointer transition-all
                ${colors.bg} ${colors.border} hover:scale-[1.02] hover:shadow-lg
            `}
            onClick={() => onSelect(object)}
            onContextMenu={(e) => onContextMenu(e, object, true)}
        >
            {/* Thumbnail or Placeholder */}
            <div className="aspect-square rounded-lg bg-black/30 mb-2 flex items-center justify-center overflow-hidden">
                {thumbnail ? (
                    <img src={thumbnail} alt={object.name} className="w-full h-full object-cover" />
                ) : (
                    <Box size={32} className="text-gray-600" />
                )}
            </div>

            {/* Info */}
            <div className="space-y-1">
                <div className="text-xs font-bold text-white truncate">{object.name}</div>
                <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 font-mono truncate">
                        {object.kId.slice(0, 12)}...
                    </span>
                    <span className={`text-[8px] uppercase font-bold ${colors.text}`}>
                        {object.type}
                    </span>
                </div>
            </div>

            {/* Quick Actions (visible on hover) */}
            <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-[8px] font-bold text-white transition-colors"
                    onClick={(e) => { e.stopPropagation(); onSelect(object); }}
                >
                    SELECT
                </button>
                <button
                    className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
                    title="Delete from Scene"
                    onClick={handleDelete}
                >
                    <Trash2 size={10} />
                </button>
            </div>
        </div>
    );
}

// ============================================================================
// SCENE TREE - Hierarchical view (future feature ready)
// ============================================================================

function SceneTree({ nodes, expandedNodes, onToggle, onContextMenu, onSelect, depth = 0 }: {
    nodes: SceneNode[];
    expandedNodes: Set<string>;
    onToggle: (kId: string) => void;
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
    depth?: number;
}) {
    if (nodes.length === 0 && depth === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4">
                    <Layers size={32} className="text-yellow-500/50" />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-1">Scene Empty</div>
                <div className="text-xs text-gray-600">No objects in scene.</div>
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            {nodes.map(node => {
                const isExpanded = expandedNodes.has(node.object.kId);
                const hasChildren = node.children.length > 0;
                const colors = APP_COLORS[node.object.createdBy] || APP_COLORS.default;

                return (
                    <div key={node.object.kId}>
                        <div
                            className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer group`}
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
                            onClick={() => onSelect(node.object)}
                            onContextMenu={(e) => onContextMenu(e, node.object, true)}
                        >
                            {/* Expand/Collapse */}
                            {hasChildren ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggle(node.object.kId); }}
                                    className="p-0.5 rounded hover:bg-white/10"
                                >
                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                            ) : (
                                <span className="w-4" />
                            )}

                            {/* Icon */}
                            <Box size={14} className={colors.text} />

                            {/* Name */}
                            <span className="text-xs text-gray-200 flex-1 truncate">{node.object.name}</span>

                            {/* Type Badge */}
                            <span className={`text-[8px] uppercase font-bold ${colors.text} opacity-50`}>
                                {node.object.type}
                            </span>

                            {/* Save Button (hover) */}
                            <button
                                className="p-1 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Save to Storage"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Save size={10} />
                            </button>
                        </div>

                        {/* Children */}
                        {hasChildren && isExpanded && (
                            <SceneTree
                                nodes={node.children}
                                expandedNodes={expandedNodes}
                                onToggle={onToggle}
                                onContextMenu={onContextMenu}
                                onSelect={onSelect}
                                depth={depth + 1}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================================
// MESHES GRID (was KERNEL ARTIFACTS)
// ============================================================================

function MeshesGrid({ items, onContextMenu, onSelect }: {
    items: KernelArtifact[];
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
}) {
    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <HardDrive size={32} className="text-cyan-500/50" />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-1">Storage Empty</div>
                <div className="text-xs text-gray-600 max-w-sm">
                    Right-click objects in <strong>SCENE</strong> tab and select "Save to Storage" to persist them.
                    <br /><br />
                    <span className="text-gray-500">Or use <strong>UPLINK</strong> in any app.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
            {items.map((item, idx) => (
                <AssetCard
                    key={item.id || idx}
                    item={item}
                    type="MESH"
                    color="cyan"
                    onContextMenu={onContextMenu}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}

// ============================================================================
// MATERIALS GRID
// ============================================================================

function MaterialsGrid({ items, onContextMenu, onSelect }: {
    items: KernelMaterial[];
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
}) {
    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                    <Palette size={32} className="text-green-500/50" />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-1">No Materials</div>
                <div className="text-xs text-gray-600 max-w-sm">
                    Create materials in KAutopbr or KGreeble to see them here.
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
            {items.map((item, idx) => (
                <AssetCard
                    key={item.id || idx}
                    item={item}
                    type="MAT"
                    color="green"
                    onContextMenu={onContextMenu}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}

// ============================================================================
// TEXTURES GRID (NEW - stub for future)
// ============================================================================

function TexturesGrid({ items, onContextMenu, onSelect }: {
    items: any[];
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
}) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4">
                <ImageIcon size={32} className="text-pink-500/50" />
            </div>
            <div className="text-sm font-bold text-gray-400 mb-1">Textures</div>
            <div className="text-xs text-gray-600 max-w-sm">
                Import textures for material swapping and references.
                <br /><br />
                <span className="text-gray-700 italic">Polyhaven integration coming soon...</span>
            </div>
        </div>
    );
}

// ============================================================================
// ALPHAS GRID
// ============================================================================

function AlphasGrid({ items, onContextMenu, onSelect }: {
    items: KernelAlpha[];
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
}) {
    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                    <Paintbrush size={32} className="text-purple-500/50" />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-1">No Alphas</div>
                <div className="text-xs text-gray-600 max-w-sm">
                    Import brush alphas or generate with AI to see them here.
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
            {items.map((item, idx) => (
                <div
                    key={item.id || idx}
                    onClick={() => onSelect(item)}
                    onContextMenu={(e) => onContextMenu(e, item, false)}
                    className="aspect-square rounded-lg bg-[#111] border border-[#222] hover:border-purple-500/50 overflow-hidden cursor-pointer transition-all hover:scale-105"
                >
                    {item.preview ? (
                        <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Paintbrush size={24} className="text-gray-700" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// GENERIC ASSET CARD
// ============================================================================

function AssetCard({ item, type, color, onContextMenu, onSelect }: {
    item: any;
    type: 'MESH' | 'MAT' | 'ALPHA';
    color: 'cyan' | 'green' | 'purple' | 'orange';
    onContextMenu: (e: React.MouseEvent, item: any, isSceneObject: boolean) => void;
    onSelect: (item: any) => void;
}) {
    const colorClasses = {
        cyan: { border: 'border-cyan-500/30', accent: 'bg-cyan-500' },
        green: { border: 'border-green-500/30', accent: 'bg-green-500' },
        purple: { border: 'border-purple-500/30', accent: 'bg-purple-500' },
        orange: { border: 'border-orange-500/30', accent: 'bg-orange-500' },
    };
    const c = colorClasses[color];

    return (
        <div
            className={`group flex flex-col p-2 rounded-xl bg-[#111] border ${c.border} hover:border-opacity-100 cursor-pointer transition-all hover:scale-105`}
            onClick={() => onSelect(item)}
            onContextMenu={(e) => onContextMenu(e, item, false)}
        >
            <div className="aspect-square rounded-lg bg-[#0a0a0a] overflow-hidden relative mb-2">
                {item.thumbnail || item.preview ? (
                    <img src={item.thumbnail || item.preview} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {type === 'MAT' && <Palette size={24} className="text-gray-700" />}
                        {type === 'MESH' && <Box size={24} className="text-gray-700" />}
                        {type === 'ALPHA' && <Paintbrush size={24} className="text-gray-700" />}
                    </div>
                )}
                <div className={`absolute bottom-0 inset-x-0 h-1 ${c.accent}`} />
            </div>
            <div className="text-[10px] font-bold text-gray-300 truncate">{item.name}</div>
            <div className="text-[8px] text-gray-600 truncate">{item.source || type}</div>
        </div>
    );
}

// ============================================================================
// CONTEXT MENU
// ============================================================================

function ContextMenu({ x, y, item, isSceneObject, onClose, onOpenInApp, onDelete, onDeleteSceneObject, onDropAsset, onSaveToStorage }: {
    x: number;
    y: number;
    item: any;
    isSceneObject: boolean;
    onClose: () => void;
    onOpenInApp?: (appId: string, item: any) => void;
    onDelete?: (item: any) => void;
    onDeleteSceneObject?: (kObject: KObject) => void;
    onDropAsset: (item: any) => void;
    onSaveToStorage?: (kObject: KObject) => void;
}) {
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Adjust position to stay in viewport
    const adjustedY = y + 250 > window.innerHeight ? y - 250 : y;
    const adjustedX = x + 200 > window.innerWidth ? x - 200 : x;

    const handleDelete = () => {
        if (isSceneObject && onDeleteSceneObject) {
            onDeleteSceneObject(item);
        } else if (onDelete) {
            onDelete(item);
        }
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="fixed w-52 bg-[#1a1a1a] border border-[#333] shadow-2xl rounded-xl z-[200] py-2 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: adjustedY, left: adjustedX }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-3 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                {item.name || 'Asset'}
            </div>

            <div className="h-px bg-[#333] my-1" />

            <MenuItem icon={Target} label="Load in Current App" onClick={() => { onDropAsset(item); onClose(); }} />

            {/* Save to Storage - only for scene objects */}
            {isSceneObject && onSaveToStorage && (
                <>
                    <div className="h-px bg-[#333] my-1" />
                    <MenuItem
                        icon={Save}
                        label="Save to Storage"
                        accent="cyan"
                        onClick={() => { onSaveToStorage(item); onClose(); }}
                    />
                </>
            )}

            <div className="h-px bg-[#333] my-1" />

            <div className="px-3 py-1 text-[8px] text-gray-600 uppercase">Open in...</div>
            <MenuItem icon={Box} label="KSculpt" accent="orange" onClick={() => { onOpenInApp?.('sculpt', item); onClose(); }} />
            <MenuItem icon={Paintbrush} label="KPainter" accent="blue" onClick={() => { onOpenInApp?.('painter', item); onClose(); }} />
            <MenuItem icon={Layers} label="KGreeble" accent="emerald" onClick={() => { onOpenInApp?.('greeble', item); onClose(); }} />

            <div className="h-px bg-[#333] my-1" />

            <MenuItem icon={Download} label="Export to File" onClick={() => { onClose(); }} />

            <div className="h-px bg-[#333] my-1" />

            <MenuItem icon={Trash2} label="Delete" danger onClick={handleDelete} />
        </div>
    );
}

function MenuItem({ icon: Icon, label, accent, danger, onClick }: {
    icon: React.ElementType;
    label: string;
    accent?: 'orange' | 'blue' | 'emerald' | 'cyan';
    danger?: boolean;
    onClick: () => void;
}) {
    const accentColors = {
        orange: 'group-hover:text-orange-400',
        blue: 'group-hover:text-blue-400',
        emerald: 'group-hover:text-emerald-400',
        cyan: 'group-hover:text-cyan-400',
    };

    return (
        <button
            onClick={onClick}
            className={`
                group w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors
                ${danger ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-300 hover:bg-white/5'}
            `}
        >
            <Icon size={12} className={accent ? accentColors[accent] : ''} />
            {label}
            {accent && <ArrowRight size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>
    );
}
