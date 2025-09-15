import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'hast-util-sanitize';

const ChatMessage = ({ message, isUser, timestamp, isHistory = false, isError = false, sources = [] }) => {
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

  // Allow only <mark> as raw HTML; everything else is sanitized by default schema
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), 'mark'],
  };

  const handleChipClick = (docTitle, ref, marker) => {
    const text = `:codex-terminal-citation[codex-terminal-citation]{line_range_start=379 line_range_end=418 terminal_chunk_id=${marker}}】 ${docTitle} — ${ref}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div
      className={[
        'message',
        isUser ? 'user-message' : 'ai-message',
        isHistory ? 'history-message' : '',
        isError ? 'is-error' : ''
      ].join(' ')}
    >
      <div className="message-avatar">
        {isUser ? '👤' : '🟢'}
      </div>

      <div className="message-content">
        <div className="message-text markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
            components={{
              h1: ({node, ...props}) => <h1 className="md-h1" {...props} />,
              h2: ({node, ...props}) => <h2 className="md-h2" {...props} />,
              h3: ({node, ...props}) => <h3 className="md-h3" {...props} />,
              h4: ({node, ...props}) => <h4 className="md-h4" {...props} />,
              p:  ({node, ...props}) => <p className="md-p" {...props} />,
              ul: ({node, ...props}) => <ul className="md-ul" {...props} />,
              ol: ({node, ...props}) => <ol className="md-ol" {...props} />,
              li: ({node, ...props}) => <li className="md-li" {...props} />,
              a:  ({node, ...props}) => <a className="md-a" target="_blank" rel="noreferrer" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="md-quote" {...props} />,
              code: ({inline, className, children, ...props}) => (
                inline
                  ? <code className="md-code-inline" {...props}>{children}</code>
                  : <pre className="md-code-block"><code>{children}</code></pre>
              ),
              table: ({node, ...props}) => <table className="md-table" {...props} />,
              thead: ({node, ...props}) => <thead className="md-thead" {...props} />,
              tbody: ({node, ...props}) => <tbody className="md-tbody" {...props} />,
              th: ({node, ...props}) => <th className="md-th" {...props} />,
              td: ({node, ...props}) => <td className="md-td" {...props} />,
            }}
          >
            {message}
          </ReactMarkdown>
        </div>

        {!isUser && sources.length > 0 && (
          <div className="message-sources">
            {sources.map((src) => (
              <button
                key={src.marker}
                className="source-chip"
                onClick={() => handleChipClick(src.doc_title, src.ref, src.marker)}
                title={`${src.doc_title} — ${src.ref}`}
              >
                {src.marker}
              </button>
            ))}
          </div>
        )}

        <div className="message-time">
          {isHistory && <span className="history-indicator">📚 </span>}
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
