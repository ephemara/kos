import React from 'react';
import { Undo, Redo, Split, Scan, Activity, Share2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { AppMode } from '../model';
import type { UiDoc } from '@/ui/studio/types';
import { UiComposerSurface } from '@/ui/studio/UiComposerSurface';
import { getUiStudioWidgetRegistry } from '@/ui/studio/globalRegistry';
import { ModelModeToggle } from '../model';
import { getAllMatcapIds } from '../constants';

interface TopBarProps {
    appMode: AppMode;
    setAppMode: (v: AppMode) => void;
    radius: number;
    setRadius: (v: number) => void;
    intensity: number;
    setIntensity: (v: number) => void;
    brushMode: 'ADD' | 'SUB';
    setBrushMode: (v: 'ADD' | 'SUB') => void;
    symmetry: 'NONE' | 'X';
    setSymmetry: (v: 'NONE' | 'X') => void;
    wireframe: boolean;
    setWireframe: (v: boolean) => void;
    dynamicTopology: boolean;
    setDynamicTopology: (v: boolean) => void;
    detailSize: number;
    setDetailSize: (v: number) => void;
    currentMatCap: string;
    setCurrentMatCap: (v: string) => void;
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    onUplink: () => void;
}

const fallbackDoc: UiDoc = {
    version: 1,
    root: {
        id: 'topbar_root',
        type: 'toolbar_root',
        props: { ariaLabel: 'KSculpt Toolbar' },
        children: [
            {
                id: 'left_group',
                type: 'toolbar_group',
                children: [
                    { id: 'mode', type: 'ksculpt_mode_toggle' },
                    { id: 'sep_a', type: 'toolbar_separator' },
                    { id: 'history', type: 'ksculpt_history' },
                    { id: 'sep_b', type: 'toolbar_separator' },
                    { id: 'brush_mode', type: 'ksculpt_brush_mode', props: { addLabel: 'Kadd', subLabel: 'Ksub' } },
                    { id: 'sep_c', type: 'toolbar_separator' },
                    { id: 'radius', type: 'ksculpt_slider', props: { label: 'Radius', bind: 'radius', min: 0.05, max: 5.0, step: 0.05 } },
                    { id: 'intensity', type: 'ksculpt_slider', props: { label: 'Intensity', bind: 'intensity', min: 0.1, max: 5.0, step: 0.1 } },
                    { id: 'sep_d', type: 'toolbar_separator' },
                    { id: 'dyn_topo', type: 'ksculpt_dyn_topo', props: { label: 'DYNTOPO', detailBind: 'detailSize' } },
                ],
            },
            {
                id: 'right_group',
                type: 'toolbar_group',
                children: [
                    { id: 'view', type: 'ksculpt_view_toggles', props: { gridLabel: 'GRID' } },
                    { id: 'sep_r1', type: 'toolbar_separator' },
                    { id: 'matcaps', type: 'ksculpt_matcaps' },
                    { id: 'sep_r2', type: 'toolbar_separator' },
                    {
                        id: 'uplink',
                        type: 'ksculpt_action_button',
                        props: {
                            label: 'UPLINK',
                            actionId: 'uplink',
                            tooltip: 'Push to Cloud',
                            className: 'border border-orange-500/40 bg-orange-500/10 text-orange-200 hover:bg-orange-500/15 w-auto px-3',
                            iconName: 'Share2',
                        },
                    },
                ],
            },
        ],
    },
};

export default function ComposedTopBar(props: TopBarProps) {
    const registry = React.useMemo(() => getUiStudioWidgetRegistry(), []);

    const runtime = React.useMemo(
        () => ({
            values: {
                appMode: props.appMode,
                brushMode: props.brushMode,
                radius: props.radius,
                intensity: props.intensity,
                dynamicTopology: props.dynamicTopology,
                detailSize: props.detailSize,
                showGrid: props.showGrid,
                symmetry: props.symmetry,
                wireframe: props.wireframe,
                currentMatCap: props.currentMatCap,
                matcaps: getAllMatcapIds(),
            },
            setters: {
                appMode: props.setAppMode,
                brushMode: props.setBrushMode,
                radius: props.setRadius,
                intensity: props.setIntensity,
                dynamicTopology: props.setDynamicTopology,
                detailSize: props.setDetailSize,
                showGrid: props.setShowGrid,
                symmetry: props.setSymmetry,
                wireframe: props.setWireframe,
                currentMatCap: props.setCurrentMatCap,
            },
            actions: {
                undo: () => invoke('leash_undo'),
                redo: () => invoke('leash_redo'),
                uplink: props.onUplink,
            },
            icons: {
                Undo,
                Redo,
                Split,
                Scan,
                Activity,
                Share2,
            },
            components: {
                ModelModeToggle,
            },
        }),
        [
            props.appMode,
            props.brushMode,
            props.detailSize,
            props.dynamicTopology,
            props.intensity,
            props.onUplink,
            props.radius,
            props.currentMatCap,
            props.setAppMode,
            props.setBrushMode,
            props.setCurrentMatCap,
            props.setDetailSize,
            props.setDynamicTopology,
            props.setIntensity,
            props.setRadius,
            props.setShowGrid,
            props.setSymmetry,
            props.setWireframe,
            props.showGrid,
            props.symmetry,
            props.wireframe,
        ]
    );

    return (
        <UiComposerSurface
            info={{ appKey: 'ksculpt', surfaceKey: 'topbar', title: 'Top Bar' }}
            fallback={fallbackDoc}
            registry={registry}
            runtime={runtime}
        />
    );
}
