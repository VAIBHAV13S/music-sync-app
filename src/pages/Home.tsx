import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HomeProps {
  onShowAuth?: () => void;
}

function Home({ onShowAuth }: HomeProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [quickJoinCode, setQuickJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleQuickJoin = async () => {
    if (!quickJoinCode.trim()) return;
    
    setIsJoining(true);
    
    try {
      // Auto-detect server URL
      const getServerUrl = () => {
        if (import.meta.env.VITE_SOCKET_SERVER_URL) {
          return import.meta.env.VITE_SOCKET_SERVER_URL;
        }
        if (import.meta.env.PROD || window.location.hostname.includes('vercel.app')) {
          return 'https://music-sync-server-nz0r.onrender.com';
        }
        return 'http://localhost:3001';
      };

      const API_BASE_URL = getServerUrl().replace(/\/$/, '');
      
      // Check if room exists before navigating
      const response = await fetch(`${API_BASE_URL}/api/rooms/${quickJoinCode}`);
      
      if (response.ok) {
        navigate(`/join/${quickJoinCode}`);
      } else {
        alert('Room not found. Please check the room code and try again.');
      }
    } catch (error) {
      console.error('Failed to check room:', error);
      alert('Connection error. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickJoin();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* Professional Header */}
      <header className="bg-gray-800/90 backdrop-blur-lg border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-.01L12 3z"/>
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-white">MusicSync</h1>
              </div>
            </div>
            
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-white">{user?.username}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="inline-flex items-center px-3 py-2 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing out...
                    </>
                  ) : (
                    'Sign out'
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={onShowAuth}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isAuthenticated ? (
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                Listen to music
                <span className="block text-blue-400">together, anywhere</span>
              </h1>
              <p className="mt-3 max-w-md mx-auto text-base text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                Create synchronized music rooms and enjoy your favorite songs with friends in real-time.
              </p>
            </div>

            {/* Quick Join Section */}
            <div className="max-w-md mx-auto">
              <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
                <h3 className="text-lg font-medium text-white mb-4">Join a room</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="room-code" className="block text-sm font-medium text-gray-300 mb-2">
                      Room code
                    </label>
                    <input
                      id="room-code"
                      type="text"
                      placeholder="Enter room code"
                      value={quickJoinCode}
                      onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                      onKeyPress={handleKeyPress}
                      className="block w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      maxLength={10}
                    />
                  </div>
                  <button
                    onClick={handleQuickJoin}
                    disabled={!quickJoinCode.trim() || isJoining}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isJoining ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Joining...
                      </>
                    ) : (
                      'Join room'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
              <div className="bg-gray-800 overflow-hidden shadow-lg rounded-xl border border-gray-700">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-white">Host a Room</h3>
                      <p className="text-sm text-gray-400">Create a new music session and invite others</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => navigate('/host/group')}
                      className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Create Room
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 overflow-hidden shadow-lg rounded-xl border border-gray-700">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-white">Browse Rooms</h3>
                      <p className="text-sm text-gray-400">Find and join public music sessions</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => navigate('/join/browse')}
                      className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      Browse Rooms
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                Listen to music
                <span className="block text-blue-400">together, anywhere</span>
              </h1>
              <p className="mt-3 max-w-md mx-auto text-base text-gray-300 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                Create synchronized music rooms and enjoy your favorite songs with friends in real-time. Sign in to get started.
              </p>
              <div className="mt-8">
                <button
                  onClick={onShowAuth}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400">
            &copy; 2025 MusicSync. Bringing people together through music.
          </p>
          {/* Debug link - only shows in development */}
          {import.meta.env.DEV && (
            <div className="text-center mt-2">
              <a 
                href="/debug" 
                className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors duration-200"
              >
                🔧 Debug Connection
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default Home;
