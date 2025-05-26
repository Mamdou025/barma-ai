import React from 'react';
import UploadButton from './UploadButton';

const Sidebar = ({ documents, selectedDoc, onSelectDoc, onUpload, onDelete }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>📚 Sources</h2>
        <div className="sidebar-actions">
          <UploadButton onUpload={onUpload} />
          {selectedDoc && (
            <button className="delete-btn" onClick={() => onDelete(selectedDoc.id)}>
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <p>📄 No documents yet</p>
            <p>Upload a PDF to get started</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className={`document-item ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
              onClick={() => onSelectDoc(doc)}
            >
              <div className="doc-icon">📄</div>
              <div className="doc-info">
                <div className="doc-title">{doc.title}</div>
                <div className="doc-meta">PDF Document</div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedDoc && (
        <div className="pdf-preview">
          <h3>📖 Preview</h3>
          <div className="pdf-viewer">
            <iframe
              src={selectedDoc.url}
              title="PDF Preview"
              width="100%"
              height="100%"
              style={{ border: '1px solid #e1e5e9', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;