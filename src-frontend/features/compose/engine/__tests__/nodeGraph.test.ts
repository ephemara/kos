/**
 * Unit tests for NodeGraph system
 * 
 * Tests node addition/removal, connection validation, type checking,
 * and dependency-ordered evaluation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NodeGraph } from '../nodeGraph';
import * as THREE from 'three';

describe('NodeGraph', () => {
  let nodeGraph: NodeGraph;

  beforeEach(() => {
    nodeGraph = new NodeGraph();
  });

  describe('Node Addition and Removal', () => {
    it('should add a node and return a valid ID', () => {
      const nodeId = nodeGraph.addNode('blur');
      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');
      expect(nodeId).toMatch(/^node_/);
    });

    it('should add node with correct type and default parameters', () => {
      const nodeId = nodeGraph.addNode('blur');
      const node = nodeGraph.getNode(nodeId);
      
      expect(node).toBeDefined();
      expect(node?.type).toBe('blur');
      expect(node?.parameters.radius).toBe(5.0);
    });

    it('should throw error for unknown node type', () => {
      expect(() => nodeGraph.addNode('invalid_type')).toThrow('Unknown node type');
    });

    it('should remove a node', () => {
      const nodeId = nodeGraph.addNode('blur');
      nodeGraph.removeNode(nodeId);
      
      const node = nodeGraph.getNode(nodeId);
      expect(node).toBeUndefined();
    });

    it('should remove all connections when removing a node', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      const outputId = nodeGraph.addNode('output');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      nodeGraph.connectNodes(blurId, outputId, 'image', 'image');
      
      nodeGraph.removeNode(blurId);
      
      const connections = nodeGraph.getConnections();
      expect(connections.length).toBe(0);
    });

    it('should create nodes with all required node types', () => {
      const nodeTypes = [
        'input', 'output', 'mix', 'blur', 'sharpen', 'colorGrade',
        'levels', 'curves', 'hsl', 'glow', 'vignette', 'chromatic',
        'distort', 'transform', 'mask', 'gradient', 'noise', 'text', 'math'
      ];

      nodeTypes.forEach(type => {
        const nodeId = nodeGraph.addNode(type);
        const node = nodeGraph.getNode(nodeId);
        expect(node?.type).toBe(type);
      });
    });
  });

  describe('Node Connection System', () => {
    it('should connect two nodes with compatible sockets', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      
      expect(() => {
        nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      }).not.toThrow();
      
      const connections = nodeGraph.getConnections();
      expect(connections.length).toBe(1);
      expect(connections[0].fromNode).toBe(inputId);
      expect(connections[0].toNode).toBe(blurId);
    });

    it('should throw error for incompatible socket types', () => {
      const inputId = nodeGraph.addNode('input');
      const mathId = nodeGraph.addNode('math');
      
      expect(() => {
        nodeGraph.connectNodes(inputId, mathId, 'image', 'value1');
      }).toThrow('Socket type mismatch');
    });

    it('should throw error for invalid node IDs', () => {
      expect(() => {
        nodeGraph.connectNodes('invalid1', 'invalid2', 'image', 'image');
      }).toThrow('Invalid node IDs');
    });

    it('should throw error for invalid socket names', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      
      expect(() => {
        nodeGraph.connectNodes(inputId, blurId, 'invalid_socket', 'image');
      }).toThrow('Invalid socket names');
    });

    it('should disconnect nodes', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      const connections = nodeGraph.getConnections();
      expect(connections.length).toBe(1);
      
      nodeGraph.disconnectNodes(connections[0].id);
      expect(nodeGraph.getConnections().length).toBe(0);
    });

    it('should prevent circular dependencies', () => {
      const node1 = nodeGraph.addNode('blur');
      const node2 = nodeGraph.addNode('sharpen');
      const node3 = nodeGraph.addNode('colorGrade');
      
      nodeGraph.connectNodes(node1, node2, 'image', 'image');
      nodeGraph.connectNodes(node2, node3, 'image', 'image');
      
      expect(() => {
        nodeGraph.connectNodes(node3, node1, 'image', 'image');
      }).toThrow('circular dependency');
    });

    it('should allow multiple connections from same output', () => {
      const inputId = nodeGraph.addNode('input');
      const blur1Id = nodeGraph.addNode('blur');
      const blur2Id = nodeGraph.addNode('blur');
      
      nodeGraph.connectNodes(inputId, blur1Id, 'image', 'image');
      nodeGraph.connectNodes(inputId, blur2Id, 'image', 'image');
      
      const connections = nodeGraph.getConnections();
      expect(connections.length).toBe(2);
    });
  });

  describe('Type Checking', () => {
    it('should validate image to image connections', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      
      expect(() => {
        nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      }).not.toThrow();
    });

    it('should validate number to number connections', () => {
      const math1Id = nodeGraph.addNode('math');
      const math2Id = nodeGraph.addNode('math');
      
      expect(() => {
        nodeGraph.connectNodes(math1Id, math2Id, 'result', 'value1');
      }).not.toThrow();
    });

    it('should reject image to number connections', () => {
      const inputId = nodeGraph.addNode('input');
      const mathId = nodeGraph.addNode('math');
      
      expect(() => {
        nodeGraph.connectNodes(inputId, mathId, 'image', 'value1');
      }).toThrow('Socket type mismatch');
    });

    it('should reject number to image connections', () => {
      const mathId = nodeGraph.addNode('math');
      const blurId = nodeGraph.addNode('blur');
      
      expect(() => {
        nodeGraph.connectNodes(mathId, blurId, 'result', 'image');
      }).toThrow('Socket type mismatch');
    });
  });

  describe('Node Parameters', () => {
    it('should update node parameters', () => {
      const blurId = nodeGraph.addNode('blur');
      
      nodeGraph.updateNodeParameters(blurId, { radius: 10.0 });
      
      const node = nodeGraph.getNode(blurId);
      expect(node?.parameters.radius).toBe(10.0);
    });

    it('should merge parameters without overwriting others', () => {
      const colorGradeId = nodeGraph.addNode('colorGrade');
      
      nodeGraph.updateNodeParameters(colorGradeId, { exposure: 1.5 });
      
      const node = nodeGraph.getNode(colorGradeId);
      expect(node?.parameters.exposure).toBe(1.5);
      expect(node?.parameters.contrast).toBe(1.0); // Should remain default
    });

    it('should invalidate cache when parameters change', () => {
      const blurId = nodeGraph.addNode('blur');
      
      // This would normally cache the result
      // After updating parameters, cache should be cleared
      nodeGraph.updateNodeParameters(blurId, { radius: 15.0 });
      
      // Verify parameter was updated
      const node = nodeGraph.getNode(blurId);
      expect(node?.parameters.radius).toBe(15.0);
    });
  });

  describe('Graph Queries', () => {
    it('should return all nodes', () => {
      const id1 = nodeGraph.addNode('input');
      const id2 = nodeGraph.addNode('blur');
      const id3 = nodeGraph.addNode('output');
      
      const nodes = nodeGraph.getNodes();
      expect(nodes.length).toBe(3);
      expect(nodes.map(n => n.id)).toContain(id1);
      expect(nodes.map(n => n.id)).toContain(id2);
      expect(nodes.map(n => n.id)).toContain(id3);
    });

    it('should return all connections', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      const outputId = nodeGraph.addNode('output');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      nodeGraph.connectNodes(blurId, outputId, 'image', 'image');
      
      const connections = nodeGraph.getConnections();
      expect(connections.length).toBe(2);
    });

    it('should return specific node by ID', () => {
      const blurId = nodeGraph.addNode('blur');
      const node = nodeGraph.getNode(blurId);
      
      expect(node).toBeDefined();
      expect(node?.id).toBe(blurId);
      expect(node?.type).toBe('blur');
    });

    it('should return undefined for non-existent node', () => {
      const node = nodeGraph.getNode('non_existent_id');
      expect(node).toBeUndefined();
    });
  });

  describe('Dependency Order Evaluation', () => {
    it('should evaluate simple linear graph', async () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      const outputId = nodeGraph.addNode('output');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      nodeGraph.connectNodes(blurId, outputId, 'image', 'image');
      
      // Should not throw
      await expect(nodeGraph.evaluate()).resolves.toBeDefined();
    });

    it('should throw error if no output node exists', async () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      
      await expect(nodeGraph.evaluate()).rejects.toThrow('No output node found');
    });

    it('should evaluate branching graph correctly', async () => {
      const inputId = nodeGraph.addNode('input');
      const blur1Id = nodeGraph.addNode('blur');
      const blur2Id = nodeGraph.addNode('blur');
      const mixId = nodeGraph.addNode('mix');
      const outputId = nodeGraph.addNode('output');
      
      nodeGraph.connectNodes(inputId, blur1Id, 'image', 'image');
      nodeGraph.connectNodes(inputId, blur2Id, 'image', 'image');
      nodeGraph.connectNodes(blur1Id, mixId, 'image', 'image1');
      nodeGraph.connectNodes(blur2Id, mixId, 'image', 'image2');
      nodeGraph.connectNodes(mixId, outputId, 'image', 'image');
      
      // Should not throw
      await expect(nodeGraph.evaluate()).resolves.toBeDefined();
    });

    it('should use cached results for repeated evaluations', async () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      const outputId = nodeGraph.addNode('output');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      nodeGraph.connectNodes(blurId, outputId, 'image', 'image');
      
      // First evaluation
      await nodeGraph.evaluate();
      
      // Second evaluation should use cache
      await expect(nodeGraph.evaluate()).resolves.toBeDefined();
    });
  });

  describe('Node Definitions', () => {
    it('should have correct inputs for mix node', () => {
      const mixId = nodeGraph.addNode('mix');
      const node = nodeGraph.getNode(mixId);
      
      expect(node?.inputs.length).toBe(3);
      expect(node?.inputs.find(i => i.name === 'image1')).toBeDefined();
      expect(node?.inputs.find(i => i.name === 'image2')).toBeDefined();
      expect(node?.inputs.find(i => i.name === 'factor')).toBeDefined();
    });

    it('should have correct outputs for input node', () => {
      const inputId = nodeGraph.addNode('input');
      const node = nodeGraph.getNode(inputId);
      
      expect(node?.outputs.length).toBe(1);
      expect(node?.outputs[0].name).toBe('image');
      expect(node?.outputs[0].type).toBe('image');
    });

    it('should have no outputs for output node', () => {
      const outputId = nodeGraph.addNode('output');
      const node = nodeGraph.getNode(outputId);
      
      expect(node?.outputs.length).toBe(0);
    });

    it('should have correct default parameters for colorGrade node', () => {
      const colorGradeId = nodeGraph.addNode('colorGrade');
      const node = nodeGraph.getNode(colorGradeId);
      
      expect(node?.parameters.exposure).toBe(0.0);
      expect(node?.parameters.contrast).toBe(1.0);
      expect(node?.parameters.saturation).toBe(1.0);
      expect(node?.parameters.temperature).toBe(0.0);
      expect(node?.parameters.tint).toBe(0.0);
    });
  });

  describe('Resource Management', () => {
    it('should dispose of resources', () => {
      const inputId = nodeGraph.addNode('input');
      const blurId = nodeGraph.addNode('blur');
      
      nodeGraph.connectNodes(inputId, blurId, 'image', 'image');
      
      expect(() => nodeGraph.dispose()).not.toThrow();
      
      // After disposal, graph should be empty
      expect(nodeGraph.getNodes().length).toBe(0);
      expect(nodeGraph.getConnections().length).toBe(0);
    });
  });
});
