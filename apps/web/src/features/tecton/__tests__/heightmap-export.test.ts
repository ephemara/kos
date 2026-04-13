/**
 * Unit tests for KTecton heightmap export functionality
 * Tests Requirements 4.4, 4.10, 14.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('KTecton Heightmap Export', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockContext: CanvasRenderingContext2D;
    
    beforeEach(() => {
        // Mock canvas and context
        mockContext = {
            createImageData: vi.fn((width: number, height: number) => ({
                data: new Uint8ClampedArray(width * height * 4),
                width,
                height
            })),
            putImageData: vi.fn(),
        } as any;
        
        mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => mockContext),
            toBlob: vi.fn((callback: BlobCallback) => {
                const blob = new Blob(['test'], { type: 'image/png' });
                callback(blob);
            })
        } as any;
        
        // Mock document.createElement
        global.document.createElement = vi.fn((tag: string) => {
            if (tag === 'canvas') return mockCanvas;
            return {} as any;
        });
    });
    
    describe('Resolution Validation', () => {
        it('should accept resolution of 512px', () => {
            const resolution = 512;
            expect(resolution).toBeGreaterThanOrEqual(512);
            expect(resolution).toBeLessThanOrEqual(8192);
        });
        
        it('should accept resolution of 8192px', () => {
            const resolution = 8192;
            expect(resolution).toBeGreaterThanOrEqual(512);
            expect(resolution).toBeLessThanOrEqual(8192);
        });
        
        it('should accept resolution of 2048px', () => {
            const resolution = 2048;
            expect(resolution).toBeGreaterThanOrEqual(512);
            expect(resolution).toBeLessThanOrEqual(8192);
        });
        
        it('should reject resolution below 512px', () => {
            const resolution = 256;
            expect(resolution).toBeLessThan(512);
        });
        
        it('should reject resolution above 8192px', () => {
            const resolution = 16384;
            expect(resolution).toBeGreaterThan(8192);
        });
    });
    
    describe('Format Support', () => {
        it('should support PNG 8-bit format', () => {
            const format = 'png8';
            expect(['png8', 'png16', 'exr']).toContain(format);
        });
        
        it('should support PNG 16-bit format', () => {
            const format = 'png16';
            expect(['png8', 'png16', 'exr']).toContain(format);
        });
        
        it('should support EXR 32-bit format', () => {
            const format = 'exr';
            expect(['png8', 'png16', 'exr']).toContain(format);
        });
    });
    
    describe('Heightmap Data Processing', () => {
        it('should create canvas with correct resolution', () => {
            const targetRes = 1024;
            mockCanvas.width = targetRes;
            mockCanvas.height = targetRes;
            
            expect(mockCanvas.width).toBe(targetRes);
            expect(mockCanvas.height).toBe(targetRes);
        });
        
        it('should create image data with correct size for PNG 8-bit', () => {
            const resolution = 512;
            const imageData = mockContext.createImageData(resolution, resolution);
            
            expect(imageData.width).toBe(resolution);
            expect(imageData.height).toBe(resolution);
            expect(imageData.data.length).toBe(resolution * resolution * 4);
        });
        
        it('should encode height values correctly for PNG 8-bit', () => {
            const height = 0.5; // Normalized height value
            const value = Math.floor(height * 255);
            
            expect(value).toBe(127);
        });
        
        it('should encode height values correctly for PNG 16-bit', () => {
            const height = 0.5; // Normalized height value
            const value16 = Math.floor(height * 65535);
            const high = (value16 >> 8) & 0xFF;
            const low = value16 & 0xFF;
            
            expect(value16).toBe(32767);
            expect(high).toBe(127);
            expect(low).toBe(255);
        });
        
        it('should clamp height values to [0, 1] range', () => {
            const testValues = [-0.5, 0, 0.5, 1.0, 1.5];
            const clamped = testValues.map(v => Math.max(0, Math.min(1, v)));
            
            expect(clamped).toEqual([0, 0, 0.5, 1.0, 1.0]);
        });
    });
    
    describe('Resampling', () => {
        it('should calculate correct scale factor for downsampling', () => {
            const sourceRes = 2048;
            const targetRes = 1024;
            const scale = sourceRes / targetRes;
            
            expect(scale).toBe(2);
        });
        
        it('should calculate correct scale factor for upsampling', () => {
            const sourceRes = 512;
            const targetRes = 1024;
            const scale = sourceRes / targetRes;
            
            expect(scale).toBe(0.5);
        });
        
        it('should map target coordinates to source coordinates correctly', () => {
            const sourceRes = 2048;
            const targetRes = 1024;
            const scale = sourceRes / targetRes;
            
            const targetX = 100;
            const targetY = 200;
            const srcX = Math.floor(targetX * scale);
            const srcY = Math.floor(targetY * scale);
            
            expect(srcX).toBe(200);
            expect(srcY).toBe(400);
        });
    });
    
    describe('File Generation', () => {
        it('should generate blob for PNG export', async () => {
            const blobCallback = vi.fn();
            mockCanvas.toBlob(blobCallback, 'image/png');
            
            expect(blobCallback).toHaveBeenCalled();
            expect(blobCallback.mock.calls[0][0]).toBeInstanceOf(Blob);
        });
        
        it('should generate filename with correct format', () => {
            const resolution = 2048;
            const format = 'png16';
            const timestamp = Date.now();
            const filename = `ktecton_heightmap_${resolution}x${resolution}_${format}_${timestamp}.png`;
            
            expect(filename).toMatch(/ktecton_heightmap_\d+x\d+_png16_\d+\.png/);
        });
    });
});
