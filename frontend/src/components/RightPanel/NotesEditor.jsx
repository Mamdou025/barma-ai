import React, { useState, useEffect } from 'react';

const NotesEditor = ({ notes, onChange, placeholder }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  useEffect(() => {
    const count = localNotes.trim() ? localNotes.split(/\s+/).length : 0;
    setWordCount(count);
  }, [localNotes]);

  const handleSave = () => {
    onChange(localNotes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalNotes(notes);
    setIsEditing(false);
  };

  return (
    <div className="notes-editor-container">
      <div className="notes-toolbar">
        <div className="notes-stats">
          <span className="word-count">{wordCount} words</span>
        </div>
        <div className="notes-actions">
          {isEditing ? (
            <>
              <button onClick={handleSave} className="btn btn-primary">
                💾 Save
              </button>
              <button onClick={handleCancel} className="btn">
                ❌ Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn">
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          className="notes-textarea"
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          placeholder={placeholder}
          autoFocus
          rows={20}
        />
      ) : (
        <div 
          className="notes-display"
          onClick={() => setIsEditing(true)}
        >
          {localNotes || (
            <div className="notes-placeholder">
              {placeholder || "Click to start taking notes..."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotesEditor;