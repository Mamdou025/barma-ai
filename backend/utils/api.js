// frontend/src/utils/api.js
const BASE_URL = 'https://barma-ai-backend.onrender.com/api';

/* ------------------- Documents ------------------- */

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

/* ------------------- Chat ------------------- */

// UPDATED to match backend: expects document_ids (array), optional session_id, vulgarisation
export async function chatWithDocument(documentId, message, sessionId = null, vulgarisation = true) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      document_ids: [documentId],
      session_id: sessionId,
      vulgarisation
    }),
  });

  if (!response.ok) throw new Error(`Failed to chat with AI (${response.status})`);
  return response.json(); // { reply, response_time_ms, retrieval_mode, sources_used, source_map }
}

/**
 * Unified API object used by ChatBox:
 *   api.sendMessage(message, [docId], sessionId)
 * Returns a normalized object with source_map included.
 */
export const api = {
  async sendMessage(message, documentIds, sessionId, vulgarisation = true) {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        document_ids: documentIds,
        session_id: sessionId,
        vulgarisation
      }),
    });

    if (!res.ok) throw new Error(`chat ${res.status}`);

    const json = await res.json();
    // Normalize shape for ChatBox
    return {
      reply: json.reply,
      response_time_ms: json.response_time_ms,
      retrieval_mode: json.retrieval_mode,
      sources_used: json.sources_used || [],
      source_map: json.source_map || {}
    };
  }
};

/* ------------------- Mindmap ------------------- */

export async function generateMindMap(documentId) {
  const response = await fetch(`${BASE_URL}/mindmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!response.ok) throw new Error('Failed to generate mind map');
  return response.json();
}
