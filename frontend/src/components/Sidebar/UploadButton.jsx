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
      
      console.log(`🚀 Upload started: ${file.name} (${file.size} bytes, ${file.type})`);
      const result = await api.uploadDocument(file);
      console.log('✅ Upload response:', result);

      // Transform response to match your component's expected format
      const newDoc = {
        id: result.id || result.document?.id, // Use actual ID from backend
        title: result.document?.title || file.name,
        storage_url: result.document?.storage_url || result.public_url,
        uploaded_at: result.document?.uploaded_at || new Date().toISOString(),
        text_content: result.document?.text_content || result.text_content || ''
      };

      onUpload(newDoc);

      if (result.warnings?.length) {
        alert(result.warnings.join('\n\n'));
      }

    } catch (error) {
      console.error('❌ Upload error:', error.message);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // Always reset so the same file can be retried after failure
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