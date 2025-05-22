import React, { useState } from 'react';

function MindMapNode({ node }) {
  const [expanded, setExpanded] = useState(true);

  if (typeof node === 'string') {
    return <li className="ml-4 list-disc">{node}</li>;
  }

  return (
    <li className="ml-2">
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer font-medium hover:underline"
      >
        {node.title}
      </div>
      {expanded && node.children?.length > 0 && (
        <ul className="ml-4 list-disc">
          {node.children.map((child, index) => (
            <MindMapNode key={index} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MindMapView({ markdown, onGenerate }) {
  let mindmap;
  try {
    mindmap = markdown ? JSON.parse(markdown) : null;
  } catch (err) {
    mindmap = null;
  }

  return (
    <div className="h-full w-full p-4 flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Mind Map & Notes</h2>
      <button
        onClick={onGenerate}
        className="mb-4 border px-3 py-1 bg-gray-100 hover:bg-gray-200"
      >
        Résumer document
      </button>

      <div className="flex-1 overflow-y-auto border border-gray-300 p-2 rounded bg-white">
        {mindmap ? (
          <ul className="list-disc pl-2">
            <MindMapNode node={mindmap} />
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Pas encore de resume de document  document cliquez pour generer .</p>
        )}
      </div>

      <textarea
        className="border border-gray-300 p-2 mt-4 w-full h-28"
        placeholder="Your notes..."
      />
    </div>
  );
}
