/**
 * Keyboard Shortcuts System
 * 
 * Data-driven keyboard shortcut configuration.
 * Supports modifier keys (Ctrl, Shift, Alt, Meta) and key combinations.
 */

export interface KeyboardShortcut {
  /** Unique identifier for the shortcut */
  id: string;
  
  /** Human-readable label */
  label: string;
  
  /** Description of what the shortcut does */
  description: string;
  
  /** The key to press (e.g., 'b', 'Enter', 'ArrowUp') */
  key: string;
  
  /** Modifier keys */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  
  /** Category for organization */
  category?: string;
  
  /** Whether the shortcut is enabled */
  enabled?: boolean;
  
  /** Action to execute when shortcut is triggered */
  action: () => void;
}

export interface ShortcutConfig {
  /** Application or feature identifier */
  appId: string;
  
  /** List of shortcuts */
  shortcuts: KeyboardShortcut[];
  
  /** Whether shortcuts are globally enabled */
  enabled?: boolean;
}

/**
 * Normalize key for comparison
 */
function normalizeKey(key: string): string {
  return key.toLowerCase();
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (!shortcut.enabled && shortcut.enabled !== undefined) {
    return false;
  }

  const keyMatches = normalizeKey(event.key) === normalizeKey(shortcut.key);
  const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
  const shiftMatches = !!shortcut.shift === event.shiftKey;
  const altMatches = !!shortcut.alt === event.altKey;

  return keyMatches && ctrlMatches && shiftMatches && altMatches;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.meta) parts.push('Meta');
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join('+');
}

/**
 * Create a keyboard shortcut handler
 */
export function createShortcutHandler(config: ShortcutConfig) {
  return (event: KeyboardEvent) => {
    if (!config.enabled && config.enabled !== undefined) {
      return;
    }

    for (const shortcut of config.shortcuts) {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        return;
      }
    }
  };
}

/**
 * Hook for using keyboard shortcuts
 */
import { useEffect } from 'react';

export function useKeyboardShortcuts(config: ShortcutConfig) {
  useEffect(() => {
    const handler = createShortcutHandler(config);
    
    window.addEventListener('keydown', handler);
    
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [config]);
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(shortcuts: KeyboardShortcut[]): Map<string, KeyboardShortcut[]> {
  const groups = new Map<string, KeyboardShortcut[]>();
  
  for (const shortcut of shortcuts) {
    const category = shortcut.category || 'General';
    const group = groups.get(category) || [];
    group.push(shortcut);
    groups.set(category, group);
  }
  
  return groups;
}
