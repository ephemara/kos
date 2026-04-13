/**
 * Expression Presets for Procedural Animation
 * 
 * Common procedural animation expressions that can be applied to material parameters.
 * Each preset includes a name, description, and the expression string.
 * 
 * Requirements: 6.12
 */

export interface ExpressionPreset {
  name: string;
  description: string;
  expression: string;
  category: 'Wave' | 'Noise' | 'UV' | 'Pulse' | 'Complex';
}

export const EXPRESSION_PRESETS: ExpressionPreset[] = [
  // Wave Presets
  {
    name: 'Sine Wave',
    description: 'Smooth oscillation between 0 and 1',
    expression: 'sin(t * 2.0) * 0.5 + 0.5',
    category: 'Wave',
  },
  {
    name: 'Cosine Wave',
    description: 'Smooth oscillation (phase shifted)',
    expression: 'cos(t * 2.0) * 0.5 + 0.5',
    category: 'Wave',
  },
  {
    name: 'Fast Sine Wave',
    description: 'Rapid oscillation',
    expression: 'sin(t * 6.28) * 0.5 + 0.5',
    category: 'Wave',
  },
  {
    name: 'Slow Wave',
    description: 'Gentle, slow oscillation',
    expression: 'sin(t * 0.5) * 0.5 + 0.5',
    category: 'Wave',
  },

  // Pulse Presets
  {
    name: 'Pulsing Emissive',
    description: 'Rhythmic pulsing effect',
    expression: 'abs(sin(t * 3.14)) * 0.8 + 0.2',
    category: 'Pulse',
  },
  {
    name: 'Breathing Effect',
    description: 'Slow in-out breathing pattern',
    expression: 'sin(t * 1.0) * 0.3 + 0.7',
    category: 'Pulse',
  },
  {
    name: 'Heartbeat',
    description: 'Double-pulse heartbeat pattern',
    expression: 'abs(sin(t * 8.0)) * abs(sin(t * 4.0)) * 0.5 + 0.5',
    category: 'Pulse',
  },

  // Noise Presets
  {
    name: 'Perlin Noise',
    description: 'Smooth organic variation',
    expression: 'perlin(t, 1.0, 0.5)',
    category: 'Noise',
  },
  {
    name: 'Simplex Noise',
    description: 'Smooth gradient noise',
    expression: 'simplex(t, 1.0, 0.5)',
    category: 'Noise',
  },
  {
    name: 'Worley Noise',
    description: 'Cellular/voronoi pattern',
    expression: 'worley(t, 1.0, 0.5)',
    category: 'Noise',
  },
  {
    name: 'Fractal Noise (FBM)',
    description: 'Multi-octave fractal noise',
    expression: 'fbm(t, 1.0, 0.5, 4, 2.0, 0.5)',
    category: 'Noise',
  },
  {
    name: 'Turbulent Noise',
    description: 'Chaotic turbulence effect',
    expression: 'abs(perlin(t, 2.0, 1.0)) * abs(simplex(t * 1.5, 1.0, 0.8))',
    category: 'Noise',
  },

  // UV Scrolling Presets
  {
    name: 'UV Scroll Right',
    description: 'Constant rightward scrolling',
    expression: 't * 0.5',
    category: 'UV',
  },
  {
    name: 'UV Scroll Left',
    description: 'Constant leftward scrolling',
    expression: 't * -0.5',
    category: 'UV',
  },
  {
    name: 'UV Scroll Up',
    description: 'Constant upward scrolling',
    expression: 't * 0.3',
    category: 'UV',
  },
  {
    name: 'UV Scroll Down',
    description: 'Constant downward scrolling',
    expression: 't * -0.3',
    category: 'UV',
  },
  {
    name: 'Flowing Water',
    description: 'Water-like flowing motion',
    expression: 't * 0.2 + sin(t * 2.0) * 0.05',
    category: 'UV',
  },

  // Complex Presets
  {
    name: 'Flickering Fire',
    description: 'Chaotic flickering flame effect',
    expression: 'abs(sin(t * 10.0)) * perlin(t * 5.0, 2.0, 0.3) * 0.7 + 0.3',
    category: 'Complex',
  },
  {
    name: 'Wind Sway',
    description: 'Gentle swaying motion',
    expression: 'sin(t * 0.8) * 0.3 + sin(t * 1.3) * 0.2',
    category: 'Complex',
  },
  {
    name: 'Electric Pulse',
    description: 'Sharp electric pulses',
    expression: 'pow(abs(sin(t * 4.0)), 8.0)',
    category: 'Complex',
  },
  {
    name: 'Shimmer',
    description: 'Subtle shimmering effect',
    expression: 'sin(t * 3.0) * 0.1 + perlin(t * 2.0, 1.0, 0.05) + 0.85',
    category: 'Complex',
  },
  {
    name: 'Glitch',
    description: 'Random glitchy jumps',
    expression: 'abs(sin(t * 20.0)) > 0.9 ? 1.0 : 0.0',
    category: 'Complex',
  },
  {
    name: 'Fade In',
    description: 'Gradual fade from 0 to 1',
    expression: 'clamp(t * 0.2, 0.0, 1.0)',
    category: 'Complex',
  },
  {
    name: 'Fade Out',
    description: 'Gradual fade from 1 to 0',
    expression: 'clamp(1.0 - t * 0.2, 0.0, 1.0)',
    category: 'Complex',
  },
  {
    name: 'Bounce',
    description: 'Bouncing ball physics',
    expression: 'abs(sin(t * 3.14)) * pow(0.8, t)',
    category: 'Complex',
  },
];

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: ExpressionPreset['category']): ExpressionPreset[] {
  return EXPRESSION_PRESETS.filter(preset => preset.category === category);
}

/**
 * Get all preset categories
 */
export function getPresetCategories(): ExpressionPreset['category'][] {
  return ['Wave', 'Noise', 'UV', 'Pulse', 'Complex'];
}

/**
 * Find preset by name
 */
export function findPresetByName(name: string): ExpressionPreset | undefined {
  return EXPRESSION_PRESETS.find(preset => preset.name === name);
}
