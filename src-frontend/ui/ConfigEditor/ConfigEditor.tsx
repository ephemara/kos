/**
 * Configuration Editor Component
 * 
 * Provides a UI for editing brushes, export formats, viewport presets, and other configurations.
 * Supports JSON validation with error highlighting.
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { Button } from '../primitives/Button';
import { BrushEditor } from './BrushEditor';
import { ExportFormatEditor } from './ExportFormatEditor';
import { ViewportPresetEditor } from './ViewportPresetEditor';
import { GreeblePatternEditor } from './GreeblePatternEditor';
import { ShadingModeEditor } from './ShadingModeEditor';
import { ConfigImportExport } from './ConfigImportExport';
import './ConfigEditor.css';

export interface ConfigEditorProps {
  onClose?: () => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('brushes');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      await invoke('save_user_config');
      setHasUnsavedChanges(false);
      console.log('[ConfigEditor] Configuration saved successfully');
    } catch (error) {
      console.error('[ConfigEditor] Failed to save configuration:', error);
      setSaveError(error as string);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReload = async () => {
    try {
      await invoke('reload_config', { projectDir: null });
      setHasUnsavedChanges(false);
      console.log('[ConfigEditor] Configuration reloaded');
    } catch (error) {
      console.error('[ConfigEditor] Failed to reload configuration:', error);
    }
  };

  const handleChange = () => {
    setHasUnsavedChanges(true);
  };

  return (
    <div className="config-editor">
      <div className="config-editor-header">
        <h2>Configuration Editor</h2>
        <div className="config-editor-actions">
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">Unsaved changes</span>
          )}
          <Button
            onClick={handleReload}
            variant="ghost"
            disabled={isSaving}
          >
            Reload
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="ghost">
              Close
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="config-editor-error">
          <strong>Error saving configuration:</strong> {saveError}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="config-editor-tabs">
        <TabsList className="config-editor-tabs-list">
          <TabsTrigger value="brushes">Brushes</TabsTrigger>
          <TabsTrigger value="export-formats">Export Formats</TabsTrigger>
          <TabsTrigger value="viewport-presets">Viewport Presets</TabsTrigger>
          <TabsTrigger value="greeble-patterns">Greeble Patterns</TabsTrigger>
          <TabsTrigger value="shading-modes">Shading Modes</TabsTrigger>
          <TabsTrigger value="import-export">Import/Export</TabsTrigger>
        </TabsList>

        <TabsContent value="brushes" className="config-editor-tab-content">
          <BrushEditor onChange={handleChange} />
        </TabsContent>

        <TabsContent value="export-formats" className="config-editor-tab-content">
          <ExportFormatEditor onChange={handleChange} />
        </TabsContent>

        <TabsContent value="viewport-presets" className="config-editor-tab-content">
          <ViewportPresetEditor onChange={handleChange} />
        </TabsContent>

        <TabsContent value="greeble-patterns" className="config-editor-tab-content">
          <GreeblePatternEditor onChange={handleChange} />
        </TabsContent>

        <TabsContent value="shading-modes" className="config-editor-tab-content">
          <ShadingModeEditor onChange={handleChange} />
        </TabsContent>

        <TabsContent value="import-export" className="config-editor-tab-content">
          <ConfigImportExport />
        </TabsContent>
      </Tabs>
    </div>
  );
};
// @ts-nocheck
