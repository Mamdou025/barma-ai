// frontend/src/components/RightPanel/index.jsx - UPDATED VERSION

import React, { useState } from 'react';
import ChatBox from '../ChatBox';
import MindMapView from '../MindMapView';
import NotesEditor from './NotesEditor';

import com003 from '../../icons/com/com003.svg' ;
import art005 from '../../icons/art/art005.svg' ;
import fil001 from '../../icons/fil/fil001.svg' ;




const RightPanel = ({ selectedDoc }) => {
  const [activeTab, setActiveTab] = useState('chat');

  const tabs = [
    { id: 'chat', label: 'Chat', icon: <img src={com003} alt="chaticon "  />},
    { id: 'notes', label: 'Notes', icon: <img src={art005} alt="art "  />},
    { id: 'mindmap', label: 'Résumé', icon: <img src={fil001} alt="resume "  /> }
  ];

const renderContent = () => {
    switch (activeTab) {
      case 'notes':
        return (
          <div className="notes-container">
            <div className="notes-header">
              <h2><img src={art005} alt="duotone" /> Mes Notes</h2>
              {selectedDoc && (
                <div className="notes-context">
                  Notes pour: <strong>{selectedDoc.title}</strong>
                </div>
              )}
            </div>
            <NotesEditor 
              documentId={selectedDoc?.id}
              documentTitle={selectedDoc?.title} // Pass document title
              placeholder={selectedDoc ? `Écrire des notes sur ${selectedDoc.title}...` : "Sélectionnez un document pour commencer à prendre des notes"}
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