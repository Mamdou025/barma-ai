import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import all global styles
import './styles/globals.css';
import './styles/App.css';
import './styles/Sidebar.css';
import './styles/ChatBox.css';
import './styles/MindMapView.css';
import './styles/components.css';
import './styles/RightPanel.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);