import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSyncContext } from '../contexts/SyncContext';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import { backgroundThemes } from '../utils/themes';
import { PlaybackState } from '../services/realSocketService';

function JoinRoom() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const [inputRoomCode, setInputRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const {
    room,
    isConnected,
    participantCount,
    currentPlaybackState,
    joinRoom,
    leaveRoom,
  } = useSyncContext();

  const joined = !!room;

  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const playerSyncRef = useRef<YouTubePlayerRef>(null);

  useEffect(() => {
    if (currentPlaybackState && playerSyncRef.current) {
      playerSyncRef.current.applySyncState(currentPlaybackState);
    }
  }, [currentPlaybackState]);

  const handleJoinRoom = async () => {
    if (!inputRoomCode.trim()) return;
    setIsJoining(true);
    try {
      await joinRoom(inputRoomCode.toUpperCase());
    } catch (error: any) {
      console.error('Error joining room:', error);
      alert(error.message || 'Failed to join room. Please check the code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveRoom = () => {
    if (confirm('Are you sure you want to leave this session?')) {
      leaveRoom();
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Participant View (After Joining)
  if (joined) {
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
          
          {/* Leave Session */}
          <button
            onClick={handleLeaveRoom}
            className="group p-4 bg-red-600/90 hover:bg-red-700/90 backdrop-blur-xl border border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-red-500/30"
            title="Leave Session"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

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
                    <span className="text-xl text-gray-400 font-light px-4">Participant Dashboard</span>
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
                  </div>
                </div>
                
                {/* Status Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {/* Connection Status */}
                  <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                    isConnected 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`}></div>
                    <span className="font-semibold">
                      {isConnected ? 'Synchronized' : 'Disconnected'}
                    </span>
                  </div>
                  
                  {/* Connection Quality */}
                  {isConnected && (
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
                  {isConnected && participantCount > 0 && (
                    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 backdrop-blur-xl">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <span className="font-semibold">
                        {participantCount} participant{participantCount !== 1 ? 's' : ''} total
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

              {/* Room Code Display */}
              <div className="max-w-lg mx-auto mb-16">
                <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 shadow-2xl">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-200 mb-3">Connected to Room</h2>
                    <p className="text-gray-400">You are listening as a participant</p>
                  </div>
                  
                  {/* Room Code Display */}
                  <div className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/50 rounded-2xl p-6 mb-6">
                    <div className="text-3xl font-mono font-black tracking-[0.4em] text-center text-white">
                      {room.roomCode}
                    </div>
                  </div>

                  {/* Participant Role Info */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M8.464 8.464a5 5 0 000 7.072m-2.828-9.9a9 9 0 000 14.142" />
                      </svg>
                      <span className="text-blue-300 font-semibold">Listening Mode</span>
                    </div>
                    <p className="text-gray-400 text-center text-sm">
                      Playback is controlled by the room host. You'll hear everything in perfect sync.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="px-8 pb-16">
            <div className="max-w-6xl mx-auto space-y-12">

              {/* Sync Status */}
              {currentPlaybackState && (
                <div className="text-center">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl">
                    <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-purple-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-purple-300 mb-3">
                      Synchronized Playback
                    </h3>
                    <p className="text-gray-400 mb-4">
                      {currentPlaybackState.isPlaying ? 'Playing' : 'Paused'} at {Math.floor(currentPlaybackState.currentTime)}s
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-lg text-purple-300 text-sm">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                      Perfect sync with host
                    </div>
                  </div>
                </div>
              )}

              {/* Connection Status */}
              {!isConnected && (
                <div className="text-center">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl">
                    <div className="w-16 h-16 mx-auto mb-6 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-amber-300 mb-3">
                      Reconnecting to Host
                    </h3>
                    <p className="text-gray-400">
                      Attempting to restore synchronization...
                    </p>
                  </div>
                </div>
              )}

              {/* YouTube Player */}
              {currentPlaybackState?.videoId && (
                <div>
                  <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Now Playing</h2>
                    <p className="text-xl text-gray-400">Synchronized with the host's playback</p>
                  </div>
                  
                  <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500">
                    <YouTubePlayer 
                      ref={playerSyncRef}
                      videoId={currentPlaybackState.videoId}
                      isHost={false}
                      initialSyncState={currentPlaybackState}
                    />
                  </div>
                </div>
              )}

              {/* Waiting for Host */}
              {!currentPlaybackState?.videoId && isConnected && (
                <div className="text-center">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-12 backdrop-blur-xl">
                    <div className="w-20 h-20 mx-auto mb-8 bg-blue-500/20 rounded-3xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <h3 className="text-3xl font-bold mb-6">Waiting for Host</h3>
                    <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                      You're connected and ready! Waiting for the host to start playing music.
                    </p>
                    <div className="flex flex-wrap justify-center gap-8">
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="font-medium">Connected</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                        <span className="font-medium">Synchronized</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                        <span className="font-medium">Ready to play</span>
                      </div>
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

  // Join Room View (Before Joining)
  return (
    <div className={`min-h-screen ${backgroundThemes.dark} text-white relative overflow-hidden`}>
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className={`absolute inset-0 bg-gradient-to-br ${modeColor} opacity-5`}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        <div className="px-8 py-12 pt-20">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen">
            
            {/* Back Button */}
            <button
              onClick={() => navigate("/")}
              className="self-start mb-8 flex items-center gap-3 px-6 py-3 bg-gray-900/50 hover:bg-gray-800/70 text-gray-300 hover:text-white rounded-2xl font-medium transition-all duration-200 backdrop-blur-xl border border-gray-700/50 hover:border-gray-600/50 group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>

            {/* Header */}
            <div className="text-center mb-16">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent leading-tight mb-6 tracking-tight">
                Join {modeTitle}
              </h1>
              <div className="flex items-center justify-center gap-2 mb-8">
                <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
                <span className="text-xl text-gray-400 font-light px-4">Enter Room Code</span>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent flex-1 max-w-xs"></div>
              </div>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Enter the room code to join {isGroupMode ? "the listening party" : "your private session"} and enjoy synchronized music playback.
              </p>
            </div>

            {/* Join Form */}
            <div className="w-full max-w-lg mb-16">
              <div className="bg-gray-900/40 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-200 mb-3">Room Access</h2>
                  <p className="text-gray-400">Enter the 6-character room code</p>
                </div>
                
                <div className="space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputRoomCode}
                      onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                      placeholder="ABCD12"
                      maxLength={6}
                      className="w-full px-6 py-6 bg-gray-800/50 border border-gray-600/50 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-center text-3xl font-mono tracking-[0.3em] transition-all duration-200 hover:bg-gray-800/70 hover:border-gray-500/50"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-blue-500/0 pointer-events-none"></div>
                  </div>
                  
                  <button
                    onClick={handleJoinRoom}
                    disabled={!inputRoomCode.trim() || isJoining}
                    className="w-full px-8 py-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-2xl font-bold text-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 flex items-center justify-center gap-3"
                  >
                    {isJoining ? (
                      <>
                        <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Joining Session...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Join Session
                      </>
                    )}
                  </button>
                </div>

                {/* Hints */}
                <div className="mt-8 pt-6 border-t border-gray-700/50">
                  <p className="text-gray-500 text-sm text-center mb-4">Room codes are 6 characters long</p>
                  <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      Auto-sync
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      HD audio
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      Real-time
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isJoining && (
              <div className="text-center mb-16">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl">
                  <div className="w-16 h-16 mx-auto mb-6 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-blue-300 mb-3">
                    Connecting to Session
                  </h3>
                  <p className="text-gray-400">
                    Establishing secure connection to room {inputRoomCode}...
                  </p>
                  <div className="flex justify-center gap-1 mt-4">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-100"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              <div className="text-center p-6 bg-gray-900/20 backdrop-blur-sm border border-gray-700/30 rounded-2xl">
                <div className="w-12 h-12 mx-auto mb-4 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="font-semibold text-emerald-300 mb-2">Perfect Sync</h3>
                <p className="text-gray-400 text-sm">Real-time synchronization with zero lag</p>
              </div>

              <div className="text-center p-6 bg-gray-900/20 backdrop-blur-sm border border-gray-700/30 rounded-2xl">
                <div className="w-12 h-12 mx-auto mb-4 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 className="font-semibold text-blue-300 mb-2">High Quality</h3>
                <p className="text-gray-400 text-sm">Crystal clear audio streaming</p>
              </div>

              <div className="text-center p-6 bg-gray-900/20 backdrop-blur-sm border border-gray-700/30 rounded-2xl">
                <div className="w-12 h-12 mx-auto mb-4 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-purple-300 mb-2">Secure</h3>
                <p className="text-gray-400 text-sm">Private encrypted connections</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinRoom;