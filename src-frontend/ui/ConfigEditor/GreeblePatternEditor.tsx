import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GreeblePatternConfig } from './types';
import { Button } from '../primitives/Button';
import './ConfigEditor.css';

interface GreeblePatternEditorProps {
  onChange?: () => void;
}

export const GreeblePatternEditor: React.FC<GreeblePatternEditorProps> = ({ onChange }) => {
  const [patterns, setPatterns] = useState<GreeblePatternConfig[]>([]);
  const [editMode, setEditMode] = useState<'list' | 'edit' | 'create'>('list');
  const [formData, setFormData] = useState<Partial<GreeblePatternConfig>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [primitivesJson, setPrimitivesJson] = useState<string>('');

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      // Note: Assuming there's a command for this, or we load from a config file
      // For now, we'll use a placeholder
      setPatterns([]);
      setError('');
    } catch (err) {
      setError(`Failed to load greeble patterns: ${err}`);
    }
  };

  const handleEdit = (pattern: GreeblePatternConfig) => {
    setFormData(pattern);
    setPrimitivesJson(JSON.stringify(pattern.primitives, null, 2));
    setEditMode('edit');
    setError('');
  };

  const handleCreate = () => {
    setFormData({
      id: '',
      name: '',
      category: 'mechanical',
      primitives: [],
    });
    setPrimitivesJson('[]');
    setEditMode('create');
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete greeble pattern "${id}"?`)) return;
    
    try {
      const updatedPatterns = patterns.filter(p => p.id !== id);
      setPatterns(updatedPatterns);
      await invoke('save_user_config');
      setSuccess('Greeble pattern deleted successfully');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete greeble pattern: ${err}`);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.id || !formData.name) {
      setError('ID and Name are required');
      return false;
    }
    if (editMode === 'create' && patterns.some(p => p.id === formData.id)) {
      setError('Greeble pattern ID already exists');
      return false;
    }
    if (!formData.category) {
      setError('Category is required');
      return false;
    }

    try {
      const primitives = JSON.parse(primitivesJson);
      if (!Array.isArray(primitives)) {
        setError('Primitives must be a JSON array');
        return false;
      }
      // Validate each primitive
      for (const prim of primitives) {
        if (!prim.type || !['box', 'cylinder', 'sphere', 'cone'].includes(prim.type)) {
          setError('Each primitive must have a valid type (box, cylinder, sphere, cone)');
          return false;
        }
        if (!Array.isArray(prim.scale) || prim.scale.length !== 3) {
          setError('Each primitive must have a scale array with 3 numbers');
          return false;
        }
        if (typeof prim.probability !== 'number' || prim.probability < 0 || prim.probability > 1) {
          setError('Each primitive must have a probability between 0 and 1');
          return false;
        }
      }
    } catch (err) {
      setError(`Invalid JSON for primitives: ${err}`);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const primitives = JSON.parse(primitivesJson);
      const pattern: GreeblePatternConfig = {
        ...formData as GreeblePatternConfig,
        primitives,
      };

      let updatedPatterns: GreeblePatternConfig[];
      if (editMode === 'create') {
        updatedPatterns = [...patterns, pattern];
      } else {
        updatedPatterns = patterns.map(p => p.id === pattern.id ? pattern : p);
      }

      setPatterns(updatedPatterns);
      await invoke('save_user_config');
      setSuccess('Greeble pattern saved successfully');
      setEditMode('list');
      setFormData({});
      setPrimitivesJson('');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to save greeble pattern: ${err}`);
    }
  };

  const handleCancel = () => {
    setEditMode('list');
    setFormData({});
    setPrimitivesJson('');
    setError('');
  };

  if (editMode === 'edit' || editMode === 'create') {
    return (
      <div className="config-editor">
        <div className="config-editor-header">
          <h3>{editMode === 'create' ? 'Create Greeble Pattern' : 'Edit Greeble Pattern'}</h3>
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
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="config-input"
              placeholder="mechanical, organic, architectural, etc."
            />
          </div>

          <div className="config-form-group">
            <label>Primitives (JSON array) *</label>
            <textarea
              value={primitivesJson}
              onChange={(e) => {
                setPrimitivesJson(e.target.value);
                try {
                  JSON.parse(e.target.value);
                  setError('');
                } catch (err) {
                  setError('Invalid JSON syntax');
                }
              }}
              className="config-textarea"
              rows={15}
              placeholder={`[
  {
    "type": "box",
    "scale": [1.0, 1.0, 1.0],
    "probability": 0.5,
    "rotation": [0, 0, 0]
  }
]`}
            />
            <small>
              Each primitive must have: type (box/cylinder/sphere/cone), scale [x,y,z], probability (0-1).
              Optional: rotation [x,y,z]
            </small>
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
        <h3>Greeble Pattern Configurations</h3>
        <Button onClick={handleCreate}>Create New</Button>
      </div>

      {error && <div className="config-error">{error}</div>}
      {success && <div className="config-success">{success}</div>}

      <div className="config-list">
        {patterns.length === 0 ? (
          <div className="config-list-empty">
            No greeble patterns configured. Click "Create New" to add one.
          </div>
        ) : (
          patterns.map((pattern) => (
            <div key={pattern.id} className="config-list-item">
              <div className="config-list-item-info">
                <strong>{pattern.name}</strong>
                <span className="config-list-item-meta">
                  {pattern.id} • {pattern.category} • {pattern.primitives.length} primitives
                </span>
              </div>
              <div className="config-list-item-actions">
                <Button onClick={() => handleEdit(pattern)} variant="secondary" size="small">
                  Edit
                </Button>
                <Button onClick={() => handleDelete(pattern.id)} variant="danger" size="small">
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
// @ts-nocheck
