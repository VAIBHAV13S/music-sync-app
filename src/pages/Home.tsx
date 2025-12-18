import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Mic2, Radio, LogOut, ArrowRight, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface HomeProps {
  onShowAuth?: () => void;
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-space-900/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-500/30">
                <Music className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                MusicSync
              </h1>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-space-800 rounded-full flex items-center justify-center border border-white/10 ring-2 ring-accent-500/20">
                    <span className="text-white font-semibold">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-white">{user?.username}</p>
                    <p className="text-xs text-gray-400">Online</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Sign out"
                >
                  {isLoggingOut ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <LogOut className="w-5 h-5" />
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={onShowAuth}
                className="glass-button px-6 py-2.5 rounded-full text-sm font-medium text-white hover:bg-white/10 shadow-lg shadow-accent-500/10"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center min-h-[calc(100vh-12rem)]">
          {/* Left Column: Hero Text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-left space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
                </span>
                Live Audio Synchronization
              </div>
              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-tight">
                Listen <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-purple-400 text-glow">Together</span>
                <br />
                Everywhere
              </h1>
              <p className="text-xl text-gray-400 max-w-lg leading-relaxed">
                Create synchronized music rooms and vibe with friends in real-time.
                Crystal clear audio, zero latency feel.
              </p>
            </div>

            {!isAuthenticated && (
              <motion.button
                onClick={onShowAuth}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white transition-all duration-200 bg-accent-600 rounded-full hover:bg-accent-500 hover:shadow-lg hover:shadow-accent-500/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 focus:ring-offset-space-900"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            )}

            {isAuthenticated && (
              <div className="glass-panel p-6 rounded-2xl max-w-md">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Got a code? Jump in.
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      placeholder="ENTER CODE"
                      value={quickJoinCode}
                      onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                      onKeyPress={handleKeyPress}
                      maxLength={10}
                      className="w-full bg-space-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition-all font-mono tracking-wider"
                    />
                  </div>
                  <button
                    onClick={handleQuickJoin}
                    disabled={!quickJoinCode.trim() || isJoining}
                    className="bg-white text-space-900 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-white/20"
                  >
                    {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : 'JOIN'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Right Column: Visuals/Cards */}
          <div className="relative hidden lg:block h-full min-h-[600px]">
            {/* Floating Elements Background */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[500px] h-[500px] border border-white/5 rounded-full animate-spin-slow opacity-30" />
              <div className="absolute w-[350px] h-[350px] border border-white/5 rounded-full animate-spin-slow opacity-30" style={{ animationDirection: 'reverse' }} />
            </div>

            {/* Cards */}
            <div className="relative h-full flex flex-col justify-center items-center gap-6">
              {isAuthenticated ? (
                <>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ y: -5 }}
                    className="glass-panel p-6 rounded-3xl w-80 cursor-pointer group"
                    onClick={() => navigate('/host/group')}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-green-500/20 group-hover:scale-110 transition-transform">
                      <Mic2 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Host a Room</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Start your own session. You control the queue, they vibe with you.
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ y: -5 }}
                    className="glass-panel p-6 rounded-3xl w-80 cursor-pointer group ml-24"
                    onClick={() => navigate('/join/browse')}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                      <Radio className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Browse Rooms</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Discover public rooms and meet new people over great music.
                    </p>
                  </motion.div>
                </>
              ) : (
                <motion.div
                  animate={{ y: [0, -20, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10"
                >
                  <div className="glass-panel p-8 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-20">
                      <Music className="w-32 h-32 text-accent-500" />
                    </div>
                    <div className="space-y-6 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-space-800 flex items-center justify-center border border-white/10">
                          <span className="block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                          <div className="h-2 w-24 bg-gray-700 rounded mb-2" />
                          <div className="h-2 w-16 bg-gray-700 rounded" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-2 w-full bg-gray-700 rounded" />
                        <div className="h-2 w-5/6 bg-gray-700 rounded" />
                        <div className="h-2 w-4/6 bg-gray-700 rounded" />
                      </div>
                      <div className="pt-4 flex gap-3">
                        <div className="h-10 w-10 rounded-full bg-accent-500/20" />
                        <div className="h-10 w-10 rounded-full bg-purple-500/20" />
                        <div className="h-10 w-10 rounded-full bg-blue-500/20" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-space-900/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; 2025 MusicSync. Crafted for audio lovers.
          </p>
          {import.meta.env.DEV && (
            <a href="/debug" className="text-xs text-accent-500 hover:text-accent-400 transition-colors">
              Connection Status
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

export default Home;

