import React from 'react';
import './ChatHeader.css';

const ChatHeader = ({ title = 'New conversation' }) => {
  return (
    <div className="chat-header">
      <div className="chat-header-title">
        {title}
      </div>
    </div>
  );
};

export default ChatHeader;
