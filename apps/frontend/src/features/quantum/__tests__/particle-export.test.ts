/**
 * Unit tests for KQuantum particle export validation and error handling
 * Tests Requirements 4.8, 4.12, 14.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

const createObjectURLMock = vi.fn(() => 'blob:test');
const revokeObjectURLMock = vi.fn();

// Setup global mocks
beforeEach(() => {
    vi.clearAllMocks();
    // Keep jsdom's URL constructor intact; only override blob URL helpers.
    Object.defineProperty(URL, 'createObjectURL', {
        value: createObjectURLMock,
        writable: true,
        configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        value: revokeObjectURLMock,
        writable: true,
        configurable: true,
    });
});

describe('KQuantum Particle Export Validation', () => {
    describe('Particle Count Validation', () => {
        it('should reject export of empty particle system', async () => {
            // Mock empty particle system
            vi.mocked(invoke).mockResolvedValueOnce(0); // particle count = 0

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.isValid).toBe(false);
            expect(validation.particleCount).toBe(0);
            expect(validation.errors).toContain(
                'Cannot export empty particle system. Please run the simulation to generate particles.'
            );
        });

        it('should accept export with 1 particle', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(1);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.isValid).toBe(true);
            expect(validation.particleCount).toBe(1);
            expect(validation.errors).toHaveLength(0);
        });

        it('should accept export with 1000 particles', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(1000);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.isValid).toBe(true);
            expect(validation.particleCount).toBe(1000);
            expect(validation.errors).toHaveLength(0);
        });

        it('should warn about large particle count (>100k)', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(150000);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.isValid).toBe(true);
            expect(validation.particleCount).toBe(150000);
            expect(validation.warnings.length).toBeGreaterThan(0);
            expect(validation.warnings[0]).toContain('150,000 particles');
            expect(validation.warnings[0]).toContain('may take a while');
        });

        it('should warn about very large particle count (>500k)', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(600000);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.isValid).toBe(true);
            expect(validation.particleCount).toBe(600000);
            expect(validation.warnings.length).toBeGreaterThanOrEqual(2);
            expect(validation.warnings.some(w => w.includes('reducing particle count'))).toBe(true);
        });
    });

    describe('Parameter Validation', () => {
        it('should reject invalid particle radius (negative)', async () => {
            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, -0.5, 1)).rejects.toThrow(
                'Invalid particle radius: -0.5'
            );
        });

        it('should reject invalid particle radius (zero)', async () => {
            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 0, 1)).rejects.toThrow(
                'Invalid particle radius: 0'
            );
        });

        it('should reject invalid particle radius (too large)', async () => {
            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 150, 1)).rejects.toThrow(
                'Invalid particle radius: 150'
            );
        });

        it('should accept valid particle radius (0.5)', async () => {
            vi.mocked(invoke).mockResolvedValueOnce([]);

            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 0.5, 1)).resolves.toBeDefined();
        });

        it('should accept valid particle radius (100)', async () => {
            vi.mocked(invoke).mockResolvedValueOnce([]);

            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 100, 1)).resolves.toBeDefined();
        });

        it('should reject invalid subdivision level (negative)', async () => {
            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 0.5, -1)).rejects.toThrow(
                'Invalid subdivision level: -1'
            );
        });

        it('should reject invalid subdivision level (too high)', async () => {
            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 0.5, 10)).rejects.toThrow(
                'Invalid subdivision level: 10'
            );
        });

        it('should accept valid subdivision level (0)', async () => {
            vi.mocked(invoke).mockResolvedValueOnce([]);

            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 0.5, 0)).resolves.toBeDefined();
        });

        it('should accept valid subdivision level (5)', async () => {
            vi.mocked(invoke).mockResolvedValueOnce([]);

            const { exportParticlesGLTF } = await import('@/services/quantumClient');

            await expect(exportParticlesGLTF(1, 0.5, 5)).resolves.toBeDefined();
        });
    });

    describe('Error Message Clarity', () => {
        it('should provide clear error for simulation not found', async () => {
            vi.mocked(invoke).mockRejectedValueOnce(
                'Simulation not found. Please ensure the simulation is running before exporting.'
            );

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(999);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toContain('Validation failed');
        });

        it('should provide actionable error message for empty system', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(0);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.errors[0]).toContain('run the simulation');
            expect(validation.errors[0]).toContain('generate particles');
        });

        it('should include particle count in warning messages', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(250000);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.warnings[0]).toContain('250,000');
        });

        it('should estimate file size in warning for large exports', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(150000);

            const { quantumExportClient } = await import('@/services/quantumClient');
            const validation = await quantumExportClient.validateExport(1);

            expect(validation.warnings[0]).toMatch(/\d+\+ MB/);
        });
    });

    describe('Progress Indication', () => {
        it('should call progress callback during JSON export', async () => {
            vi.mocked(invoke)
                .mockResolvedValueOnce(1000) // particle count
                .mockResolvedValueOnce('{"particles":[]}'); // JSON data

            const { quantumExportClient } = await import('@/services/quantumClient');
            const progressCallback = vi.fn();

            await quantumExportClient.exportJSONToFile(1, 'test.json', progressCallback);

            expect(progressCallback).toHaveBeenCalled();
            expect(progressCallback.mock.calls.length).toBeGreaterThan(1);
            expect(progressCallback).toHaveBeenCalledWith(0, expect.stringContaining('Validating'));
            expect(progressCallback).toHaveBeenCalledWith(100, expect.stringContaining('complete'));
        });

        it('should report progress at multiple stages', async () => {
            vi.mocked(invoke)
                .mockResolvedValueOnce(5000)
                .mockResolvedValueOnce('{"particles":[]}');

            const { quantumExportClient } = await import('@/services/quantumClient');
            const progressCallback = vi.fn();

            await quantumExportClient.exportJSONToFile(1, 'test.json', progressCallback);

            const progressValues = progressCallback.mock.calls.map(call => call[0]);
            expect(progressValues).toContain(0); // Start
            expect(progressValues).toContain(100); // Complete
            expect(Math.max(...progressValues)).toBe(100);
            expect(Math.min(...progressValues)).toBe(0);
        });

        it('should include particle count in progress messages', async () => {
            vi.mocked(invoke)
                .mockResolvedValueOnce(12345)
                .mockResolvedValueOnce('{"particles":[]}');

            const { quantumExportClient } = await import('@/services/quantumClient');
            const progressCallback = vi.fn();

            await quantumExportClient.exportJSONToFile(1, 'test.json', progressCallback);

            const messages = progressCallback.mock.calls.map(call => call[1]);
            expect(messages.some(msg => msg.includes('12,345'))).toBe(true);
        });
    });

    describe('Export Workflow Integration', () => {
        it('should validate before attempting export', async () => {
            vi.mocked(invoke).mockResolvedValueOnce(0); // Empty system

            const { quantumExportClient } = await import('@/services/quantumClient');

            await expect(
                quantumExportClient.exportJSONToFile(1, 'test.json')
            ).rejects.toThrow('Export validation failed');

            // Should not attempt to create download link
            expect(createObjectURLMock).not.toHaveBeenCalled();
        });

        it('should proceed with export after successful validation', async () => {
            vi.mocked(invoke)
                .mockResolvedValueOnce(100) // Valid particle count
                .mockResolvedValueOnce('{"particles":[]}'); // JSON data

            const { quantumExportClient } = await import('@/services/quantumClient');

            await quantumExportClient.exportJSONToFile(1, 'test.json');

            expect(createObjectURLMock).toHaveBeenCalled();
        });
    });
});
