import React, { useState } from 'react';
import ChatBox from '../ChatBox';
import MindMapView from '../MindMapView';
import NotesEditor from './NotesEditor';

const RightPanel = ({ selectedDoc }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [notes, setNotes] = useState('');

  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'mindmap', label: 'Mind Map', icon: '🧠' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatBox selectedDoc={selectedDoc} />;
      case 'notes':
        return (
          <div className="notes-container">
            <div className="notes-header">
              <h2>📝 My Notes</h2>
              {selectedDoc && (
                <div className="notes-context">
                  Notes for: <strong>{selectedDoc.title}</strong>
                </div>
              )}
            </div>
            <NotesEditor 
              notes={notes} 
              onChange={setNotes}
              placeholder={selectedDoc ? `Write notes about ${selectedDoc.title}...` : "Select a document to start taking notes"}
            />
          </div>
        );
      case 'mindmap':
        return <MindMapView selectedDoc={selectedDoc} />;
      default:
        return <ChatBox selectedDoc={selectedDoc} />;
    }
  };

  return (
    <div className="right-panel-container">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default RightPanel;