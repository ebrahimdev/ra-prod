import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useAuth } from '../../hooks/useAuth';
import './DashboardPage.css';

const DashboardPage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="user-info">
          <h2 className="dashboard-title">Welcome to TeXGPT</h2>
          {user && (
            <div className="user-details">
              <span className="user-email">{user.email}</span>
              {user.first_name && (
                <span className="user-name">
                  {user.first_name} {user.last_name || ''}
                </span>
              )}
            </div>
          )}
        </div>
        <VSCodeButton
          appearance="secondary"
          onClick={logout}
        >
          Logout
        </VSCodeButton>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-placeholder">
          <p>Dashboard features coming soon...</p>
          <p className="dashboard-placeholder-subtitle">
            This is where your research assistant dashboard will appear.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
