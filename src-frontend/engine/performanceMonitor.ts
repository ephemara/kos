/**
 * Performance Monitoring System
 * 
 * Tracks FPS, frame time, memory usage, and render stats.
 * Emits warnings when performance thresholds are exceeded.
 */

export interface PerformanceStats {
  fps: number;
  frameTime: number; // ms
  memoryUsage: MemoryStats | null;
  renderStats: RenderStats;
}

export interface MemoryStats {
  usedJSHeapSize: number; // bytes
  totalJSHeapSize: number; // bytes
  jsHeapSizeLimit: number; // bytes
  usagePercent: number; // 0-100
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  vertices: number;
  textures: number;
  programs: number;
}

export type PerformanceWarningType = 'fps' | 'memory' | 'frame_time';

export interface PerformanceWarning {
  type: PerformanceWarningType;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

type PerformanceWarningCallback = (warning: PerformanceWarning) => void;
type PerformanceMetricsCallback = (metrics: {
  fps: number;
  frameTime: number;
  memory: { used: number; total: number; limit: number };
  renderStats: RenderStats;
}) => void;

/**
 * Performance Monitor
 * 
 * Continuously tracks performance metrics and emits warnings when thresholds are exceeded.
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private lastFrameTime = performance.now();
  private fps = 60;
  private frameTime = 16.67;
  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<PerformanceWarningCallback>();
  private metricListeners = new Set<PerformanceMetricsCallback>();
  private isRunning = false;

  // Thresholds
  private fpsThreshold = 30;
  private memoryThreshold = 0.8; // 80%
  private frameTimeThreshold = 16; // ms for 60 FPS

  // Warning cooldown to prevent spam
  private lastWarningTime = new Map<PerformanceWarningType, number>();
  private warningCooldown = 5000; // 5 seconds

  // Frame time history for smoothing
  private frameTimeHistory: number[] = [];
  private frameTimeHistorySize = 120; // 2 seconds at 60fps
  private customMetricHistory = new Map<string, number[]>();
  private customMetricHistorySize = 100;
  private hasRecordedFrame = false;

  constructor() {
    this.updateLoop = this.updateLoop.bind(this);
    this.start();
  }

  /**
   * Start monitoring performance
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;
      this.checkWarnings();
      this.emitMetrics();
    }, 1000);
  }

  /**
   * Stop monitoring performance
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Compatibility alias used by tests/older callers.
   */
  destroy(): void {
    this.stop();
    this.metricListeners.clear();
    this.listeners.clear();
  }

  /**
   * Subscribe to performance warnings
   */
  onPerformanceWarning(callback: PerformanceWarningCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to aggregated performance metrics.
   * Compatibility API used by older tests/tooling.
   */
  subscribe(callback: PerformanceMetricsCallback): () => void {
    this.metricListeners.add(callback);
    return () => {
      this.metricListeners.delete(callback);
    };
  }

  /**
   * Get current performance stats
   */
  getStats(): PerformanceStats {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      memoryUsage: this.getMemoryStats(),
      renderStats: this.getRenderStats(),
    };
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Get current frame time in ms
   */
  getFrameTime(): number {
    return this.frameTime;
  }

  /**
   * Compatibility API for externally recorded frames.
   */
  recordFrame(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (this.hasRecordedFrame) {
      this.frameTimeHistory.push(deltaTime);
      if (this.frameTimeHistory.length > this.frameTimeHistorySize) {
        this.frameTimeHistory.shift();
      }
    } else {
      this.hasRecordedFrame = true;
    }

    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    this.frameTime = this.frameTimeHistory.length > 0 ? sum / this.frameTimeHistory.length : 0;

    this.frameCount++;
    const elapsed = now - this.lastTime;
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = now;
      this.checkWarnings();
      this.emitMetrics();
    } else if (this.frameTime > 0) {
      this.fps = Math.round(1000 / this.frameTime);
    }
  }

  getFrameHistory(): number[] {
    return [...this.frameTimeHistory];
  }

  recordMetric(name: string, value: number): void {
    const history = this.customMetricHistory.get(name) ?? [];
    history.push(value);
    if (history.length > this.customMetricHistorySize) {
      history.shift();
    }
    this.customMetricHistory.set(name, history);
  }

