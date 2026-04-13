import React from 'react';
import type { UiDoc, UiNode, UiSurfaceInfo } from './types';
import { ensureUiDocLoaded, subscribeUiDoc } from './uiDocStore';
import { registerUiSurface } from './uiStudioRegistry';
import { getUiStudioState, setUiStudioActiveSurface, setUiStudioSelectedNodeId, subscribeUiStudio } from './uiStudioStore';
import type { UiWidgetRegistry, UiRenderContext } from './registry';

function useUiDoc(appKey: string, surfaceKey: string, fallback: UiDoc): UiDoc {
    const getSnapshot = React.useCallback(() => ensureUiDocLoaded(appKey, surfaceKey, fallback), [appKey, surfaceKey, fallback]);
    const subscribe = React.useCallback((l: () => void) => subscribeUiDoc(appKey, surfaceKey, l), [appKey, surfaceKey]);
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useStudioState() {
    const getSnapshot = React.useCallback(() => getUiStudioState(), []);
    return React.useSyncExternalStore(subscribeUiStudio, getSnapshot, getSnapshot);
}

function renderNode(node: UiNode, registry: UiWidgetRegistry, ctx: UiRenderContext): React.ReactNode {
    const def = registry.get(node.type);
    if (!def) return null;
    return def.render(node, ctx);
}

function renderNodes(nodes: UiNode[] | undefined, registry: UiWidgetRegistry, ctx: UiRenderContext): React.ReactNode {
    if (!nodes?.length) return null;
    return nodes.map((n) => <React.Fragment key={n.id}>{renderNode(n, registry, ctx)}</React.Fragment>);
}

export function UiComposerSurface({
    info,
    fallback,
    registry,
    runtime,
}: {
    info: UiSurfaceInfo;
    fallback: UiDoc;
    registry: UiWidgetRegistry;
    runtime?: any;
}) {
    const studio = useStudioState();
    const doc = useUiDoc(info.appKey, info.surfaceKey, fallback);

    const ctxRef = React.useRef<UiRenderContext | null>(null);

    React.useEffect(() => {
        return registerUiSurface({ ...info, fallbackDoc: fallback });
    }, [fallback, info.appKey, info.surfaceKey, info.title]);

    const onSelectNode = React.useCallback(
        (nodeId: string) => {
            if (!studio.open) return;
            setUiStudioActiveSurface({ appKey: info.appKey, surfaceKey: info.surfaceKey });
            setUiStudioSelectedNodeId(nodeId);
        },
        [info.appKey, info.surfaceKey, studio.open]
    );

    const selectedNodeId =
        studio.activeSurface?.appKey === info.appKey && studio.activeSurface?.surfaceKey === info.surfaceKey
            ? studio.selectedNodeId ?? null
            : null;

    const ctx: UiRenderContext = React.useMemo(() => {
        const base: UiRenderContext = {
            appKey: info.appKey,
            surfaceKey: info.surfaceKey,
            studioOpen: studio.open,
            selectedNodeId,
            onSelectNode,
            renderChildren: (nodes?: UiNode[]) => {
                const current = ctxRef.current;
                if (!current) return null;
                return renderNodes(nodes, registry, current);
            },
            runtime,
        };
        return base;
    }, [info.appKey, info.surfaceKey, registry, runtime, onSelectNode, selectedNodeId, studio.open]);

    ctxRef.current = ctx;

    return <>{renderNode(doc.root, registry, ctx)}</>;
}
