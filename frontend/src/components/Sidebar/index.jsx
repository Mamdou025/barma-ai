import React, { useEffect, useState } from 'react';
import UploadButton from './UploadButton';
import { api } from '../../utils/api';

const Sidebar = ({ selectedDoc, onSelectDoc, onUpload, onDelete }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch documents on component mount
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getDocuments();
      setDocuments(response.documents || []);
      
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Handle successful upload
  const handleUploadSuccess = (newDoc) => {
    setDocuments(prev => [newDoc, ...prev]); // Add to top of list
    onUpload(newDoc);
    onSelectDoc(newDoc); // Auto-select uploaded document
  };

  // Handle document deletion
  const handleDelete = async () => {
    if (!selectedDoc) return;

    if (!window.confirm(`Are you sure you want to delete "${selectedDoc.title}"?`)) {
      return;
    }

    try {
      await api.deleteDocument(selectedDoc.id);
      
      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== selectedDoc.id));
      onSelectDoc(null);
      
      if (onDelete) {
        onDelete(selectedDoc.id);
      }
      
    } catch (err) {
      console.error('Delete error:', err);
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  if (loading && documents.length === 0) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>📚 Sources</h2>
        </div>
        <div className="loading">Chargement des documents...</div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>📚 Sources</h2>
        <div className="sidebar-actions">
          <UploadButton onUpload={handleUploadSuccess} />
          {selectedDoc && (
            <button className="delete-btn" onClick={handleDelete}>
              🗑️ Supprimer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ 
          color: '#d32f2f', 
          padding: '8px', 
          background: '#ffebee', 
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <p>📄 Pas encore de document </p>
            <p>Téléchargez un PDF pour commencer</p>
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
                <div className="document-list__title-row">
                  <div className="document-list__title">{doc.title}</div>
                  <span className={`doc-badge doc-badge--${doc.type || 'pdf'}`}>
                    {(doc.type || 'pdf').toUpperCase()}
                  </span>
                </div>
                <div className="doc-meta">
                  PDF Document • {new Date(doc.uploaded_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedDoc && (
        <div className="pdf-preview">
          <h3>📖 aperçu</h3>
          <div className="pdf-viewer">
            <iframe
              src={selectedDoc.storage_url}
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