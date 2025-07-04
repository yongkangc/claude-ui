import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ConsoleApp from './console/ConsoleApp';
import ChatApp from './chat/ChatApp';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/console" element={<ConsoleApp />} />
      </Routes>
    </Router>
  );
}

export default App;