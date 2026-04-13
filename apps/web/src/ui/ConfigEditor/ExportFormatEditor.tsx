import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExportFormatConfig } from './types';
import { Button } from '../primitives/Button';
import './ConfigEditor.css';

interface ExportFormatEditorProps {
  onChange?: () => void;
}

export const ExportFormatEditor: React.FC<ExportFormatEditorProps> = ({ onChange }) => {
  const [formats, setFormats] = useState<ExportFormatConfig[]>([]);
  const [editMode, setEditMode] = useState<'list' | 'edit' | 'create'>('list');
  const [formData, setFormData] = useState<Partial<ExportFormatConfig>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [extensionsInput, setExtensionsInput] = useState<string>('');

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    try {
      const data = await invoke<ExportFormatConfig[]>('list_config_export_formats');
      setFormats(data);
      setError('');
    } catch (err) {
      setError(`Failed to load export formats: ${err}`);
    }
  };

  const handleEdit = (format: ExportFormatConfig) => {
    setFormData(format);
    setExtensionsInput(format.extensions.join(', '));
    setEditMode('edit');
    setError('');
  };

  const handleCreate = () => {
    setFormData({
      id: '',
      name: '',
      extensions: [],
      supportsMeshes: true,
      supportsTextures: false,
      supportsMaterials: false,
      options: [],
    });
    setExtensionsInput('');
    setEditMode('create');
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete export format "${id}"?`)) return;
    
    try {
      const updatedFormats = formats.filter(f => f.id !== id);
      setFormats(updatedFormats);
      await invoke('save_user_config');
      setSuccess('Export format deleted successfully');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete export format: ${err}`);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.id || !formData.name) {
      setError('ID and Name are required');
      return false;
    }
    if (editMode === 'create' && formats.some(f => f.id === formData.id)) {
      setError('Export format ID already exists');
      return false;
    }
    const extensions = extensionsInput.split(',').map(e => e.trim()).filter(e => e);
    if (extensions.length === 0) {
      setError('At least one file extension is required');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const extensions = extensionsInput.split(',').map(e => e.trim()).filter(e => e);
      const format: ExportFormatConfig = {
        ...formData as ExportFormatConfig,
        extensions,
      };

      let updatedFormats: ExportFormatConfig[];
      if (editMode === 'create') {
        updatedFormats = [...formats, format];
      } else {
        updatedFormats = formats.map(f => f.id === format.id ? format : f);
      }

      setFormats(updatedFormats);
      await invoke('save_user_config');
      setSuccess('Export format saved successfully');
      setEditMode('list');
      setFormData({});
      setExtensionsInput('');
      onChange?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to save export format: ${err}`);
    }
  };

  const handleCancel = () => {
    setEditMode('list');
    setFormData({});
    setExtensionsInput('');
    setError('');
  };

  if (editMode === 'edit' || editMode === 'create') {
    return (
      <div className="config-editor">
        <div className="config-editor-header">
          <h3>{editMode === 'create' ? 'Create Export Format' : 'Edit Export Format'}</h3>
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
            <label>File Extensions * (comma-separated)</label>
            <input
              type="text"
              value={extensionsInput}
              onChange={(e) => setExtensionsInput(e.target.value)}
              className="config-input"
              placeholder="obj, fbx, gltf"
            />
            <small>Enter extensions without dots, separated by commas</small>
          </div>

          <div className="config-form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.supportsMeshes ?? true}
                onChange={(e) => setFormData({ ...formData, supportsMeshes: e.target.checked })}
              />
              Supports Meshes
            </label>
          </div>

          <div className="config-form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.supportsTextures ?? false}
                onChange={(e) => setFormData({ ...formData, supportsTextures: e.target.checked })}
              />
              Supports Textures
            </label>
          </div>

          <div className="config-form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.supportsMaterials ?? false}
                onChange={(e) => setFormData({ ...formData, supportsMaterials: e.target.checked })}
              />
              Supports Materials
            </label>
          </div>

          <div className="config-form-group">
            <label>Options (JSON array)</label>
            <textarea
              value={JSON.stringify(formData.options || [], null, 2)}
              onChange={(e) => {
                try {
                  const options = JSON.parse(e.target.value);
                  setFormData({ ...formData, options });
                  setError('');
                } catch (err) {
                  setError('Invalid JSON for options');
                }
              }}
              className="config-textarea"
              rows={8}
              placeholder='[{"id": "option1", "label": "Option 1", "type": "bool", "default": true}]'
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
        <h3>Export Format Configurations</h3>
        <Button onClick={handleCreate}>Create New</Button>
      </div>

      {error && <div className="config-error">{error}</div>}
      {success && <div className="config-success">{success}</div>}

      <div className="config-list">
        {formats.map((format) => (
          <div key={format.id} className="config-list-item">
            <div className="config-list-item-info">
              <strong>{format.name}</strong>
              <span className="config-list-item-meta">
                {format.id} • Extensions: {format.extensions.join(', ')} • 
                {format.supportsMeshes && ' Meshes'} 
                {format.supportsTextures && ' Textures'} 
                {format.supportsMaterials && ' Materials'}
              </span>
            </div>
            <div className="config-list-item-actions">
              <Button onClick={() => handleEdit(format)} variant="secondary" size="small">
                Edit
              </Button>
              <Button onClick={() => handleDelete(format.id)} variant="danger" size="small">
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
