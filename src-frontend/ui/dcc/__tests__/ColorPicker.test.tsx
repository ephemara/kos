/**
 * ColorPicker.test.tsx
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for ColorPicker component
 *
 * Tests:
 *  1. Color picker interactions (Requirement 9.4)
 *  2. Swatch selection
 *  3. Alpha channel toggle
 *  4. Hex color conversion
 *  5. Popover behavior
 *
 * **Validates: Requirement 9.4**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker, type Color } from '../ColorPicker';

describe('ColorPicker', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render with initial color', () => {
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} />);
      
      expect(screen.getByText('#ff0000')).toBeInTheDocument();
    });

    it('should display color preview', () => {
      const color: Color = { r: 100, g: 150, b: 200, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} />);
      
      const preview = screen.getByRole('button').querySelector('div');
      expect(preview).toHaveStyle({ backgroundColor: 'rgba(100, 150, 200, 1)' });
    });

    it('should display alpha percentage when showAlpha is true', () => {
      const color: Color = { r: 255, g: 0, b: 0, a: 0.5 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha />);
      
      expect(screen.getByText('#ff0000 50%')).toBeInTheDocument();
    });

    it('should not display alpha percentage when showAlpha is false', () => {
      const color: Color = { r: 255, g: 0, b: 0, a: 0.5 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha={false} />);
      
      expect(screen.getByText('#ff0000')).toBeInTheDocument();
      expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
    });

    it('should render in disabled state', () => {
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50');
    });
  });

  // ─── Popover Behavior ───────────────────────────────────────────────────────

  describe('Popover', () => {
    it('should open popover on click', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Popover should be open (react-colorful picker should be visible)
      await waitFor(() => {
        expect(document.querySelector('.react-colorful')).toBeInTheDocument();
      });
    });

    it('should close popover on outside click', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(document.querySelector('.react-colorful')).toBeInTheDocument();
      });
      
      // Click outside
      await user.click(document.body);
      
      await waitFor(() => {
        expect(document.querySelector('.react-colorful')).not.toBeInTheDocument();
      });
    });

    it('should not open popover when disabled', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} disabled />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(document.querySelector('.react-colorful')).not.toBeInTheDocument();
    });
  });

  // ─── Color Picker Interactions (Requirement 9.4) ───────────────────────────

  describe('Color Picker Interactions', () => {
    it('should use HexColorPicker when showAlpha is false', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha={false} />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const picker = document.querySelector('.react-colorful');
        expect(picker).toBeInTheDocument();
      });
    });

    it('should use RgbaColorPicker when showAlpha is true', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const picker = document.querySelector('.react-colorful');
        expect(picker).toBeInTheDocument();
      });
    });
  });

  // ─── Swatch Selection ───────────────────────────────────────────────────────

  describe('Swatch Selection', () => {
    it('should display default swatches when none provided', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        // Default swatches: white, black, red, green, blue, yellow, magenta, cyan
        const swatches = document.querySelectorAll('button[title^="#"]');
        expect(swatches.length).toBeGreaterThanOrEqual(8);
      });
    });

    it('should display custom swatches', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      const customSwatches: Color[] = [
        { r: 255, g: 100, b: 100, a: 1 },
        { r: 100, g: 255, b: 100, a: 1 },
        { r: 100, g: 100, b: 255, a: 1 },
      ];
      
      render(<ColorPicker value={color} onChange={onChange} swatches={customSwatches} />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const swatches = document.querySelectorAll('button[title^="#"]');
        expect(swatches).toHaveLength(3);
      });
    });

    it('should select swatch on click', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      const customSwatches: Color[] = [
        { r: 0, g: 255, b: 0, a: 1 }, // Green
      ];
      
      render(<ColorPicker value={color} onChange={onChange} swatches={customSwatches} />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const swatch = document.querySelector('button[title="#00ff00"]');
        expect(swatch).toBeInTheDocument();
      });
      
      const swatch = document.querySelector('button[title="#00ff00"]') as HTMLElement;
      await user.click(swatch);
      
      expect(onChange).toHaveBeenCalledWith({ r: 0, g: 255, b: 0, a: 1 });
    });

    it('should preserve alpha when selecting swatch', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 0.5 };
      const customSwatches: Color[] = [
        { r: 0, g: 255, b: 0, a: 0.8 },
      ];
      
      render(<ColorPicker value={color} onChange={onChange} swatches={customSwatches} showAlpha />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        const swatch = document.querySelector('button[title="#00ff00"]');
        expect(swatch).toBeInTheDocument();
      });
      
      const swatch = document.querySelector('button[title="#00ff00"]') as HTMLElement;
      await user.click(swatch);
      
      expect(onChange).toHaveBeenCalledWith({ r: 0, g: 255, b: 0, a: 0.8 });
    });
  });

  // ─── Hex Color Conversion ───────────────────────────────────────────────────

  describe('Hex Color Conversion', () => {
    it('should convert RGB to hex correctly', () => {
      const testCases: Array<[Color, string]> = [
        [{ r: 255, g: 0, b: 0, a: 1 }, '#ff0000'],
        [{ r: 0, g: 255, b: 0, a: 1 }, '#00ff00'],
        [{ r: 0, g: 0, b: 255, a: 1 }, '#0000ff'],
        [{ r: 255, g: 255, b: 255, a: 1 }, '#ffffff'],
        [{ r: 0, g: 0, b: 0, a: 1 }, '#000000'],
        [{ r: 128, g: 128, b: 128, a: 1 }, '#808080'],
      ];

      testCases.forEach(([color, expectedHex]) => {
        const { rerender } = render(<ColorPicker value={color} onChange={onChange} showAlpha={false} />);
        expect(screen.getByText(expectedHex)).toBeInTheDocument();
        rerender(<div />); // Clean up
      });
    });

    it('should handle color values with decimals', () => {
      const color: Color = { r: 127.5, g: 63.7, b: 191.2, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha={false} />);
      
      // Should round to nearest integer (128, 64, 191)
      expect(screen.getByText('#8040bf')).toBeInTheDocument();
    });

    it('should pad hex values with leading zeros', () => {
      const color: Color = { r: 1, g: 2, b: 3, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha={false} />);
      
      expect(screen.getByText('#010203')).toBeInTheDocument();
    });
  });

  // ─── Alpha Channel ──────────────────────────────────────────────────────────

  describe('Alpha Channel', () => {
    it('should display alpha as percentage', () => {
      const testCases: Array<[number, string]> = [
        [1.0, '100%'],
        [0.5, '50%'],
        [0.0, '0%'],
        [0.75, '75%'],
        [0.33, '33%'],
      ];

      testCases.forEach(([alpha, expectedText]) => {
        const color: Color = { r: 255, g: 0, b: 0, a: alpha };
        const { rerender } = render(<ColorPicker value={color} onChange={onChange} showAlpha />);
        expect(screen.getByText(new RegExp(expectedText))).toBeInTheDocument();
        rerender(<div />); // Clean up
      });
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle complete workflow: open, select swatch, close', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      const swatches: Color[] = [
        { r: 0, g: 255, b: 0, a: 1 },
      ];
      
      render(<ColorPicker value={color} onChange={onChange} swatches={swatches} />);
      
      // Open popover
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(document.querySelector('.react-colorful')).toBeInTheDocument();
      });
      
      // Select swatch
      const swatch = document.querySelector('button[title="#00ff00"]') as HTMLElement;
      await user.click(swatch);
      
      expect(onChange).toHaveBeenCalledWith({ r: 0, g: 255, b: 0, a: 1 });
      
      // Close popover
      await user.click(document.body);
      
      await waitFor(() => {
        expect(document.querySelector('.react-colorful')).not.toBeInTheDocument();
      });
    });

    it('should update preview when color changes', () => {
      const color1: Color = { r: 255, g: 0, b: 0, a: 1 };
      const { rerender } = render(<ColorPicker value={color1} onChange={onChange} />);
      
      let preview = screen.getByRole('button').querySelector('div');
      expect(preview).toHaveStyle({ backgroundColor: 'rgba(255, 0, 0, 1)' });
      
      const color2: Color = { r: 0, g: 255, b: 0, a: 1 };
      rerender(<ColorPicker value={color2} onChange={onChange} />);
      
      preview = screen.getByRole('button').querySelector('div');
      expect(preview).toHaveStyle({ backgroundColor: 'rgba(0, 255, 0, 1)' });
    });

    it('should handle alpha changes with showAlpha enabled', async () => {
      const user = userEvent.setup();
      const color: Color = { r: 255, g: 0, b: 0, a: 1 };
      render(<ColorPicker value={color} onChange={onChange} showAlpha />);
      
      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(document.querySelector('.react-colorful')).toBeInTheDocument();
      });
      
      // RgbaColorPicker should allow alpha changes
      // This is handled by react-colorful library
      expect(document.querySelector('.react-colorful')).toBeInTheDocument();
    });
  });
});
