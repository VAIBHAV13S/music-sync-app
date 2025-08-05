import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import HomePage from './pages/Home';
import HostRoom from './pages/HostRoom';
import JoinRoom from './pages/JoinRoom';
import ConnectionDebug from './components/ConnectionDebug';
import { useState } from 'react';
import './index.css';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <HomePage />
            ) : (
              <HomePage onShowAuth={() => setShowAuthModal(true)} />
            )
          }
        />
        <Route
          path="/host/:mode"
          element={
            isAuthenticated ? (
              <HostRoom />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/join/:mode"
          element={
            isAuthenticated ? (
              <JoinRoom />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* Debug route - only accessible in development */}
        {import.meta.env.DEV && (
          <Route
            path="/debug"
            element={<ConnectionDebug />}
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

export default App;