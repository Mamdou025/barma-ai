import { useState, useEffect } from 'react';
import DocumentList from './DocumentList';
import UploadButton from './UploadButton';
import PDFViewer from './PDFViewer';
import '../../styles/Sidebar.css';

export default function Sidebar({ onSelectDocument, selectedDocument }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('https://barma-ai-backend.onrender.com/api/documents');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const docsArray = Array.isArray(data) ? data : data.documents || [];
      setDocuments(docsArray);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDocumentSelect = (doc) => {
    if (doc?.storage_url?.startsWith('http')) {
      onSelectDocument(doc); // ✅ send full document object to App.js
    } else {
      console.error('Invalid document URL:', doc);
      setError('Selected document has an invalid URL');
    }
  };

  if (loading) {
    return <div className="sidebar-loading">Loading documents...</div>;
  }

  if (error) {
    return (
      <div className="sidebar-error">
        <p>Error: {error}</p>
        <button onClick={fetchDocuments}>Retry</button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3 className="sidebar-title">Documents</h3>
        <div className="sidebar-controls">
          <UploadButton onUpload={fetchDocuments} />
          <button className="refresh-button" onClick={fetchDocuments} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <DocumentList 
        documents={documents}
        onSelect={handleDocumentSelect} // ✅ wrapped with URL check
        selectedDocument={selectedDocument}
      />

      {selectedDocument && (
        <div className="pdf-preview-container">
          <h4>{selectedDocument.title || 'Document Preview'}</h4>
          <PDFViewer pdfUrl={selectedDocument.storage_url} />
        </div>
      )}
    </div>
  );
}
