import React, { useState } from 'react';
import './ChatInitialInput.css';

const ChatInitialInput = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-initial-input">
      <h1 className="chat-initial-title">Ask anything</h1>
      <p className="chat-initial-description">
        Ask any question relates to your papers. TexGPT can also help you find academic papers you need.
      </p>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="chat-input-container">
          <textarea
            className="chat-input-field"
            placeholder="+ Add your papers"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!message.trim()}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M1 8L15 8M15 8L9 2M15 8L9 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInitialInput;