  getAverageMetric(name: string): number {
    const history = this.customMetricHistory.get(name);
    if (!history || history.length === 0) return 0;
    return history.reduce((sum, value) => sum + value, 0) / history.length;
  }

  reset(): void {
    this.frameCount = 0;
    this.fps = 60;
    this.frameTime = 16.67;
    this.frameTimeHistory = [];
    this.customMetricHistory.clear();
    this.hasRecordedFrame = false;
    const now = performance.now();
    this.lastTime = now;
    this.lastFrameTime = now;
  }

  /**
   * Get memory usage stats
   */
  getMemoryStats(): MemoryStats | null {
    // @ts-ignore - performance.memory is non-standard but available in Chrome/Edge
    const memory = performance.memory;
    if (!memory) return null;

    const usedJSHeapSize = memory.usedJSHeapSize;
    const totalJSHeapSize = memory.totalJSHeapSize;
    const jsHeapSizeLimit = memory.jsHeapSizeLimit;
    const usagePercent = (usedJSHeapSize / jsHeapSizeLimit) * 100;

    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      usagePercent,
    };
  }

  /**
   * Get render stats (placeholder - should be set by renderer)
   */
  getRenderStats(): RenderStats {
    return {
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textures: 0,
      programs: 0,
    };
  }

  /**
   * Set FPS warning threshold
   */
  setFPSThreshold(threshold: number): void {
    this.fpsThreshold = threshold;
  }

  /**
   * Set memory warning threshold (0-1)
   */
  setMemoryThreshold(threshold: number): void {
    this.memoryThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Set frame time warning threshold in ms
   */
  setFrameTimeThreshold(threshold: number): void {
    this.frameTimeThreshold = threshold;
  }

  /**
   * Main update loop
   */
  private updateLoop(): void {
    if (!this.isRunning) return;
    this.recordFrame();
  }

  /**
   * Check for performance warnings
   */
  private checkWarnings(): void {
    const now = performance.now();

    // Check FPS
    if (this.fps < this.fpsThreshold) {
      this.emitWarning({
        type: 'fps',
        message: `FPS dropped below ${this.fpsThreshold}`,
        value: this.fps,
        threshold: this.fpsThreshold,
        timestamp: now,
      });
    }

    // Check frame time
    if (this.frameTime > this.frameTimeThreshold) {
      this.emitWarning({
        type: 'frame_time',
        message: `Frame time exceeded ${this.frameTimeThreshold}ms`,
        value: this.frameTime,
        threshold: this.frameTimeThreshold,
        timestamp: now,
      });
    }

    // Check memory
    const memoryStats = this.getMemoryStats();
    if (memoryStats && memoryStats.usagePercent > this.memoryThreshold * 100) {
      this.emitWarning({
        type: 'memory',
        message: `Memory usage exceeded ${this.memoryThreshold * 100}%`,
        value: memoryStats.usagePercent,
        threshold: this.memoryThreshold * 100,
        timestamp: now,
      });
    }
  }

  /**
   * Emit a performance warning
   */
  private emitWarning(warning: PerformanceWarning): void {
    // Check cooldown to prevent spam
    const lastWarning = this.lastWarningTime.get(warning.type);
    if (lastWarning && warning.timestamp - lastWarning < this.warningCooldown) {
      return;
    }

    this.lastWarningTime.set(warning.type, warning.timestamp);

    // Emit to all listeners
    for (const listener of this.listeners) {
      listener(warning);
    }
  }

  private emitMetrics(): void {
    if (this.metricListeners.size === 0) return;

    const memoryStats = this.getMemoryStats();
    const metrics = {
      fps: this.fps,
      frameTime: this.frameTime,
      memory: {
        used: memoryStats ? memoryStats.usedJSHeapSize / (1024 * 1024) : 0,
        total: memoryStats ? memoryStats.totalJSHeapSize / (1024 * 1024) : 0,
        limit: memoryStats ? memoryStats.jsHeapSizeLimit / (1024 * 1024) : 0,
      },
      renderStats: this.getRenderStats(),
    };

    for (const listener of this.metricListeners) {
      listener(metrics);
    }
  }
}

// Global singleton instance
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get the global performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
    globalMonitor.start();
  }
  return globalMonitor;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format milliseconds to human-readable string
 */
export function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(3)}ms`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  return `${ms.toFixed(1)}ms`;
}
