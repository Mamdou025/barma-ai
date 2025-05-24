import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Sidebar from './components/Sidebar';
import ChatBox from './components/ChatBox';
import MindMapView from './components/MindMapView';
import PDFViewer from './components/Sidebar/PDFViewer';
import './styles/App.css';

function App() {
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    console.log("✅ Selected document in App.js:", selectedDocument);
  }, [selectedDocument]);

  return (
    <div className="app-container">
      <PanelGroup direction="horizontal">

        {/* Left Panel (Sidebar + PDF Viewer) */}
        <Panel defaultSize={25} minSize={15} className="panel">
          <div className="panel-content">
            <Sidebar onSelectDocument={setSelectedDocument} selectedDocument={selectedDocument} />
          </div>
        </Panel>
        <PanelResizeHandle className="resize-handle" />

        {/* Middle Panel (Chat) */}
        <Panel defaultSize={50} minSize={30} className="panel">
          <div className="panel-content">
            <ChatBox documentId={selectedDocument?.id} />
          </div>
        </Panel>
        <PanelResizeHandle className="resize-handle" />

        {/* Right Panel (Mind Map & Notes) */}
        <Panel defaultSize={25} minSize={15} className="panel">
          <div className="panel-content">
            <MindMapView selectedDoc={selectedDocument} />
          </div>
        </Panel>

      </PanelGroup>
    </div>
  );
}

export default App;
