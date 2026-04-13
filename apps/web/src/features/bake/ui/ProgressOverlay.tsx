/**
 * ProgressOverlay - Baking progress indicator
 * 
 * Displays progress bar and current map type during batch baking operations
 */

import React from 'react';
import type { MapType } from '../engine/bakeEngine';

interface ProgressOverlayProps {
  visible: boolean;
  currentMap: MapType | null;
  current: number;
  total: number;
}

const MAP_TYPE_LABELS: Record<MapType, string> = {
  normal: 'Normal Map',
  ao: 'Ambient Occlusion',
  curvature: 'Curvature Map',
  thickness: 'Thickness Map',
  position: 'Position Map',
  id: 'Material ID Map'
};

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  visible,
  currentMap,
  current,
  total
}) => {
  if (!visible) return null;

  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      pointerEvents: 'all'
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '2px solid #4488ff',
        borderRadius: '12px',
        padding: '32px',
        minWidth: '400px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid #4488ff',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite'
          }} />
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              Baking in Progress
            </h3>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: '#888'
            }}>
              {current} of {total} maps completed
            </p>
          </div>
        </div>

        {/* Current Map */}
        {currentMap && (
          <div style={{
            padding: '12px',
            background: '#2a2a2a',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#888',
              marginBottom: '4px'
            }}>
              Currently baking:
            </div>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#4488ff'
            }}>
              {MAP_TYPE_LABELS[currentMap]}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: '#2a2a2a',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #4488ff, #44ffff)',
            transition: 'width 0.3s ease',
            borderRadius: '4px'
          }} />
        </div>

        {/* Progress Percentage */}
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#4488ff'
        }}>
          {progress.toFixed(0)}%
        </div>

        {/* Info */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#2a2a2a',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#666',
          textAlign: 'center'
        }}>
          GPU ray tracing in progress. This may take a few moments...
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
