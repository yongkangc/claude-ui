import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Home } from './components/Home/Home';
import { ConversationView } from './components/ConversationView/ConversationView';
import { LogPage } from './components/LogPage/LogPage';
import { ConversationsProvider } from './contexts/ConversationsContext';
import './styles/global.css';

function ChatApp() {
  return (
    <ConversationsProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/c/:sessionId" element={
          <Layout>
            <ConversationView />
          </Layout>
        } />
        <Route path="/log" element={<LogPage />} />
      </Routes>
    </ConversationsProvider>
  );
}

export default ChatApp;