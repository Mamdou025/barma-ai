import React from 'react';
import '../../styles/ChatMessage.css';

const formatMessageText = (text) => {
      if (!text) return null; // Prevent crashing on undefined or null

  // Simple formatting for newlines and URLs
  return text.split('\n').map((paragraph, i) => (
    <React.Fragment key={i}>
      {paragraph.split(' ').map((word, j) => {
        // Basic URL detection
        if (word.startsWith('http://') || word.startsWith('https://')) {
          return (
            <a 
              key={j} 
              href={word} 
              target="_blank" 
              rel="noopener noreferrer"
              className="message-link"
            >
              {word}
            </a>
          );
        }
        return <span key={j}>{word} </span>;
      })}
      <br />
    </React.Fragment>
  ));
};

const ChatMessage = ({ text, isUser, timestamp }) => {
  const messageClass = isUser ? 'user-message' : 'ai-message';
  const timeString = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`message-container ${messageClass}`}>
      <div className="message-bubble">
        <div className="message-content">
          {formatMessageText(text)}
        </div>
        <div className="message-timestamp">
          {timeString}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;