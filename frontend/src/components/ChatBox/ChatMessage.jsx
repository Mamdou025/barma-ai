import React from 'react';
import ReactMarkdown from 'react-markdown';

const ChatMessage = ({ message, isUser, timestamp, isHistory = false }) => {
  const formatTime = (timestamp) => {
    if (timestamp) {
      return new Date(timestamp).toLocaleString([], { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
        <div className="message-time">
          {isHistory && <span className="history-indicator">📚 </span>}
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
