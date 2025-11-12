import React, { useState, useCallback, useEffect } from 'react';
import ChatInitialInput from '../../components/chat/ChatInitialInput';
import ChatHeader from '../../components/chat/ChatHeader';
import MessageList from '../../components/chat/MessageList';
import ConversationInput from '../../components/chat/ConversationInput';
import { ChatProvider } from '../../contexts/ChatContext';
import { postMessage, addMessageListener } from '../../vscode';
import './ChatEditorPage.css';

const ChatEditorPageContent = () => {
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for messages from extension
  useEffect(() => {
    const cleanup = addMessageListener((message) => {
      console.log('Received message from extension:', message);

      switch (message.command) {
        case 'messageResponse':
          handleMessageResponse(message.data);
          break;
        case 'messageError':
          handleMessageError(message.error);
          break;
        case 'init':
          console.log('Chat initialized:', message.conversationId);
          break;
        default:
          console.log('Unknown message command:', message.command);
      }
    });

    // Send ready signal
    postMessage({ command: 'ready' });

    return cleanup;
  }, []);

  const handleMessageResponse = useCallback((data) => {
    console.log('Message response data:', data);

    // Update session ID if this is a new session
    if (data.session_id && !currentSessionId) {
      setCurrentSessionId(data.session_id);
    }

    // Add user message if not already in state
    const userMessage = {
      id: data.user_message_id,
      role: 'user',
      content: data.user_message,
      timestamp: new Date().toISOString()
    };

    // Add assistant message
    const assistantMessage = {
      id: data.assistant_message_id,
      role: 'assistant',
      content: data.message,
      timestamp: data.timestamp
    };

    setMessages(prev => {
      // Check if user message already exists (to avoid duplicates)
      const hasUserMessage = prev.some(m => m.id === userMessage.id);
      if (hasUserMessage) {
        return [...prev, assistantMessage];
      } else {
        return [...prev, userMessage, assistantMessage];
      }
    });

    setIsLoading(false);
    setError(null);
  }, [currentSessionId]);

  const handleMessageError = useCallback((errorMessage) => {
    console.error('Message error:', errorMessage);
    setError(errorMessage);
    setIsLoading(false);
  }, []);

  const handleSendMessage = useCallback((messageText) => {
    console.log('Sending message:', messageText);

    // Add user message optimistically
    const userMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Send to extension
    postMessage({
      command: 'sendMessage',
      text: messageText,
      sessionId: currentSessionId
    });
  }, [currentSessionId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="chat-editor-page">
      {messages.length === 0 ? (
        <ChatInitialInput onSendMessage={handleSendMessage} />
      ) : (
        <>
          <ChatHeader title="New conversation" />
          {error && (
            <div className="chat-error">
              <span className="chat-error-message">{error}</span>
              <button className="chat-error-dismiss" onClick={clearError}>
                ×
              </button>
            </div>
          )}
          <MessageList messages={messages} isLoading={isLoading} />
          <ConversationInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
          />
        </>
      )}
    </div>
  );
};

const ChatEditorPage = () => {
  return (
    <ChatProvider>
      <ChatEditorPageContent />
    </ChatProvider>
  );
};

export default ChatEditorPage;
