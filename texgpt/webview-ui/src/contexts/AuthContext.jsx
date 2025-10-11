import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useVSCode } from '../hooks/useVSCode';
import { getState, setState } from '../vscode';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle messages from the extension
  const handleMessage = useCallback((message) => {
    switch (message.command) {
      case 'setUser':
        setUser(message.user);
        setLoading(false);
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

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
