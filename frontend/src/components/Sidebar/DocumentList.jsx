import { useState } from 'react';
import '../../styles/Sidebar.css';

export default function DocumentList({ documents = [], onSelect, selectedDocument }) {
  const [error, setError] = useState(null);

  if (!documents || !Array.isArray(documents)) {
    return <div className="document-list-error">No documents available</div>;
  }

  const handleDocumentClick = (doc) => {
    try {
      if (!doc.id || !doc.storage_url) {
        throw new Error('Invalid document format');
      }
      onSelect(doc); // ✅ Send entire doc to App
      setError(null);
    } catch (err) {
      console.error('Error selecting document:', err);
      setError('Failed to load document. Please try another.');
    }
  };

  return (
    <div className="document-list-container">
      {error && <div className="document-list-error">{error}</div>}
      
      <ul className="document-list">
        {documents.map(doc => (
          <li 
            key={doc.id}
            className={`document-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
            onClick={() => handleDocumentClick(doc)}
          >
            <span className="document-name">
              {doc.title || doc.name || `Document ${doc.id.substring(0, 8)}`}
            </span>
            <span className="document-date">
              {doc.uploaded_at && new Date(doc.uploaded_at).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
