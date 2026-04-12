import React from 'react';
import { motion } from 'framer-motion';

interface WebcamStatusProps {
  status: 'connecting' | 'live' | 'error';
  fps: number;
  resolution: { width: number; height: number };
}

export const WebcamStatus: React.FC<WebcamStatusProps> = ({
  status,
  fps,
  resolution,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connecting':
        return {
          label: 'CONNECTING',
          color: '#fbbf24',
          bgColor: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
        };
      case 'live':
        return {
          label: 'LIVE',
          color: '#00ffcc',
          bgColor: 'bg-[#00ffcc]/20',
          textColor: 'text-[#00ffcc]',
        };
      case 'error':
        return {
          label: 'ERROR',
          color: '#ef4444',
          bgColor: 'bg-red-500/20',
          textColor: 'text-red-400',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-3">
      {/* Status Badge */}
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded ${config.bgColor}`}
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
          animate={{
            opacity: status === 'connecting' ? [1, 0.3, 1] : 1,
            scale: status === 'live' ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: status === 'connecting' ? 1.5 : 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <span className={`text-xs font-semibold ${config.textColor}`}>
          {config.label}
        </span>
      </div>

      {/* FPS Counter */}
      {status === 'live' && fps > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded">
          <span className="text-xs text-gray-400">FPS:</span>
          <span
            className={`text-xs font-semibold ${
              fps >= 30
                ? 'text-[#00ffcc]'
                : fps >= 20
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}
          >
            {fps}
          </span>
        </div>
      )}

      {/* Resolution */}
      {status === 'live' && resolution.width > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded">
          <span className="text-xs text-gray-400">
            {resolution.width}×{resolution.height}
          </span>
        </div>
      )}
    </div>
  );
};
