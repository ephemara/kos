/**
 * React hook for 2D brush engine
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import Brush2DEngine from './Brush2DEngine';
import type { Paint2DBrushParams, BrushStrokePoint } from '@mocap/shared/systems/brush/BrushTypes';

/**
 * Hook for managing 2D brush engine
 */
export function useBrush2D(canvas?: HTMLCanvasElement) {
  const engineRef = useRef<Brush2DEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [params, setParams] = useState<Paint2DBrushParams | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new Brush2DEngine();
    engineRef.current = engine;

    if (canvas) {
      engine.init(canvas).then(() => {
        setIsReady(true);
        setParams(engine.getParams());
      });
    } else {
      engine.init().then(() => {
        setIsReady(true);
        setParams(engine.getParams());
      });
    }

    return () => {
      engine.dispose();
    };
  }, []);

  // Update canvas
  const setCanvas = useCallback((newCanvas: HTMLCanvasElement) => {
    if (engineRef.current) {
      engineRef.current.setCanvas(newCanvas);
      setIsReady(true);
    }
  }, []);

  // Update parameters
  const updateParams = useCallback((newParams: Partial<Paint2DBrushParams>) => {
    if (engineRef.current) {
      engineRef.current.setParams(newParams);
      setParams(engineRef.current.getParams());
    }
  }, []);

  // Start stroke
  const startStroke = useCallback((point: BrushStrokePoint) => {
    if (engineRef.current && params) {
      engineRef.current.startStroke(params, point);
    }
  }, [params]);

  // Continue stroke
  const continueStroke = useCallback((point: BrushStrokePoint) => {
    if (engineRef.current) {
      engineRef.current.continueStroke(point);
    }
  }, []);

  // End stroke
  const endStroke = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.endStroke();
    }
  }, []);

  // Clear canvas
  const clear = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.clear();
    }
  }, []);

  return {
    engine: engineRef.current,
    isReady,
    params,
    setCanvas,
    updateParams,
    startStroke,
    continueStroke,
    endStroke,
    clear,
  };
}

export default useBrush2D;
