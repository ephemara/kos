import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ViewportPresetConfig } from './types';
import { Button } from '../primitives/Button';
import './ConfigEditor.css';

interface ViewportPresetEditorProps {
  onChange?: () => void;
}

export const ViewportPresetEditor: React.FC<ViewportPresetEditorProps> = ({ onChange }) => {
  const [presets, setPresets] = useState<ViewportPresetConfig[]>([]);
  const [editMode, setEditMode] = useState<'list' | 'edit' | 'create'>('list');
  const [formData, setFormData] = useState<Partial<ViewportPresetConfig>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const data = await invoke<ViewportPresetConfig[]>('list_config_viewport_presets');
      setPresets(data);
      setError('');
    } catch (err) {
      setError(`Failed to load viewport presets: ${err}`);
    }
  };

  const handleEdit = (preset: ViewportPresetConfig) => {
    setFormData(preset);
    setEditMode('edit');
    setError('');
  };

  const handleCreate = () => {
    setFormData({
      id: '',
      name: '',
      gridSize: 10,
      gridDivisions: 10,
      cameraDistance: 5,
      cameraFov: 75,
      lighting: {
        ambientIntensity: 0.3,
        directionalIntensity: 0.7,
        directionalDirection: [1, 1, 1],
        shadowsEnabled: true,
      },
    });
    setEditMode('create');
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete viewport preset "${id}"?`)) return;
    
    try {
      const updatedPresets = presets.filter(p => p.id !== id);
      setPresets(updatedPresets);
      await invoke('save_user_config');
      setSuccess('Viewport preset deleted successfully');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete viewport preset: ${err}`);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.id || !formData.name) {
      setError('ID and Name are required');
      return false;
    }
    if (editMode === 'create' && presets.some(p => p.id === formData.id)) {
      setError('Viewport preset ID already exists');
      return false;
    }
    if (typeof formData.gridSize !== 'number' || formData.gridSize <= 0) {
      setError('Grid size must be a positive number');
      return false;
    }
    if (typeof formData.gridDivisions !== 'number' || formData.gridDivisions <= 0) {
      setError('Grid divisions must be a positive number');
      return false;
    }
    if (typeof formData.cameraDistance !== 'number' || formData.cameraDistance <= 0) {
      setError('Camera distance must be a positive number');
      return false;
    }
    if (typeof formData.cameraFov !== 'number' || formData.cameraFov <= 0 || formData.cameraFov >= 180) {
      setError('Camera FOV must be between 0 and 180');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const preset = formData as ViewportPresetConfig;
      let updatedPresets: ViewportPresetConfig[];

      if (editMode === 'create') {
        updatedPresets = [...presets, preset];
      } else {
        updatedPresets = presets.map(p => p.id === preset.id ? preset : p);
      }

      setPresets(updatedPresets);
      await invoke('save_user_config');
      setSuccess('Viewport preset saved successfully');
      setEditMode('list');
      setFormData({});
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to save viewport preset: ${err}`);
    }
  };

  const handleCancel = () => {
    setEditMode('list');
    setFormData({});
    setError('');
  };

  const updateLighting = (field: string, value: any) => {
    setFormData({
      ...formData,
      lighting: {
        ...formData.lighting!,
        [field]: value,
      },
    });
  };

  const updateDirectionalDirection = (index: number, value: number) => {
    const direction = [...(formData.lighting?.directionalDirection || [1, 1, 1])];
    direction[index] = value;
    updateLighting('directionalDirection', direction);
  };

  if (editMode === 'edit' || editMode === 'create') {
    return (
      <div className="config-editor">
        <div className="config-editor-header">
          <h3>{editMode === 'create' ? 'Create Viewport Preset' : 'Edit Viewport Preset'}</h3>
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
            <label>Grid Size *</label>
            <input
              type="number"
              value={formData.gridSize || 10}
              onChange={(e) => setFormData({ ...formData, gridSize: parseFloat(e.target.value) })}
              className="config-input"
              min="0.1"
              step="0.1"
            />
          </div>

          <div className="config-form-group">
            <label>Grid Divisions *</label>
            <input
              type="number"
              value={formData.gridDivisions || 10}
              onChange={(e) => setFormData({ ...formData, gridDivisions: parseInt(e.target.value) })}
              className="config-input"
              min="1"
            />
          </div>

          <div className="config-form-group">
            <label>Camera Distance *</label>
            <input
              type="number"
              value={formData.cameraDistance || 5}
              onChange={(e) => setFormData({ ...formData, cameraDistance: parseFloat(e.target.value) })}
              className="config-input"
              min="0.1"
              step="0.1"
            />
          </div>

          <div className="config-form-group">
            <label>Camera FOV *</label>
            <input
              type="number"
              value={formData.cameraFov || 75}
              onChange={(e) => setFormData({ ...formData, cameraFov: parseFloat(e.target.value) })}
              className="config-input"
              min="1"
              max="179"
            />
          </div>

          <h4>Lighting Configuration</h4>

          <div className="config-form-group">
            <label>Ambient Intensity</label>
            <input
              type="number"
              value={formData.lighting?.ambientIntensity || 0.3}
              onChange={(e) => updateLighting('ambientIntensity', parseFloat(e.target.value))}
              className="config-input"
              min="0"
              max="1"
              step="0.1"
            />
          </div>

          <div className="config-form-group">
            <label>Directional Intensity</label>
            <input
              type="number"
              value={formData.lighting?.directionalIntensity || 0.7}
              onChange={(e) => updateLighting('directionalIntensity', parseFloat(e.target.value))}
              className="config-input"
              min="0"
              max="1"
              step="0.1"
            />
          </div>

          <div className="config-form-group">
            <label>Directional Direction (X, Y, Z)</label>
            <div className="config-input-group">
              <input
                type="number"
                value={formData.lighting?.directionalDirection?.[0] || 1}
                onChange={(e) => updateDirectionalDirection(0, parseFloat(e.target.value))}
                className="config-input"
                step="0.1"
              />
              <input
                type="number"
                value={formData.lighting?.directionalDirection?.[1] || 1}
                onChange={(e) => updateDirectionalDirection(1, parseFloat(e.target.value))}
                className="config-input"
                step="0.1"
              />
              <input
                type="number"
                value={formData.lighting?.directionalDirection?.[2] || 1}
                onChange={(e) => updateDirectionalDirection(2, parseFloat(e.target.value))}
                className="config-input"
                step="0.1"
              />
            </div>
          </div>

          <div className="config-form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.lighting?.shadowsEnabled ?? true}
                onChange={(e) => updateLighting('shadowsEnabled', e.target.checked)}
              />
              Shadows Enabled
            </label>
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
        <h3>Viewport Preset Configurations</h3>
        <Button onClick={handleCreate}>Create New</Button>
      </div>

      {error && <div className="config-error">{error}</div>}
      {success && <div className="config-success">{success}</div>}

      <div className="config-list">
        {presets.map((preset) => (
          <div key={preset.id} className="config-list-item">
            <div className="config-list-item-info">
              <strong>{preset.name}</strong>
              <span className="config-list-item-meta">
                {preset.id} • Grid: {preset.gridSize}×{preset.gridDivisions} • 
                Camera: {preset.cameraDistance}u, FOV {preset.cameraFov}°
              </span>
            </div>
            <div className="config-list-item-actions">
              <Button onClick={() => handleEdit(preset)} variant="secondary" size="small">
                Edit
              </Button>
              <Button onClick={() => handleDelete(preset.id)} variant="danger" size="small">
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
