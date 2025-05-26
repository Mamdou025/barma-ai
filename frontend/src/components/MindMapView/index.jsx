import React, { useState } from 'react';
import { api } from '../../utils/api';

const MindMapView = ({ selectedDoc }) => {
  const [mindMap, setMindMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateMindMap = async () => {
    if (!selectedDoc) {
      alert('Please select a document first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await api.generateMindMap([selectedDoc.id]);
      setMindMap(response.mindmap);
    } catch (err) {
      console.error('MindMap generation error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert JSON mindmap to markdown for display
  const jsonToMarkdown = (node, level = 1) => {
    if (!node) return '';
    
    const heading = `${'#'.repeat(level)} ${node.title || ''}`;
    
    if (!node.children || !Array.isArray(node.children)) {
      return heading;
    }
    
    const children = node.children.map(child => {
      if (typeof child === 'string') {
        return `- ${child}`;
      } else {
        return jsonToMarkdown(child, level + 1);
      }
    }).join('\n');
    
    return `${heading}\n${children}`;
  };

  const renderMindMap = (text) => {
    if (!text) return null;
    
    return text.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="mind-map-h1">{line.slice(2)}</h1>;
      } else if (line.startsWith('## ')) {
        return <h2 key={index} className="mind-map-h2">{line.slice(3)}</h2>;
      } else if (line.startsWith('### ')) {
        return <h3 key={index} className="mind-map-h3">{line.slice(4)}</h3>;
      } else if (line.startsWith('- ')) {
        return <li key={index} className="mind-map-li">{line.slice(2)}</li>;
      } else if (line.trim()) {
        return <p key={index} className="mind-map-p">{line}</p>;
      }
      return <br key={index} />;
    });
  };

  return (
    <div className="mindmap-container">
      <div className="mindmap-header">
        <h2>🧠 Mind Map Generator</h2>
        <button 
          onClick={generateMindMap}
          disabled={!selectedDoc || loading}
          className="generate-btn"
        >
          {loading ? '⏳ Generating...' : '✨ Generate Mind Map'}
        </button>
      </div>

      <div className="mindmap-content">
        {loading ? (
          <div className="mindmap-loading">
            <div className="loading-spinner"></div>
            <p>Analyzing document and generating mind map...</p>
          </div>
        ) : error ? (
          <div className="mindmap-error">
            <h3>❌ Error</h3>
            <p>{error}</p>
            <button onClick={generateMindMap} className="retry-btn">
              🔄 Retry
            </button>
          </div>
        ) : mindMap ? (
          <div className="mindmap-display">
            {renderMindMap(jsonToMarkdown(mindMap))}
          </div>
        ) : (
          <div className="mindmap-empty">
            <div className="empty-mindmap-icon">🧠</div>
            <h3>Generate a Mind Map</h3>
            <p>Select a document and click "Generate Mind Map" to create a visual overview of key concepts and insights.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapView;