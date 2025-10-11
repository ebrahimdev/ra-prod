import React from 'react';
import './Layout.css';

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <div className="layout-content">
        {children}
      </div>
    </div>
  );
};

export default Layout;
