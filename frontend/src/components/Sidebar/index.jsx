import React, { useEffect, useState } from 'react';
import UploadButton from './UploadButton';
import DocumentList from './DocumentList';
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
        <div className="sidebar-brand">
          <div className="brand-icon">⚖️</div>
          <div className="brand-text">
            <span className="brand-name">Barma AI</span>
            <span className="brand-tagline">Assistant Juridique</span>
          </div>
        </div>
        <div className="sidebar-loading">Chargement des documents...</div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">⚖️</div>
        <div className="brand-text">
          <span className="brand-name">Barma AI</span>
          <span className="brand-tagline">Assistant Juridique</span>
        </div>
      </div>

      {/* Actions */}
      <div className="sidebar-header">
        <div className="sidebar-actions">
          <UploadButton onUpload={handleUploadSuccess} />
          {selectedDoc && (
            <button className="delete-btn" onClick={handleDelete}>
              Supprimer
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-section-label">Mes Documents</div>

      {error && <div className="sidebar-error">{error}</div>}

      <DocumentList
        documents={documents}
        selectedDoc={selectedDoc}
        onSelectDoc={onSelectDoc}
      />

      {selectedDoc && (
        <div className="pdf-preview">
          <div className="pdf-preview-label">Aperçu</div>
          <div className="pdf-viewer">
            <iframe
              src={selectedDoc.storage_url}
              title="PDF Preview"
              width="100%"
              height="100%"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;