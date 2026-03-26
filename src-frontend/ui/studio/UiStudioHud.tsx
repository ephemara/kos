import React from 'react';
import { X, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import type { UiDoc, UiNode } from './types';
import { listUiSurfaces, subscribeUiSurfaces } from './uiStudioRegistry';
import { getUiStudioState, setUiStudioActiveSurface, setUiStudioSelectedNodeId, subscribeUiStudio } from './uiStudioStore';
import { ensureUiDocLoaded, resetUiDoc, setUiDoc, subscribeUiDoc } from './uiDocStore';
import { clamp, makeNodeId, moveArrayItem } from './util';
import type { UiWidgetRegistry, UiWidgetDefinition } from './registry';

function useStudioState() {
    const getSnapshot = React.useCallback(() => getUiStudioState(), []);
    return React.useSyncExternalStore(subscribeUiStudio, getSnapshot, getSnapshot);
}

function useSurfaces(appKey: string) {
    const getSnapshot = React.useCallback(() => listUiSurfaces(appKey), [appKey]);
    return React.useSyncExternalStore(subscribeUiSurfaces, getSnapshot, getSnapshot);
}

function useUiDoc(appKey: string, surfaceKey: string, fallback: UiDoc): UiDoc {
    const getSnapshot = React.useCallback(() => ensureUiDocLoaded(appKey, surfaceKey, fallback), [appKey, surfaceKey, fallback]);
    const subscribe = React.useCallback((l: () => void) => subscribeUiDoc(appKey, surfaceKey, l), [appKey, surfaceKey]);
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useUiDocMaybe(appKey: string, surfaceKey: string | null, fallback: UiDoc | undefined): UiDoc | null {
    const enabled = Boolean(surfaceKey && fallback);

    const getSnapshot = React.useCallback(() => {
        if (!enabled || !surfaceKey || !fallback) return null;
        return ensureUiDocLoaded(appKey, surfaceKey, fallback);
    }, [appKey, enabled, fallback, surfaceKey]);

    const subscribe = React.useCallback(
        (l: () => void) => {
            if (!enabled || !surfaceKey) return () => { };
            return subscribeUiDoc(appKey, surfaceKey, l);
        },
        [appKey, enabled, surfaceKey]
    );

    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function findNode(root: UiNode, id: string): UiNode | null {
    if (root.id === id) return root;
    if (!root.children) return null;
    for (const c of root.children) {
        const hit = findNode(c, id);
        if (hit) return hit;
    }
    return null;
}

function updateNode(root: UiNode, id: string, patch: (n: UiNode) => UiNode): UiNode {
    if (root.id === id) return patch(root);
    if (!root.children) return root;
    const nextChildren = root.children.map((c) => updateNode(c, id, patch));
    if (nextChildren === root.children) return root;
    return { ...root, children: nextChildren };
}

function removeNode(root: UiNode, id: string): UiNode {
    if (!root.children) return root;
    const kept = root.children.filter((c) => c.id !== id).map((c) => removeNode(c, id));
    return { ...root, children: kept };
}

function insertChild(root: UiNode, parentId: string, child: UiNode): UiNode {
    if (root.id === parentId) {
        const children = root.children ? root.children.slice() : [];
        children.push(child);
        return { ...root, children };
    }
    if (!root.children) return root;
    return { ...root, children: root.children.map((c) => insertChild(c, parentId, child)) };
}

function moveSibling(root: UiNode, parentId: string, from: number, to: number): UiNode {
    if (root.id === parentId) {
        const children = root.children ?? [];
        const safeTo = clamp(to, 0, Math.max(0, children.length - 1));
        return { ...root, children: moveArrayItem(children, from, safeTo) };
    }
    if (!root.children) return root;
    return { ...root, children: root.children.map((c) => moveSibling(c, parentId, from, to)) };
}

function findParentAndIndex(root: UiNode, childId: string): { parentId: string; index: number } | null {
    if (!root.children) return null;
    const idx = root.children.findIndex((c) => c.id === childId);
    if (idx >= 0) return { parentId: root.id, index: idx };
    for (const c of root.children) {
        const hit = findParentAndIndex(c, childId);
        if (hit) return hit;
    }
    return null;
}

function NodeRow({
    node,
    depth,
    selectedId,
    onSelect,
    registry,
}: {
    node: UiNode;
    depth: number;
    selectedId: string | null;
    onSelect: (id: string) => void;
    registry: UiWidgetRegistry;
}) {
    const def = registry.get(node.type);
    const title = def?.title ?? node.type;
    const label = (node.props as any)?.label as string | undefined;
    const isSelected = node.id === selectedId;

    return (
        <div>
            <button
                className={
                    'w-full text-left px-2 py-1 rounded text-[11px] font-mono ' +
                    (isSelected ? 'bg-orange-500/20 text-orange-200 border border-orange-500/30' : 'text-white/70 hover:bg-white/5')
                }
                style={{ marginLeft: depth * 10 }}
                onClick={() => onSelect(node.id)}
            >
                <span className="opacity-60">{title}</span>
                {label ? <span className="ml-2 opacity-80">{label}</span> : null}
            </button>
            {node.children?.map((c) => (
                <NodeRow key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} registry={registry} />
            ))}
        </div>
    );
}

export function UiStudioHud({
    open,
    onOpenChange,
    appKey,
    registry,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appKey: string;
    registry: UiWidgetRegistry;
}) {
    if (!open) return null;

    return <UiStudioHudInner open={open} onOpenChange={onOpenChange} appKey={appKey} registry={registry} />;
}

function UiStudioHudInner({
    open,
    onOpenChange,
    appKey,
    registry,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appKey: string;
    registry: UiWidgetRegistry;
}) {
    const studio = useStudioState();
    const surfaces = useSurfaces(appKey);

    const active = studio.activeSurface?.appKey === appKey ? studio.activeSurface : null;
    const surfaceKey = active?.surfaceKey ?? surfaces[0]?.surfaceKey ?? null;
    const fallback = surfaces.find((s) => s.surfaceKey === surfaceKey)?.fallbackDoc;
    const doc = useUiDocMaybe(appKey, surfaceKey, fallback);

    const selectedNodeId = studio.selectedNodeId;

    React.useEffect(() => {
        if (!open) return;
        if (!surfaceKey) return;

        if (!active || active.surfaceKey !== surfaceKey) {
            setUiStudioActiveSurface({ appKey, surfaceKey });
        }

        if (!doc) return;
        if (!selectedNodeId) setUiStudioSelectedNodeId(doc.root.id);
    }, [active, appKey, doc, open, selectedNodeId, surfaceKey]);

    const selectedNode = doc && selectedNodeId ? findNode(doc.root, selectedNodeId) : null;
    const selectedDef = selectedNode ? registry.get(selectedNode.type) : undefined;

    const palette = registry.list();

    const applyDoc = (nextRoot: UiNode) => {
        if (!surfaceKey || !fallback) return;
        setUiDoc(appKey, surfaceKey, { version: 1, root: nextRoot });
    };

    const onDeleteSelected = () => {
        if (!doc || !selectedNodeId) return;
        if (doc.root.id === selectedNodeId) return;
        const next = removeNode(doc.root, selectedNodeId);
        applyDoc(next);
        setUiStudioSelectedNodeId(doc.root.id);
    };

    const onMoveSelected = (dir: -1 | 1) => {
        if (!doc || !selectedNodeId) return;
        const pi = findParentAndIndex(doc.root, selectedNodeId);
        if (!pi) return;
        const next = moveSibling(doc.root, pi.parentId, pi.index, pi.index + dir);
        applyDoc(next);
    };

    const onAddChild = (def: UiWidgetDefinition) => {
        if (!doc || !selectedNodeId) return;
        const targetNode = selectedNode ?? doc.root;
        const targetDef = registry.get(targetNode.type);
        const parentId = targetDef?.canHaveChildren ? targetNode.id : doc.root.id;
        const child: UiNode = {
            id: makeNodeId(def.type),
            type: def.type,
            props: { ...(def.defaultProps ?? {}) },
            children: def.canHaveChildren ? [] : undefined,
        };
        const next = insertChild(doc.root, parentId, child);
        applyDoc(next);
        setUiStudioSelectedNodeId(child.id);
    };

    const onEditProp = (key: string, value: any) => {
        if (!doc || !selectedNodeId) return;
        const next = updateNode(doc.root, selectedNodeId, (n) => ({
            ...n,
            props: { ...(n.props ?? {}), [key]: value },
        }));
        applyDoc(next);
    };

    return (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-[195] w-[1100px] max-w-[95vw]">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-widest text-white/80">UI STUDIO</div>
                        <div className="text-[10px] font-mono text-white/40 truncate">{appKey}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="h-7 px-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] text-white/70"
                            onClick={() => {
                                if (!surfaceKey || !fallback) return;
                                resetUiDoc(appKey, surfaceKey, fallback);
                                setUiStudioSelectedNodeId(null);
                            }}
                            title="Reset surface"
                        >
                            <Trash2 size={14} className="inline-block mr-1" />
                            Reset
                        </button>
                        <button
                            className="h-7 w-7 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                            onClick={() => onOpenChange(false)}
                            aria-label="Close"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-0">
                    <div className="col-span-3 border-r border-white/10 p-2">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] text-white/40 font-mono">surface</div>
                            <select
                                className="h-7 rounded-md bg-black/40 border border-white/10 text-white/80 px-2 text-[10px]"
                                value={surfaceKey ?? ''}
                                onChange={(e) => {
                                    const sk = e.target.value;
                                    setUiStudioActiveSurface({ appKey, surfaceKey: sk });
                                    setUiStudioSelectedNodeId(null);
                                }}
                            >
                                {surfaces.map((s) => (
                                    <option key={s.surfaceKey} value={s.surfaceKey}>
                                        {s.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="text-[10px] text-white/40 font-mono mb-1">tree</div>
                        {doc ? (
                            <div className="max-h-[520px] overflow-auto">
                                <NodeRow node={doc.root} depth={0} selectedId={selectedNodeId} onSelect={setUiStudioSelectedNodeId} registry={registry} />
                            </div>
                        ) : (
                            <div className="text-[10px] text-white/40">No surface</div>
                        )}
                    </div>

                    <div className="col-span-5 border-r border-white/10 p-2">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] text-white/40 font-mono">actions</div>
                            <div className="flex items-center gap-1">
                                <button
                                    className="h-7 w-7 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                                    onClick={() => onMoveSelected(-1)}
                                    title="Move up"
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <button
                                    className="h-7 w-7 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                                    onClick={() => onMoveSelected(1)}
                                    title="Move down"
                                >
                                    <ArrowDown size={14} />
                                </button>
                                <button
                                    className="h-7 w-7 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                                    onClick={() => onDeleteSelected()}
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="text-[10px] text-white/40 font-mono mb-1">palette</div>
                        <div className="grid grid-cols-2 gap-2 max-h-[520px] overflow-auto">
                            {palette.map((p) => (
                                <button
                                    key={p.type}
                                    className="h-9 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] text-white/70 flex items-center justify-between px-2"
                                    onClick={() => onAddChild(p)}
                                >
                                    <span className="truncate">{p.title}</span>
                                    <Plus size={14} className="opacity-60" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="col-span-4 p-2">
                        <div className="text-[10px] text-white/40 font-mono mb-2">inspector</div>
                        {selectedNode && selectedDef ? (
                            <div className="space-y-2">
                                <div className="text-[11px] text-white/80 font-mono">{selectedDef.title}</div>
                                {(selectedDef.inspector ?? []).map((f) => {
                                    const v = (selectedNode.props ?? {})[f.key];
                                    if (f.kind === 'boolean') {
                                        return (
                                            <label key={f.key} className="flex items-center justify-between gap-2 text-[10px] text-white/60">
                                                <span>{f.label}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(v)}
                                                    onChange={(e) => onEditProp(f.key, e.target.checked)}
                                                />
                                            </label>
                                        );
                                    }

                                    return (
                                        <label key={f.key} className="block text-[10px] text-white/60">
                                            {f.label}
                                            <input
                                                className="mt-1 w-full h-8 rounded-md bg-black/40 border border-white/10 text-white/80 px-2"
                                                value={v != null && !Number.isNaN(v) ? v : ''}
                                                onChange={(e) => {
                                                    if (f.kind === 'number') {
                                                        const num = parseFloat(e.target.value);
                                                        onEditProp(f.key, Number.isNaN(num) ? 0 : num);
                                                    } else {
                                                        onEditProp(f.key, e.target.value);
                                                    }
                                                }}
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-[10px] text-white/40">Select a node</div>
                        )}
                    </div>
                </div>

                <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/30 font-mono flex items-center justify-between">
                    <span>delete/reorder/rename controls</span>
                    <span>app: {appKey}</span>
                </div>
            </div>
        </div>
    );
}
