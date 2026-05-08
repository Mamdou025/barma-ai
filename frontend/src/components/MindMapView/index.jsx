import React, { useState } from 'react';
import { api } from '../../utils/api';

import fil001 from '../../icons/fil/fil001.svg';

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

  const jsonToMarkdown = (node, level = 1) => {
    if (!node) return '';
    const heading = `${'#'.repeat(level)} ${node.title || ''}`;
    if (!node.children || !Array.isArray(node.children)) return heading;
    const children = node.children.map(child =>
      typeof child === 'string' ? `- ${child}` : jsonToMarkdown(child, level + 1)
    ).join('\n');
    return `${heading}\n${children}`;
  };

  const renderMindMap = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => {
      if (line.startsWith('# '))   return <h1 key={index} className="mind-map-h1">{line.slice(2)}</h1>;
      if (line.startsWith('## '))  return <h2 key={index} className="mind-map-h2">{line.slice(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={index} className="mind-map-h3">{line.slice(4)}</h3>;
      if (line.startsWith('- '))   return <li key={index} className="mind-map-li">{line.slice(2)}</li>;
      if (line.trim())             return <p key={index} className="mind-map-p">{line}</p>;
      return <br key={index} />;
    });
  };

  return (
    <div className="mindmap-container">
      <div className="mindmap-header">
        <h2>
          <img src={fil001} alt="resume" /> Résumé structuré
        </h2>
        <button
          onClick={generateMindMap}
          disabled={!selectedDoc || loading}
          className="generate-btn"
        >
          {loading ? 'Génération...' : 'Générer un résumé'}
        </button>
      </div>

      <div className="mindmap-content">
        {loading ? (
          <div className="mindmap-loading">
            <div className="loading-spinner"></div>
            <p>Analyse du document en cours...</p>
          </div>
        ) : error ? (
          <div className="mindmap-error">
            <h3>Erreur</h3>
            <p>{error}</p>
            <button onClick={generateMindMap} className="generate-btn">
              Réessayer
            </button>
          </div>
        ) : mindMap ? (
          <div className="mindmap-display">
            {renderMindMap(jsonToMarkdown(mindMap))}
          </div>
        ) : (
          <div className="mindmap-empty">
            <div className="empty-mindmap-icon">
              <img src={fil001} alt="resume" />
            </div>
            <h3>Générer un résumé</h3>
            <p>Sélectionnez un document et cliquez sur « Générer un résumé » pour obtenir une synthèse structurée des idées clés.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapView;
