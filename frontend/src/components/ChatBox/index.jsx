import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import '../../styles/ChatBox.css';

export default function ChatBox({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (message) => {
    if (!message.trim()) return;

    if (!documentId) {
      setError("Please select a document before chatting.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userMessage = { text: message, isUser: true };
      setMessages(prev => [...prev, userMessage]);

      const requestBody = {
        message,
        document_ids: [documentId], // ✅ Include selected document
      };

      console.log('Sending request with body:', JSON.stringify(requestBody));

      const response = await fetch('https://barma-ai-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': 'Bearer YOUR_API_KEY' // Uncomment if needed
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response data:', errorData);
        throw new Error(errorData.message || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      console.log('Success response:', data);
      setMessages(prev => [...prev, { text: data.reply, isUser: false }]);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to get response. Please try again.');
      setMessages(prev => [...prev, {
        text: err.message || "Sorry, I couldn't process your request.",
        isUser: false
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h2>Chat with AI</h2>
        {error && <div className="chat-error">{error}</div>}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            Ask a question about your documents to get started
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} text={msg.text} isUser={msg.isUser} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} loading={loading} />
    </div>
  );
}
