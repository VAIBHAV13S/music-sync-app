import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import YouTubeSearch from "../components/YouTubeSearch";
import YouTubePlayer, { YouTubePlayerRef } from "../components/YouTubePlayer";
import { useSync } from "../hooks/useSync";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Copy,
  Share2,
  Music2,
  Signal,
  Clock,
  Info,
  X,
  CheckCircle2,
  ShieldCheck,
  Disc
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function HostRoom() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  let roomCode = searchParams.get("room") || "";
  if (!roomCode) {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    window.history.replaceState({}, '', `${window.location.pathname}?room=${roomCode}`);
  }

  const stableRoomCode = useMemo(() => roomCode, [roomCode]);

  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionStats, setSessionStats] = useState({ songsPlayed: 0, totalTime: 0 });
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  const playerSyncRef = useRef<YouTubePlayerRef>(null);

  const { connected, participantCount, syncPlay, syncPause, syncSeek, syncVideoLoad } = useSync({
    roomCode: stableRoomCode,
    isHost: true
  });

  // Track session start time
  useEffect(() => {
    if (connected && !sessionStartTime) {
      setSessionStartTime(new Date());
    }
  }, [connected, sessionStartTime]);

  // Track songs played
  useEffect(() => {
    if (selectedVideoId) {
      setSessionStats(prev => ({ ...prev, songsPlayed: prev.songsPlayed + 1 }));
    }
  }, [selectedVideoId]);

  const copyRoomCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(stableRoomCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy room code:', err);
    }
  }, [stableRoomCode]);

  const shareRoom = useCallback(() => {
    const shareUrl = `${window.location.origin}/join/${stableRoomCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my MusicSync room',
        text: `Join my music session with room code: ${stableRoomCode}`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [stableRoomCode]);

  const handleVideoSelect = useCallback((videoId: string) => {
    console.log('🎵 Host selected video:', videoId);
    setSelectedVideoId(videoId);
    syncVideoLoad(videoId);
  }, [syncVideoLoad]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const connectionStatus = useMemo(() => {
    if (!connected) return { label: 'Connecting...', color: 'text-yellow-400', bg: 'bg-yellow-400/10', ring: 'ring-yellow-400/20' };
    if (connectionQuality === 'excellent') return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-400/10', ring: 'ring-green-400/20' };
    if (connectionQuality === 'good') return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-400/10', ring: 'ring-blue-400/20' };
    return { label: 'Poor', color: 'text-red-400', bg: 'bg-red-400/10', ring: 'ring-red-400/20' };
  }, [connected, connectionQuality]);

  return (
    <div className="min-h-screen relative bg-space-900 pb-12">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-space-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/')}
                className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 group"
                title="Back to Home"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Host Dashboard</h1>
                  <p className="text-xs text-gray-400">Manage your session</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Video Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Info Card */}
            <div className="glass-panel rounded-2xl p-1">
              <div className="bg-space-900/50 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Room Code
                    <span className="px-2 py-0.5 rounded text-xs bg-accent-500/20 text-accent-300 border border-accent-500/20">Active</span>
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Share this code to invite friends</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-space-950/50 border border-white/10 rounded-xl px-6 py-3 relative group">
                    <span className="text-3xl font-mono font-bold text-white tracking-widest text-glow">
                      {stableRoomCode}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={copyRoomCode}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white transition-all active:scale-95"
                      title="Copy Code"
                    >
                      {copySuccess ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={shareRoom}
                      className="p-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 shadow-lg shadow-accent-500/20 text-white transition-all active:scale-95"
                      title="Share Link"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Player Card */}
            <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
              <div className="p-4 border-b border-white/5 bg-space-800/50 backdrop-blur-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedVideoId ? 'bg-red-500/20' : 'bg-gray-700/50'}`}>
                    <Disc className={`w-4 h-4 ${selectedVideoId ? 'text-red-500 animate-spin-slow' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Now Playing</h3>
                    {selectedVideoId && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <Signal className="w-3 h-3" />
                        Syncing with {participantCount} devices
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="aspect-video bg-black relative">
                {selectedVideoId ? (
                  <YouTubePlayer
                    ref={playerSyncRef}
                    videoId={selectedVideoId}
                    onSyncPlay={(videoId: string, time: number) => syncPlay(videoId, time)}
                    onSyncPause={(videoId: string, time: number) => syncPause(videoId, time)}
                    onSyncSeek={(videoId: string, time: number, isPlaying: boolean) => syncSeek(videoId, time, isPlaying)}
                    isHost={true}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-space-950/50">
                    <Music2 className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No track selected</p>
                    <p className="text-sm opacity-60">Select a song from the sidebar to start</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Search Card */}
            <div className="glass-panel p-6 rounded-2xl min-h-[400px]">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Music2 className="w-5 h-5 text-accent-400" />
                Search Music
              </h3>
              <YouTubeSearch onSelectTrack={handleVideoSelect} />
            </div>

            {/* Session Stats */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Signal className="w-5 h-5 text-green-400" />
                Session Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm text-gray-400">Songs played</span>
                  <span className="text-lg font-mono font-bold text-white">{sessionStats.songsPlayed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm text-gray-400">Total duration</span>
                  <div className="text-right">
                    <span className="text-lg font-mono font-bold text-white">
                      {sessionStartTime ? formatDuration(Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)) : '0:00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <AnimatePresence>
              {showInstructions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-accent-500/10 rounded-2xl border border-accent-500/20 p-6 relative overflow-hidden"
                >
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent-500/20 blur-2xl rounded-full" />

                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <h3 className="text-lg font-bold text-accent-200 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      Pro Tips
                    </h3>
                    <button
                      onClick={() => setShowInstructions(false)}
                      className="text-accent-400 hover:text-accent-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent-300">1</div>
                      <p className="text-sm text-accent-100/80 leading-relaxed">Share the code above. Friends can join securely from any device.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent-300">2</div>
                      <p className="text-sm text-accent-100/80 leading-relaxed">You control the flow. Pause or seek, and everyone syncs instantly.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

export default HostRoom;
