import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import StreamComponent from './componenst/StreamComponent';
import StreamViewer from './componenst/StreamViewer';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StreamComponent />} />
        <Route path="/streams" element={<StreamViewer />} />
      </Routes>
    </Router>
  );
}

export default App;
