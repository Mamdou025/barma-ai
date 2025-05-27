// frontend/src/components/ChatBox/ChatHistory.jsx - Updated to use ChatMessage

import React, { useEffect, useState } from 'react';
import ChatMessage from './ChatMessage';

const ChatHistory = ({ documentId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!documentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE_URL}/api/chatlogs/${documentId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        setLogs(result.logs || []);

      } catch (err) {
        console.error('❌ Chat history fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [documentId]);

  // Convert chat logs into message pairs for display
  const convertLogsToMessages = (logs) => {
    const messages = [];
    
    logs.forEach((log) => {
      // Add user message
      if (log.user_message) {
        messages.push({
          id: `${log.id}-user`,
          message: log.user_message,
          isUser: true,
          timestamp: log.created_at,
          isHistory: true
        });
      }
      
      // Add AI response
      if (log.ai_response) {
        messages.push({
          id: `${log.id}-ai`,
          message: log.ai_response,
          isUser: false,
          timestamp: log.created_at,
          isHistory: true,
          responseTime: log.response_time_ms
        });
      }
    });
    
    return messages;
  };

  // Don't render anything if no document is selected
  if (!documentId) {
    return null;
  }

  const historyMessages = convertLogsToMessages(logs);

  return (
    <div className="chat-history">
      <div className="chat-history-header">
        <button 
          className={`history-toggle ${isExpanded ? 'expanded' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={loading || error || logs.length === 0}
        >
          <span className="toggle-icon">
            {isExpanded ? '📖' : '📚'}
          </span>
          <span className="toggle-text">
            Chat History {logs.length > 0 && `(${logs.length} conversations)`}
          </span>
          <span className="toggle-arrow">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="chat-history-content">
          {loading ? (
            <div className="history-loading">
              <div className="loading-spinner"></div>
              <span>Loading previous conversations...</span>
            </div>
          ) : error ? (
            <div className="history-error">
              <p className="error-message">❌ Failed to load history: {error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="retry-btn"
              >
                🔄 Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="history-empty">
              <div className="empty-icon">💬</div>
              <p>No previous conversations</p>
              <span>Start chatting to build your history!</span>
            </div>
          ) : (
            <div className="history-messages">
              <div className="history-divider">
                <span>Previous Conversations</span>
              </div>
              {historyMessages.map((msg) => (
                <div key={msg.id} className="history-message-wrapper">
                  <ChatMessage 
                    message={msg.message} 
                    isUser={msg.isUser}
                    timestamp={msg.timestamp}
                    isHistory={true}
                  />
                  {msg.responseTime && !msg.isUser && (
                    <div className="response-time-badge">
                      ⚡ {msg.responseTime}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatHistory;