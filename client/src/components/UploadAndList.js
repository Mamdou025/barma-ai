// src/components/UploadAndList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UploadAndList({ onSelect }) {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/documents');
      setDocuments(res.data.documents);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/api/upload', formData);
      setFile(null);
      fetchDocuments(); // refresh list
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div>
      <h3>Upload PDF</h3>
      <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>

      <hr />

      <h3>Documents</h3>
      <ul>
        {documents.map(doc => (
          <li key={doc.id}>
            <button onClick={() => onSelect(doc)}>{doc.title}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UploadAndList;
