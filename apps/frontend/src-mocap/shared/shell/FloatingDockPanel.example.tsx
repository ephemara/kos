/**
 * FloatingDockPanel Example Usage
 * 
 * This file demonstrates how to use the FloatingDockPanel component
 * with various configurations and features.
 */

import React, { useState } from 'react';
import { FloatingDockPanel } from './FloatingDockPanel';
import { Button } from '@mocap/shared/primitives/Button';

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

export const BasicFloatingPanelExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>
        Open Floating Panel
      </Button>

      {isOpen && (
        <FloatingDockPanel
          title="Basic Panel"
          onClose={() => setIsOpen(false)}
        >
          <div className="space-y-4">
            <h4 className="text-sm font-bold">Panel Content</h4>
            <p className="text-xs text-[color:var(--kos-text-secondary)]">
              This is a basic floating panel. You can:
            </p>
            <ul className="text-xs text-[color:var(--kos-text-secondary)] space-y-2 list-disc list-inside">
              <li>Drag the panel by the header</li>
              <li>Resize from any edge or corner</li>
              <li>Drag near screen edges to dock</li>
              <li>Maximize/minimize with the button</li>
              <li>Close with the X button</li>
            </ul>
          </div>
        </FloatingDockPanel>
      )}
    </div>
  );
};

// ============================================================================
// Example 2: Custom Size and Position
// ============================================================================

export const CustomSizePositionExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>
        Open Custom Panel
      </Button>

      {isOpen && (
        <FloatingDockPanel
          title="Custom Panel"
          defaultPosition={{ x: 200, y: 150 }}
          defaultSize={{ width: 600, height: 400 }}
          minSize={{ width: 300, height: 200 }}
          maxSize={{ width: 1200, height: 800 }}
          onClose={() => setIsOpen(false)}
          storageKey="custom-panel-state"
        >
          <div className="space-y-4">
            <h4 className="text-sm font-bold">Custom Configuration</h4>
            <p className="text-xs text-[color:var(--kos-text-secondary)]">
              This panel has custom:
            </p>
            <ul className="text-xs text-[color:var(--kos-text-secondary)] space-y-2 list-disc list-inside">
              <li>Initial position (200, 150)</li>
              <li>Initial size (600x400)</li>
              <li>Min size (300x200)</li>
              <li>Max size (1200x800)</li>
              <li>Persistent state with custom storage key</li>
            </ul>
          </div>
        </FloatingDockPanel>
      )}
    </div>
  );
};

// ============================================================================
// Example 3: Multiple Panels
// ============================================================================

export const MultiplePanelsExample: React.FC = () => {
  const [panels, setPanels] = useState<{ id: string; title: string }[]>([]);

  const addPanel = () => {
    const id = `panel-${Date.now()}`;
    setPanels(prev => [...prev, { id, title: `Panel ${panels.length + 1}` }]);
  };

  const removePanel = (id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div>
      <Button onClick={addPanel}>
        Add Panel
      </Button>

      {panels.map((panel, index) => (
        <FloatingDockPanel
          key={panel.id}
          title={panel.title}
          defaultPosition={{ 
            x: 100 + (index * 30), 
            y: 100 + (index * 30) 
          }}
          onClose={() => removePanel(panel.id)}
          storageKey={`panel-${panel.id}`}
        >
          <div className="space-y-4">
            <h4 className="text-sm font-bold">{panel.title}</h4>
            <p className="text-xs text-[color:var(--kos-text-secondary)]">
              This is panel #{index + 1}. You can have multiple panels open at once.
            </p>
          </div>
        </FloatingDockPanel>
      ))}
    </div>
  );
};

// ============================================================================
// Example 4: Rich Content Panel
// ============================================================================

