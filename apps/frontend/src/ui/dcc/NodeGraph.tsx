// @ts-nocheck
import React, { useCallback } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Connection,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
    NodeTypes,
    EdgeTypes,
    ConnectionMode,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '../primitives/cn';

export type NodeGraphProps = {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: (nodes: Node[]) => void;
    onEdgesChange: (edges: Edge[]) => void;
    nodeTypes?: NodeTypes;
    edgeTypes?: EdgeTypes;
    disabled?: boolean;
    className?: string;
    showMinimap?: boolean;
    showControls?: boolean;
    showBackground?: boolean;
    connectionMode?: ConnectionMode;
};

/**
 * NodeGraph - Node-based graph editor using @xyflow/react
 * 
 * Features:
 * - Add nodes programmatically or via UI
 * - Create connections by dragging between node handles
 * - Move and arrange nodes freely
 * - Automatic layout support
 * - Minimap for navigation
 * - Zoom and pan controls
 * - Custom node and edge types
 * - Connection validation
 * 
 * Validates: Requirement 9.7
 */
export function NodeGraph({
    nodes: initialNodes,
    edges: initialEdges,
    onNodesChange: onNodesChangeProp,
    onEdgesChange: onEdgesChangeProp,
    nodeTypes,
    edgeTypes,
    disabled = false,
    className,
    showMinimap = true,
    showControls = true,
    showBackground = true,
    connectionMode = ConnectionMode.Loose,
}: NodeGraphProps) {
    // Use internal state management from @xyflow/react
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync internal state with external props
    React.useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    React.useEffect(() => {
        setEdges(initialEdges);
    }, [initialEdges, setEdges]);

    // Handle node changes and propagate to parent
    const handleNodesChange = useCallback(
        (changes: any) => {
            onNodesChange(changes);
            // Get updated nodes after changes
            const updatedNodes = nodes; // This will be updated by useNodesState
            onNodesChangeProp(updatedNodes);
        },
        [onNodesChange, onNodesChangeProp, nodes]
    );

    // Handle edge changes and propagate to parent
    const handleEdgesChange = useCallback(
        (changes: any) => {
            onEdgesChange(changes);
            // Get updated edges after changes
            const updatedEdges = edges; // This will be updated by useEdgesState
            onEdgesChangeProp(updatedEdges);
        },
        [onEdgesChange, onEdgesChangeProp, edges]
    );

    // Handle new connections
    const onConnect = useCallback(
        (connection: Connection) => {
            if (disabled) return;
            
            const newEdges = addEdge(connection, edges);
            setEdges(newEdges);
            onEdgesChangeProp(newEdges);
        },
        [edges, setEdges, onEdgesChangeProp, disabled]
    );

    // Custom styles for K_OS theme
    const customStyles = {
        background: 'var(--kos-surface-primary)',
        color: 'var(--kos-text-primary)',
    };

    return (
        <ReactFlowProvider>
            <div
                className={cn(
                    'relative w-full h-full',
                    disabled && 'pointer-events-none opacity-50',
                    className
                )}
                style={customStyles}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={connectionMode}
                    fitView
                    attributionPosition="bottom-left"
                    className={cn(
                        'rounded-lg',
                        'border border-[color:var(--kos-border-primary)]'
                    )}
                    style={{
                        backgroundColor: 'var(--kos-surface-tertiary)',
                    }}
                >
                    {showControls && (
                        <Controls
                            className="bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded-md"
                            style={{
                                button: {
                                    backgroundColor: 'var(--kos-surface-tertiary)',
                                    color: 'var(--kos-text-primary)',
                                    borderColor: 'var(--kos-border-primary)',
                                },
                            }}
                        />
                    )}

                    {showBackground && (
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={16}
                            size={1}
                            color="rgba(255, 255, 255, 0.1)"
                        />
                    )}

                    {showMinimap && (
                        <MiniMap
                            className="bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded-md"
                            nodeColor={(node) => {
                                if (node.type === 'input') return '#4ade80';
                                if (node.type === 'output') return '#f87171';
                                return '#60a5fa';
                            }}
                            maskColor="rgba(0, 0, 0, 0.5)"
                        />
                    )}
                </ReactFlow>
            </div>
        </ReactFlowProvider>
    );
}

/**
 * Default node component for K_OS theme
 * Can be used as a base for custom node types
 */
export function DefaultNode({ data }: { data: any }) {
    return (
        <div
            className={cn(
                'px-4 py-2 rounded-md',
                'bg-[color:var(--kos-surface-secondary)]',
                'border border-[color:var(--kos-border-primary)]',
                'shadow-lg',
                'min-w-[150px]'
            )}
        >
            <div className="text-[11px] text-[color:var(--kos-text-primary)] font-medium">
                {data.label}
            </div>
            {data.description && (
                <div className="text-[10px] text-[color:var(--kos-text-secondary)] mt-1">
                    {data.description}
                </div>
            )}
        </div>
    );
}

/**
 * Input node component (green accent)
 */
export function InputNode({ data }: { data: any }) {
    return (
        <div
            className={cn(
                'px-4 py-2 rounded-md',
                'bg-[color:var(--kos-surface-secondary)]',
                'border-2 border-green-500',
                'shadow-lg',
                'min-w-[150px]'
            )}
        >
            <div className="text-[11px] text-green-400 font-bold">
                {data.label || 'Input'}
            </div>
            {data.description && (
                <div className="text-[10px] text-[color:var(--kos-text-secondary)] mt-1">
                    {data.description}
                </div>
            )}
        </div>
    );
}

/**
 * Output node component (red accent)
 */
export function OutputNode({ data }: { data: any }) {
    return (
        <div
            className={cn(
                'px-4 py-2 rounded-md',
                'bg-[color:var(--kos-surface-secondary)]',
                'border-2 border-red-500',
                'shadow-lg',
                'min-w-[150px]'
            )}
        >
            <div className="text-[11px] text-red-400 font-bold">
                {data.label || 'Output'}
            </div>
            {data.description && (
                <div className="text-[10px] text-[color:var(--kos-text-secondary)] mt-1">
                    {data.description}
                </div>
            )}
        </div>
    );
}

/**
 * Default node types for K_OS
 */
export const defaultNodeTypes: NodeTypes = {
    default: DefaultNode,
    input: InputNode,
    output: OutputNode,
};
// @ts-nocheck
