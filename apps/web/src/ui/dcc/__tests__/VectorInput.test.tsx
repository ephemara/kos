/**
 * VectorInput.test.tsx
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for VectorInput component
 *
 * Tests:
 *  1. Component synchronization (Requirement 9.3)
 *  2. Individual component updates
 *  3. Array immutability
 *  4. Custom labels
 *  5. Different vector sizes (Vec2, Vec3, Vec4)
 *
 * **Validates: Requirement 9.3**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorInput } from '../VectorInput';

describe('VectorInput', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render Vec2 with default labels', () => {
      render(<VectorInput value={[1, 2]} onChange={onChange} />);
      
      expect(screen.getByText('X')).toBeInTheDocument();
      expect(screen.getByText('Y')).toBeInTheDocument();
      expect(screen.getByText('1.00')).toBeInTheDocument();
      expect(screen.getByText('2.00')).toBeInTheDocument();
    });

    it('should render Vec3 with default labels', () => {
      render(<VectorInput value={[1, 2, 3]} onChange={onChange} />);
      
      expect(screen.getByText('X')).toBeInTheDocument();
      expect(screen.getByText('Y')).toBeInTheDocument();
      expect(screen.getByText('Z')).toBeInTheDocument();
    });

    it('should render Vec4 with default labels', () => {
      render(<VectorInput value={[1, 2, 3, 4]} onChange={onChange} />);
      
      expect(screen.getByText('X')).toBeInTheDocument();
      expect(screen.getByText('Y')).toBeInTheDocument();
      expect(screen.getByText('Z')).toBeInTheDocument();
      expect(screen.getByText('W')).toBeInTheDocument();
    });

    it('should render with custom labels', () => {
      render(<VectorInput value={[1, 2, 3]} onChange={onChange} labels={['Width', 'Height', 'Depth']} />);
      
      expect(screen.getByText('Width')).toBeInTheDocument();
      expect(screen.getByText('Height')).toBeInTheDocument();
      expect(screen.getByText('Depth')).toBeInTheDocument();
    });

    it('should apply color coding to default labels', () => {
      render(<VectorInput value={[1, 2, 3]} onChange={onChange} />);
      
      const xLabel = screen.getByText('X');
      const yLabel = screen.getByText('Y');
      const zLabel = screen.getByText('Z');
      
      expect(xLabel).toHaveClass('text-red-400');
      expect(yLabel).toHaveClass('text-green-400');
      expect(zLabel).toHaveClass('text-blue-400');
    });
  });

  // ─── Component Synchronization (Requirement 9.3) ───────────────────────────

  describe('Component Synchronization', () => {
    it('should update individual component', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[1, 2, 3]} onChange={onChange} step={1} />);
      
      // Find X component input by label
      const xLabel = screen.getByText('X');
      const xContainer = xLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      xContainer.focus();
      
      // Increment X with arrow key
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0]).toBeCloseTo(2, 1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(3);
    });

    it('should maintain other components when updating one', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[5, 10, 15]} onChange={onChange} />);
      
      // Update Y component
      const yContainer = screen.getByText('10.00').closest('div')!;
      yContainer.focus();
      await user.keyboard('{ArrowDown}');
      
      // X and Z should remain unchanged
      expect(onChange).toHaveBeenCalledWith([5, 9.9, 15]);
    });

    it('should update all components independently', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<VectorInput value={[0, 0, 0]} onChange={onChange} step={1} />);
      
      // Update X
      const xLabel = screen.getByText('X');
      const xContainer = xLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      let result = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(result[0]).toBeCloseTo(1, 1);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
      
      // Rerender with new value
      rerender(<VectorInput value={[1, 0, 0]} onChange={onChange} step={1} />);
      
      // Update Y
      const yLabel = screen.getByText('Y');
      const yContainer = yLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      yContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      result = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(result[0]).toBe(1);
      expect(result[1]).toBeCloseTo(1, 1);
      expect(result[2]).toBe(0);
      
      // Rerender with new value
      rerender(<VectorInput value={[1, 1, 0]} onChange={onChange} step={1} />);
      
      // Update Z
      const zLabel = screen.getByText('Z');
      const zContainer = zLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      zContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      result = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(1);
      expect(result[2]).toBeCloseTo(1, 1);
    });

    it('should handle drag on individual component', async () => {
      render(<VectorInput value={[0, 0, 0]} onChange={onChange} step={1} />);
      
      // Drag Y component
      const yContainer = screen.getAllByText('0.00')[1].closest('div')!;
      
      fireEvent.mouseDown(yContainer, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 110 });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0][0]).toBe(0); // X unchanged
        expect(lastCall[0][1]).toBeGreaterThan(0); // Y changed
        expect(lastCall[0][2]).toBe(0); // Z unchanged
      });
      
      fireEvent.mouseUp(document);
    });
  });

  // ─── Array Immutability ─────────────────────────────────────────────────────

  describe('Array Immutability', () => {
    it('should create new array on update', async () => {
      const user = userEvent.setup();
      const originalValue = [1, 2, 3];
      render(<VectorInput value={originalValue} onChange={onChange} />);
      
      const xContainer = screen.getByText('1.00').closest('div')!;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      
      // Should be a different array instance
      expect(newValue).not.toBe(originalValue);
      
      // Original should be unchanged
      expect(originalValue).toEqual([1, 2, 3]);
    });

    it('should not mutate original array during drag', async () => {
      const originalValue = [5, 10, 15];
      render(<VectorInput value={originalValue} onChange={onChange} step={1} />);
      
      const yContainer = screen.getByText('10.00').closest('div')!;
      
      fireEvent.mouseDown(yContainer, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 105 });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
      
      fireEvent.mouseUp(document);
      
      // Original array should be unchanged
      expect(originalValue).toEqual([5, 10, 15]);
    });

    it('should preserve array length', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[1, 2, 3, 4]} onChange={onChange} />);
      
      const wContainer = screen.getByText('4.00').closest('div')!;
      wContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      expect(newValue).toHaveLength(4);
    });
  });

  // ─── Shared Properties ──────────────────────────────────────────────────────

  describe('Shared Properties', () => {
    it('should apply min/max to all components', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[9, 9, 9]} onChange={onChange} min={0} max={10} step={1} />);
      
      // Try to increment X beyond max
      const xLabel = screen.getByText('X');
      const xContainer = xLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      let result = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(9);
      expect(result[2]).toBe(9);
    });

    it('should apply step to all components', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[0, 0]} onChange={onChange} step={0.5} />);
      
      const xContainer = screen.getAllByText('0.00')[0].closest('div')!;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalledWith([0.5, 0]);
    });

    it('should apply precision to all components', () => {
      render(<VectorInput value={[1.23456, 2.34567, 3.45678]} onChange={onChange} precision={3} />);
      
      expect(screen.getByText('1.235')).toBeInTheDocument();
      expect(screen.getByText('2.346')).toBeInTheDocument();
      expect(screen.getByText('3.457')).toBeInTheDocument();
    });

    it('should disable all components when disabled', () => {
      render(<VectorInput value={[1, 2, 3]} onChange={onChange} disabled />);
      
      const containers = screen.getAllByText(/\d+\.\d+/).map(el => el.closest('div'));
      
      containers.forEach(container => {
        expect(container).toHaveClass('opacity-50');
      });
    });
  });

  // ─── Different Vector Sizes ─────────────────────────────────────────────────

  describe('Vector Sizes', () => {
    it('should handle Vec2', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[1, 2]} onChange={onChange} step={1} />);
      
      expect(screen.getAllByText(/\d+\.\d+/)).toHaveLength(2);
      
      const xLabel = screen.getByText('X');
      const xContainer = xLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0]).toBeCloseTo(2, 1);
      expect(result[1]).toBe(2);
    });

    it('should handle Vec3', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[1, 2, 3]} onChange={onChange} step={1} />);
      
      expect(screen.getAllByText(/\d+\.\d+/)).toHaveLength(3);
      
      const yLabel = screen.getByText('Y');
      const yContainer = yLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      yContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0]).toBe(1);
      expect(result[1]).toBeCloseTo(3, 1);
      expect(result[2]).toBe(3);
    });

    it('should handle Vec4', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[1, 2, 3, 4]} onChange={onChange} step={1} />);
      
      expect(screen.getAllByText(/\d+\.\d+/)).toHaveLength(4);
      
      const wLabel = screen.getByText('W');
      const wContainer = wLabel.closest('.flex-col')!.querySelector('[tabindex="0"]') as HTMLElement;
      wContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(3);
      expect(result[3]).toBeCloseTo(5, 1);
    });

    it('should adapt to vector size changes', () => {
      const { rerender } = render(<VectorInput value={[1, 2]} onChange={onChange} />);
      
      expect(screen.getAllByText(/\d+\.\d+/)).toHaveLength(2);
      
      rerender(<VectorInput value={[1, 2, 3]} onChange={onChange} />);
      
      expect(screen.getAllByText(/\d+\.\d+/)).toHaveLength(3);
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle complete workflow across all components', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<VectorInput value={[0, 0, 0]} onChange={onChange} step={1} />);
      
      // Update X via keyboard
      const xContainer = screen.getAllByText('0.00')[0].closest('div')!;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      expect(onChange).toHaveBeenCalledWith([1, 0, 0]);
      
      rerender(<VectorInput value={[1, 0, 0]} onChange={onChange} step={1} />);
      
      // Update Y via drag
      const yContainer = screen.getAllByText('0.00')[0].closest('div')!;
      fireEvent.mouseDown(yContainer, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 102 });
      
      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0][0]).toBe(1); // X unchanged
        expect(lastCall[0][1]).toBeGreaterThan(0); // Y changed
      });
      
      fireEvent.mouseUp(document);
      
      rerender(<VectorInput value={[1, 1, 0]} onChange={onChange} step={1} />);
      
      // Update Z via double-click edit
      const zContainer = screen.getByText('0.00').closest('div')!;
      await user.dblClick(zContainer);
      
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, '5');
      await user.keyboard('{Enter}');
      
      expect(onChange).toHaveBeenCalledWith([1, 1, 5]);
    });

    it('should maintain synchronization with clamping', async () => {
      const user = userEvent.setup();
      render(<VectorInput value={[5, 5, 5]} onChange={onChange} min={0} max={10} step={10} />);
      
      // Try to increment X beyond max
      const xContainer = screen.getAllByText('5.00')[0].closest('div')!;
      xContainer.focus();
      await user.keyboard('{ArrowUp}');
      
      // Should clamp to max
      expect(onChange).toHaveBeenCalledWith([10, 5, 5]);
      
      // Other components should be unaffected
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0][1]).toBe(5);
      expect(lastCall[0][2]).toBe(5);
    });
  });
});
