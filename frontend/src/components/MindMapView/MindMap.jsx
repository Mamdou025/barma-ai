import ReactMarkdown from 'react-markdown';
import '../../styles/MindMapView.css';

export default function MindMap({ markdown, loading, error }) {
  if (error) {
    return (
      <div className="mind-map-error">
        Error generating mind map: {error.message || 'Unknown error'}
      </div>
    );
  }

  if (loading) {
    return <div className="mind-map-loading">Generating mind map...</div>;
  }

  if (!markdown) {
    return (
      <div className="mind-map-placeholder">
        Select a document and click "Generate Mind Map"
      </div>
    );
  }

  return (
    <div className="mind-map-container">
      <ReactMarkdown 
        components={{
          h1: ({ node, ...props }) => <h1 className="mind-map-h1" {...props} />,
          h2: ({ node, ...props }) => <h2 className="mind-map-h2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="mind-map-h3" {...props} />,
          p: ({ node, ...props }) => <p className="mind-map-p" {...props} />,
          ul: ({ node, ...props }) => <ul className="mind-map-ul" {...props} />,
          li: ({ node, ...props }) => <li className="mind-map-li" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}