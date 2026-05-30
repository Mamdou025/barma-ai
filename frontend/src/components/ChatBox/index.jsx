// frontend/src/components/ChatBox/index.jsx
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import { api } from '../../utils/api';
import ChatHistory from './ChatHistory';

// Icones
import com003 from '../../icons/com/com003.svg';

const ChatBox = ({ selectedDoc }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate a new session identifier when the selected document changes
  useEffect(() => {
    if (selectedDoc) {
      sessionIdRef.current = `${selectedDoc.id}-${Date.now()}`;
    } else {
      sessionIdRef.current = null;
    }
  }, [selectedDoc]);

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!selectedDoc) {
      alert('Please select a document first');
      return;
    }

    const userMessage = input;
    setInput('');
    setError(null);

    // Add user message to chat
    console.log('=== SEND BUTTON CLICKED ===');
    console.log('1. User message:', userMessage);
    console.log('2. Selected document:', selectedDoc);
    console.log('3. Selected document ID:', selectedDoc?.id);
    console.log('4. Document IDs array:', [selectedDoc.id]);
    console.log('5. About to call api.sendMessage with:', {
      message: userMessage,
      documentIds: [selectedDoc.id],
      sessionId: sessionIdRef.current
    });
    console.log('==============================');

    setMessages(prev => [
      ...prev,
      {
        message: userMessage,
        isUser: true,
        sourceMap: null,
        timestamp: Date.now()
      }
    ]);
    setLoading(true);

    // The AI bubble we progressively fill as tokens stream in, addressed by a
    // stable id. `created` is a synchronous guard so rapid deltas can't append
    // duplicate bubbles before the first append has flushed to state.
    const aiId = `ai-${Date.now()}`;
    let created = false;
    const ensureAiMessage = () => {
      if (created) return;
      created = true;
      setMessages(prev => [
        ...prev,
        {
          id: aiId,
          message: '',
          isUser: false,
          sourceMap: {},
          streaming: true,
          timestamp: Date.now()
        }
      ]);
      setLoading(false); // first event arrived: swap the typing dots for live text
    };
    const updateAi = (patch) => {
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m
      ));
    };

    try {
      await api.sendMessageStream(userMessage, [selectedDoc.id], sessionIdRef.current, {
        onMeta: ({ source_map }) => {
          ensureAiMessage();
          updateAi({ sourceMap: source_map || {} });
        },
        onDelta: (text) => {
          ensureAiMessage();
          updateAi(m => ({ message: m.message + text }));
        },
        onDone: ({ reply, source_map }) => {
          ensureAiMessage();
          updateAi(m => ({
            // Prefer the post-processed reply (highlights + sources) when present.
            message: reply ?? m.message,
            sourceMap: source_map || m.sourceMap || {},
            streaming: false
          }));
        }
      });

    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message);

      if (created) {
        // Stream started then failed: turn the in-progress bubble into an error.
        updateAi({ message: `Sorry, I encountered an error: ${err.message}`, isError: true, streaming: false });
      } else {
        setMessages(prev => [
          ...prev,
          {
            message: `Sorry, I encountered an error: ${err.message}`,
            isUser: false,
            isError: true,
            sourceMap: null,
            timestamp: Date.now()
          }
        ]);
      }
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
        <h2>
          <img src={com003} alt="chaticon" /> Discutez avec l'IA
        </h2>
        {selectedDoc && (
          <div className="chat-context">
            En analyse: <strong>{selectedDoc.title}</strong>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-chat-icon">
              <img src={com003} alt="chaticon" />
            </div>
            <h3>Commencez une conversation</h3>
            <p>Posez des questions sur vos documents et obtenez des réponses juridiques précises basées sur leur contenu.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg.message}
              isUser={msg.isUser}
              isError={msg.isError}
              streaming={msg.streaming}
              sourceMap={msg.sourceMap}
              timestamp={msg.timestamp}
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
            placeholder={selectedDoc ? "Posez une question sur ce document…" : "Sélectionnez un document pour commencer"}
            disabled={!selectedDoc || loading}
            rows={1}
            className="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !selectedDoc || loading}
            className="send-button"
            aria-label="Envoyer"
          >
            {loading ? (
              <svg className="spin-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25"/>
                <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
