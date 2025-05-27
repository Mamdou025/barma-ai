// frontend/src/components/ChatBox/ChatMessage.jsx - Updated to handle history

import React from 'react';

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
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-text">{message}</div>
        <div className="message-time">
          {isHistory && <span className="history-indicator">📚 </span>}
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;