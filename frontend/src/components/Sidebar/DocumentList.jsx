import React from 'react';
import '../../styles/Sidebar.css';

function DocumentList({ documents, selectedDocs, onDocumentSelect }) {
  return (
    <ul className="document-list">
      {documents.map((doc) => (
        <li key={doc.id} className="document-item">
          <div className="doc-entry" onClick={() => onDocumentSelect(doc.id)}>
            <span className="pdf-icon">📄</span>
            <span className="doc-title">{doc.title}</span>
          </div>
          <input
            type="checkbox"
            className="doc-checkbox"
            checked={selectedDocs.includes(doc.id)}
            onChange={() => onDocumentSelect(doc.id)}
          />
        </li>
      ))}
    </ul>
  );
}

export default DocumentList;
