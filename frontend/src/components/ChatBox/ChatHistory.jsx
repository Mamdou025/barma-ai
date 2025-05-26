import React, { useEffect, useState } from 'react';

const ChatHistory = ({ documentId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/chatlogs/${documentId}`);

        if (!response.ok) {
          const text = await response.text();
          console.error('🔍 Raw error response:', text);
          throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();
        setLogs(result.logs);

      } catch (err) {
        console.error('Chat history error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchLogs();
    }
  }, [documentId]);

  if (!documentId) return null;

  return (
    <div className="chat-history">
      <h3>🕓 Chat History</h3>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="error">❌ {error}</p>
      ) : logs.length === 0 ? (
        <p>No previous chats for this document.</p>
      ) : (
        <ul className="history-list">
          {logs.map(log => (
            <li key={log.id} className="history-item">
              <p className="history-q"><strong>Q:</strong> {log.user_message}</p>
              <p className="history-a"><strong>A:</strong> {log.ai_response}</p>
              <p className="history-time">🗓️ {new Date(log.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChatHistory;
