import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ConsoleApp from './console/ConsoleApp';
import ChatApp from './chat/ChatApp';
import { useAuth, getAuthToken } from './hooks/useAuth';

function App() {
  // Handle auth token extraction from URL fragment
  useAuth();

  // Check if user is authenticated
  const authToken = getAuthToken();
  
  if (!authToken) {
    return 'Unauthorized';
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/*" element={<ChatApp />} />
        <Route path="/console" element={<ConsoleApp />} />
      </Routes>
    </Router>
  );
}

export default App;