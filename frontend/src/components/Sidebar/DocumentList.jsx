import React, { useEffect, useState } from 'react';
import { fetchDocumentTypePreview } from '../../utils/api';
import DocTypeBadge from './DocTypeBadge';

const CACHE_KEY = 'barmai.docTypeCache.v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Read and sanitize cache (remove expired entries)
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const fresh = {};
    for (const [docId, entry] of Object.entries(parsed)) {
      if (entry && entry.ts && now - entry.ts < TTL_MS) {
        fresh[docId] = entry;
      }
    }
    // Persist cleaned cache
    localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch (err) {
    console.warn('Failed to read docType cache', err);
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('Failed to write docType cache', err);
  }
}

const DocumentList = ({ documents, selectedDoc, onSelectDoc }) => {
  const [docTypes, setDocTypes] = useState({});

  useEffect(() => {
    if (!documents || documents.length === 0) return;

    const cache = readCache();
    const seeded = {};
    const toFetch = [];
    for (const doc of documents) {
      if (cache[doc.id]) {
        const { type, human, ts } = cache[doc.id];
        seeded[doc.id] = { type, human, ts, loading: false, error: null };
      } else {
        seeded[doc.id] = { loading: true };
        toFetch.push(doc);
      }
    }
    setDocTypes(seeded);

    if (toFetch.length === 0) return;

    let isCancelled = false;
    let running = 0;
    let index = 0;
    const controllers = [];

    const runNext = () => {
      if (isCancelled || index >= toFetch.length) return;
      const doc = toFetch[index++];
      const controller = new AbortController();
      controllers.push(controller);
      running++;
      fetchDocumentTypePreview(doc.id, { signal: controller.signal })
        .then(res => {
          if (isCancelled) return;
          const entry = {
            type: res.type || 'unknown',
            human: res.human || 'Inconnu',
            ts: Date.now(),
          };
          setDocTypes(prev => ({
            ...prev,
            [doc.id]: { ...entry, loading: false, error: null },
          }));
          cache[doc.id] = entry;
          writeCache(cache);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Error fetching document type preview', err);
            setDocTypes(prev => ({
              ...prev,
              [doc.id]: { ...prev[doc.id], loading: false, error: true },
            }));
          }
        })
        .finally(() => {
          running--;
          if (!isCancelled) runNext();
        });
    };

    const initial = Math.min(2, toFetch.length);
    for (let i = 0; i < initial; i++) {
      runNext();
    }

    return () => {
      isCancelled = true;
      controllers.forEach(c => c.abort());
    };
  }, [documents]);

  return (
    <div className="documents-list">
      {documents.length === 0 ? (
        <div className="empty-state">
          <p>📄 Pas encore de document </p>
          <p>Téléchargez un PDF pour commencer</p>
        </div>
      ) : (
        documents.map((doc) => {
          const t = docTypes[doc.id] || {};
          const type = t.type || doc.type || 'pdf';
          const human = t.human || 'PDF Document';
          return (
            <div
              key={doc.id}
              className={`document-item ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
              onClick={() => onSelectDoc(doc)}
            >
              <div className="doc-icon">📄</div>
              <div className="doc-info">
                <div className="document-list__title-row">
                  <div className="document-list__title">{doc.title}</div>
                  <DocTypeBadge type={type} human={human} loading={t.loading} error={t.error} />
                </div>
                <div className="doc-meta">
                  {human} • {new Date(doc.uploaded_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default DocumentList;
