import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useAuth } from '../../hooks/useAuth';
import SignupForm from './SignupForm';
import LoginForm from './LoginForm';
import GoogleIcon from '../../components/common/GoogleIcon'
import './AuthPage.css';

const AuthPage = () => {
  const [isSignup, setIsSignup] = useState(true);
  const { isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">Get started</h1>
          <b className="auth-subtitle">
            Sign up or login to start using TeXGPT
          </b>
        </div>

        <div className="auth-form">
          {isSignup ? <SignupForm /> : <LoginForm />}
          <div className="auth-toggle">
            <p>
              Already have an account? Log in
            </p>
          </div>
        </div>

        <div className="google-auth">
          <VSCodeButton
            appearance="secondary"
            className="google-auth-btn"
            onClick={loginWithGoogle}
          >
            <GoogleIcon size={12} />
            <b>Sign in with Google</b>
          </VSCodeButton>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
