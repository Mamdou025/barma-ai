export const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

// UUID regex (same as backend)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const fetchDocumentTypePreview = async (documentId, { signal } = {}) => {
  const params = new URLSearchParams({ document_id: documentId });
  const response = await fetch(`${API_BASE_URL}/api/segment-preview?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch document type preview');
  }

  const json = await response.json();

  return {
    type: json.detected_type || 'unknown',
    human: json.detected_type_human || 'Inconnu',
  };
};

export const api = {
  // Upload PDF - matches your /api/upload endpoint
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Upload failed');
    }
    
    return response.json();
  },

  // Get all documents - matches your /api/documents endpoint
  getDocuments: async () => {
    const response = await fetch(`${API_BASE_URL}/api/documents`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch documents');
    }
    
    return response.json();
  },

  // Delete document - matches your /api/documents/:id endpoint
  deleteDocument: async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to delete document');
    }
    
    return response.json();
  },

  // Chat with AI - matches your /api/chat endpoint
  // sessionId parameter is optional. If provided, it's sent in the payload
  sendMessage: async (message, documentIds, sessionId) => {
    const payload = {
      message: message,
      document_ids: documentIds, // Your backend expects this format
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to send message');
    }
    
    return response.json();
  },

  // Generate mind map - matches your /api/mindmap endpoint
  generateMindMap: async (documentIds) => {
    const response = await fetch(`${API_BASE_URL}/api/mindmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_ids: documentIds, // Your backend expects this format
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate mind map');
    }
    
    return response.json();
  },

   // Save or update notes for a document
  saveNotes: async (documentId, content, title ) => {
    console.log('💾 Saving notes for document:', documentId);
    console.log('📝 Notes content:', content);
    console.log('📝 Notes title:', title);

    const response = await fetch(`${API_BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        content: content,
         title: title || `Notes for Document ${documentId.slice(0, 8)}...` // Auto-generate title
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save notes');
    }
    
    const result = await response.json();
    console.log('✅ Notes saved successfully:', result);
    return result;
  },

  // Get notes for a document
  getNotes: async (documentId) => {
    console.log('📖 Loading notes for document:', documentId);

    const response = await fetch(`${API_BASE_URL}/api/notes/${documentId}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to load notes');
    }
    
    const result = await response.json();
    console.log('✅ Notes loaded:', result);
    return result;
  },

  // Fetch document type preview
  fetchDocumentTypePreview,
};

// Helper function to format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to validate PDF file
export const validatePDFFile = (file) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!file.type.includes('pdf')) {
    throw new Error('Please select a PDF file');
  }
  
  if (file.size > maxSize) {
    throw new Error('File size must be less than 10MB');
  }
  
  return true;
};

