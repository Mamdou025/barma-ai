const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Fetch a document type preview
export const fetchDocumentTypePreview = async (
  documentId,
  { signal } = {}
) => {
  const response = await fetch(
    `${API_BASE_URL}/api/segment-preview?document_id=${encodeURIComponent(documentId)}`,
    { signal }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch document type preview');
  }

  return { type: data.type, human: data.human };
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
  sendMessage: async (message, documentIds, sessionId, filters = {}) => {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        document_ids: documentIds, // Backend expects snake_case
        documentIds, // Also send camelCase for compatibility
        session_id: sessionId || crypto.randomUUID(),
        filters,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        errorData.error ||
        (response.status === 404
          ? 'Document not indexed'
          : response.status === 400
          ? 'No document selected'
          : 'Failed to send message');
      const error = new Error(message);
      error.status = response.status;
      throw error;
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

  // Fetch chat history for a document
  getChatLogs: async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/api/chatlogs/${documentId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    return response.json();
  },

  // Delete chat history for a document
  deleteChatLogs: async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/api/chatlogs/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to delete chat logs');
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

