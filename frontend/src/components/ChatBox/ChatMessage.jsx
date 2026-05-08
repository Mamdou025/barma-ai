import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const ChatMessage = ({ message, isUser, timestamp, isHistory = false, isError = false, sourceMap = {} }) => {
  const [copiedKey, setCopiedKey] = useState(null);

  const formatTime = (ts) => {
    if (ts) {
      return new Date(ts).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch (_) {}
  };

  const entries = Object.entries(sourceMap || {}); // [["1",{doc_id,...}], ...]

  return (
    <div className={`message ${isUser ? 'user-message' : 'ai-message'} ${isHistory ? 'history-message' : ''} ${isError ? 'is-error' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🟢'}
      </div>

      <div className="message-content">
        <div className="message-text markdown-body">
          <ReactMarkdown
            // IMPORTANT: do NOT pass `linkTarget` prop (it was removed)
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            // Whitelist the HTML tags we want to permit (so <mark> works)
            allowedElements={[
              'p','a','strong','em','code','pre','blockquote','ul','ol','li',
              'h1','h2','h3','table','thead','tbody','tr','th','td','mark','br'
            ]}
            components={{
              a: ({node, ...props}) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md-a"
                />
              ),
              h1: ({node, ...props}) => <h1 className="md-h1" {...props} />,
              h2: ({node, ...props}) => <h2 className="md-h2" {...props} />,
              h3: ({node, ...props}) => <h3 className="md-h3" {...props} />,
              p:  ({node, ...props}) => <p className="md-p" {...props} />,
              ul: ({node, ...props}) => <ul className="md-ul" {...props} />,
              ol: ({node, ...props}) => <ol className="md-ol" {...props} />,
              li: ({node, ...props}) => <li className="md-li" {...props} />,
              code: ({inline, ...props}) =>
                inline ? (
                  <code className="md-code-inline" {...props} />
                ) : (
                  <code className="md-code-block" {...props} />
                ),
              blockquote: ({node, ...props}) => <blockquote className="md-quote" {...props} />,
              table: ({node, ...props}) => <table className="md-table" {...props} />,
              th: ({node, ...props}) => <th className="md-th" {...props} />,
              td: ({node, ...props}) => <td className="md-td" {...props} />,
              mark: ({node, ...props}) => <mark {...props} />
            }}
          >
            {message || ''}
          </ReactMarkdown>

          {/* Source chips (if backend sent `source_map`) */}
          {!isUser && entries.length > 0 && (
            <div className="source-chips">
              {entries.map(([key, meta]) => {
                const label = `【${key}】 ${meta?.doc_title || 'Source'}`;
                if (meta?.storage_url) {
                  return (
                    <a
                      key={key}
                      className="source-chip"
                      href={meta.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={meta.doc_title || undefined}
                    >
                      {label}
                    </a>
                  );
                }
                // No URL: fallback to copy the marker
                return (
                  <button
                    key={key}
                    className={`source-chip ${copiedKey === key ? 'is-copied' : ''}`}
                    onClick={() => handleCopy(label, key)}
                    title="Copier la référence"
                  >
                    {label}
                    {copiedKey === key && <span className="chip-toast">Copié</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="message-time">
          {isHistory && <span className="history-indicator">📚 </span>}
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
