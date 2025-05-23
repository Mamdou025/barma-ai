import { useState, useEffect } from 'react';
import '../../styles/MindMapView.css';

export default function NotesEditor({ initialNotes = '', onSave }) {
  const [notes, setNotes] = useState(initialNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Update word count when notes change
  useEffect(() => {
    const count = notes.trim() ? notes.split(/\s+/).length : 0;
    setWordCount(count);
  }, [notes]);

  const handleSave = () => {
    if (typeof onSave === 'function') {
      onSave(notes);
    }
    setIsEditing(false);
  };

  return (
    <div className="notes-editor-container">
      <div className="notes-header">
        <h3>Notes</h3>
        <span className="word-count">{wordCount} words</span>
        {isEditing ? (
          <button onClick={handleSave} className="save-button">
            Save
          </button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="edit-button">
            Edit
          </button>
        )}
      </div>
      
      {isEditing ? (
        <textarea
          className="notes-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write your notes here..."
          autoFocus
        />
      ) : (
        <div 
          className="notes-preview"
          onClick={() => setIsEditing(true)}
        >
          {notes || <span className="placeholder">Click to add notes...</span>}
        </div>
      )}
    </div>
  );
}