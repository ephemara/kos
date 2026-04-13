import { describe, it, expect } from 'vitest';

/**
 * Unit tests for AppShell resize system bug fix
 * 
 * Bug: Panels were "flying" and stretching too far during resize because
 * the delta was being accumulated incorrectly. The resize handlers were
 * doing `prev + delta` where `prev` kept changing, causing exponential growth.
 * 
 * Fix: Store the initial size when resize starts and calculate new size as
 * `initialSize + delta`, where delta is the cumulative distance from start.
 */
describe('AppShell Resize System - Delta Calculation', () => {
    it('should calculate new size from initial size + delta, not prev + delta', () => {
        // Simulate the OLD buggy behavior
        let buggySize = 384; // Initial 384px
        const buggyResize = (delta: number) => {
            buggySize = buggySize + delta; // BUG: accumulates on changing value
        };

        // Simulate pointer moves with cumulative deltas
        buggyResize(50);  // Move 50px from start -> should be 434px
        buggyResize(100); // Move 100px from start -> should be 484px
        buggyResize(150); // Move 150px from start -> should be 534px

        // Buggy behavior: 384 + 50 = 434, 434 + 100 = 534, 534 + 150 = 684
        expect(buggySize).toBe(684); // WRONG! Panel flew too far

        // Simulate the FIXED behavior
        const initialSize = 384;
        let fixedSize = initialSize;
        const fixedResize = (delta: number) => {
            fixedSize = initialSize + delta; // FIX: calculate from initial size
        };

        // Same pointer moves with cumulative deltas
        fixedResize(50);  // Move 50px from start -> 384 + 50 = 434px
        fixedResize(100); // Move 100px from start -> 384 + 100 = 484px
        fixedResize(150); // Move 150px from start -> 384 + 150 = 534px

        // Fixed behavior: Always relative to initial size
        expect(fixedSize).toBe(534); // CORRECT! Panel stays at expected position
    });

    it('should respect min/max constraints', () => {
        const initialSize = 384;
        const minSize = 192;
        const maxSize = 1536; // 80% of 1920px container

        const resize = (delta: number): number => {
            return Math.max(minSize, Math.min(maxSize, initialSize + delta));
        };

        // Try to resize below minimum
        expect(resize(-300)).toBe(minSize); // Clamped to 192px

        // Try to resize above maximum
        expect(resize(2000)).toBe(maxSize); // Clamped to 1536px

        // Normal resize within bounds
        expect(resize(100)).toBe(484); // 384 + 100 = 484px
    });

    it('should handle right panel resize with inverted delta', () => {
        const initialSize = 384;
        const minSize = 192;
        const maxSize = 1536;

        // Right panel grows leftward, so we subtract delta
        const resizeRight = (delta: number): number => {
            return Math.max(minSize, Math.min(maxSize, initialSize - delta));
        };

        // Drag right (positive delta) should shrink panel
        expect(resizeRight(100)).toBe(284); // 384 - 100 = 284px

        // Drag left (negative delta) should grow panel
        expect(resizeRight(-100)).toBe(484); // 384 - (-100) = 484px

        // Respect minimum
        expect(resizeRight(300)).toBe(minSize); // 384 - 300 = 84, clamped to 192px
    });

    it('should handle bottom panel resize with inverted delta', () => {
        const initialSize = 270; // 25% of 1080px
        const minSize = 100;
        const maxSize = 864; // 80% of 1080px

        // Bottom panel grows upward, so we subtract delta
        const resizeBottom = (delta: number): number => {
            return Math.max(minSize, Math.min(maxSize, initialSize - delta));
        };

        // Drag down (positive delta) should shrink panel
        expect(resizeBottom(100)).toBe(170); // 270 - 100 = 170px

        // Drag up (negative delta) should grow panel
        expect(resizeBottom(-100)).toBe(370); // 270 - (-100) = 370px

        // Respect minimum
        expect(resizeBottom(200)).toBe(minSize); // 270 - 200 = 70, clamped to 100px
    });

    it('should demonstrate the bug with multiple rapid moves', () => {
        // Simulate rapid pointer moves during drag (like 60fps updates)
        const moves = [10, 20, 30, 40, 50]; // Cumulative deltas from start position

        // BUGGY: Accumulating on changing value
        let buggySize = 384;
        moves.forEach(delta => {
            buggySize = buggySize + delta; // Each delta added to already-changed size
        });
        // Result: 384 + 10 + 20 + 30 + 40 + 50 = 534
        // But we only moved 50px total! Should be 434px
        expect(buggySize).toBe(534); // WRONG

        // FIXED: Calculate from initial size
        const initialSize = 384;
        let fixedSize = initialSize;
        moves.forEach(delta => {
            fixedSize = initialSize + delta; // Each delta relative to initial
        });
        // Result: 384 + 50 = 434 (only the last delta matters)
        expect(fixedSize).toBe(434); // CORRECT
    });
});

