import { useState } from 'react';
import '../../styles/Sidebar.css';

export default function UploadButton({ onUpload }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://barma-ai-backend.onrender.com/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text() || 'Upload failed');
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      onUpload(); // Refresh the document list
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="upload-container">
      <label className="upload-button">
        {isUploading ? 'Uploading...' : 'Upload PDF'}
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleUpload}
          disabled={isUploading}
          style={{ display: 'none' }}
        />
      </label>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}