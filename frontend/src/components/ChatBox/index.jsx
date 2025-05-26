import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';

const ChatBox = ({ selectedDoc }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!selectedDoc) {
      alert('Please select a document first');
      return;
    }

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { message: userMessage, isUser: true }]);
    setLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        `Based on the document "${selectedDoc.title}", I can help you understand the key concepts and legal implications.`,
        'This document contains important information about legal frameworks and compliance requirements.',
        'The document outlines several key clauses that are critical for understanding the legal obligations.',
        'I can help you analyze the risk factors and implications mentioned in this document.'
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages(prev => [...prev, { message: randomResponse, isUser: false }]);
      setLoading(false);
    }, 1500);
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
        <h2>💬 Chat with AI</h2>
        {selectedDoc && (
          <div className="chat-context">
            Currently analyzing: <strong>{selectedDoc.title}</strong>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-chat-icon">💬</div>
            <h3>Start a conversation</h3>
            <p>Ask questions about your uploaded documents and get AI-powered insights.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage key={index} message={msg.message} isUser={msg.isUser} />
          ))
        )}
        
        {loading && (
          <div className="message ai-message">
            <div className="message-avatar">🤖</div>
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