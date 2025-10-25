import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ChatEditorPage from './pages/Chat/ChatEditorPage';
import './styles/global.css';

function ChatRouter() {
  return (
    <MemoryRouter>
      <div className="chat-container">
        <Routes>
          <Route path="/" element={<ChatEditorPage />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}

export default ChatRouter;
