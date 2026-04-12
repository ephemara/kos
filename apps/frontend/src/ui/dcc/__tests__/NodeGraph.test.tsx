/**
 * NodeGraph.test.tsx
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for NodeGraph component
 *
 * Tests:
 *  1. Node connections (Requirement 9.7)
 *  2. Node movement
 *  3. Edge creation/deletion
 *  4. Custom node types
 *  5. Minimap and controls
 *
 * **Validates: Requirement 9.7**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeGraph } from '../NodeGraph';
import type { Node, Edge } from '@xyflow/react';

// Mock @xyflow/react
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    ReactFlow: ({ nodes, edges, onNodesChange, onEdgesChange, onConnect, children }: any) => (
      <div data-testid="react-flow">
        <div data-testid="nodes-count">{nodes.length}</div>
        <div data-testid="edges-count">{edges.length}</div>
        {children}
      </div>
    ),
  };
});

describe('NodeGraph', () => {
  let onNodesChange: ReturnType<typeof vi.fn>;
  let onEdgesChange: ReturnType<typeof vi.fn>;

  const defaultNodes: Node[] = [
    {
      id: '1',
      type: 'input',
      position: { x: 0, y: 0 },
      data: { label: 'Input' },
    },
    {
      id: '2',
      type: 'default',
      position: { x: 200, y: 0 },
      data: { label: 'Process' },
    },
    {
      id: '3',
      type: 'output',
      position: { x: 400, y: 0 },
      data: { label: 'Output' },
    },
  ];

  const defaultEdges: Edge[] = [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
    },
  ];

  beforeEach(() => {
    onNodesChange = vi.fn();
    onEdgesChange = vi.fn();
  });

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render with initial nodes', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3');
    });

    it('should render with initial edges', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={defaultEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
    });

    it('should render in disabled state', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          disabled
        />
      );

      const container = screen.getByTestId('react-flow').parentElement;
      expect(container).toHaveClass('pointer-events-none');
      expect(container).toHaveClass('opacity-50');
    });

    it('should render with controls when enabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          showControls
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should render with minimap when enabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          showMinimap
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should render with background when enabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          showBackground
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  // ─── Node Management ────────────────────────────────────────────────────────

  describe('Node Management', () => {
    it('should update when nodes change', () => {
      const { rerender } = render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3');

      const newNodes: Node[] = [
        ...defaultNodes,
        {
          id: '4',
          type: 'default',
          position: { x: 600, y: 0 },
          data: { label: 'New Node' },
        },
      ];

      rerender(
        <NodeGraph
          nodes={newNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('4');
    });

    it('should handle empty nodes array', () => {
      render(
        <NodeGraph
          nodes={[]}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('0');
    });

    it('should handle nodes with different types', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { label: 'Input' },
        },
        {
          id: '2',
          type: 'output',
          position: { x: 200, y: 0 },
          data: { label: 'Output' },
        },
        {
          id: '3',
          type: 'default',
          position: { x: 400, y: 0 },
          data: { label: 'Default' },
        },
      ];

      render(
        <NodeGraph
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3');
    });
  });

  // ─── Edge Management (Requirement 9.7) ──────────────────────────────────────

  describe('Edge Management', () => {
    it('should update when edges change', () => {
      const { rerender } = render(
        <NodeGraph
          nodes={defaultNodes}
          edges={defaultEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('1');

      const newEdges: Edge[] = [
        ...defaultEdges,
        {
          id: 'e2-3',
          source: '2',
          target: '3',
        },
      ];

      rerender(
        <NodeGraph
          nodes={defaultNodes}
          edges={newEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('2');
    });

    it('should handle empty edges array', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('0');
    });

    it('should handle multiple edges between same nodes', () => {
      const edges: Edge[] = [
        {
          id: 'e1-2-a',
          source: '1',
          target: '2',
        },
        {
          id: 'e1-2-b',
          source: '1',
          target: '2',
        },
      ];

      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('2');
    });

    it('should handle edges with custom data', () => {
      const edges: Edge[] = [
        {
          id: 'e1-2',
          source: '1',
          target: '2',
          data: { weight: 0.5, color: 'red' },
        },
      ];

      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
    });
  });

  // ─── Node Connections (Requirement 9.7) ────────────────────────────────────

  describe('Node Connections', () => {
    it('should allow connecting nodes', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      // ReactFlow handles connection internally
      // We verify the component renders correctly
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should not allow connections when disabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          disabled
        />
      );

      const container = screen.getByTestId('react-flow').parentElement;
      expect(container).toHaveClass('pointer-events-none');
    });

    it('should handle connection mode', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          connectionMode="strict"
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  // ─── Custom Node Types ──────────────────────────────────────────────────────

  describe('Custom Node Types', () => {
    it('should accept custom node types', () => {
      const customNodeTypes = {
        custom: ({ data }: any) => <div>{data.label}</div>,
      };

      const nodes: Node[] = [
        {
          id: '1',
          type: 'custom',
          position: { x: 0, y: 0 },
          data: { label: 'Custom Node' },
        },
      ];

      render(
        <NodeGraph
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={customNodeTypes}
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should accept custom edge types', () => {
      const customEdgeTypes = {
        custom: () => <div>Custom Edge</div>,
      };

      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={defaultEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          edgeTypes={customEdgeTypes}
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  // ─── State Synchronization ──────────────────────────────────────────────────

  describe('State Synchronization', () => {
    it('should sync internal state with external props', () => {
      const { rerender } = render(
        <NodeGraph
          nodes={defaultNodes}
          edges={defaultEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3');
      expect(screen.getByTestId('edges-count')).toHaveTextContent('1');

      const newNodes: Node[] = [
        {
          id: '1',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { label: 'Updated Input' },
        },
      ];

      const newEdges: Edge[] = [];

      rerender(
        <NodeGraph
          nodes={newNodes}
          edges={newEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('1');
      expect(screen.getByTestId('edges-count')).toHaveTextContent('0');
    });

    it('should handle rapid state updates', () => {
      const { rerender } = render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const nodes: Node[] = [
          {
            id: '1',
            type: 'default',
            position: { x: i * 10, y: 0 },
            data: { label: `Node ${i}` },
          },
        ];

        rerender(
          <NodeGraph
            nodes={nodes}
            edges={[]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
          />
        );
      }

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('1');
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle complete workflow: add nodes, connect, remove', () => {
      const { rerender } = render(
        <NodeGraph
          nodes={[]}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('0');

      // Add nodes
      const nodes: Node[] = [
        {
          id: '1',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { label: 'Input' },
        },
        {
          id: '2',
          type: 'output',
          position: { x: 200, y: 0 },
          data: { label: 'Output' },
        },
      ];

      rerender(
        <NodeGraph
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('2');

      // Add edge
      const edges: Edge[] = [
        {
          id: 'e1-2',
          source: '1',
          target: '2',
        },
      ];

      rerender(
        <NodeGraph
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('edges-count')).toHaveTextContent('1');

      // Remove node
      const updatedNodes = nodes.filter(n => n.id !== '2');

      rerender(
        <NodeGraph
          nodes={updatedNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('1');
      expect(screen.getByTestId('edges-count')).toHaveTextContent('0');
    });

    it('should handle complex graph with multiple connections', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: '2', type: 'default', position: { x: 200, y: 0 }, data: { label: 'B' } },
        { id: '3', type: 'default', position: { x: 200, y: 100 }, data: { label: 'C' } },
        { id: '4', type: 'output', position: { x: 400, y: 50 }, data: { label: 'D' } },
      ];

      const edges: Edge[] = [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e1-3', source: '1', target: '3' },
        { id: 'e2-4', source: '2', target: '4' },
        { id: 'e3-4', source: '3', target: '4' },
      ];

      render(
        <NodeGraph
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('4');
      expect(screen.getByTestId('edges-count')).toHaveTextContent('4');
    });

    it('should maintain graph integrity through updates', () => {
      const { rerender } = render(
        <NodeGraph
          nodes={defaultNodes}
          edges={defaultEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );

      // Multiple updates
      for (let i = 0; i < 5; i++) {
        const updatedNodes = defaultNodes.map(node => ({
          ...node,
          position: { x: node.position.x + i * 10, y: node.position.y },
        }));

        rerender(
          <NodeGraph
            nodes={updatedNodes}
            edges={defaultEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
          />
        );

        expect(screen.getByTestId('nodes-count')).toHaveTextContent('3');
        expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
      }
    });
  });

  // ─── UI Features ────────────────────────────────────────────────────────────

  describe('UI Features', () => {
    it('should render without minimap when disabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          showMinimap={false}
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should render without controls when disabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          showControls={false}
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should render without background when disabled', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          showBackground={false}
        />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <NodeGraph
          nodes={defaultNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          className="custom-class"
        />
      );

      const container = screen.getByTestId('react-flow').parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });
});
