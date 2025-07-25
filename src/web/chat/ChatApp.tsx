import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Home } from './components/Home/Home';
import { ConversationView } from './components/ConversationView/ConversationView';
import { LogPage } from './components/LogPage/LogPage';
import { ConversationsProvider } from './contexts/ConversationsContext';
import { StreamStatusProvider } from './contexts/StreamStatusContext';
import './styles/global.css';

function ChatApp() {
  return (
    <StreamStatusProvider>
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
    </StreamStatusProvider>
  );
}

export default ChatApp;