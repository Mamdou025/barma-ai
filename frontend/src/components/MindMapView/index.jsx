import React, { useState } from 'react';
import { api } from '../../utils/api';

import fil001 from '../../icons/fil/fil001.svg';

// One node of the foldable tree. Leaf strings render as bullets; nodes with
// children render a clickable label that expands/collapses their subtree.
const MindNode = ({ node, depth, forceOpen }) => {
  // Default: the first few levels are open so the outline is visible at a glance.
  const [open, setOpen] = useState(depth < 2);
  const expanded = forceOpen === null ? open : forceOpen;

  if (typeof node === 'string') {
    return <li className="mind-leaf">{node}</li>;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const lvl = node.level ?? depth;

  return (
    <li className="mind-item">
      <div
        className={`mind-label mind-lvl-${lvl}`}
        onClick={() => hasChildren && setOpen((v) => !v)}
        role={hasChildren ? 'button' : undefined}
      >
        <span className="mind-toggle">{hasChildren ? (expanded ? '▾' : '▸') : '·'}</span>
        <span className="mind-title">{node.title}</span>
        {hasChildren && <span className="mind-count">{children.length}</span>}
      </div>
      {hasChildren && expanded && (
        <ul className="mind-children">
          {children.map((child, i) => (
            <MindNode key={i} node={child} depth={depth + 1} forceOpen={forceOpen} />
          ))}
        </ul>
      )}
    </li>
  );
};

const MindMapView = ({ selectedDoc }) => {
  const [mindMap, setMindMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // null = per-node state; true/false = force all expanded/collapsed. `treeKey`
  // remounts the tree so nodes re-read their default after a force toggle.
  const [forceOpen, setForceOpen] = useState(null);
  const [treeKey, setTreeKey] = useState(0);

  const generateMindMap = async () => {
    if (!selectedDoc) {
      alert('Please select a document first');
      return;
    }
    setLoading(true);
    setError(null);
    setForceOpen(null);
    try {
      const response = await api.generateMindMap([selectedDoc.id]);
      setMindMap(response.mindmap);
      setTreeKey((k) => k + 1);
    } catch (err) {
      console.error('MindMap generation error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const expandAll = () => { setForceOpen(true); setTreeKey((k) => k + 1); };
  const collapseAll = () => { setForceOpen(false); setTreeKey((k) => k + 1); };

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
            <div className="mindmap-toolbar">
              <button className="tree-btn" onClick={expandAll}>Tout déplier</button>
              <button className="tree-btn" onClick={collapseAll}>Tout replier</button>
            </div>
            <ul className="mind-tree" key={treeKey}>
              <MindNode node={mindMap} depth={0} forceOpen={forceOpen} />
            </ul>
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
