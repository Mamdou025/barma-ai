import React, { useRef, useState } from 'react';
import { api, validatePDFFile } from '../../utils/api';

const UploadButton = ({ onUpload }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Validate file before upload
      validatePDFFile(file);
      
      setUploading(true);
      
      // Use real API call
      const result = await api.uploadDocument(file);
      
      // Transform response to match your component's expected format
      const newDoc = {
        id: result.document?.id || Date.now(), // Use actual ID from backend
        title: file.name,
        storage_url: result.public_url,
        uploaded_at: new Date().toISOString(),
        text_content: result.text_content || ''
      };
      
      onUpload(newDoc);
      
      // Reset file input
      e.target.value = '';
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button 
        className="upload-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? '⏳ En chargement...' : '📄 Ajouter PDF'}
      </button>
    </>
  );
};

export default UploadButton;