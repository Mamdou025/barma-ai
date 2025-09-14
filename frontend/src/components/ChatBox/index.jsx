import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import { api } from '../../utils/api';
import ChatHistory from './ChatHistory';
import { toast } from 'react-toastify';

// Icones 
import com003 from '../../icons/com/com003.svg' ;

const ChatBox = ({ selectedDoc }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!selectedDoc) {
      toast.warn('Please select a document first');
      return;
    }

    const userMessage = input;
    setInput('');
    setError(null);
    
    // Add user message to chat
    const payload = {
      message: userMessage,
      document_ids: [selectedDoc.id],
      session_id: sessionIdRef.current,
    };
    console.log('api.sendMessage payload:', JSON.stringify(payload));

    setMessages(prev => [...prev, { message: userMessage, isUser: true }]);
    setLoading(true);

    try {
      // Call your real API
      const response = await api.sendMessage(
        userMessage,
        [selectedDoc.id],
        sessionIdRef.current
      );
      console.log('api.sendMessage response:', response);

      // Add AI response to chat
      setMessages(prev => [...prev, {
        message: response.reply,
        isUser: false
      }]);
      
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message);
      
      // Add error message to chat
      setMessages(prev => [...prev, {
        message: `Sorry, I encountered an error: ${err.message}`,
        isUser: false,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <ChatHistory documentId={selectedDoc?.id} />
        <h2> <img src={com003} alt="chaticon" /> Discutez avec l'IA</h2>
        {selectedDoc && (
          <div className="chat-context">
            En analyse: <strong>{selectedDoc.title}</strong>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-chat-icon"><img src={com003} alt=" chaticon"  /></div>
            <h3>Commencez une Conversation </h3>
            <p>Posez des questions sur vos documents téléchargés et obtenez des informations basées sur l'IA</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage 
              key={index} 
              message={msg.message} 
              isUser={msg.isUser} 
              isError={msg.isError}
            />
          ))
        )}
        
        {loading && (
          <div className="message ai-message">
            <div className="message-avatar">🟢</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedDoc ? "Ask a question about this document..." : "Select a document to start chatting"}
            disabled={!selectedDoc || loading}
            rows={1}
            className="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !selectedDoc || loading}
            className="send-button"
          >
            {loading ? '⏳' : '🚀'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
