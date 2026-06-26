import React from 'react';
import { Routes, Route } from 'react-router-dom';
import TranscriptionPage from './pages/TranscriptionPage.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<TranscriptionPage />} />
      </Routes>
    </div>
  );
}

export default App;
