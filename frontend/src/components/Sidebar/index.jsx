import React, { useEffect, useState } from 'react';
import UploadButton from './UploadButton';
import DocumentList from './DocumentList';
import PDFViewer from './PDFViewer';
import '../../styles/Sidebar.css';

function Sidebar({ onSelectDocument, selectedDocument }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    fetch('/api/documents')
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents);
        if (selectAll) {
          setSelectedDocs(data.documents.map(doc => doc.id));
        }
      });
  }, [selectAll]);

  const handleDocumentSelect = (id) => {
    const updatedSelection = selectedDocs.includes(id)
      ? selectedDocs.filter(docId => docId !== id)
      : [...selectedDocs, id];
    setSelectedDocs(updatedSelection);
    const selected = documents.find(doc => doc.id === id);
    onSelectDocument(selected);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map(doc => doc.id));
    }
    setSelectAll(!selectAll);
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;

    try {
      const response = await fetch(`/api/documents/${selectedDocument.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete document');

      setDocuments(prev => prev.filter(doc => doc.id !== selectedDocument.id));
      setSelectedDocs(prev => prev.filter(id => id !== selectedDocument.id));
      onSelectDocument(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="sidebar-container">
      <h2 className="sidebar-header">Sources</h2>
      <div className="sidebar-actions">
        <UploadButton onUploadSuccess={() => window.location.reload()} />
        <button className="delete-button" onClick={handleDelete} disabled={!selectedDocument}>Delete</button>
      </div>

      <div className="select-all">
        <input
          type="checkbox"
          checked={selectAll}
          onChange={toggleSelectAll}
        /> Select all sources
      </div>

      <DocumentList
        documents={documents}
        selectedDocs={selectedDocs}
        onDocumentSelect={handleDocumentSelect}
      />

      {selectedDocument && (
        <div className="pdf-preview-container">
          <PDFViewer pdfUrl={selectedDocument.storage_url} />
        </div>
      )}
    </div>
  );
}

export default Sidebar;
