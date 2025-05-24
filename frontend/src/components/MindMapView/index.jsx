import { useState , useEffect } from 'react';
import MindMap from './MindMap';
import NotesEditor from './NotesEditor';
import '../../styles/MindMapView.css';

function jsonToMarkdown(node, level = 1) {
  if (!node) return '';
  const heading = `${'#'.repeat(level)} ${node.title || ''}`;
  const children = Array.isArray(node.children)
    ? node.children.map(child =>
        typeof child === 'string'
          ? `- ${child}`
          : jsonToMarkdown(child, level + 1)
      ).join('\n')
    : '';
  return `${heading}\n${children}`;
}


export default function MindMapView({ documentId }) {
  const [mindMap, setMindMap] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

useEffect(() => {
  console.log("📄 documentId in MindMapView:", documentId);
}, [documentId]);


const generateMindMap = async () => {
  if (!documentId) {
    setError('No document selected.');
    return;
  }

  try {
    setLoading(true);
    setError(null);

    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/mindmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ document_ids: [documentId] }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("🧠 Raw mindmap data:", data.mindmap);
console.log("🧠 typeof data.mindmap:", typeof data.mindmap);

try {
  if (typeof data.mindmap === 'string') {
    console.warn("⚠️ Received string instead of object, attempting parse.");
    const safeResponse = data.mindmap
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');
    const parsed = JSON.parse(safeResponse);
    setMindMap(jsonToMarkdown(parsed));
  } else {
    // ✅ It's already a JavaScript object
    setMindMap(jsonToMarkdown(data.mindmap));
  }
} catch (err) {
  console.error("❌ Final parse failure:", err, data.mindmap);
  setMindMap("Invalid mind map format returned.");
}


  } catch (err) {
    console.error('MindMap generation error:', err);
    setError('Failed to generate mind map. Please try again.');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="mind-map-view">
      <div className="mind-map-header">
        <h3>Mind Map Generator</h3>
        <div className="mind-map-controls">
          <button onClick={generateMindMap} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Mind Map'}
          </button>
          {error && <div className="mind-map-error">{error}</div>}
        </div>
      </div>

      <div className="mind-map-content">
        {mindMap ? (
  <MindMap markdown={mindMap} />
) : (
  <div className="mind-map-placeholder">No mind map generated yet</div>
)}

      </div>

      <div className="notes-section">
        <h3>Notes</h3>
        <NotesEditor notes={notes} onChange={setNotes} />
      </div>
    </div>
  );
}
