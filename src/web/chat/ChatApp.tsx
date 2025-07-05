import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { NewConversation } from './components/NewConversation/NewConversation';
import { ConversationView } from './components/ConversationView/ConversationView';
import { ConversationsProvider } from './contexts/ConversationsContext';
import './styles/global.css';

function ChatApp() {
  return (
    <ConversationsProvider>
      <Layout sidebar={<Sidebar />}>
        <Routes>
          <Route path="/" element={<Navigate to="/new" replace />} />
          <Route path="/new" element={<NewConversation />} />
          <Route path="/c/:sessionId" element={<ConversationView />} />
        </Routes>
      </Layout>
    </ConversationsProvider>
  );
}

export default ChatApp;