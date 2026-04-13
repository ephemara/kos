import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BrushConfig } from './types';
import { Button } from '../primitives/Button';
import './ConfigEditor.css';

interface BrushEditorProps {
  onChange?: () => void;
}

export const BrushEditor: React.FC<BrushEditorProps> = ({ onChange }) => {
  const [brushes, setBrushes] = useState<BrushConfig[]>([]);
  const [selectedBrush, setSelectedBrush] = useState<BrushConfig | null>(null);
  const [editMode, setEditMode] = useState<'list' | 'edit' | 'create'>('list');
  const [formData, setFormData] = useState<Partial<BrushConfig>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadBrushes();
  }, []);

  const loadBrushes = async () => {
    try {
      const data = await invoke<BrushConfig[]>('list_config_brushes');
      setBrushes(data);
      setError('');
    } catch (err) {
      setError(`Failed to load brushes: ${err}`);
    }
  };

  const handleEdit = async (id: string) => {
    try {
      const brush = await invoke<BrushConfig | null>('get_config_brush', { id });
      if (brush) {
        setSelectedBrush(brush);
        setFormData(brush);
        setEditMode('edit');
        setError('');
      }
    } catch (err) {
      setError(`Failed to load brush: ${err}`);
    }
  };

  const handleCreate = () => {
    setFormData({
      id: '',
      name: '',
      category: 'sculpt',
      defaultSize: 50,
      defaultStrength: 0.5,
      supportsPressure: true,
      icon: 'brush',
    });
    setEditMode('create');
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete brush "${id}"?`)) return;
    
    try {
      // Filter out the deleted brush
      const updatedBrushes = brushes.filter(b => b.id !== id);
      setBrushes(updatedBrushes);
      await invoke('save_user_config');
      setSuccess('Brush deleted successfully');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete brush: ${err}`);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.id || !formData.name) {
      setError('ID and Name are required');
      return false;
    }
    if (editMode === 'create' && brushes.some(b => b.id === formData.id)) {
      setError('Brush ID already exists');
      return false;
    }
    if (!formData.category || !['sculpt', 'paint', 'mask', 'smooth'].includes(formData.category)) {
      setError('Invalid category');
      return false;
    }
    if (typeof formData.defaultSize !== 'number' || formData.defaultSize <= 0) {
      setError('Default size must be a positive number');
      return false;
    }
    if (typeof formData.defaultStrength !== 'number' || formData.defaultStrength < 0 || formData.defaultStrength > 1) {
      setError('Default strength must be between 0 and 1');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const brush = formData as BrushConfig;
      let updatedBrushes: BrushConfig[];

      if (editMode === 'create') {
        updatedBrushes = [...brushes, brush];
      } else {
        updatedBrushes = brushes.map(b => b.id === brush.id ? brush : b);
      }

      setBrushes(updatedBrushes);
      await invoke('save_user_config');
      setSuccess('Brush saved successfully');
      setEditMode('list');
      setFormData({});
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to save brush: ${err}`);
    }
  };

  const handleCancel = () => {
    setEditMode('list');
    setFormData({});
    setError('');
  };

  const filteredBrushes = categoryFilter === 'all' 
    ? brushes 
    : brushes.filter(b => b.category === categoryFilter);

  if (editMode === 'edit' || editMode === 'create') {
    return (
      <div className="config-editor">
        <div className="config-editor-header">
          <h3>{editMode === 'create' ? 'Create Brush' : 'Edit Brush'}</h3>
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
            <label>Category *</label>
            <select
              value={formData.category || 'sculpt'}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
              className="config-input"
            >
              <option value="sculpt">Sculpt</option>
              <option value="paint">Paint</option>
              <option value="mask">Mask</option>
              <option value="smooth">Smooth</option>
            </select>
          </div>

          <div className="config-form-group">
            <label>Default Size *</label>
            <input
              type="number"
              value={formData.defaultSize || 50}
              onChange={(e) => setFormData({ ...formData, defaultSize: parseFloat(e.target.value) })}
              className="config-input"
              min="1"
            />
          </div>

          <div className="config-form-group">
            <label>Default Strength *</label>
            <input
              type="number"
              value={formData.defaultStrength || 0.5}
              onChange={(e) => setFormData({ ...formData, defaultStrength: parseFloat(e.target.value) })}
              className="config-input"
              min="0"
              max="1"
              step="0.1"
            />
          </div>

          <div className="config-form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.supportsPressure ?? true}
                onChange={(e) => setFormData({ ...formData, supportsPressure: e.target.checked })}
              />
              Supports Pressure
            </label>
          </div>

          <div className="config-form-group">
            <label>GPU Shader (optional)</label>
            <input
              type="text"
              value={formData.gpuShader || ''}
              onChange={(e) => setFormData({ ...formData, gpuShader: e.target.value })}
              className="config-input"
              placeholder="shader_name"
            />
          </div>

          <div className="config-form-group">
            <label>Icon *</label>
            <input
              type="text"
              value={formData.icon || ''}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="config-input"
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
        <h3>Brush Configurations</h3>
        <Button onClick={handleCreate}>Create New</Button>
      </div>

      {error && <div className="config-error">{error}</div>}
      {success && <div className="config-success">{success}</div>}

      <div className="config-filter">
        <label>Filter by Category:</label>
        <select 
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="config-input"
        >
          <option value="all">All</option>
          <option value="sculpt">Sculpt</option>
          <option value="paint">Paint</option>
          <option value="mask">Mask</option>
          <option value="smooth">Smooth</option>
        </select>
      </div>

      <div className="config-list">
        {filteredBrushes.map((brush) => (
          <div key={brush.id} className="config-list-item">
            <div className="config-list-item-info">
              <strong>{brush.name}</strong>
              <span className="config-list-item-meta">
                {brush.id} • {brush.category} • Size: {brush.defaultSize} • Strength: {brush.defaultStrength}
              </span>
            </div>
            <div className="config-list-item-actions">
              <Button onClick={() => handleEdit(brush.id)} variant="secondary" size="small">
                Edit
              </Button>
              <Button onClick={() => handleDelete(brush.id)} variant="danger" size="small">
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