export const RichContentPanelExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>
        Open Rich Content Panel
      </Button>

      {isOpen && (
        <FloatingDockPanel
          title="Rich Content Panel"
          defaultSize={{ width: 500, height: 600 }}
          onClose={() => setIsOpen(false)}
          storageKey="rich-content-panel"
        >
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-bold mb-2">Interactive Content</h4>
              <div className="flex items-center gap-4">
                <Button onClick={() => setCount(count - 1)}>-</Button>
                <span className="text-lg font-bold">{count}</span>
                <Button onClick={() => setCount(count + 1)}>+</Button>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-bold mb-2">Form Elements</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter text..."
                  className="w-full px-3 py-2 bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded text-sm"
                />
                <textarea
                  placeholder="Enter description..."
                  rows={4}
                  className="w-full px-3 py-2 bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded text-sm resize-none"
                />
              </div>
            </section>

            <section>
              <h4 className="text-sm font-bold mb-2">List Content</h4>
              <div className="space-y-2">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="p-3 bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded"
                  >
                    <div className="text-xs font-bold">Item {i + 1}</div>
                    <div className="text-[10px] text-[color:var(--kos-text-muted)]">
                      This is item content
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </FloatingDockPanel>
      )}
    </div>
  );
};

// ============================================================================
// Example 5: Settings Panel
// ============================================================================

export const SettingsPanelExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    theme: 'dark',
    notifications: true,
    autoSave: true,
    quality: 'high',
  });

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>
        Open Settings
      </Button>

      {isOpen && (
        <FloatingDockPanel
          title="Settings"
          defaultSize={{ width: 450, height: 500 }}
          onClose={() => setIsOpen(false)}
          storageKey="settings-panel"
        >
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-bold mb-3">Appearance</h4>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-xs">Theme</span>
                  <select
                    value={settings.theme}
                    onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                    className="px-2 py-1 bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded text-xs"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-bold mb-3">Preferences</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-xs">Enable Notifications</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                    className="w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-xs">Auto Save</span>
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
                    className="w-4 h-4"
                  />
                </label>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-bold mb-3">Performance</h4>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-xs">Quality</span>
                  <select
                    value={settings.quality}
                    onChange={(e) => setSettings({ ...settings, quality: e.target.value })}
                    className="px-2 py-1 bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="ultra">Ultra</option>
                  </select>
                </label>
              </div>
            </section>

            <div className="flex gap-2 pt-4 border-t border-[color:var(--kos-border-primary)]">
              <Button onClick={() => setIsOpen(false)} className="flex-1">
                Save
              </Button>
              <Button variant="ghost" onClick={() => setIsOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </FloatingDockPanel>
      )}
    </div>
  );
};

// ============================================================================
// All Examples Combined
// ============================================================================

export const FloatingDockPanelExamples: React.FC = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">FloatingDockPanel Examples</h2>
        <p className="text-sm text-[color:var(--kos-text-secondary)] mb-8">
          Click the buttons below to see different FloatingDockPanel configurations.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold mb-2">Basic Usage</h3>
          <BasicFloatingPanelExample />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-2">Custom Size & Position</h3>
          <CustomSizePositionExample />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-2">Multiple Panels</h3>
          <MultiplePanelsExample />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-2">Rich Content</h3>
          <RichContentPanelExample />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-2">Settings Panel</h3>
          <SettingsPanelExample />
        </div>
      </div>

      <div className="mt-12 p-6 bg-[color:var(--kos-surface-secondary)] border border-[color:var(--kos-border-primary)] rounded">
        <h3 className="text-lg font-bold mb-4">Features</h3>
        <ul className="space-y-2 text-sm text-[color:var(--kos-text-secondary)]">
          <li>✅ Fully resizable from all edges and corners</li>
          <li>✅ Draggable with smooth motion</li>
          <li>✅ Magnetic docking to screen edges (left, right, top, bottom)</li>
          <li>✅ Visual dock zone indicators</li>
          <li>✅ Maximize/minimize functionality</li>
          <li>✅ Persistent state with localStorage</li>
          <li>✅ Viewport constraints (stays within bounds)</li>
          <li>✅ Min/max size constraints</li>
          <li>✅ Smooth animations with framer-motion</li>
          <li>✅ Glassmorphism design with accent glow when docked</li>
        </ul>
      </div>
    </div>
  );
};
