import React from 'react';
import {
    Aperture,
    Atom,
    Brush,
    Copy,
    Disc,
    Globe,
    Grid,
    Layers,
    Map as MapIcon,
    Paintbrush,
    PenTool,
    Rocket,
    Search,
    Sprout,
    Weight,
    type LucideIcon,
} from 'lucide-react';

export type NativeToolModuleId =
    | 'atlas'
    | 'autopbr'
    | 'bake'
    | 'cloner'
    | 'graphos'
    | 'greeble'
    | 'inspect'
    | 'painter'
    | 'quantum'
    | 'retopo'
    | 'scatter'
    | 'sculpt'
    | 'tecton'
    | 'weight';

export interface NativeToolSection {
    title: string;
    lines: string[];
}

export interface NativeToolTabConfig {
    id: string;
    label: string;
    icon: LucideIcon;
    sections: NativeToolSection[];
}

export interface NativeToolModuleConfig {
    id: NativeToolModuleId;
    title: string;
    subtitle: string;
    accent: {
        border: string;
        bg: string;
        text: string;
    };
    defaultPrimitive: string;
    leftTabs: NativeToolTabConfig[];
    rightTabs: NativeToolTabConfig[];
    bottomTabs: NativeToolTabConfig[];
    centerBadges: string[];
}

function sections(primary: string, lines: string[], secondary: string, secondaryLines: string[]): NativeToolSection[] {
    return [
        { title: primary, lines },
        { title: secondary, lines: secondaryLines },
    ];
}

