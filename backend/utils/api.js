const BASE_URL = 'https://barma-ai-backend.onrender.com/api';

// Upload a PDF document
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Failed to upload document');
  return response.json();
}

// Fetch all uploaded documents
export async function fetchDocuments() {
  const response = await fetch(`${BASE_URL}/documents`);
  if (!response.ok) throw new Error('Failed to fetch documents');
  return response.json();
}

// Delete a document by ID
export async function deleteDocument(id) {
  const response = await fetch(`${BASE_URL}/documents/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete document');
  return response.json();
}

// Send a message to the AI chat with document context
export async function chatWithDocument(documentId, message) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, message }),
  });

  if (!response.ok) throw new Error('Failed to chat with AI');
  return response.json();
}

// Generate a mind map for a document
export async function generateMindMap(documentId) {
  const response = await fetch(`${BASE_URL}/mindmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!response.ok) throw new Error('Failed to generate mind map');
  return response.json();
}
