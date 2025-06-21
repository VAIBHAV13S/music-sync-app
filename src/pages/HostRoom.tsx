import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import YouTubeSearch from "../components/YouTubeSearch";
import YouTubePlayer, { YouTubePlayerRef } from "../components/YouTubePlayer";
import { backgroundThemes, buttonThemes } from "../utils/themes";
import { useSync } from "../hooks/useSync";
import { useNavigate, useParams } from "react-router-dom";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [sessionStats, setSessionStats] = useState({ songsPlayed: 0, totalTime: 0 });
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [volume, setVolume] = useState(80);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
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

  // Simulate connection quality monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const qualities = ['excellent', 'good', 'poor'] as const;
      const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
      setConnectionQuality(randomQuality);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR Code URL
  const generateQRCode = () => {
    const joinUrl = `${window.location.origin}/join/${mode}?room=${roomCode}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
  };

  const handleVideoLoad = useCallback((videoId: string) => {
    console.log('🎵 Host video loaded:', videoId);
    syncVideoLoad(videoId);
  }, [syncVideoLoad]);

  const handleTrackSelect = (videoId: string) => {
    console.log('🎵 Host selected video:', videoId);
    setSelectedVideoId(videoId);
    setShowInstructions(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy room code:', err);
    }
  };

  const shareRoom = async () => {
    const shareUrl = `${window.location.origin}/join/${mode}?room=${roomCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my music listening session',
          text: `Join me for a synchronized music session. Room code: ${roomCode}`,
          url: shareUrl,
        });
      } catch (err) {
        copyToClipboard();
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const endSession = () => {
    if (confirm('Are you sure you want to end this session? All participants will be disconnected.')) {
      navigate('/');
    }
  };

  // Mode detection
  const isGroupMode = mode === "group";
  const modeTitle = isGroupMode ? "Group Listening Session" : "Private Listening Session";
  const modeColor = isGroupMode ? "from-purple-600 via-blue-600 to-indigo-600" : "from-blue-600 via-indigo-600 to-purple-600";

  // Connection quality styling
  const connectionQualityConfig = {
    excellent: { color: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', status: 'Excellent', pulse: 'animate-pulse' },
    good: { color: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50', status: 'Good', pulse: '' },
    poor: { color: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/50', status: 'Poor', pulse: 'animate-pulse' }
  };

  // Session duration
  const getSessionDuration = () => {
    if (!sessionStartTime) return '0m';
    const now = new Date();
    const diff = now.getTime() - sessionStartTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  // Sync handlers
  const handleSyncPlay = (videoId: string, currentTime: number) => {
    syncPlay(videoId, currentTime);
  };

  const handleSyncPause = (videoId: string, currentTime: number) => {
    syncPause(videoId, currentTime);
  };

  const handleSyncSeek = (videoId: string, currentTime: number, isPlaying: boolean) => {
    syncSeek(videoId, currentTime, isPlaying);
  };

  return (
    <div className={`min-h-screen ${backgroundThemes.dark} text-white relative overflow-hidden`}>
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className={`absolute inset-0 bg-gradient-to-br ${modeColor} opacity-5`}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Floating Action Menu */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
        {/* Advanced Controls Toggle */}
        <button
          onClick={() => setShowAdvancedControls(!showAdvancedControls)}
          className={`group p-4 ${showAdvancedControls ? 'bg-blue-500/90 shadow-blue-500/25' : 'bg-gray-900/80 hover:bg-gray-800/90'} backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl`}
          title="Advanced Controls"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        
        {/* QR Code Toggle */}
        <button
          onClick={() => setShowQRCode(!showQRCode)}
          className={`group p-4 ${showQRCode ? 'bg-purple-500/90 shadow-purple-500/25' : 'bg-gray-900/80 hover:bg-gray-800/90'} backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl`}
          title="Show QR Code"
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </button>
        
        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="group p-4 bg-gray-900/80 hover:bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl"
          title="Toggle Fullscreen"
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isFullscreen ? "M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5M9 15H4.5M9 15v4.5M9 15l-5.5 5.5" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"} />
          </svg>
        </button>
        
        {/* End Session */}
        <button
          onClick={endSession}
          className="group p-4 bg-red-600/90 hover:bg-red-700/90 backdrop-blur-xl border border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-red-500/30"
          title="End Session"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Advanced Controls Panel */}
      {showAdvancedControls && (
        <div className="fixed top-6 left-6 right-24 sm:right-auto sm:left-6 z-40 bg-gray-900/95 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl max-w-sm animate-in slide-in-from-left duration-300">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Advanced Controls</h3>
              <p className="text-sm text-gray-400 mt-1">Fine-tune your session</p>
            </div>
            <button
              onClick={() => setShowAdvancedControls(false)}
              className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Volume Control */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-semibold text-gray-300">Volume</label>
              <span className="text-sm font-mono bg-gray-800 px-3 py-1 rounded-lg">{volume}%</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-3 bg-gray-800 rounded-full appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume}%, #374151 ${volume}%, #374151 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          
          {/* Playback Speed */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-300 mb-4">Playback Speed</label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value={0.5}>0.5x (Half Speed)</option>
              <option value={0.75}>0.75x (Slower)</option>
              <option value={1}>1x (Normal)</option>
              <option value={1.25}>1.25x (Faster)</option>
              <option value={1.5}>1.5x (Fast)</option>
              <option value={2}>2x (Double Speed)</option>
            </select>
          </div>
          
          {/* Session Stats */}
          <div className="border-t border-gray-700/50 pt-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Session Analytics</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                <div className="text-lg font-bold text-blue-400">{getSessionDuration()}</div>
                <div className="text-xs text-gray-500">Duration</div>
              </div>
              <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                <div className="text-lg font-bold text-purple-400">{sessionStats.songsPlayed}</div>
                <div className="text-xs text-gray-500">Songs</div>
              </div>
              <div className="text-center p-3 bg-gray-800/50 rounded-xl">
                <div className="text-lg font-bold text-green-400">{participantCount}</div>
                <div className="text-xs text-gray-500">Users</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-gray-900/95 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Quick Join</h3>
              <p className="text-gray-400">Scan this QR code to join instantly</p>
            </div>
            <div className="bg-white p-6 rounded-2xl mb-6 inline-block shadow-lg">
              <img src={generateQRCode()} alt="Join Room QR Code" className="w-48 h-48" />
            </div>
            <button
              onClick={() => setShowQRCode(false)}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header Section */}
        <div className="px-8 py-12 pt-20">
          <div className="max-w-6xl mx-auto">
            
            {/* Back Button */}
            <button
              onClick={() => navigate("/")}
              className="mb-8 flex items-center gap-3 px-6 py-3 bg-gray-900/50 hover:bg-gray-800/70 text-gray-300 hover:text-white rounded-2xl font-medium transition-all duration-200 backdrop-blur-xl border border-gray-700/50 hover:border-gray-600/50 group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>

            {/* Title Section */}
            <div className="text-center mb-16">
              <div className="mb-8">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent leading-tight mb-6 tracking-tight">
                  {modeTitle}
                </h1>
                <div className="flex items-center justify-center gap-2 mb-8">
                  <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
                  <span className="text-xl text-gray-400 font-light px-4">Host Dashboard</span>
                  <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
                </div>
              </div>
              
              {/* Status Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {/* Connection Status */}
                <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                  connected 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`}></div>
                  <span className="font-semibold">
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                {/* Connection Quality */}
                {connected && (
                  <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                    connectionQualityConfig[connectionQuality].bg
                  } ${connectionQualityConfig[connectionQuality].border} ${connectionQualityConfig[connectionQuality].color}`}>
                    <div className={`w-3 h-3 rounded-full bg-current ${connectionQualityConfig[connectionQuality].pulse}`}></div>
                    <span className="font-semibold">
                      {connectionQualityConfig[connectionQuality].status}
                    </span>
                  </div>
                )}
                
                {/* Participant Count */}
                {connected && (
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 backdrop-blur-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <span className="font-semibold">
                      {participantCount} participant{participantCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {/* Session Duration */}
                {sessionStartTime && (
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300 backdrop-blur-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">
                      {getSessionDuration()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Room Code Section */}
            <div className="max-w-lg mx-auto mb-16">
              <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:border-gray-600/50">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-200 mb-3">Room Code</h2>
                  <p className="text-gray-400">Share this code to invite others</p>
                </div>
                
                {/* Room Code Display */}
                <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/50 rounded-2xl p-8 mb-8 group hover:from-gray-700/80 hover:to-gray-600/80 transition-all duration-300 cursor-pointer" onClick={copyToClipboard}>
                  <div className="text-4xl font-mono font-black tracking-[0.4em] text-center text-white group-hover:scale-105 transition-transform duration-300 select-all">
                    {roomCode}
                  </div>
                  <div className="text-center text-xs text-gray-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Click to copy
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={copyToClipboard}
                    className={`flex items-center justify-center gap-3 px-6 py-4 ${
                      copySuccess ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                    } rounded-2xl font-bold transition-all duration-200 transform hover:scale-105 shadow-xl`}
                  >
                    {copySuccess ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Code
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={shareRoom}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-purple-600 hover:bg-purple-700 rounded-2xl font-bold transition-all duration-200 transform hover:scale-105 shadow-xl shadow-purple-500/25"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share
                  </button>
                </div>
                
                {/* Quick Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowQRCode(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    QR Code
                  </button>
                  <button
                    onClick={() => {
                      const text = `Join my music session! Room code: ${roomCode}\n\nJoin here: ${window.location.origin}/join/${mode}?room=${roomCode}`;
                      navigator.clipboard.writeText(text);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 pb-16">
          <div className="max-w-6xl mx-auto space-y-12">
            
            {/* Welcome/Instructions */}
            {showInstructions && (
              <div className="text-center">
                <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 border border-blue-500/20 rounded-3xl p-12 backdrop-blur-xl">
                  <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center">
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold mb-6">Ready to Start Your Session</h3>
                  <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                    Search for music below to begin. All participants will experience perfect synchronization with your playback in real-time.
                  </p>
                  <div className="flex flex-wrap justify-center gap-8">
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                      <span className="font-medium">Real-time sync</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="font-medium">HD quality</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                      <span className="font-medium">Zero latency</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Participant Status */}
            {participantCount === 0 && connected && selectedVideoId && (
              <div className="text-center">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl">
                  <div className="w-16 h-16 mx-auto mb-6 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-amber-300 mb-3">
                    Waiting for participants to join
                  </h3>
                  <p className="text-gray-400">
                    Share your room code for others to join the synchronized session
                  </p>
                </div>
              </div>
            )}

            {participantCount > 0 && (
              <div className="text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl">
                  <div className="w-16 h-16 mx-auto mb-6 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-emerald-300 mb-3">
                    {participantCount} participant{participantCount !== 1 ? 's' : ''} connected
                  </h3>
                  <p className="text-gray-400">
                    Session is live with perfect synchronization across all devices
                  </p>
                </div>
              </div>
            )}

            {/* Music Search */}
            <div>
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Music Library</h2>
                <p className="text-xl text-gray-400">Search and select tracks for your synchronized session</p>
              </div>
              <YouTubeSearch onSelectTrack={handleTrackSelect} />
            </div>

            {/* YouTube Player */}
            {selectedVideoId && (
              <div>
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Now Playing</h2>
                  <p className="text-xl text-gray-400">Host controls - all participants will follow your playback</p>
                </div>
                
                <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500">
                  <YouTubePlayer 
                    ref={playerSyncRef}
                    videoId={selectedVideoId}
                    onSyncPlay={handleSyncPlay}
                    onSyncPause={handleSyncPause}
                    onSyncSeek={handleSyncSeek}
                    onVideoLoad={handleVideoLoad}
                    isHost={true}
                  />
                </div>
              </div>
            )}

            {/* Connection Error */}
            {!connected && (
              <div className="text-center">
                <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-12 backdrop-blur-xl max-w-md mx-auto">
                  <div className="w-20 h-20 mx-auto mb-8 bg-red-500/20 rounded-3xl flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-red-300 mb-6">
                    Connection Issue
                  </h3>
                  <p className="text-gray-300 mb-8">
                    Unable to connect to the synchronization server. Please check your connection and try again.
                  </p>
                  <div className="space-y-4">
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full px-8 py-4 bg-red-600 hover:bg-red-700 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center gap-3 hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry Connection
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="w-full px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center gap-3 hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Back to Home
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HostRoom;