import React from 'react';
import '../../styles/Sidebar.css';

function UploadButton({ onUploadSuccess }) {
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      onUploadSuccess();
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  return (
    <label className="ajouter-button">
      ➕ Ajouter
      <input
        type="file"
        accept="application/pdf"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />
    </label>
  );
}

export default UploadButton;
