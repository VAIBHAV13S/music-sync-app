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
      // ✅ Fix: Remove trailing slash
      const API_BASE_URL = (import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');
      
      // Check if room exists before navigating
      const response = await fetch(`${API_BASE_URL}/api/rooms/${quickJoinCode}`);
      
      if (response.ok) {
        navigate(`/join/${quickJoinCode}`);
      } else {
        // Handle room not found
        console.error('Room not found');
      }
    } catch (error) {
      console.error('Failed to check room:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(); // Call logout without parameters for single device logout
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ✅ Optional: Add handler for logout from all devices
  const handleLogoutAllDevices = async () => {
    setIsLoggingOut(true);
    try {
      await logout(true); // Pass true for all devices
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-blue-600/5 to-indigo-600/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header with User Info/Auth Buttons */}
        <header className="flex justify-between items-center p-6">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            MusicSync
          </div>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img 
                  src={user?.avatar} 
                  alt={user?.username}
                  className="w-10 h-10 rounded-full border-2 border-blue-500/50"
                />
                <div>
                  <p className="text-white font-medium">{user?.username}</p>
                  <p className="text-gray-400 text-sm">{user?.email}</p>
                </div>
              </div>
              
              {/* Single logout button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-600/50 disabled:cursor-not-allowed border border-gray-600/50 rounded-xl text-gray-300 hover:text-white transition-all duration-200"
              >
                {isLoggingOut ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing out...</span>
                  </div>
                ) : (
                  'Sign Out'
                )}
              </button>

              {/* Optional: Dropdown with logout options */}
              {/* Uncomment if you want both options */}
              {/*
              <div className="relative group">
                <button
                  className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 rounded-xl text-gray-300 hover:text-white transition-all duration-200"
                >
                  ⋮
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800/90 backdrop-blur-md border border-gray-600/50 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-t-xl transition-colors"
                  >
                    Sign out this device
                  </button>
                  <button
                    onClick={handleLogoutAllDevices}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-3 text-left text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-b-xl transition-colors"
                  >
                    Sign out all devices
                  </button>
                </div>
              </div>
              */}
            </div>
          ) : (
            <button
              onClick={onShowAuth}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-medium transition-all duration-200"
            >
              Sign In
            </button>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center mb-16">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              MusicSync
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Listen to music together in perfect sync. Create rooms, invite friends, and enjoy synchronized playback across all devices.
            </p>
          </div>

          {/* Quick Join Section */}
          <div className="w-full max-w-md mb-12">
            <h3 className="text-xl font-semibold text-center mb-6 text-gray-200">
              Quick Join Room
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={quickJoinCode}
                onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="Enter room code"
                className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                maxLength={10}
              />
              <button
                onClick={handleQuickJoin}
                disabled={!quickJoinCode.trim() || isJoining}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:transform-none flex items-center gap-2"
              >
                {isJoining ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Joining...
                  </>
                ) : (
                  'Join'
                )}
              </button>
            </div>
          </div>

          {/* Action Cards */}
          {isAuthenticated ? (
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
              {/* Host Room Card */}
              <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 hover:bg-gray-800/40 transition-all duration-300 hover:scale-105">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white">Host a Room</h3>
                  <p className="text-gray-300 mb-8">Create a room and control the music for everyone to enjoy together.</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => navigate('/host/group')}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    >
                      Host Group Session
                    </button>
                    <button
                      onClick={() => navigate('/host/private')}
                      className="w-full py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    >
                      Host Private Session
                    </button>
                  </div>
                </div>
              </div>

              {/* Join Room Card */}
              <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 hover:bg-gray-800/40 transition-all duration-300 hover:scale-105">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white">Join a Room</h3>
                  <p className="text-gray-300 mb-8">Enter a room code to join an existing listening session.</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => navigate('/join/group')}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    >
                      Join Group Session
                    </button>
                    <button
                      onClick={() => navigate('/join/private')}
                      className="w-full py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    >
                      Join Private Session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 mb-6">Sign in to create or join music rooms</p>
              <button
                onClick={onShowAuth}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              >
                Get Started
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="text-center py-8 text-gray-400">
          <p>&copy; 2025 MusicSync. Bringing people together through music.</p>
        </footer>
      </div>
    </div>
  );
}

export default Home;