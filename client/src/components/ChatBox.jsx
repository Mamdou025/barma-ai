import React, { useState } from 'react';

export default function ChatBox({ selectedDocumentIds }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim() || selectedDocumentIds.length === 0) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const res = await fetch('https://barma-ai-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_ids: selectedDocumentIds,
          message: input,
        }),
      });

      const data = await res.json();
      console.log('Chat API response:', data);

      const reply = data.reply || '[No response]';
      const aiMessage = { role: 'assistant', content: reply };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat failed:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '[Error fetching reply]' },
      ]);
    }
  };

  return (
    <div className="h-full w-full p-4 border-r border-gray-300 flex flex-col">
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div className="inline-block border border-gray-300 rounded p-2 bg-white max-w-xs">
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <textarea
          className="flex-1 border border-gray-300 p-2"
          rows="2"
          placeholder="Demandez quelque chose ... "
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={handleSend}
          className="border border-gray-400 px-4 py-2 bg-gray-100 hover:bg-gray-200"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
