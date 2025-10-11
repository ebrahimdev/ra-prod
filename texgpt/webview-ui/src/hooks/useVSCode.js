import { useEffect, useCallback } from 'react';
import { postMessage, addMessageListener } from '../vscode';

/**
 * Hook for VSCode webview communication
 * @param {function} onMessage - Callback to handle incoming messages
 * @returns {function} Function to send messages to the extension
 */
export const useVSCode = (onMessage) => {
  useEffect(() => {
    if (!onMessage) return;

    const cleanup = addMessageListener(onMessage);
    return cleanup;
  }, [onMessage]);

  const sendMessage = useCallback((message) => {
    postMessage(message);
  }, []);

  return sendMessage;
};

export default useVSCode;
