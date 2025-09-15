import React from 'react';
import ReactMarkdown from 'react-markdown';

<<<<<<< HEAD
const ChatMessage = ({ message, isUser, timestamp, isHistory = false, isError = false, sources = [] }) => {
  const formatTime = (ts) => {
    if (ts) {
      return new Date(ts).toLocaleString([], {
=======
const ChatMessage = ({ message, isUser, timestamp, isHistory = false }) => {
  const formatTime = (timestamp) => {
    if (timestamp) {
      return new Date(timestamp).toLocaleString([], { 
>>>>>>> parent of fdff44e (y)
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

<<<<<<< HEAD
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

=======
>>>>>>> parent of fdff44e (y)
  return (
    <div className={`message ${isUser ? 'user-message' : 'ai-message'} ${isHistory ? 'history-message' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🟢'}
      </div>
      <div className="message-content">
        <div className="message-text">
          <ReactMarkdown>
            {message}
          </ReactMarkdown>
        </div>
<<<<<<< HEAD

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

=======
>>>>>>> parent of fdff44e (y)
        <div className="message-time">
          {isHistory && <span className="history-indicator">📚 </span>}
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
