import React, { useState } from 'react';
import {
    NumericInput,
    VectorInput,
    ColorPicker,
    CurveEditor,
    GradientEditor,
    NodeGraph,
    defaultNodeTypes,
    Color,
    Curve,
    Gradient,
} from './index';
import { Node, Edge } from '@xyflow/react';

/**
 * DCCComponentsDemo - Demonstration of all DCC UI components
 * 
 * This component showcases all six DCC-specific UI components
 * and can be used as a reference for implementation.
 */
export function DCCComponentsDemo() {
    // NumericInput state
    const [numericValue, setNumericValue] = useState(50);

    // VectorInput state
    const [vectorValue, setVectorValue] = useState([1.0, 2.0, 3.0]);

    // ColorPicker state
    const [color, setColor] = useState<Color>({ r: 255, g: 100, b: 50, a: 1 });

    // CurveEditor state
    const [curve, setCurve] = useState<Curve>({
        points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.8 },
            { x: 1, y: 1 },
        ],
        interpolation: 'smooth',
    });

    // GradientEditor state
    const [gradient, setGradient] = useState<Gradient>({
        stops: [
            { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
            { position: 0.5, color: { r: 255, g: 255, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 255, b: 0, a: 1 } },
        ],
    });

    // NodeGraph state
    const [nodes, setNodes] = useState<Node[]>([
        {
            id: '1',
            type: 'input',
            position: { x: 50, y: 100 },
            data: { label: 'Input', description: 'Source data' },
        },
        {
            id: '2',
            type: 'default',
            position: { x: 250, y: 50 },
            data: { label: 'Process A', description: 'First operation' },
        },
        {
            id: '3',
            type: 'default',
            position: { x: 250, y: 150 },
            data: { label: 'Process B', description: 'Second operation' },
        },
        {
            id: '4',
            type: 'output',
            position: { x: 450, y: 100 },
            data: { label: 'Output', description: 'Final result' },
        },
    ]);

    const [edges, setEdges] = useState<Edge[]>([
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e1-3', source: '1', target: '3' },
        { id: 'e2-4', source: '2', target: '4' },
        { id: 'e3-4', source: '3', target: '4' },
    ]);

    return (
        <div className="w-full h-full p-6 bg-[color:var(--kos-surface-primary)] overflow-auto">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-[color:var(--kos-text-primary)] mb-2">
                        K_OS DCC Component Library
                    </h1>
                    <p className="text-[color:var(--kos-text-secondary)]">
                        Enhanced UI components for Digital Content Creation workflows
                    </p>
                </div>

                {/* NumericInput Demo */}
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-[color:var(--kos-text-primary)]">
                        NumericInput
                    </h2>
                    <p className="text-sm text-[color:var(--kos-text-secondary)]">
                        Drag horizontally to change value, double-click to type exact value
                    </p>
                    <div className="flex gap-4">
                        <NumericInput
                            value={numericValue}
                            onChange={setNumericValue}
                            min={0}
                            max={100}
                            step={1}
                            precision={0}
                            label="Intensity"
                            className="w-32"
                        />
                        <NumericInput
                            value={numericValue / 10}
                            onChange={(v) => setNumericValue(v * 10)}
                            min={0}
                            max={10}
                            step={0.1}
                            precision={2}
                            label="Scale"
                            className="w-32"
                        />
                    </div>
                    <div className="text-xs text-[color:var(--kos-text-secondary)] font-mono">
                        Current value: {numericValue}
                    </div>
                </section>

                {/* VectorInput Demo */}
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-[color:var(--kos-text-primary)]">
                        VectorInput
                    </h2>
                    <p className="text-sm text-[color:var(--kos-text-secondary)]">
                        Multi-component vector input with color-coded labels
                    </p>
                    <VectorInput
                        value={vectorValue}
                        onChange={setVectorValue}
                        min={-10}
                        max={10}
                        step={0.1}
                        precision={2}
                        className="max-w-md"
                    />
                    <div className="text-xs text-[color:var(--kos-text-secondary)] font-mono">
                        Current vector: [{vectorValue.map((v) => v.toFixed(2)).join(', ')}]
                    </div>
                </section>

                {/* ColorPicker Demo */}
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-[color:var(--kos-text-primary)]">
                        ColorPicker
                    </h2>
                    <p className="text-sm text-[color:var(--kos-text-secondary)]">
                        Click to open color picker with swatches and alpha support
                    </p>
                    <ColorPicker
                        value={color}
                        onChange={setColor}
                        showAlpha={true}
                        className="w-64"
                    />
                    <div className="text-xs text-[color:var(--kos-text-secondary)] font-mono">
                        Current color: rgba({Math.round(color.r)}, {Math.round(color.g)},{' '}
                        {Math.round(color.b)}, {color.a.toFixed(2)})
                    </div>
                </section>

                {/* CurveEditor Demo */}
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-[color:var(--kos-text-primary)]">
                        CurveEditor
                    </h2>
                    <p className="text-sm text-[color:var(--kos-text-secondary)]">
                        Click to add points, drag to move, right-click to delete
                    </p>
                    <CurveEditor
                        curve={curve}
                        onChange={setCurve}
                        width={500}
                        height={200}
                        gridLines={4}
                        showValues={true}
                    />
                    <div className="text-xs text-[color:var(--kos-text-secondary)] font-mono">
                        Points: {curve.points.length}, Interpolation: {curve.interpolation}
                    </div>
                </section>

                {/* GradientEditor Demo */}
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-[color:var(--kos-text-primary)]">
                        GradientEditor
                    </h2>
                    <p className="text-sm text-[color:var(--kos-text-secondary)]">
                        Click to add stops, drag to move, right-click to delete
                    </p>
                    <GradientEditor
                        gradient={gradient}
                        onChange={setGradient}
                        width={500}
                        height={60}
                    />
                    <div className="text-xs text-[color:var(--kos-text-secondary)] font-mono">
                        Stops: {gradient.stops.length}
                    </div>
                </section>

                {/* NodeGraph Demo */}
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-[color:var(--kos-text-primary)]">
                        NodeGraph
                    </h2>
                    <p className="text-sm text-[color:var(--kos-text-secondary)]">
                        Drag nodes to move, drag from handles to create connections
                    </p>
                    <div className="h-[400px] rounded-lg overflow-hidden">
                        <NodeGraph
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={setNodes}
                            onEdgesChange={setEdges}
                            nodeTypes={defaultNodeTypes}
                            showMinimap={true}
                            showControls={true}
                            showBackground={true}
                        />
                    </div>
                    <div className="text-xs text-[color:var(--kos-text-secondary)] font-mono">
                        Nodes: {nodes.length}, Edges: {edges.length}
                    </div>
                </section>
            </div>
        </div>
    );
}
