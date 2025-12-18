import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import YouTubePlayer, { YouTubePlayerRef } from "../components/YouTubePlayer";
import { useSync } from "../hooks/useSync";
import type { PlaybackState } from "../services/realSocketService";
import {
  ArrowLeft,
  Users,
  Music2,
  Signal,
  Clock,
  Info,
  Disc,
  Headphones,
  Radio,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";

function JoinRoom() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [syncState, setSyncState] = useState<PlaybackState | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const playerSyncRef = useRef<YouTubePlayerRef>(null);

  // Track session start time
  useEffect(() => {
    if (joined && !sessionStartTime) {
      setSessionStartTime(new Date());
    }
  }, [joined, sessionStartTime]);

  // Simulate connection quality monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const qualities = ['excellent', 'good'] as const;
      const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
      setConnectionQuality(randomQuality);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Stable callback to prevent re-renders
  const handleSyncReceived = useCallback((state: PlaybackState) => {
    console.log('🎯 JoinRoom received sync:', state);
    setCurrentVideoId(state.videoId);
    setSyncState(state);

    if (playerSyncRef.current) {
      playerSyncRef.current.applySyncState(state);
    }
  }, []);

  // Only initialize sync when actually joined and roomCode is stable
  const stableRoomCode = useMemo(() => joined ? roomCode : "", [joined, roomCode]);

  const handleVideoLoadReceived = useCallback((videoId: string) => {
    console.log('📹 JoinRoom received video load:', videoId);
    setCurrentVideoId(videoId);
  }, []);

  const { connected, participantCount } = useSync({
    roomCode: stableRoomCode,
    isHost: false,
    onSyncReceived: handleSyncReceived,
    onVideoLoadReceived: handleVideoLoadReceived
  });

  const connectionStatus = useMemo(() => {
    if (!connected) return { label: 'Connecting...', color: 'text-yellow-400', bg: 'bg-yellow-400/10', ring: 'ring-yellow-400/20' };
    if (connectionQuality === 'excellent') return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-400/10', ring: 'ring-green-400/20' };
    if (connectionQuality === 'good') return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-400/10', ring: 'ring-blue-400/20' };
    return { label: 'Poor', color: 'text-red-400', bg: 'bg-red-400/10', ring: 'ring-red-400/20' };
  }, [connected, connectionQuality]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) return;

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

      const response = await fetch(`${getServerUrl()}/api/rooms/${roomCode}`);

      if (response.ok) {
        setJoined(true);
      } else {
        alert('Room not found. Please check the room code.');
      }
    } catch (error) {
      console.error('Error checking room:', error);
      alert('Failed to connect to server. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  const handleLeaveRoom = () => {
    if (confirm('Are you sure you want to leave this session?')) {
      setJoined(false);
      setRoomCode("");
      setCurrentVideoId("");
      setSyncState(null);
      setSessionStartTime(null);
    }
  };

  // Join Room Form (Before Joining)
  if (!joined) {
    return (
      <div className="min-h-screen relative bg-space-900 flex flex-col items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-accent-500/20">
              <Headphones className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Join Session</h1>
            <p className="text-gray-400">Enter the room code to start listening</p>
          </div>

          <div className="glass-panel p-8 rounded-3xl space-y-6">
            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
                ROOM CODE
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="ABC1234"
                className="w-full px-4 py-4 border border-white/10 bg-black/20 text-white rounded-xl focus:ring-2 focus:ring-accent-500/50 focus:border-transparent text-center text-2xl font-mono tracking-[0.2em] uppercase placeholder-gray-600 transition-all font-bold"
                maxLength={10}
                disabled={isJoining}
                autoFocus
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim() || isJoining}
              className="w-full py-4 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold shadow-lg shadow-accent-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  CONNECTING...
                </>
              ) : (
                'JOIN ROOM'
              )}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            Listening is better together.
          </p>
        </motion.div>
      </div>
    );
  }

  // Participant View (After Joining)
  return (
    <div className="min-h-screen relative bg-space-900 pb-12">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/5 bg-space-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <button
                onClick={handleLeaveRoom}
                className="p-2 -ml-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-white/5"
                title="Leave Room"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Room {roomCode}</h1>
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live Sync
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`hidden sm:flex px-3 py-1.5 rounded-full items-center gap-2 border border-white/5 ${connectionStatus.bg} ${connectionStatus.ring}`}>
                <div className={`w-2 h-2 rounded-full ${connectionStatus.color.replace('text-', 'bg-')} animate-pulse`} />
                <span className={`text-xs font-medium ${connectionStatus.color}`}>{connectionStatus.label}</span>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-panel">
                <Users className="w-4 h-4 text-accent-400" />
                <span className="text-sm font-medium text-white">{participantCount}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
              <div className="p-4 border-b border-white/5 bg-space-800/50 backdrop-blur-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentVideoId ? 'bg-red-500/20' : 'bg-gray-700/50'}`}>
                    <Disc className={`w-4 h-4 ${currentVideoId ? 'text-red-500 animate-spin-slow' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Now Playing</h3>
                    <p className="text-xs text-gray-400">Synchronized playback</p>
                  </div>
                </div>
              </div>

              <div className="aspect-video bg-black relative">
                {currentVideoId ? (
                  <YouTubePlayer
                    ref={playerSyncRef}
                    videoId={currentVideoId}
                    isHost={false}
                    initialSyncState={syncState}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-space-950/50">
                    <Music2 className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Waiting for host</p>
                    <p className="text-sm opacity-60">Music will start automatically</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-accent-400" />
                Session Info
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm text-gray-400">Room Code</span>
                  <span className="text-sm font-mono font-bold text-white">{roomCode}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm text-gray-400">Participants</span>
                  <span className="text-lg font-mono font-bold text-white">{participantCount}</span>
                </div>
                {sessionStartTime && (
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-sm text-gray-400">Duration</span>
                    <span className="text-lg font-mono font-bold text-white">
                      {formatDuration(Math.floor((Date.now() - sessionStartTime.getTime()) / 1000))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-accent-500/10 rounded-2xl border border-accent-500/20 p-6">
              <h3 className="text-lg font-bold text-accent-200 mb-4 flex items-center gap-2">
                <Headphones className="w-5 h-5" />
                Listening Mode
              </h3>
              <div className="space-y-4 text-sm text-accent-100/80">
                <p>You're connected to the room. Sit back and enjoy.</p>
                <div className="flex items-center gap-3 bg-accent-500/10 p-3 rounded-lg">
                  <Signal className="w-4 h-4" />
                  <span>Auto-sync enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinRoom;
