import React, { useState } from 'react';
import { PanelGroup, Panel } from 'react-resizable-panels';
import Sidebar from './components/Sidebar';
import ChatBox from './components/ChatBox';
import MindMapView from './components/MindMapView';

export default function App() {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [mindmapMarkdown, setMindmapMarkdown] = useState('');

 const handleGenerateMindmap = async () => {
  if (selectedDocumentIds.length === 0) return alert('Select at least one document.');

  try {
    const res = await fetch('/api/mindmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: selectedDocumentIds })
    });

    const data = await res.json();
    console.log('Frontend received mindmap:', data.mindmap);

    setMindmapMarkdown(JSON.stringify(data.mindmap)); // ✅ fixed
  } catch (err) {
    console.error('Error generating mind map:', err);
    setMindmapMarkdown('[Error generating mind map]');
  }
};


  return (
    <div className="h-screen w-screen overflow-hidden">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20}>
          <Sidebar
            onSelectionChange={setSelectedDocumentIds}
            selectedDocumentIds={selectedDocumentIds}
          />
        </Panel>
        <Panel defaultSize={50}>
          <ChatBox selectedDocumentIds={selectedDocumentIds} />
        </Panel>
        <Panel defaultSize={30}>
          <MindMapView
            markdown={mindmapMarkdown}
            onGenerate={handleGenerateMindmap}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
