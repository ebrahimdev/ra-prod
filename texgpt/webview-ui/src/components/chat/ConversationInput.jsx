import React, { useState } from 'react';
import './ConversationInput.css';

const ConversationInput = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
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
    <div className="conversation-input">
      <form onSubmit={handleSubmit} className="conversation-input-form">
        <div className="conversation-input-container">
          <button
            type="button"
            className="conversation-attach-button"
            aria-label="Attach file"
            disabled={disabled}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2V8M8 8V14M8 8H14M8 8H2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <textarea
            className="conversation-input-field"
            placeholder="Ask anything"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
          <button
            type="submit"
            className="conversation-send-button"
            disabled={!message.trim() || disabled}
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

export default ConversationInput;
