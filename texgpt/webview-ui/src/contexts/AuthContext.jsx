import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useVSCode } from '../hooks/useVSCode';
import { getState, setState } from '../vscode';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  // Handle messages from the extension
  const handleMessage = useCallback((message) => {
    switch (message.command) {
      case 'setUser':
        setUser(message.user);
        setLoading(false);
        // Check if this is a first-time user
        // TEMP: Always show onboarding for testing
        setIsFirstTimeUser(true);
        // if (message.isFirstTimeUser) {
        //   setIsFirstTimeUser(true);
        // }
        // Persist user in webview state
        setState({ user: message.user });
        break;

      case 'authError':
        setError(message.error);
        setLoading(false);
        break;

      case 'authSuccess':
        setError(null);
        // Extension will reload the window, so we don't need to handle this
        break;

      case 'logout':
        setUser(null);
        setState({ user: null });
        break;

      default:
        break;
    }
  }, []);

  const sendMessage = useVSCode(handleMessage);

  // Initialize auth state on mount
  useEffect(() => {
    // Try to restore user from webview state
    const savedState = getState();
    if (savedState?.user) {
      setUser(savedState.user);
      setLoading(false);
      // TEMP: Always show onboarding for testing
      setIsFirstTimeUser(true);
    } else {
      // Request user data from extension
      sendMessage({ command: 'requestUserData' });
    }
  }, [sendMessage]);

  // Auth actions
  const login = useCallback((email, password) => {
    setLoading(true);
    setError(null);
    sendMessage({
      command: 'loginWithEmail',
      email,
      password
    });
  }, [sendMessage]);

  const register = useCallback((email, password) => {
    setLoading(true);
    setError(null);
    sendMessage({
      command: 'signupWithEmail',
      email,
      password
    });
  }, [sendMessage]);

  const loginWithGoogle = useCallback(() => {
    sendMessage({ command: 'signup' });
  }, [sendMessage]);

  const logout = useCallback(() => {
    sendMessage({ command: 'logout' });
  }, [sendMessage]);

  const markOnboardingComplete = useCallback(() => {
    setIsFirstTimeUser(false);
    sendMessage({ command: 'markOnboardingComplete' });
  }, [sendMessage]);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isFirstTimeUser,
    login,
    register,
    loginWithGoogle,
    logout,
    markOnboardingComplete
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
