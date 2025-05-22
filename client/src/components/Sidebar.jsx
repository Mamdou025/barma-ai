import React, { useState, useEffect } from 'react';

export default function Sidebar({ onSelectionChange, selectedDocumentIds }) {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetch('https://barma-ai-backend.onrender.com/api/documents')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.documents)) {
          setDocuments(data.documents);
        } else {
          console.error('Expected array of documents, got:', data);
          setDocuments([]);
        }
      })
      .catch((err) => console.error('Failed to load documents:', err));
  }, []);

  const handleCheckboxChange = (id) => {
    const newSelection = selectedDocumentIds.includes(id)
      ? selectedDocumentIds.filter((docId) => docId !== id)
      : [...selectedDocumentIds, id];
    onSelectionChange(newSelection);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://barma-ai-backend.onrender.com/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocuments((prev) => [...prev, newDoc]);
      } else {
        console.error('Upload failed');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
    }
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm('Are you sure you want to delete this document?');
    if (!confirm) return;

    try {
      const res = await fetch(`https://barma-ai-backend.onrender.com/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        onSelectionChange(selectedDocumentIds.filter((docId) => docId !== id));
      } else {
        alert('Failed to delete document');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('An error occurred while deleting.');
    }
  };

  return (
    <div className="h-full w-full p-4 border-r border-gray-300 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-2">Sources</h2>
      <input type="file" onChange={handleUpload} className="mb-4" />

      <ul className="text-sm space-y-2">
        {documents.map((doc, index) => (
          <li key={doc.id || index} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedDocumentIds.includes(doc.id)}
              onChange={() => handleCheckboxChange(doc.id)}
            />
            <a
              href={doc.storage_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline truncate"
              title={doc.title ?? doc.name ?? doc.filename ?? 'Untitled'}
            >
              {doc.title ?? doc.name ?? doc.filename ?? 'Untitled'}
            </a>
            <button
              onClick={() => handleDelete(doc.id)}
              className="text-red-500 hover:underline text-xs ml-auto"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
