import { useState, useEffect, useRef } from 'react';
import '../../styles/ChatInput.css';

export default function ChatInput({ onSend, loading }) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !loading) {
      onSend(message);
      setMessage('');
      // Reset textarea height after send
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={loading}
          rows={1}
          className="chat-textarea"
        />
        <button 
          type="submit" 
          disabled={!message.trim() || loading}
          className="send-button"
        >
          {loading ? (
            <span className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path 
                fill="currentColor" 
                d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
              />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}