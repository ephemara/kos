import React from 'react';
import type { UiNode } from './types';

export type UiRenderContext = {
    appKey: string;
    surfaceKey: string;
    studioOpen: boolean;
    selectedNodeId: string | null;
    onSelectNode: (nodeId: string) => void;
    renderChildren: (nodes?: UiNode[]) => React.ReactNode;
    runtime?: any;
};

export type UiWidgetDefinition = {
    type: string;
    title: string;
    defaultProps?: Record<string, any>;
    canHaveChildren?: boolean;
    render: (node: UiNode, ctx: UiRenderContext) => React.ReactNode;
    inspector?: Array<{ key: string; label: string; kind: 'text' | 'number' | 'boolean' }>
};

export class UiWidgetRegistry {
    private map = new Map<string, UiWidgetDefinition>();

    register(def: UiWidgetDefinition): void {
        this.map.set(def.type, def);
    }

    get(type: string): UiWidgetDefinition | undefined {
        return this.map.get(type);
    }

    list(): UiWidgetDefinition[] {
        return Array.from(this.map.values()).sort((a, b) => a.title.localeCompare(b.title));
    }
}
