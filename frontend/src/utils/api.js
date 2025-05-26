const API_BASE_URL = 'https://barma-ai-backend.onrender.com';

export const api = {
  // Upload PDF
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return response.json();
  },

  // Get all documents
  getDocuments: async () => {
    const response = await fetch(`${API_BASE_URL}/api/documents`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    
    return response.json();
  },

  // Delete document
  deleteDocument: async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
    
    return response.json();
  },

  // Chat with AI
  sendMessage: async (message, documentIds) => {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        document_ids: documentIds,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return response.json();
  },

  // Generate mind map
  generateMindMap: async (documentIds) => {
    const response = await fetch(`${API_BASE_URL}/api/mindmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_ids: documentIds,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate mind map');
    }
    
    return response.json();
  },
};