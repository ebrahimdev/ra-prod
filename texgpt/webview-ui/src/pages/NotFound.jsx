import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '20px',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: '600' }}>404</h1>
      <p style={{ fontSize: '14px', color: 'var(--vscode-descriptionForeground)' }}>
        Page not found
      </p>
      <VSCodeButton onClick={() => navigate('/')}>
        Go back
      </VSCodeButton>
    </div>
  );
};

export default NotFound;
