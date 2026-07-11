import {
  SAMPLE_DOCUMENTS,
  areSampleDocIds,
  buildSampleReply,
  buildMindMap,
  registerLocalDoc,
  getLocalDoc,
} from './sampleDocuments';
import { extractPdfText } from './pdfText';

// Generate a RFC-4122 v4 UUID (matches UUID_RE). Prefers the platform API,
// falls back to Math.random on older browsers.
const makeUuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Process an uploaded PDF entirely in the browser (no backend): extract its
// text, mint an id, and register it so chat/mind-map work offline.
const processUploadLocally = async (file, reason) => {
  console.warn(`Processing "${file.name}" locally (${reason}).`);
  let text = '';
  try {
    text = await extractPdfText(file);
  } catch (err) {
    console.error('PDF text extraction failed:', err);
  }
  const id = makeUuid();
  const document = {
    id,
    title: file.name,
    storage_url: URL.createObjectURL(file), // in-memory preview for this session
    uploaded_at: new Date().toISOString(),
    text_content: text,
    type: 'pdf',
  };
  registerLocalDoc(document);
  return { id, document, sample: true };
};

// Stream a canned demo reply token-by-token (used when the backend isn't
// available and the chat targets built-in sample documents).
const streamSampleReply = async (message, documentIds, { onMeta, onDelta, onDone } = {}) => {
  const reply = buildSampleReply(message, documentIds);
  onMeta?.({ source_map: {} });
  const tokens = reply.match(/\S+\s*/g) || [reply];
  for (const token of tokens) {
    onDelta?.(token);
    // Small pause so the UI shows a live "typing" effect.
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
  onDone?.({ reply, source_map: {} });
};

const configuredApiBase = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_BASE;

export const API_BASE_URL = (configuredApiBase || 'http://localhost:5000').replace(/\/$/, '');

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

    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
    } catch (networkErr) {
      // Backend unreachable → process the PDF in the browser instead.
      return processUploadLocally(file, `cannot reach API (${networkErr.message})`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Backend responded with an error (e.g. no DB/bucket). Fall back to local
      // processing so the document can still be worked with offline.
      const detail = errorData.detail ? ` — ${errorData.detail}` : '';
      return processUploadLocally(file, `${errorData.error || 'upload failed'}${detail}`);
    }

    return response.json();
  },

  // Get all documents - matches your /api/documents endpoint.
  // Falls back to built-in sample documents when the backend is unreachable or
  // returns no documents, so the UI can be demoed without a live database.
  getDocuments: async () => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/documents`);
    } catch (networkErr) {
      // fetch() throws only on transport failures (server down, CORS, bad URL).
      console.warn(
        `Cannot reach the API at ${API_BASE_URL} (${networkErr.message}). ` +
          'Serving sample documents.'
      );
      return { documents: SAMPLE_DOCUMENTS, sample: true };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Prefer the backend's real cause when present, so the actual reason is visible.
      const detail = errorData.detail ? ` — ${errorData.detail}` : '';
      const probe = errorData.connectivity ? ` [Supabase: ${errorData.connectivity}]` : '';
      console.warn(
        `${errorData.error || 'Failed to fetch documents'}${detail}${probe}. ` +
          'Serving sample documents.'
      );
      return { documents: SAMPLE_DOCUMENTS, sample: true };
    }

    const data = await response.json();
    // Empty database → show samples instead of a blank list.
    if (!data.documents || data.documents.length === 0) {
      return { documents: SAMPLE_DOCUMENTS, sample: true };
    }
    return data;
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
    // Offline demo mode for built-in sample documents.
    if (areSampleDocIds(documentIds)) {
      return { reply: buildSampleReply(message, documentIds), source_map: {} };
    }

    const payload = {
      message: message,
      document_ids: documentIds, // Your backend expects this format
    };
    if (sessionId) {
      payload.sessionid = sessionId;
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

  // Streamed chat - matches your /api/chat/stream (SSE) endpoint.
  // Reads tokens as they are generated and reports them via callbacks:
  //   onMeta({ retrieval_mode, source_map })  — once, before any token
  //   onDelta(text)                            — per token chunk
  //   onDone({ reply, response_time_ms, sources_used }) — final processed answer
  // Resolves once the stream ends; rejects on transport/HTTP errors.
  sendMessageStream: async (
    message,
    documentIds,
    sessionId,
    { onMeta, onDelta, onDone, signal } = {}
  ) => {
    // Offline demo mode: sample documents don't exist in any backend, so answer
    // locally instead of calling an endpoint that can't know about them.
    if (areSampleDocIds(documentIds)) {
      return streamSampleReply(message, documentIds, { onMeta, onDelta, onDone });
    }

    const payload = {
      message,
      document_ids: documentIds,
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }

    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamError = null;

    const dispatch = (event, data) => {
      if (event === 'meta') onMeta?.(data);
      else if (event === 'delta') onDelta?.(data?.text ?? '');
      else if (event === 'done') onDone?.(data);
      else if (event === 'error') streamError = new Error(data?.error || 'Stream error');
    };

    // SSE frames are separated by a blank line; each frame has `event:`/`data:` lines.
    const flushFrame = (frame) => {
      let event = 'message';
      let dataStr = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) return;
      let data;
      try { data = JSON.parse(dataStr); } catch { data = dataStr; }
      dispatch(event, data);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (frame.trim()) flushFrame(frame);
      }
    }
    if (buffer.trim()) flushFrame(buffer);

    if (streamError) throw streamError;
  },

  // Generate mind map - matches your /api/mindmap endpoint.
  // For locally-handled documents (samples or offline uploads), extract the
  // structure client-side instead of calling the backend.
  generateMindMap: async (documentIds) => {
    if (areSampleDocIds(documentIds)) {
      const doc = documentIds.map(getLocalDoc).find(Boolean);
      return { mindmap: buildMindMap(doc?.title, doc?.text_content) };
    }

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

