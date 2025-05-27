import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const NotesEditor = ({ documentId, placeholder, documentTitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [localNotes, setLocalNotes] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    const loadNotes = async () => {
      if (!documentId) {
        setNotes('');
        setLocalNotes('');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await api.getNotes(documentId);
        const content = result.notes?.content || '';

        setNotes(content);
        setLocalNotes(content);

        if (result.notes?.updated_at) {
          setLastSaved(new Date(result.notes.updated_at));
        }
      } catch (err) {
        console.error('Failed to load notes:', err);
        setError('Failed to load notes');
        setNotes('');
        setLocalNotes('');
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [documentId]);

  useEffect(() => {
    const count = localNotes.trim() ? localNotes.split(/\s+/).length : 0;
    setWordCount(count);
  }, [localNotes]);

  const handleSave = async () => {
    if (!documentId) {
      alert('No document selected');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const notesTitle = documentTitle
        ? `Notes: ${documentTitle}`
        : `Notes for Document ${documentId.slice(0, 8)}...`;

      await api.saveNotes(documentId, localNotes, notesTitle);

      setNotes(localNotes);
      setIsEditing(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save notes:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalNotes(notes);
    setIsEditing(false);
    setError(null);
  };

  const handleAutoSave = async () => {
    if (!documentId || localNotes === notes) return;

    try {
      const notesTitle = documentTitle
        ? `Notes: ${documentTitle}`
        : `Notes for Document ${documentId.slice(0, 8)}...`;

      await api.saveNotes(documentId, localNotes, notesTitle);
      setNotes(localNotes);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  };

  useEffect(() => {
    if (!isEditing || !documentId) return;

    const autoSaveInterval = setInterval(handleAutoSave, 30000);
    return () => clearInterval(autoSaveInterval);
  }, [isEditing, localNotes, documentId, handleAutoSave]);

  if (!documentId) {
    return (
      <div className="notes-editor-container">
        <div className="notes-empty-state">
          <div className="empty-notes-icon">📝</div>
          <h3>No Document Selected</h3>
          <p>Select a document to start taking notes</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="notes-editor-container">
        <div className="notes-loading">
          <div className="loading-spinner"></div>
          <span>Loading notes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-editor-container">
      <div className="notes-toolbar">
        <div className="notes-stats">
          <span className="word-count">{wordCount} words</span>
          {lastSaved && (
            <span className="last-saved">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="notes-actions">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? '💾 Saving...' : '💾 Save'}
              </button>
              <button
                onClick={handleCancel}
                className="btn"
                disabled={saving}
              >
                ❌ Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn"
              disabled={loading}
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="notes-error">
          <span className="error-message">❌ {error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">
            ✕
          </button>
        </div>
      )}

      {isEditing ? (
        <div className="notes-editor">
          <textarea
            className="notes-textarea"
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder={placeholder || 'Start taking notes about this document...'}
            autoFocus
            rows={20}
            disabled={saving}
          />
          <div className="editor-help">
            <small>
              💡 Auto-saves every 30 seconds • Press Ctrl+S to save manually
            </small>
          </div>
        </div>
      ) : (
        <div className="notes-display" onClick={() => setIsEditing(true)}>
          {notes ? (
            <div className="notes-content">
              {notes.split('\n').map((line, index) => (
                <p key={index} className="notes-line">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          ) : (
            <div className="notes-placeholder">
              <div className="placeholder-icon">📝</div>
              <p>
                {placeholder || 'Click to start taking notes about this document...'}
              </p>
              <small>Your notes will be automatically saved</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotesEditor;
