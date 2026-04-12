/**
 * CurveEditor.test.tsx
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for CurveEditor component
 *
 * Tests:
 *  1. Control point addition (Requirement 9.5)
 *  2. Control point movement
 *  3. Control point deletion
 *  4. Interpolation modes (linear, smooth, step)
 *  5. Grid and value display
 *
 * **Validates: Requirement 9.5**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurveEditor, type Curve, type CurvePoint } from '../CurveEditor';

// Mock canvas context
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    set strokeStyle(_value: string) {},
    set fillStyle(_value: string) {},
    set lineWidth(_value: number) {},
    set font(_value: string) {},
  })) as any;
});

describe('CurveEditor', () => {
  let onChange: ReturnType<typeof vi.fn>;
  const defaultCurve: Curve = {
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    interpolation: 'linear',
  };

  beforeEach(() => {
    onChange = vi.fn();
  });

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render canvas with specified dimensions', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
    });

    it('should render with initial curve points', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
    });

    it('should render in disabled state', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} disabled />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toHaveClass('opacity-50');
      expect(canvas).toHaveClass('cursor-not-allowed');
    });

    it('should render with grid lines', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} gridLines={4} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
    });
  });

  // ─── Control Point Addition (Requirement 9.5) ──────────────────────────────

  describe('Control Point Addition', () => {
    it('should add point on canvas click', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      
      // Click in the middle of the canvas
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
        target: canvas,
      });
      
      expect(onChange).toHaveBeenCalled();
      const newCurve = onChange.mock.calls[0][0] as Curve;
      
      // Should have 3 points now (original 2 + new 1)
      expect(newCurve.points.length).toBe(3);
    });

    it('should add point with correct coordinates', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      
      // Mock getBoundingClientRect
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Click at (200, 150) - should be (0.5, 0.5) in curve space
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      expect(onChange).toHaveBeenCalled();
      const newCurve = onChange.mock.calls[0][0] as Curve;
      const addedPoint = newCurve.points.find(p => p.x > 0 && p.x < 1);
      
      expect(addedPoint).toBeDefined();
      expect(addedPoint!.x).toBeCloseTo(0.5, 1);
      expect(addedPoint!.y).toBeCloseTo(0.5, 1);
    });

    it('should sort points by x coordinate after adding', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Add point at x=0.3
      fireEvent.mouseDown(canvas, {
        clientX: 120, // 0.3 * 400
        clientY: 150,
      });
      
      expect(onChange).toHaveBeenCalled();
      const newCurve = onChange.mock.calls[0][0] as Curve;
      
      // Points should be sorted by x
      for (let i = 1; i < newCurve.points.length; i++) {
        expect(newCurve.points[i].x).toBeGreaterThanOrEqual(newCurve.points[i - 1].x);
      }
    });

    it('should clamp point coordinates to 0-1 range', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Click outside bounds (negative)
      fireEvent.mouseDown(canvas, {
        clientX: -50,
        clientY: -50,
      });
      
      expect(onChange).toHaveBeenCalled();
      const newCurve = onChange.mock.calls[0][0] as Curve;
      const addedPoint = newCurve.points[newCurve.points.length - 1];
      
      expect(addedPoint.x).toBeGreaterThanOrEqual(0);
      expect(addedPoint.x).toBeLessThanOrEqual(1);
      expect(addedPoint.y).toBeGreaterThanOrEqual(0);
      expect(addedPoint.y).toBeLessThanOrEqual(1);
    });

    it('should not add point when disabled', () => {
      render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} disabled />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ─── Control Point Movement ─────────────────────────────────────────────────

  describe('Control Point Movement', () => {
    it('should start dragging on point mousedown', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Click on middle point (200, 150)
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      // Move mouse
      fireEvent.mouseMove(document, {
        clientX: 220,
        clientY: 130,
      });
      
      // Should update point position
      expect(onChange).toHaveBeenCalled();
    });

    it('should update point position during drag', async () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Click on middle point
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      // Drag to new position
      fireEvent.mouseMove(document, {
        clientX: 240,
        clientY: 120,
      });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
        
        // Middle point should have moved
        const movedPoint = newCurve.points.find(p => p.x > 0.5 && p.x < 0.7);
        expect(movedPoint).toBeDefined();
      });
    });

    it('should stop dragging on mouseup', async () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Start drag
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      // Move
      fireEvent.mouseMove(document, {
        clientX: 220,
        clientY: 130,
      });
      
      const callCountDuringDrag = onChange.mock.calls.length;
      
      // Stop drag
      fireEvent.mouseUp(document);
      
      // Move again (should not trigger onChange)
      fireEvent.mouseMove(document, {
        clientX: 240,
        clientY: 110,
      });
      
      // Call count should not increase after mouseup
      expect(onChange.mock.calls.length).toBe(callCountDuringDrag);
    });

    it('should clamp dragged point to bounds', async () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Click on middle point
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      // Drag outside bounds
      fireEvent.mouseMove(document, {
        clientX: 500, // Beyond canvas width
        clientY: -50, // Beyond canvas height
      });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
        
        // All points should be within 0-1 range
        newCurve.points.forEach(point => {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(1);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should re-sort points after drag', async () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Drag middle point to the left
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      fireEvent.mouseMove(document, {
        clientX: 80, // x = 0.2
        clientY: 150,
      });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
        
        // Points should still be sorted
        for (let i = 1; i < newCurve.points.length; i++) {
          expect(newCurve.points[i].x).toBeGreaterThanOrEqual(newCurve.points[i - 1].x);
        }
      });
    });
  });

  // ─── Control Point Deletion ─────────────────────────────────────────────────

  describe('Control Point Deletion', () => {
    it('should delete point on right-click', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Right-click on middle point
      fireEvent.contextMenu(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      expect(onChange).toHaveBeenCalled();
      const newCurve = onChange.mock.calls[0][0] as Curve;
      
      // Should have 2 points now (deleted middle point)
      expect(newCurve.points.length).toBe(2);
    });

    it('should not delete if only 2 points remain', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Try to delete a point
      fireEvent.contextMenu(canvas, {
        clientX: 0,
        clientY: 300,
      });
      
      // Should not delete (need at least 2 points)
      if (onChange.mock.calls.length > 0) {
        const newCurve = onChange.mock.calls[0][0] as Curve;
        expect(newCurve.points.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should not delete when disabled', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} disabled />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      
      fireEvent.contextMenu(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ─── Interpolation Modes ────────────────────────────────────────────────────

  describe('Interpolation Modes', () => {
    it('should render linear interpolation', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
    });

    it('should render smooth interpolation', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'smooth',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
    });

    it('should render step interpolation', () => {
      const curve: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
        ],
        interpolation: 'step',
      };
      
      render(<CurveEditor curve={curve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
    });

    it('should update rendering when interpolation changes', () => {
      const curve1: Curve = {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: 'linear',
      };
      
      const { rerender } = render(<CurveEditor curve={curve1} onChange={onChange} width={400} height={300} />);
      
      const curve2: Curve = {
        ...curve1,
        interpolation: 'smooth',
      };
      
      rerender(<CurveEditor curve={curve2} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle complete workflow: add, move, delete', async () => {
      const { rerender } = render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Add point
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      expect(onChange).toHaveBeenCalled();
      let newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
      expect(newCurve.points.length).toBe(3);
      
      // Update component
      rerender(<CurveEditor curve={newCurve} onChange={onChange} width={400} height={300} />);
      
      // Move point
      fireEvent.mouseDown(canvas, {
        clientX: 200,
        clientY: 150,
      });
      
      fireEvent.mouseMove(document, {
        clientX: 220,
        clientY: 130,
      });
      
      fireEvent.mouseUp(document);
      
      await waitFor(() => {
        expect(onChange.mock.calls.length).toBeGreaterThan(1);
      });
      
      newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
      
      // Update component
      rerender(<CurveEditor curve={newCurve} onChange={onChange} width={400} height={300} />);
      
      // Delete point
      fireEvent.contextMenu(canvas, {
        clientX: 220,
        clientY: 130,
      });
      
      newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
      expect(newCurve.points.length).toBe(2);
    });

    it('should maintain curve integrity through multiple operations', async () => {
      const { rerender } = render(<CurveEditor curve={defaultCurve} onChange={onChange} width={400} height={300} />);
      
      const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
      
      // Add multiple points
      for (let i = 0; i < 3; i++) {
        fireEvent.mouseDown(canvas, {
          clientX: 100 + i * 50,
          clientY: 150,
        });
        
        const newCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
        rerender(<CurveEditor curve={newCurve} onChange={onChange} width={400} height={300} />);
      }
      
      const finalCurve = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Curve;
      
      // All points should be within bounds
      finalCurve.points.forEach(point => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      });
      
      // Points should be sorted
      for (let i = 1; i < finalCurve.points.length; i++) {
        expect(finalCurve.points[i].x).toBeGreaterThanOrEqual(finalCurve.points[i - 1].x);
      }
    });
  });
});
