/**
 * VSCode API wrapper for webview communication
 */

// Acquire VS Code API - this is a singleton provided by VS Code
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

/**
 * Post a message to the extension
 * @param {object} message - The message to send
 */
export const postMessage = (message) => {
  if (vscode) {
    vscode.postMessage(message);
  } else {
    console.warn('VSCode API not available. Running in development mode?', message);
  }
};

/**
 * Get the VSCode API state
 * @returns {object} The state object
 */
export const getState = () => {
  return vscode?.getState() || {};
};

/**
 * Set the VSCode API state
 * @param {object} state - The state to save
 */
export const setState = (state) => {
  if (vscode) {
    vscode.setState(state);
  }
};

/**
 * Add a message listener
 * @param {function} callback - Callback function to handle messages
 * @returns {function} Cleanup function to remove the listener
 */
export const addMessageListener = (callback) => {
  const handler = (event) => {
    callback(event.data);
  };

  window.addEventListener('message', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handler);
  };
};

export default {
  postMessage,
  getState,
  setState,
  addMessageListener
};
