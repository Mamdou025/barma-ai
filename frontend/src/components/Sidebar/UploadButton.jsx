import React, { useRef, useState } from 'react';

const UploadButton = ({ onUpload }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    // Simulate upload
    setTimeout(() => {
      onUpload({ 
        id: Date.now(), 
        title: file.name, 
        url: URL.createObjectURL(file) 
      });
      setUploading(false);
    }, 1000);
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
        {uploading ? '⏳ Uploading...' : '📄 Add PDF'}
      </button>
    </>
  );
};

export default UploadButton;