import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { NewConversation } from './components/NewConversation/NewConversation';
import { ConversationView } from './components/ConversationView/ConversationView';
import './styles/global.css';

function ChatApp() {
  return (
    <Layout sidebar={<Sidebar />}>
      <Routes>
        <Route path="/" element={<Navigate to="/new" replace />} />
        <Route path="/new" element={<NewConversation />} />
        <Route path="/c/:sessionId" element={<ConversationView />} />
      </Routes>
    </Layout>
  );
}

export default ChatApp;