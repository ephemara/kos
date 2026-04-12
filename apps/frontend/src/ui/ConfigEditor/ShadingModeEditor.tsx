import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShadingModeConfig } from './types';
import { Button } from '../primitives/Button';
import './ConfigEditor.css';

interface ShadingModeEditorProps {
  onChange?: () => void;
}

export const ShadingModeEditor: React.FC<ShadingModeEditorProps> = ({ onChange }) => {
  const [modes, setModes] = useState<ShadingModeConfig[]>([]);
  const [editMode, setEditMode] = useState<'list' | 'edit' | 'create'>('list');
  const [formData, setFormData] = useState<Partial<ShadingModeConfig>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [appFilter, setAppFilter] = useState<string>('all');

  useEffect(() => {
    loadModes();
  }, []);

  const loadModes = async () => {
    try {
      const data = await invoke<ShadingModeConfig[]>('list_config_shading_modes');
      setModes(data);
      setError('');
    } catch (err) {
      setError(`Failed to load shading modes: ${err}`);
    }
  };

  const handleEdit = (mode: ShadingModeConfig) => {
    setFormData(mode);
    setEditMode('edit');
    setError('');
  };

  const handleCreate = () => {
    setFormData({
      id: '',
      name: '',
      app: 'ksculpt',
      modeIndex: 0,
      icon: '',
      description: '',
    });
    setEditMode('create');
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete shading mode "${id}"?`)) return;
    
    try {
      const updatedModes = modes.filter(m => m.id !== id);
      setModes(updatedModes);
      await invoke('save_user_config');
      setSuccess('Shading mode deleted successfully');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete shading mode: ${err}`);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.id || !formData.name) {
      setError('ID and Name are required');
      return false;
    }
    if (editMode === 'create' && modes.some(m => m.id === formData.id)) {
      setError('Shading mode ID already exists');
      return false;
    }
    if (!formData.app) {
      setError('App is required');
      return false;
    }
    if (typeof formData.modeIndex !== 'number' || formData.modeIndex < 0) {
      setError('Mode index must be a non-negative number');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const mode = formData as ShadingModeConfig;
      let updatedModes: ShadingModeConfig[];

      if (editMode === 'create') {
        updatedModes = [...modes, mode];
      } else {
        updatedModes = modes.map(m => m.id === mode.id ? mode : m);
      }

      setModes(updatedModes);
      await invoke('save_user_config');
      setSuccess('Shading mode saved successfully');
      setEditMode('list');
      setFormData({});
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to save shading mode: ${err}`);
    }
  };

  const handleCancel = () => {
    setEditMode('list');
    setFormData({});
    setError('');
  };

  const filteredModes = appFilter === 'all' 
    ? modes 
    : modes.filter(m => m.app === appFilter);

  const uniqueApps = Array.from(new Set(modes.map(m => m.app)));

  if (editMode === 'edit' || editMode === 'create') {
    return (
      <div className="config-editor">
        <div className="config-editor-header">
          <h3>{editMode === 'create' ? 'Create Shading Mode' : 'Edit Shading Mode'}</h3>
          <Button onClick={handleCancel} variant="secondary">Cancel</Button>
        </div>

        {error && <div className="config-error">{error}</div>}
        {success && <div className="config-success">{success}</div>}

        <div className="config-form">
          <div className="config-form-group">
            <label>ID *</label>
            <input
              type="text"
              value={formData.id || ''}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={editMode === 'edit'}
              className="config-input"
            />
          </div>

          <div className="config-form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="config-input"
            />
          </div>

          <div className="config-form-group">
            <label>App *</label>
            <input
              type="text"
              value={formData.app || ''}
              onChange={(e) => setFormData({ ...formData, app: e.target.value })}
              className="config-input"
              placeholder="ksculpt, kpainter, etc."
            />
          </div>

          <div className="config-form-group">
            <label>Mode Index *</label>
            <input
              type="number"
              value={formData.modeIndex ?? 0}
              onChange={(e) => setFormData({ ...formData, modeIndex: parseInt(e.target.value) })}
              className="config-input"
              min="0"
            />
            <small>Numeric index for the shading mode (used for ordering)</small>
          </div>

          <div className="config-form-group">
            <label>Icon (optional)</label>
            <input
              type="text"
              value={formData.icon || ''}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="config-input"
              placeholder="icon-name"
            />
          </div>

          <div className="config-form-group">
            <label>Description (optional)</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="config-textarea"
              rows={3}
              placeholder="Brief description of this shading mode"
            />
          </div>

          <div className="config-form-actions">
            <Button onClick={handleSave}>Save</Button>
            <Button onClick={handleCancel} variant="secondary">Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="config-editor">
      <div className="config-editor-header">
        <h3>Shading Mode Configurations</h3>
        <Button onClick={handleCreate}>Create New</Button>
      </div>

      {error && <div className="config-error">{error}</div>}
      {success && <div className="config-success">{success}</div>}

      <div className="config-filter">
        <label>Filter by App:</label>
        <select 
          value={appFilter} 
          onChange={(e) => setAppFilter(e.target.value)}
          className="config-input"
        >
          <option value="all">All</option>
          {uniqueApps.map(app => (
            <option key={app} value={app}>{app}</option>
          ))}
        </select>
      </div>

      <div className="config-list">
        {filteredModes.map((mode) => (
          <div key={mode.id} className="config-list-item">
            <div className="config-list-item-info">
              <strong>{mode.name}</strong>
              <span className="config-list-item-meta">
                {mode.id} • {mode.app} • Index: {mode.modeIndex}
                {mode.description && ` • ${mode.description}`}
              </span>
            </div>
            <div className="config-list-item-actions">
              <Button onClick={() => handleEdit(mode)} variant="secondary" size="small">
                Edit
              </Button>
              <Button onClick={() => handleDelete(mode.id)} variant="danger" size="small">
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
// @ts-nocheck
