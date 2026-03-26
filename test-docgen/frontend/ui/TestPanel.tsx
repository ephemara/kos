import React from 'react';

interface TestPanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * TestPanel - Reusable UI panel component
 * Part of the K_OS UI component library for testing
 */
export const TestPanel: React.FC<TestPanelProps> = ({ 
  title, 
  children, 
  className = '' 
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
}

/**
 * MetricCard - Displays a single metric with optional trend indicator
 */
export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  unit = '', 
  trend = 'neutral' 
}) => {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→'
  };

  return (
    <div className="bg-gray-50 p-3 rounded">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
        <span className={`text-sm ${trendColors[trend]}`}>
          {trendIcons[trend]}
        </span>
      </div>
    </div>
  );
};

export default TestPanel;