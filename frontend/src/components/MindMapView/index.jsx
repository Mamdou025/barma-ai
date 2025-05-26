import React, { useState } from 'react';

const MindMapView = ({ selectedDoc }) => {
  const [mindMap, setMindMap] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateMindMap = async () => {
    if (!selectedDoc) {
      alert('Please select a document first');
      return;
    }

    setLoading(true);
    setError(null);
    
    // Simulate mind map generation
    setTimeout(() => {
      const sampleMindMap = `# ${selectedDoc.title} - Analysis

## 📋 Key Concepts
- Legal Framework Overview
- Compliance Requirements
- Risk Assessment Guidelines
- Implementation Strategies

## ⚖️ Legal Implications
- Regulatory Compliance
- Liability Considerations
- Contractual Obligations
- Dispute Resolution

## 🎯 Action Items
- Review Section 3.2
- Update Policy Documents
- Consult Legal Team
- Schedule Compliance Audit

## 📊 Risk Factors
- **High Priority**: Regulatory changes
- **Medium Priority**: Implementation timeline
- **Low Priority**: Documentation updates`;

      setMindMap(sampleMindMap);
      setLoading(false);
    }, 2000);
  };

  const renderMindMap = (text) => {
    if (!text) return null;
    
    return text.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="mind-map-h1">{line.slice(2)}</h1>;
      } else if (line.startsWith('## ')) {
        return <h2 key={index} className="mind-map-h2">{line.slice(3)}</h2>;
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
        ) : mindMap ? (
          <div className="mindmap-display">
            {renderMindMap(mindMap)}
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