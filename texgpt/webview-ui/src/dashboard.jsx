import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardRouter from './DashboardRouter';

// VSCode Webview UI Toolkit is loaded via script tag in HTML
// to ensure custom elements are registered before React initializes

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DashboardRouter />
  </React.StrictMode>
);
