/**
 * NodeEditor - Node graph editor component
 * 
 * Provides a visual node graph editor for compositing operations.
 * Uses @xyflow/react for node graph visualization and interaction.
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ComposeEngine } from '../engine/composeEngine';
import type { CompositeNode, NodeConnection } from '../engine/nodeGraph';

interface NodeEditorProps {
  engine: ComposeEngine | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

// Custom node component for compositing nodes
const CompositeNodeComponent: React.FC<{ data: any }> = ({ data }) => {
  const { label, type, inputs, outputs } = data;

  return (
    <div style={{
      background: '#2a2a2a',
      border: '2px solid #4a7c59',
      borderRadius: '8px',
      padding: '12px',
      minWidth: '180px',
      color: '#fff',
    }}>
      {/* Node Header */}
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        marginBottom: '8px',
        color: '#4a7c59',
        textAlign: 'center',
      }}>
        {label}
      </div>

      {/* Node Type */}
      <div style={{
        fontSize: '10px',
        color: '#999',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        {type}
      </div>

      {/* Inputs */}
      {inputs && inputs.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {inputs.map((input: any, idx: number) => (
            <div
              key={idx}
              style={{
                fontSize: '11px',
                color: '#ccc',
                padding: '4px 8px',
                background: '#1a1a1a',
                borderRadius: '4px',
                marginBottom: '4px',
              }}
            >
              ▶ {input.name}
            </div>
          ))}
        </div>
      )}

      {/* Outputs */}
      {outputs && outputs.length > 0 && (
        <div>
          {outputs.map((output: any, idx: number) => (
            <div
              key={idx}
              style={{
                fontSize: '11px',
                color: '#ccc',
                padding: '4px 8px',
                background: '#1a1a1a',
                borderRadius: '4px',
                marginBottom: '4px',
                textAlign: 'right',
              }}
            >
              {output.name} ◀
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  compositeNode: CompositeNodeComponent,
};

// Node type categories for the add menu
const NODE_CATEGORIES = {
  'Input/Output': ['input', 'output'],
  'Blend': ['mix', 'mask'],
  'Color': ['colorGrade', 'levels', 'curves', 'hsl'],
  'Effects': ['blur', 'sharpen', 'glow', 'vignette', 'chromatic'],
  'Transform': ['transform', 'distort'],
  'Generators': ['gradient', 'noise'],
};

export const NodeEditor: React.FC<NodeEditorProps> = ({
  engine,
  selectedNodeId,
  onNodeSelect,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPosition, setAddMenuPosition] = useState({ x: 0, y: 0 });

  // Convert engine nodes to ReactFlow nodes
  const convertToFlowNodes = useCallback((engineNodes: CompositeNode[]): Node[] => {
    return engineNodes.map((node, index) => ({
      id: node.id,
      type: 'compositeNode',
      position: node.position.x !== 0 || node.position.y !== 0 
        ? node.position 
        : { x: 100 + index * 250, y: 100 + (index % 3) * 150 },
      data: {
        label: node.name,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
      },
      selected: node.id === selectedNodeId,
    }));
  }, [selectedNodeId]);

  // Convert engine connections to ReactFlow edges
  const convertToFlowEdges = useCallback((engineConnections: NodeConnection[]): Edge[] => {
    return engineConnections.map((conn) => ({
      id: conn.id,
      source: conn.fromNode,
      target: conn.toNode,
      sourceHandle: conn.fromSocket,
      targetHandle: conn.toSocket,
      animated: true,
      style: { stroke: '#4a7c59', strokeWidth: 2 },
    }));
  }, []);

  // Sync engine state with ReactFlow
  useEffect(() => {
    if (!engine) return;

    const updateGraph = () => {
      const engineNodes = engine.getNodes();
      const engineConnections = engine.getConnections();
      
      setNodes(convertToFlowNodes(engineNodes));
      setEdges(convertToFlowEdges(engineConnections));
    };

    updateGraph();

    // Poll for updates
    const interval = setInterval(updateGraph, 500);
    return () => clearInterval(interval);
  }, [engine, convertToFlowNodes, convertToFlowEdges, setNodes, setEdges]);

  // Handle node connection
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!engine || !connection.source || !connection.target) return;

      try {
        engine.connectNodes(
          connection.source,
          connection.target,
          connection.sourceHandle || 'output',
          connection.targetHandle || 'input'
        );
        
        setEdges((eds) => addEdge(connection, eds));
      } catch (error) {
        console.error('[NodeEditor] Connection failed:', error);
      }
    },
    [engine, setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    setShowAddMenu(false);
  }, [onNodeSelect]);

  // Handle right-click to show add menu
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setAddMenuPosition({ x: event.clientX, y: event.clientY });
    setShowAddMenu(true);
  }, []);

  // Add node at position
  const handleAddNode = useCallback(
    (type: string) => {
      if (!engine) return;

      const nodeId = engine.addNode(type);
      
      // Update position based on where the menu was opened
      const node = engine.getNode(nodeId);
      if (node) {
        node.position = {
          x: addMenuPosition.x - 100,
          y: addMenuPosition.y - 100,
        };
      }

      onNodeSelect(nodeId);
      setShowAddMenu(false);
    },
    [engine, addMenuPosition, onNodeSelect]
  );

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#1e1e1e',
      position: 'relative',
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: '#1e1e1e' }}
      >
        <Background color="#333" gap={16} />
        <Controls style={{ background: '#2a2a2a', border: '1px solid #444' }} />
        <MiniMap
          style={{ background: '#2a2a2a', border: '1px solid #444' }}
          nodeColor="#4a7c59"
        />

        {/* Instructions Panel */}
        <Panel position="bottom-left">
          <div style={{
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#999',
          }}>
            Right-click to add nodes • Drag to connect • Click to select
          </div>
        </Panel>
      </ReactFlow>

      {/* Context Menu for Adding Nodes */}
      {showAddMenu && (
        <div
          style={{
            position: 'fixed',
            left: addMenuPosition.x,
            top: addMenuPosition.y,
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            padding: '8px',
            zIndex: 1000,
            minWidth: '200px',
            maxHeight: '400px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{
            fontSize: '12px',
            color: '#999',
            marginBottom: '8px',
            fontWeight: 600,
            padding: '4px 8px',
          }}>
            Add Node
          </div>

          {Object.entries(NODE_CATEGORIES).map(([category, types]) => (
            <div key={category} style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '10px',
                color: '#666',
                marginBottom: '4px',
                padding: '4px 8px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                {category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {types.map((type) => (
                  <button
                    key={type}
                    style={{
                      padding: '6px 12px',
                      background: '#3a3a3a',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => handleAddNode(type)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#4a4a4a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#3a3a3a';
                    }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Click outside to close menu */}
      {showAddMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
};
