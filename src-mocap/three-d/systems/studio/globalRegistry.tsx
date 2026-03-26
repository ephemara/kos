import React from 'react';
import { UiWidgetRegistry, type UiWidgetDefinition, type UiRenderContext } from './registry';
import type { UiNode } from './types';
import * as Toolbar from '@mocap/shared/primitives/Toolbar';
import { Slider } from '@mocap/shared/primitives/Slider';

let registrySingleton: UiWidgetRegistry | null = null;

function selectableWrap(node: UiNode, ctx: UiRenderContext, child: React.ReactNode): React.ReactNode {
    const selected = ctx.studioOpen && ctx.selectedNodeId === node.id;

    if (!ctx.studioOpen) return child;

    return (
        <div
            className={selected ? 'outline outline-1 outline-orange-500/70 rounded-md' : 'outline outline-1 outline-white/10 rounded-md'}
            onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                ctx.onSelectNode(node.id);
            }}
        >
            {child}
        </div>
    );
}

function def(type: string, title: string, partial: Omit<UiWidgetDefinition, 'type' | 'title'>): UiWidgetDefinition {
    return { type, title, ...partial };
}

export function getUiStudioWidgetRegistry(): UiWidgetRegistry {
    if (registrySingleton) return registrySingleton;

    const r = new UiWidgetRegistry();

    r.register(
        def('toolbar_root', 'Toolbar Root', {
            canHaveChildren: true,
            defaultProps: {},
            render: (node, ctx) => {
                const child = (
                    <Toolbar.Root aria-label={(node.props as any)?.ariaLabel ?? 'Toolbar'}>
                        {ctx.renderChildren(node.children)}
                    </Toolbar.Root>
                );
                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('toolbar_group', 'Toolbar Group', {
            canHaveChildren: true,
            defaultProps: {},
            render: (node, ctx) => {
                const child = <Toolbar.Group>{ctx.renderChildren(node.children)}</Toolbar.Group>;
                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('toolbar_separator', 'Toolbar Separator', {
            canHaveChildren: false,
            defaultProps: {},
            render: (node, ctx) => selectableWrap(node, ctx, <Toolbar.Separator />),
        })
    );

    r.register(
        def('ksculpt_mode_toggle', 'KSculpt: Mode Toggle', {
            canHaveChildren: false,
            defaultProps: {},
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const Comp = runtime?.components?.ModelModeToggle;
                if (!Comp) return null;
                const child = <Comp mode={runtime.values.appMode} onModeChange={runtime.setters.appMode} />;
                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_history', 'KSculpt: History', {
            canHaveChildren: false,
            defaultProps: {},
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const child = (
                    <Toolbar.ToggleGroup type="multiple">
                        <Toolbar.Button onClick={runtime.actions.undo} tooltip="Undo" shortcut="⌘Z">
                            {runtime.icons?.Undo ? <runtime.icons.Undo size={14} /> : 'Undo'}
                        </Toolbar.Button>
                        <Toolbar.Button onClick={runtime.actions.redo} tooltip="Redo" shortcut="⌘Y">
                            {runtime.icons?.Redo ? <runtime.icons.Redo size={14} /> : 'Redo'}
                        </Toolbar.Button>
                    </Toolbar.ToggleGroup>
                );
                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_brush_mode', 'KSculpt: Brush Mode', {
            canHaveChildren: false,
            defaultProps: {
                addLabel: 'Kadd',
                subLabel: 'Ksub',
            },
            inspector: [
                { key: 'addLabel', label: 'add label', kind: 'text' },
                { key: 'subLabel', label: 'sub label', kind: 'text' },
            ],
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const addLabel = (node.props as any)?.addLabel ?? 'Kadd';
                const subLabel = (node.props as any)?.subLabel ?? 'Ksub';

                const child = (
                    <Toolbar.ToggleGroup
                        type="single"
                        value={runtime.values.brushMode}
                        onValueChange={(v) => v && runtime.setters.brushMode(v)}
                    >
                        <Toolbar.ToggleItem value="ADD" className="data-[state=on]:bg-orange-500 data-[state=on]:text-black">
                            {addLabel}
                        </Toolbar.ToggleItem>
                        <Toolbar.ToggleItem value="SUB" className="data-[state=on]:bg-orange-500 data-[state=on]:text-black">
                            {subLabel}
                        </Toolbar.ToggleItem>
                    </Toolbar.ToggleGroup>
                );

                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_slider', 'KSculpt: Slider', {
            canHaveChildren: false,
            defaultProps: {
                label: 'Slider',
                bind: 'radius',
                min: 0,
                max: 1,
                step: 0.01,
                color: 'orange',
            },
            inspector: [
                { key: 'label', label: 'label', kind: 'text' },
                { key: 'bind', label: 'bind', kind: 'text' },
                { key: 'min', label: 'min', kind: 'number' },
                { key: 'max', label: 'max', kind: 'number' },
                { key: 'step', label: 'step', kind: 'number' },
            ],
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const label = (node.props as any)?.label ?? 'Slider';
                const bind = (node.props as any)?.bind ?? 'radius';
                const min = Number((node.props as any)?.min ?? 0);
                const max = Number((node.props as any)?.max ?? 1);
                const step = Number((node.props as any)?.step ?? 0.01);

                const value = runtime.values?.[bind];
                const setValue = runtime.setters?.[bind];

                if (typeof value !== 'number' || typeof setValue !== 'function') return null;

                const child = (
                    <div className="flex flex-col w-24 gap-1">
                        <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-wider">
                            <span>{label}</span>
                            <span className="text-orange-400">{value.toFixed(2)}</span>
                        </div>
                        <Slider
                            value={value}
                            onValueChange={setValue}
                            min={min}
                            max={max}
                            step={step}
                            rangeClassName="bg-orange-500/60"
                            thumbClassName="border-orange-500/60"
                        />
                    </div>
                );

                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_dyn_topo', 'KSculpt: DynTopo', {
            canHaveChildren: false,
            defaultProps: {
                label: 'DYNTOPO',
                detailBind: 'detailSize',
            },
            inspector: [
                { key: 'label', label: 'label', kind: 'text' },
                { key: 'detailBind', label: 'detail bind', kind: 'text' },
            ],
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const label = (node.props as any)?.label ?? 'DYNTOPO';
                const detailBind = (node.props as any)?.detailBind ?? 'detailSize';

                const child = (
                    <div className="flex items-center gap-2">
                        <Toolbar.ToggleGroup type="single" value={runtime.values.dynamicTopology ? 'on' : 'off'}>
                            <Toolbar.ToggleItem
                                value="on"
                                onClick={() => runtime.setters.dynamicTopology(!runtime.values.dynamicTopology)}
                                className="data-[state=on]:bg-red-900/40 data-[state=on]:text-red-400 border border-transparent data-[state=on]:border-red-500/50"
                            >
                                {label}
                            </Toolbar.ToggleItem>
                        </Toolbar.ToggleGroup>

                        {runtime.values.dynamicTopology ? (
                            <div className="flex flex-col w-20 gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                                <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider">
                                    <span>Detail</span>
                                    <span className="text-red-400">{runtime.values[detailBind].toFixed(2)}</span>
                                </div>
                                <Slider
                                    value={runtime.values[detailBind]}
                                    onValueChange={runtime.setters[detailBind]}
                                    min={0.1}
                                    max={2.0}
                                    step={0.1}
                                    rangeClassName="bg-red-500/60"
                                    thumbClassName="border-red-500/60"
                                />
                            </div>
                        ) : null}
                    </div>
                );

                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_view_toggles', 'KSculpt: View Toggles', {
            canHaveChildren: false,
            defaultProps: {
                gridLabel: 'GRID',
            },
            inspector: [{ key: 'gridLabel', label: 'grid label', kind: 'text' }],
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const gridLabel = (node.props as any)?.gridLabel ?? 'GRID';
                const ScanIcon = runtime.icons?.Scan;
                const SplitIcon = runtime.icons?.Split;

                const child = (
                    <Toolbar.ToggleGroup
                        type="multiple"
                        value={[runtime.values.showGrid ? 'grid' : '', runtime.values.symmetry === 'X' ? 'sym' : '', runtime.values.wireframe ? 'wire' : '']
                            .filter(Boolean)}
                    >
                        <Toolbar.ToggleItem
                            value="grid"
                            onClick={() => runtime.setters.showGrid(!runtime.values.showGrid)}
                            className="data-[state=on]:text-orange-300 data-[state=on]:border-orange-500/40 data-[state=on]:bg-orange-500/10"
                        >
                            {gridLabel}
                        </Toolbar.ToggleItem>
                        <Toolbar.ToggleItem
                            value="sym"
                            onClick={() => runtime.setters.symmetry(runtime.values.symmetry === 'X' ? 'NONE' : 'X')}
                            className="data-[state=on]:text-blue-300 data-[state=on]:border-blue-500/40 data-[state=on]:bg-blue-500/10"
                        >
                            {SplitIcon ? <SplitIcon size={12} className="mr-1" /> : null}
                            {runtime.values.symmetry === 'X' ? 'X' : 'OFF'}
                        </Toolbar.ToggleItem>
                        <Toolbar.ToggleItem
                            value="wire"
                            onClick={() => runtime.setters.wireframe(!runtime.values.wireframe)}
                            className="px-2 data-[state=on]:text-orange-300 data-[state=on]:border-orange-500/40 data-[state=on]:bg-orange-500/10"
                        >
                            {ScanIcon ? <ScanIcon size={14} /> : 'W'}
                        </Toolbar.ToggleItem>
                    </Toolbar.ToggleGroup>
                );

                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_matcaps', 'KSculpt: Matcaps', {
            canHaveChildren: false,
            defaultProps: {},
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const child = (
                    <Toolbar.ToggleGroup
                        type="single"
                        value={runtime.values.currentMatCap}
                        onValueChange={(v) => v && runtime.setters.currentMatCap(v)}
                    >
                        {runtime.values.matcaps.map((mc: string) => (
                            <Toolbar.ToggleItem key={mc} value={mc} className="px-2">
                                <span className="truncate max-w-[40px]">{mc.split('_')[1] || mc}</span>
                            </Toolbar.ToggleItem>
                        ))}
                    </Toolbar.ToggleGroup>
                );
                return selectableWrap(node, ctx, child);
            },
        })
    );

    r.register(
        def('ksculpt_action_button', 'KSculpt: Action Button', {
            canHaveChildren: false,
            defaultProps: {
                label: 'ACTION',
                actionId: 'uplink',
            },
            inspector: [
                { key: 'label', label: 'label', kind: 'text' },
                { key: 'actionId', label: 'action id', kind: 'text' },
            ],
            render: (node, ctx) => {
                const runtime = ctx.runtime as any;
                const label = (node.props as any)?.label ?? 'ACTION';
                const actionId = (node.props as any)?.actionId ?? 'uplink';
                const Icon = runtime.icons?.[(node.props as any)?.iconName ?? ''];

                const onClick = runtime.actions?.[actionId];
                if (typeof onClick !== 'function') return null;

                const child = (
                    <Toolbar.Button
                        onClick={onClick}
                        className={(node.props as any)?.className}
                        tooltip={(node.props as any)?.tooltip}
                    >
                        {Icon ? <Icon size={12} className="mr-2" /> : null}
                        {label}
                    </Toolbar.Button>
                );

                return selectableWrap(node, ctx, child);
            },
        })
    );

    registrySingleton = r;
    return r;
}
