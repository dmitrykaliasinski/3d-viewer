import { BrowserRouter, Route, Router, Routes } from 'react-router-dom';
import { ModelViewerPage } from './pages/ModelViewerPage.jsx';
import { Home } from './pages/Home.jsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:modelName" element={<ModelViewerPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