export const NATIVE_TOOL_MODULES: Record<NativeToolModuleId, NativeToolModuleConfig> = {
    sculpt: {
        id: 'sculpt',
        title: 'K-SCULPT',
        subtitle: 'native mesh authoring shell',
        accent: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-300' },
        defaultPrimitive: 'icosphere',
        centerBadges: ['native viewport', 'single source', 'authoring reset'],
        leftTabs: [
            { id: 'workspace', label: 'WORKSPACE', icon: PenTool, sections: sections('Mode', ['Surface sculpt pass', 'Single native viewport feed'], 'Reset', ['Legacy brush scene ownership removed', 'Viewport is now suite-owned']) },
            { id: 'input', label: 'INPUT', icon: Layers, sections: sections('Kernel', ['Uses active artifact when present', 'Falls back to native primitive bootstrap'], 'Focus', ['Block out form', 'Validate flow before deeper tools return']) },
        ],
        rightTabs: [
            { id: 'pipeline', label: 'PIPELINE', icon: Grid, sections: sections('Renderer', ['Native session registered from module config', 'No embedded Three.js viewport'], 'Next', ['Reintroduce sculpt operators against native handles']) },
            { id: 'output', label: 'OUTPUT', icon: Layers, sections: sections('State', ['Stateless shell', 'Tabbed property surfaces'], 'Goal', ['Mesh edits should flow through one renderer contract']) },
        ],
        bottomTabs: [
            { id: 'log', label: 'LOG', icon: Layers, sections: sections('Native Status', ['Viewport host is universal', 'Overlay only in app center'], 'Notes', ['Fresh-start mode enabled']) },
        ],
    },
    retopo: {
        id: 'retopo',
        title: 'K-RETOPO',
        subtitle: 'native topology workspace',
        accent: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-300' },
        defaultPrimitive: 'icosphere',
        centerBadges: ['native viewport', 'retopo reset', 'tabbed ui'],
        leftTabs: [
            { id: 'tools', label: 'TOOLS', icon: Grid, sections: sections('Retopo', ['Draw and patch flow will return on native handles', 'Current shell is viewport-first'], 'Input', ['Active artifact sync', 'Primitive fallback']) },
            { id: 'constraints', label: 'CONSTRAINTS', icon: Layers, sections: sections('Rules', ['One viewport host', 'No module-local canvas'], 'Plan', ['Surface snapping comes back against native picking']) },
        ],
        rightTabs: [
            { id: 'stats', label: 'STATS', icon: Search, sections: sections('Runtime', ['Retopo workspace is now stateless', 'Renderer is shared'], 'Output', ['Topology summaries land here']) },
        ],
        bottomTabs: [
            { id: 'log', label: 'LOG', icon: Layers, sections: sections('Status', ['Native retopo staging active'], 'Goal', ['Bring tools back on top of the shared viewport']) },
        ],
    },
    greeble: {
        id: 'greeble',
        title: 'K-GREEBLE',
        subtitle: 'native detail distribution shell',
        accent: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
        defaultPrimitive: 'cube',
        centerBadges: ['native viewport', 'detail staging', 'ue-style tabs'],
        leftTabs: [
            { id: 'patterns', label: 'PATTERNS', icon: Rocket, sections: sections('Generate', ['Boolean-free native staging', 'Pattern controls return here'], 'Bootstrap', ['Cube primitive default', 'Artifact overrides when loaded']) },
        ],
        rightTabs: [
            { id: 'distribution', label: 'DISTRIBUTION', icon: Layers, sections: sections('Placement', ['Shared viewport only', 'No more local stage'], 'Roadmap', ['Re-add kit placement and masks']) },
        ],
        bottomTabs: [
            { id: 'notes', label: 'NOTES', icon: Layers, sections: sections('State', ['Fresh-start shell active'], 'Target', ['Native greeble operators']) },
        ],
    },
    scatter: {
        id: 'scatter',
        title: 'K-SCATTER',
        subtitle: 'native instancing shell',
        accent: { border: 'border-lime-500/30', bg: 'bg-lime-500/10', text: 'text-lime-300' },
        defaultPrimitive: 'sphere',
        centerBadges: ['native viewport', 'instancing reset', 'single renderer'],
        leftTabs: [
            { id: 'emitters', label: 'EMITTERS', icon: Sprout, sections: sections('Emitters', ['Artifact or primitive drives viewport source', 'Scatter controls return on native backend'], 'Goal', ['Native density and mask pipeline']) },
        ],
        rightTabs: [
            { id: 'variation', label: 'VARIATION', icon: Layers, sections: sections('Variation', ['Rotation, scale, jitter panels stage here'], 'Source', ['Renderer owned by universal host']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Native scatter shell online'], 'Next', ['Connect native instancer']) },
        ],
    },
    atlas: {
        id: 'atlas',
        title: 'K-ATLAS',
        subtitle: 'native uv workspace shell',
        accent: { border: 'border-teal-500/30', bg: 'bg-teal-500/10', text: 'text-teal-300' },
        defaultPrimitive: 'cube',
        centerBadges: ['native viewport', 'uv reset', 'shared host'],
        leftTabs: [
            { id: 'unwrap', label: 'UNWRAP', icon: MapIcon, sections: sections('UV Core', ['Shared artifact preview only', 'No local Three.js stage'], 'Reset', ['Projection and packing come back on native data']) },
        ],
        rightTabs: [
            { id: 'packing', label: 'PACKING', icon: Layers, sections: sections('Layout', ['Packing controls stage here'], 'Flow', ['Viewport remains universal']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Atlas is now a dumb shell'], 'Goal', ['UV tools should target native mesh state']) },
        ],
    },
    bake: {
        id: 'bake',
        title: 'K-BAKE',
        subtitle: 'native baking shell',
        accent: { border: 'border-pink-500/30', bg: 'bg-pink-500/10', text: 'text-pink-300' },
        defaultPrimitive: 'cube',
        centerBadges: ['native viewport', 'baking shell', 'tabbed pipeline'],
        leftTabs: [
            { id: 'passes', label: 'PASSES', icon: Disc, sections: sections('Bake Stack', ['AO, normal, curvature, ID staging'], 'Input', ['Kernel artifact feeds viewport']) },
        ],
        rightTabs: [
            { id: 'targets', label: 'TARGETS', icon: Layers, sections: sections('Outputs', ['Texture targets return here'], 'Renderer', ['Native viewport is the only preview path']) },
        ],
        bottomTabs: [
            { id: 'notes', label: 'NOTES', icon: Layers, sections: sections('Status', ['Fresh bake shell online'], 'Next', ['Connect bake jobs to native outputs']) },
        ],
    },
    graphos: {
        id: 'graphos',
        title: 'K-GRAPHOS',
        subtitle: 'native surface authoring shell',
        accent: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-300' },
        defaultPrimitive: 'sphere',
        centerBadges: ['native viewport', 'surface reset', 'shared preview'],
        leftTabs: [
            { id: 'brushes', label: 'BRUSHES', icon: Brush, sections: sections('Authoring', ['2D and material passes reset around native preview'], 'Reset', ['No canvas-owned renderer in the tool']) },
        ],
        rightTabs: [
            { id: 'layers', label: 'LAYERS', icon: Layers, sections: sections('Stack', ['Layering shell lives here'], 'Goal', ['Rebuild painterly stack as overlay state only']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Graphos is now shell-only'], 'Next', ['Reconnect authoring subsystems incrementally']) },
        ],
    },
    autopbr: {
        id: 'autopbr',
        title: 'K-SAMPLE',
        subtitle: 'native material preview shell',
        accent: { border: 'border-sky-500/30', bg: 'bg-sky-500/10', text: 'text-sky-300' },
        defaultPrimitive: 'sphere',
        centerBadges: ['native viewport', 'material staging', 'single preview host'],
        leftTabs: [
            { id: 'sources', label: 'SOURCES', icon: Aperture, sections: sections('Input', ['Artifact-first sync source', 'Sphere fallback preview'], 'Goal', ['Material generation wraps the shared viewport']) },
        ],
        rightTabs: [
            { id: 'maps', label: 'MAPS', icon: Layers, sections: sections('Maps', ['PBR map outputs return here'], 'State', ['Renderer is no longer tool-owned']) },
        ],
        bottomTabs: [
            { id: 'notes', label: 'NOTES', icon: Layers, sections: sections('Status', ['Native material shell active'], 'Next', ['Reconnect local AI and bake flows']) },
        ],
    },
    painter: {
        id: 'painter',
        title: 'K-PAINTER',
        subtitle: 'native texture paint shell',
        accent: { border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-300' },
        defaultPrimitive: 'cube',
        centerBadges: ['native viewport', 'paint reset', 'overlay only'],
        leftTabs: [
            { id: 'strokes', label: 'STROKES', icon: Paintbrush, sections: sections('Paint', ['Painter shell now defers preview to native host'], 'Plan', ['Stroke overlays return without owning the renderer']) },
        ],
        rightTabs: [
            { id: 'channels', label: 'CHANNELS', icon: Layers, sections: sections('Channels', ['Base color, roughness, masks'], 'Goal', ['Paint data should be viewport-agnostic']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Fresh painter shell online'], 'Next', ['Reconnect brush engine against shared viewport']) },
        ],
    },
    weight: {
        id: 'weight',
        title: 'K-WEIGHT',
        subtitle: 'native rig weighting shell',
        accent: { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-300' },
        defaultPrimitive: 'icosphere',
        centerBadges: ['native viewport', 'weighting shell', 'single source'],
        leftTabs: [
            { id: 'bones', label: 'BONES', icon: Weight, sections: sections('Rig', ['Weight painting and bone views return here'], 'Input', ['Artifact-first mesh sync']) },
        ],
        rightTabs: [
            { id: 'weights', label: 'WEIGHTS', icon: Layers, sections: sections('Influence', ['Weights and mirrors stage here'], 'Goal', ['Native picking and paint passes']) },
        ],
        bottomTabs: [
            { id: 'notes', label: 'NOTES', icon: Layers, sections: sections('Mode', ['Weight shell active'], 'Next', ['Reconnect rig tooling']) },
        ],
    },
    cloner: {
        id: 'cloner',
        title: 'K-CLONER',
        subtitle: 'native cloning shell',
        accent: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
        defaultPrimitive: 'cube',
        centerBadges: ['native viewport', 'clone reset', 'tabbed layout'],
        leftTabs: [
            { id: 'sources', label: 'SOURCES', icon: Copy, sections: sections('Sources', ['Shared viewport preview', 'Artifact drives source geometry'], 'Goal', ['Cloners return as native scene ops']) },
        ],
        rightTabs: [
            { id: 'arrays', label: 'ARRAYS', icon: Layers, sections: sections('Distribution', ['Grid, radial, spline staging'], 'Reset', ['No embedded stage logic']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Cloner shell active'], 'Next', ['Reconnect array generators']) },
        ],
    },
    inspect: {
        id: 'inspect',
        title: 'K-INSPECT',
        subtitle: 'native asset review shell',
        accent: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
        defaultPrimitive: 'cube',
        centerBadges: ['native viewport', 'review shell', 'artifact-first'],
        leftTabs: [
            { id: 'overview', label: 'OVERVIEW', icon: Search, sections: sections('Inspect', ['Asset review sits on the universal viewport'], 'Input', ['Artifact preview preferred', 'Primitive fallback']) },
        ],
        rightTabs: [
            { id: 'export', label: 'EXPORT', icon: Layers, sections: sections('Output', ['Export and validation panels return here'], 'Goal', ['Inspection stays renderer-agnostic']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Inspect shell active'], 'Next', ['Reconnect validation/export flows']) },
        ],
    },
    tecton: {
        id: 'tecton',
        title: 'K-TECTON',
        subtitle: 'native simulation shell',
        accent: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
        defaultPrimitive: 'icosphere',
        centerBadges: ['native viewport', 'sim reset', 'one renderer'],
        leftTabs: [
            { id: 'sim', label: 'SIM', icon: Globe, sections: sections('Simulation', ['Native shell replaces local scene runtime'], 'Source', ['Artifact or primitive preview']) },
        ],
        rightTabs: [
            { id: 'controls', label: 'CONTROLS', icon: Layers, sections: sections('Controls', ['Velocity, force, erosion panels return here'], 'Goal', ['All sim preview flows through native viewport']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Tecton shell active'], 'Next', ['Reconnect simulation backend']) },
        ],
    },
    quantum: {
        id: 'quantum',
        title: 'K-QUANTUM',
        subtitle: 'native field visualization shell',
        accent: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-300' },
        defaultPrimitive: 'sphere',
        centerBadges: ['native viewport', 'field reset', 'shared host'],
        leftTabs: [
            { id: 'fields', label: 'FIELDS', icon: Atom, sections: sections('Field State', ['Quantum preview no longer owns a local scene'], 'Reset', ['Visualization returns on native GPU data']) },
        ],
        rightTabs: [
            { id: 'fx', label: 'FX', icon: Layers, sections: sections('Display', ['Distortion, color, and bloom panels stage here'], 'Goal', ['Universal viewport owns presentation']) },
        ],
        bottomTabs: [
            { id: 'status', label: 'STATUS', icon: Layers, sections: sections('Mode', ['Quantum shell active'], 'Next', ['Reconnect field sim outputs']) },
        ],
    },
};
