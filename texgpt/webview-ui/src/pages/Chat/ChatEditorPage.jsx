import React, { useState } from 'react';
import ChatInitialInput from '../../components/chat/ChatInitialInput';
import './ChatEditorPage.css';

const ChatEditorPage = () => {
  const [messages, setMessages] = useState([]);

  const handleSendMessage = (message) => {
    // For now, just add the message to state
    // Later we'll connect to backend
    console.log('Sending message:', message);

    const newMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, newMessage]);

    // TODO: Send to backend and get response
  };

  return (
    <div className="chat-editor-page">
      {messages.length === 0 ? (
        <ChatInitialInput onSendMessage={handleSendMessage} />
      ) : (
        <div className="chat-messages">
          {/* TODO: Add MessageList and ChatInput components */}
          <p>Messages will appear here...</p>
          {messages.map(msg => (
            <div key={msg.id}>{msg.content}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatEditorPage;
