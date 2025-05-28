import React, { useState } from 'react';
import { useResizable } from './hooks/useResizable';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // TWO-PANEL LAYOUT: Sidebar (40%) | Combined Panel (60%)
  const leftPanel = useResizable(560, 400, 900);

  const handleUpload = (newDoc) => {
    setDocuments(prev => [...prev, newDoc]);
    setSelectedDoc(newDoc);
  };

  const handleDelete = (docId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document?')) {
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
      }
    }
  };

  return (
    <div className="app">
      {/* Left Panel - PDF Sidebar */}
      <div className="panel left-panel" style={{ width: leftPanel.width }}>
        <Sidebar
          documents={documents}
          selectedDoc={selectedDoc}
          onSelectDoc={setSelectedDoc}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />
      </div>

      {/* Resize Handle */}
      <div
        className={`resize-handle ${leftPanel.isResizing ? 'resizing' : ''}`}
        onMouseDown={leftPanel.startResize}
      />

      {/* Right Panel - Combined Chat/Notes/MindMap */}
      <div className="panel right-panel-main">
        <RightPanel selectedDoc={selectedDoc} />
      </div>
    </div>
  );
};

export default App;