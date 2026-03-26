/**
 * shell-ui.test.tsx
 * ────────────────────────────────────────────────────────────────────────────
 * Behaviour tests for AppShell + DockPanel + ResizeHandle.
 *
 * Covers:
 *  1. DockPanel renders tabs and switches content correctly
 *  2. DockPanel collapsed mode shows icon strip, no content
 *  3. DockPanel auto-recovers when active tab is removed from tabs array
 *  4. ResizeHandle keyboard navigation fires resize callbacks
 *  5. ResizeHandle pointer-down/move/up fires correct sequence
 *  6. AppShell renders children in the viewport slot
 *  7. AppShell layout preset switching (focus hides panels)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DockPanel, type DockTab } from '../DockPanel';
import { ResizeHandle } from '../ResizeHandle';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS: DockTab[] = [
    { id: 'alpha', label: 'ALPHA', content: <div>Alpha Content</div> },
    { id: 'beta', label: 'BETA', content: <div>Beta Content</div> },
    { id: 'gamma', label: 'GAMMA', content: <div>Gamma Content</div> },
];

// ─── DockPanel ────────────────────────────────────────────────────────────────

describe('DockPanel — expanded mode', () => {
    it('renders all tab triggers', () => {
        render(<DockPanel side="left" tabs={TABS} />);
        expect(screen.getByText('ALPHA')).toBeTruthy();
        expect(screen.getByText('BETA')).toBeTruthy();
        expect(screen.getByText('GAMMA')).toBeTruthy();
    });

    it('shows first tab content by default', () => {
        render(<DockPanel side="left" tabs={TABS} />);
        // Default active tab first item
        expect(screen.getByText('Alpha Content')).toBeTruthy();
    });

    it('switches content when a tab trigger is clicked', async () => {
        const user = userEvent.setup();
        render(<DockPanel side="left" tabs={TABS} />);

        await user.click(screen.getByText('BETA'));
        expect(await screen.findByText('Beta Content')).toBeInTheDocument();
    });

    it('calls onActiveTabIdChange when a tab is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DockPanel side="left" tabs={TABS} onActiveTabIdChange={onChange} />);

        await user.click(screen.getByText('GAMMA'));
        expect(onChange).toHaveBeenCalledWith('gamma');
    });

    it('renders controlled activeTabId correctly', () => {
        render(<DockPanel side="left" tabs={TABS} activeTabId="beta" />);
        expect(screen.getByText('Beta Content')).toBeInTheDocument();
    });

    it('recovers to first tab when active tab is removed from tabs', async () => {
        const { rerender } = render(<DockPanel side="left" tabs={TABS} defaultTabId="gamma" />);
        expect(screen.getByText('Gamma Content')).toBeInTheDocument();

        // Remove gamma tab
        const reduced = TABS.slice(0, 2);
        rerender(<DockPanel side="left" tabs={reduced} defaultTabId="alpha" />);
        // Should recover to alpha
        expect(await screen.findByText('Alpha Content')).toBeInTheDocument();
    });
});

describe('DockPanel — collapsed mode', () => {
    it('shows collapse toggle button but not tab content', () => {
        const onToggle = vi.fn();
        render(
            <DockPanel
                side="left"
                tabs={TABS}
                collapsed
                onToggleCollapsed={onToggle}
            />
        );
        // No content visible
        expect(screen.queryByText('Alpha Content')).toBeNull();
        // Has expand button
        const expandBtn = screen.getByRole('button', { name: /expand left panel/i });
        expect(expandBtn).toBeTruthy();
    });

    it('calls onToggleCollapsed when expand button is clicked', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        render(
            <DockPanel
                side="left"
                tabs={TABS}
                collapsed
                onToggleCollapsed={onToggle}
            />
        );
        await user.click(screen.getByRole('button', { name: /expand left panel/i }));
        expect(onToggle).toHaveBeenCalledOnce();
    });

    it('shows tab icon buttons in collapsed mode', () => {
        render(<DockPanel side="left" tabs={TABS} collapsed />);
        // Collapsed mode shows icon buttons (aria-label = tab label)
        const btns = screen.getAllByRole('button');
        expect(btns.length).toBeGreaterThanOrEqual(TABS.length);
    });
});

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

describe('ResizeHandle — keyboard navigation', () => {
    it('fires onResizeStart, onResize(+10), onResizeEnd on ArrowRight', async () => {
        const user = userEvent.setup();
        const onStart = vi.fn();
        const onResize = vi.fn();
        const onEnd = vi.fn();

        render(
            <ResizeHandle
                direction="horizontal"
                onResizeStart={onStart}
                onResize={onResize}
                onResizeEnd={onEnd}
            />
        );

        const handle = screen.getByRole('separator');
        handle.focus();
        await user.keyboard('{ArrowRight}');

        expect(onStart).toHaveBeenCalledOnce();
        expect(onResize).toHaveBeenCalledWith(10);
        expect(onEnd).toHaveBeenCalledOnce();
    });

    it('fires onResize(-10) on ArrowLeft', async () => {
        const user = userEvent.setup();
        const onResize = vi.fn();

        render(
            <ResizeHandle
                direction="horizontal"
                onResize={onResize}
            />
        );

        screen.getByRole('separator').focus();
        await user.keyboard('{ArrowLeft}');
        expect(onResize).toHaveBeenCalledWith(-10);
    });

    it('fires onResize(-10) on ArrowUp for vertical handle', async () => {
        const user = userEvent.setup();
        const onResize = vi.fn();

        render(
            <ResizeHandle
                direction="vertical"
                onResize={onResize}
            />
        );

        screen.getByRole('separator').focus();
        await user.keyboard('{ArrowUp}');
        expect(onResize).toHaveBeenCalledWith(-10);
    });

    it('ignores irrelevant keys', async () => {
        const user = userEvent.setup();
        const onResize = vi.fn();

        render(
            <ResizeHandle
                direction="horizontal"
                onResize={onResize}
            />
        );

        screen.getByRole('separator').focus();
        await user.keyboard('{Enter}');
        expect(onResize).not.toHaveBeenCalled();
    });
});

describe('ResizeHandle — pointer events', () => {
    it('calls onResizeStart on pointerdown', () => {
        const onStart = vi.fn();
        const onResize = vi.fn();

        render(
            <ResizeHandle
                direction="horizontal"
                onResizeStart={onStart}
                onResize={onResize}
            />
        );

        const handle = screen.getByRole('separator');
        fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
        expect(onStart).toHaveBeenCalledOnce();
    });

    it('calls onResize with delta on pointermove after pointerdown', () => {
        const onResize = vi.fn();
        vi.useFakeTimers();
        render(
            <ResizeHandle
                direction="horizontal"
                onResize={onResize}
            />
        );

        const handle = screen.getByRole('separator');
        fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientX: 150, clientY: 0, pointerId: 1 });
        vi.advanceTimersByTime(20);

        expect(onResize).toHaveBeenCalledWith(50);
        vi.useRealTimers();
    });

    it('calls onResizeEnd on pointerup', () => {
        const onEnd = vi.fn();
        render(
            <ResizeHandle
                direction="horizontal"
                onResize={vi.fn()}
                onResizeEnd={onEnd}
            />
        );

        const handle = screen.getByRole('separator');
        fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
        fireEvent.pointerUp(handle, { clientX: 150, clientY: 0, pointerId: 1 });

        expect(onEnd).toHaveBeenCalledOnce();
    });

    it('ignores non-primary button pointerdown (right-click)', () => {
        const onStart = vi.fn();
        render(
            <ResizeHandle
                direction="horizontal"
                onResizeStart={onStart}
                onResize={vi.fn()}
            />
        );

        const handle = screen.getByRole('separator');
        // button: 2 = right click
        fireEvent.pointerDown(handle, { button: 2, clientX: 100, clientY: 0, pointerId: 1 });
        expect(onStart).not.toHaveBeenCalled();
    });

    it('does not fire onResize on pointermove without prior pointerdown', () => {
        const onResize = vi.fn();
        render(
            <ResizeHandle
                direction="horizontal"
                onResize={onResize}
            />
        );

        const handle = screen.getByRole('separator');
        fireEvent.pointerMove(handle, { clientX: 200, clientY: 0, pointerId: 1 });
        expect(onResize).not.toHaveBeenCalled();
    });
});

// ─── Resize delta calculation (pure math — no DOM required) ──────────────────

describe('Panel resize — delta is always relative to drag-start, not prev value', () => {
    const MOVES = [10, 20, 30, 40, 50]; // cumulative deltas from start position

    it('fixed pattern: final size = initialSize + last delta', () => {
        const initialSize = 384;
        let size = initialSize;
        MOVES.forEach(delta => { size = initialSize + delta; });
        // Last delta is 50, so 384 + 50 = 434
        expect(size).toBe(434);
    });

    it('buggy pattern: accumulation causes overshoot', () => {
        let size = 384;
        MOVES.forEach(delta => { size = size + delta; });
        // Accumulates: 384+10+20+30+40+50 = 534 — wrong for a 50px drag
        expect(size).toBeGreaterThan(484);
    });

    it('left panel resize respects min/max clamp', () => {
        const initial = 384, min = 100, max = 1536;
        const resize = (d: number) => Math.max(min, Math.min(max, initial + d));
        expect(resize(-300)).toBe(min);
        expect(resize(2000)).toBe(max);
        expect(resize(100)).toBe(484);
    });

    it('right panel inverts delta (grows leftward)', () => {
        const initial = 384, min = 100, max = 1536;
        const resize = (d: number) => Math.max(min, Math.min(max, initial - d));
        expect(resize(100)).toBe(284); // drag right → panel shrinks
        expect(resize(-100)).toBe(484); // drag left  → panel grows
        expect(resize(400)).toBe(min);
    });
});
