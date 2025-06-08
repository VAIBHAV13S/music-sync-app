import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/Home';
import HostRoom from './pages/HostRoom';
import JoinRoom from './pages/JoinRoom';
import './index.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host/:mode" element={<HostRoom />} />
        <Route path="/join/:mode" element={<JoinRoom />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </div>
  );
}

export default App;