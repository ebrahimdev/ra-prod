import React, { createContext, useState, useCallback } from 'react';

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const addMessages = useCallback((newMessages) => {
    setMessages(prev => [...prev, ...newMessages]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
  }, []);

  const updateSessionId = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
  }, []);

  const setLoadingState = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  const setErrorState = useCallback((errorMessage) => {
    setError(errorMessage);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    currentSessionId,
    messages,
    isLoading,
    error,
    addMessage,
    addMessages,
    clearMessages,
    updateSessionId,
    setLoadingState,
    setErrorState,
    clearError
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
