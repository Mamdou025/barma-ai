import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Sidebar from './components/Sidebar';
import ChatBox from './components/ChatBox';
import MindMapView from './components/MindMapView';
import PDFViewer from './components/Sidebar/PDFViewer'; // Ensure you import this
import './styles/App.css';

function App() {
  const [selectedDocument, setSelectedDocument] = useState(null);
  useEffect(() => {
    console.log("✅ Selected document in App.js:", selectedDocument);
  }, [selectedDocument]);
  return (
    <PanelGroup direction="horizontal">
      {/* Left Panel (Sidebar) */}
      <Panel defaultSize={25} minSize={15}>
<Sidebar onSelectDocument={setSelectedDocument} selectedDocument={selectedDocument} />
        <PDFViewer pdfUrl={selectedDocument?.storage_url} />
      </Panel>
      <PanelResizeHandle className="resize-handle" />

      {/* Middle Panel (Chat) */}
      <Panel defaultSize={50}>
        <ChatBox documentId={selectedDocument?.id} />
      </Panel>
      <PanelResizeHandle className="resize-handle" />

      {/* Right Panel (Mind Map) */}
      <Panel defaultSize={25} minSize={15}>
        <MindMapView documentId={selectedDocument?.id} />
      </Panel>
    </PanelGroup>
  );
}

export default App;
