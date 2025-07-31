import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InspectorApp from './inspector/InspectorApp';
import ChatApp from './chat/ChatApp';
import Login from './components/Login/Login';
import { useAuth, getAuthToken, setAuthToken } from './hooks/useAuth';

function App() {
  // Handle auth token extraction from URL fragment
  useAuth();

  // Check if user is authenticated
  const authToken = getAuthToken();
  
  if (!authToken) {
    return <Login onLogin={setAuthToken} />;
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
        <Route path="/inspector" element={<InspectorApp />} />
      </Routes>
    </Router>
  );
}

export default App;