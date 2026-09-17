import React, { useState } from 'react';
import { api, WorkspaceSummary } from '../lib/api-client';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (workspace: WorkspaceSummary) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [useIcm, setUseIcm] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('founder');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a workspace name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ws = await api.createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        template: useIcm ? selectedTemplate : undefined,
      });
      onCreated(ws);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(28, 25, 23, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem',
    }}>
      <div style={{
        background: '#FAF8F5',
        border: '1px solid #E7E5E4',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.15)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.75rem',
          borderBottom: '1px solid #E7E5E4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'serif',
              fontSize: '1.35rem',
              fontWeight: 600,
              color: '#1C1917',
              margin: 0,
            }}>
              Initialize New Workspace
            </h2>
            <p style={{
              fontSize: '0.8125rem',
              color: '#78716C',
              margin: '0.25rem 0 0',
            }}>
              Create an isolated knowledge filesystem and collaboration boundary.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              color: '#A8A29E',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }}>
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              color: '#57534E',
              marginBottom: '0.4rem',
            }}>
              Workspace Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operations Core, Legal Sovereign, Q3 Expansion"
              autoFocus
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: '1px solid #D6D3D1',
                borderRadius: '6px',
                fontSize: '0.9rem',
                background: '#FFFFFF',
                color: '#1C1917',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              color: '#57534E',
              marginBottom: '0.4rem',
            }}>
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Institutional purpose, team access scope, or mission..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: '1px solid #D6D3D1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                background: '#FFFFFF',
                color: '#1C1917',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none',
              }}
            />
          </div>

          {/* Template Selection */}
          <div style={{
            background: useIcm ? '#FAF5F2' : '#F5F5F4',
            border: `1px solid ${useIcm ? '#8B263E' : '#E7E5E4'}`,
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}
              onClick={() => setUseIcm(!useIcm)}
            >
              <input
                type="checkbox"
                checked={useIcm}
                onChange={(e) => setUseIcm(e.target.checked)}
                style={{ marginTop: '0.25rem', accentColor: '#8B263E' }}
              />
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1C1917',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  Seed with ICM Template
                  <span style={{
                    fontSize: '0.6875rem',
                    background: '#8B263E',
                    color: '#FFF',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    fontWeight: 500,
                  }}>
                    RECOMMENDED
                  </span>
                </div>
                <p style={{
                  fontSize: '0.8rem',
                  color: '#78716C',
                  margin: '0.35rem 0 0',
                  lineHeight: 1.4,
                }}>
                  Seeds standard ICM folders with living filesystem overviews ready for immediate reasoning and provenance traversal.
                </p>
              </div>
            </div>

            {useIcm && (
              <div style={{ marginTop: '0.875rem', paddingLeft: '1.75rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                  color: '#57534E',
                  marginBottom: '0.35rem',
                }}>
                  Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #D6D3D1',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    background: '#FFFFFF',
                    color: '#1C1917',
                    outline: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="founder">Founder ICM — Company Brain starter</option>
                  <option value="agency-client">Agency Client Workbench</option>
                  <option value="operations-playbook">Operations Playbook</option>
                  <option value="minimal">Minimal — Blank with query harness only</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.625rem 1.125rem',
                border: '1px solid #D6D3D1',
                borderRadius: '6px',
                background: '#FFFFFF',
                color: '#57534E',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.625rem 1.35rem',
                border: 'none',
                borderRadius: '6px',
                background: '#8B263E',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Initializing...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
