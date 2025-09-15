import React, { useEffect, useRef, useState } from 'react';
import DocTypeBadge from './DocTypeBadge';
import { api } from '../../utils/api';

const CACHE_KEY = 'barmai.docTypeCache.v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h in ms
const CONCURRENT_LIMIT = 2;

const DocumentList = ({ documents, selectedDoc, onSelectDoc }) => {
  const [docTypes, setDocTypes] = useState({});
  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const cacheRef = useRef(null);

  // Lazy load cache
  if (cacheRef.current === null) {
    try {
      cacheRef.current = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    } catch {
      cacheRef.current = {};
    }
  }

  const saveCache = () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheRef.current));
    } catch {
      // ignore write errors
    }
  };

  const runQueue = () => {
    while (activeRef.current < CONCURRENT_LIMIT && queueRef.current.length) {
      const docId = queueRef.current.shift();
      activeRef.current += 1;
      api
        .getDocumentType(docId)
        .then((res) => {
          const type = res.type || 'unknown';
          setDocTypes((prev) => ({ ...prev, [docId]: { status: 'loaded', type } }));
          cacheRef.current[docId] = { type, ts: Date.now() };
          saveCache();
        })
        .catch(() => {
          setDocTypes((prev) => ({ ...prev, [docId]: { status: 'error' } }));
        })
        .finally(() => {
          activeRef.current -= 1;
          runQueue();
        });
    }
  };

  useEffect(() => {
    const now = Date.now();
    documents.forEach((doc) => {
      if (docTypes[doc.id]) return;
      const cached = cacheRef.current[doc.id];
      if (cached && now - cached.ts < CACHE_TTL) {
        setDocTypes((prev) => ({ ...prev, [doc.id]: { status: 'loaded', type: cached.type } }));
      } else {
        queueRef.current.push(doc.id);
        setDocTypes((prev) => ({ ...prev, [doc.id]: { status: 'loading' } }));
      }
    });
    runQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const info = docTypes[doc.id] || { status: 'loading' };
          return (
            <div
              key={doc.id}
              className={`document-item ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
              onClick={() => onSelectDoc(doc)}
            >
              <div className="doc-icon">📄</div>
              <div className="doc-info">
                <div className="doc-title">
                  {doc.title} <DocTypeBadge type={info.type} status={info.status} />
                </div>
                <div className="doc-meta">
                  PDF Document • {new Date(doc.uploaded_at).toLocaleDateString()}
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
