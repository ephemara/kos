/**
 * NumericInput.test.tsx
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for NumericInput component
 *
 * Tests:
 *  1. Drag behavior updates value continuously (Requirement 9.1)
 *  2. Value clamping at min/max bounds (Requirement 9.2)
 *  3. Double-click enters edit mode
 *  4. Keyboard arrow keys adjust value
 *  5. Precision formatting
 *  6. Disabled state
 *
 * **Validates: Requirements 9.1, 9.2**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumericInput } from '../NumericInput';

describe('NumericInput', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render with initial value', () => {
      render(<NumericInput value={5.5} onChange={onChange} />);
      expect(screen.getByText('5.50')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<NumericInput value={10} onChange={onChange} label="Speed" />);
      expect(screen.getByText('Speed')).toBeInTheDocument();
    });

    it('should format value with specified precision', () => {
      render(<NumericInput value={3.14159} onChange={onChange} precision={3} />);
      expect(screen.getByText('3.142')).toBeInTheDocument();
    });

    it('should render in disabled state', () => {
      render(<NumericInput value={5} onChange={onChange} disabled />);
      const container = screen.getByText('5.00').closest('div');
      expect(container).toHaveClass('opacity-50');
    });
  });

  // ─── Drag Behavior (Requirement 9.1) ───────────────────────────────────────

  describe('Drag Behavior', () => {
    it('should update value continuously during drag', async () => {
      render(<NumericInput value={0} onChange={onChange} step={1} dragSensitivity={1} />);
      
      const container = screen.getByText('0.00').closest('div')!;
      
      // Start drag
      fireEvent.mouseDown(container, { clientX: 100 });
      
      // Simulate drag movement
      fireEvent.mouseMove(document, { clientX: 110 });
      
      // Should have called onChange with new value
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0]).toBeCloseTo(10, 1);
      });
      
      // End drag
      fireEvent.mouseUp(document);
    });

    it('should respect drag sensitivity', async () => {
      render(<NumericInput value={0} onChange={onChange} step={1} dragSensitivity={10} />);
      
      const container = screen.getByText('0.00').closest('div')!;
      
      fireEvent.mouseDown(container, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 110 }); // 10 pixels
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        // 10 pixels / 10 sensitivity * 1 step = 1
        expect(lastCall[0]).toBeCloseTo(1, 1);
      });
      
      fireEvent.mouseUp(document);
    });

    it('should apply step multiplier during drag', async () => {
      render(<NumericInput value={0} onChange={onChange} step={0.5} dragSensitivity={2} />);
      
      const container = screen.getByText('0.00').closest('div')!;
      
      fireEvent.mouseDown(container, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 104 }); // 4 pixels
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        // 4 pixels / 2 sensitivity * 0.5 step = 1
        expect(lastCall[0]).toBeCloseTo(1, 1);
      });
      
      fireEvent.mouseUp(document);
    });

    it('should not drag when disabled', () => {
      render(<NumericInput value={5} onChange={onChange} disabled />);
      
      const container = screen.getByText('5.00').closest('div')!;
      
      fireEvent.mouseDown(container, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 110 });
      fireEvent.mouseUp(document);
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should change cursor during drag', async () => {
      render(<NumericInput value={0} onChange={onChange} />);
      
      const container = screen.getByText('0.00').closest('div')!;
      
      fireEvent.mouseDown(container, { clientX: 100 });
      
      // Cursor should change to ew-resize
      await waitFor(() => {
        expect(document.body.style.cursor).toBe('ew-resize');
      });
      
      fireEvent.mouseUp(document);
      
      // Cursor should reset
      await waitFor(() => {
        expect(document.body.style.cursor).toBe('');
      });
    });
  });

  // ─── Value Clamping (Requirement 9.2) ──────────────────────────────────────

  describe('Value Clamping', () => {
    it('should clamp value to minimum', async () => {
      render(<NumericInput value={5} onChange={onChange} min={0} max={10} step={1} dragSensitivity={1} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      
      // Drag far left (should clamp to 0)
      fireEvent.mouseDown(container, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 0 }); // -100 pixels
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0]).toBe(0);
      });
      
      fireEvent.mouseUp(document);
    });

    it('should clamp value to maximum', async () => {
      render(<NumericInput value={5} onChange={onChange} min={0} max={10} step={1} dragSensitivity={1} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      
      // Drag far right (should clamp to 10)
      fireEvent.mouseDown(container, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 200 }); // +100 pixels
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0]).toBe(10);
      });
      
      fireEvent.mouseUp(document);
    });

    it('should clamp typed value to bounds', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} min={0} max={10} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      
      // Double-click to enter edit mode
      await user.dblClick(container);
      
      const input = screen.getByRole('textbox') as HTMLInputElement;
      
      // Type value exceeding max
      await user.clear(input);
      await user.type(input, '15');
      await user.keyboard('{Enter}');
      
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('should handle negative bounds', async () => {
      render(<NumericInput value={0} onChange={onChange} min={-10} max={10} step={1} dragSensitivity={1} />);
      
      const container = screen.getByText('0.00').closest('div')!;
      
      // Drag left to negative
      fireEvent.mouseDown(container, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 95 }); // -5 pixels
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[0]).toBeCloseTo(-5, 1);
      });
      
      fireEvent.mouseUp(document);
    });
  });

  // ─── Edit Mode ──────────────────────────────────────────────────────────────

  describe('Edit Mode', () => {
    it('should enter edit mode on double-click', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      await user.dblClick(container);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should select text on entering edit mode', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      await user.dblClick(container);
      
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('5.00');
    });

    it('should commit value on Enter key', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      await user.dblClick(container);
      
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, '10.5');
      await user.keyboard('{Enter}');
      
      expect(onChange).toHaveBeenCalledWith(10.5);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should cancel edit on Escape key', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      await user.dblClick(container);
      
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, '10.5');
      await user.keyboard('{Escape}');
      
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should commit value on blur', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      await user.dblClick(container);
      
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, '7.25');
      
      // Blur the input
      fireEvent.blur(input);
      
      expect(onChange).toHaveBeenCalledWith(7.25);
    });

    it('should not enter edit mode when disabled', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} disabled />);
      
      const container = screen.getByText('5.00').closest('div')!;
      await user.dblClick(container);
      
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  // ─── Keyboard Controls ──────────────────────────────────────────────────────

  describe('Keyboard Controls', () => {
    it('should increment value with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} step={1} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      container.focus();
      
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalledWith(6);
    });

    it('should decrement value with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={5} onChange={onChange} step={1} />);
      
      const container = screen.getByText('5.00').closest('div')!;
      container.focus();
      
      await user.keyboard('{ArrowDown}');
      
      expect(onChange).toHaveBeenCalledWith(4);
    });

    it('should respect step size with arrow keys', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={0} onChange={onChange} step={0.5} />);
      
      const container = screen.getByText('0.00').closest('div')!;
      container.focus();
      
      await user.keyboard('{ArrowUp}');
      expect(onChange).toHaveBeenCalledWith(0.5);
      
      await user.keyboard('{ArrowDown}');
      expect(onChange).toHaveBeenCalledWith(-0.5);
    });

    it('should clamp arrow key adjustments to bounds', async () => {
      const user = userEvent.setup();
      render(<NumericInput value={9.5} onChange={onChange} min={0} max={10} step={1} />);
      
      const container = screen.getByText('9.50').closest('div')!;
      container.focus();
      
      await user.keyboard('{ArrowUp}');
      
      expect(onChange).toHaveBeenCalledWith(10);
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle complete workflow: drag, edit, keyboard', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<NumericInput value={0} onChange={onChange} step={1} dragSensitivity={1} />);
      
      const getContainer = () => screen.getByText(/\d+\.\d+/).closest('div')!;
      
      // Drag to change value
      fireEvent.mouseDown(getContainer(), { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 105 });
      fireEvent.mouseUp(document);
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
      
      // Update component with new value
      rerender(<NumericInput value={5} onChange={onChange} step={1} dragSensitivity={1} />);
      
      // Use keyboard to adjust
      getContainer().focus();
      await user.keyboard('{ArrowUp}');
      expect(onChange).toHaveBeenCalledWith(6);
      
      // Update again
      rerender(<NumericInput value={6} onChange={onChange} step={1} dragSensitivity={1} />);
      
      // Double-click to edit
      await user.dblClick(getContainer());
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, '10');
      await user.keyboard('{Enter}');
      
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('should maintain precision through multiple operations', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<NumericInput value={1.111} onChange={onChange} precision={3} step={0.001} />);
      
      const getContainer = () => screen.getByText(/\d+\.\d+/).closest('div')!;
      
      // Verify initial precision
      expect(screen.getByText('1.111')).toBeInTheDocument();
      
      // Increment
      getContainer().focus();
      await user.keyboard('{ArrowUp}');
      
      // Check with tolerance for floating point
      expect(onChange).toHaveBeenCalled();
      const callValue = onChange.mock.calls[0][0];
      expect(callValue).toBeCloseTo(1.112, 3);
      
      // Update
      rerender(<NumericInput value={1.112} onChange={onChange} precision={3} step={0.001} />);
      expect(screen.getByText('1.112')).toBeInTheDocument();
    });
  });
});
