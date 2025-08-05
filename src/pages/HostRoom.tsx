import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import YouTubeSearch from "../components/YouTubeSearch";
import YouTubePlayer, { YouTubePlayerRef } from "../components/YouTubePlayer";
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

  const getConnectionStatus = () => {
    if (!connected) return { status: 'Connecting...', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20' };
    if (connectionQuality === 'excellent') return { status: 'Excellent', color: 'text-green-400', bgColor: 'bg-green-900/20' };
    if (connectionQuality === 'good') return { status: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-900/20' };
    return { status: 'Poor', color: 'text-red-400', bgColor: 'bg-red-900/20' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Home
              </button>
              <div className="h-6 w-px bg-gray-600"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Hosting Room</h1>
                  <p className="text-sm text-gray-400">You're the host of this session</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${connectionStatus.bgColor} ${connectionStatus.color}`}>
                {connectionStatus.status}
              </div>
              
              {/* Participants Count */}
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {participantCount} participant{participantCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Video Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Info Card */}
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Room Code</h2>
                  <p className="text-sm text-gray-400 mt-1">Share this code with others to invite them</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    <span className="text-2xl font-mono font-bold text-white tracking-wider">
                      {stableRoomCode}
                    </span>
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className="inline-flex items-center px-3 py-2 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    {copySuccess ? (
                      <>
                        <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={shareRoom}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            </div>

            {/* Video Player Card */}
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-medium text-white">Now Playing</h3>
                {selectedVideoId && (
                  <p className="text-sm text-gray-400 mt-1">
                    Synchronized with {participantCount} participant{participantCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="aspect-video bg-gray-900">
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
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <h4 className="text-xl font-medium mb-2">No music selected</h4>
                      <p className="text-gray-400">Search for a song to start your session</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Search Card */}
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Search Music</h3>
              <YouTubeSearch onSelectTrack={handleVideoSelect} />
            </div>

            {/* Session Stats */}
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Session Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Songs played</span>
                  <span className="text-lg font-semibold text-white">{sessionStats.songsPlayed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Participants</span>
                  <span className="text-lg font-semibold text-white">{participantCount}</span>
                </div>
                {sessionStartTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Session duration</span>
                    <span className="text-lg font-semibold text-white">
                      {formatDuration(Math.floor((Date.now() - sessionStartTime.getTime()) / 1000))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Connection</span>
                  <span className={`text-sm font-medium ${connectionStatus.color}`}>
                    {connectionStatus.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            {showInstructions && (
              <div className="bg-blue-900/20 rounded-xl border border-blue-700/50 p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-blue-300">How to use</h3>
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-3 text-sm text-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-white">1</span>
                    </div>
                    <p>Share the room code with friends to invite them to your session</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-white">2</span>
                    </div>
                    <p>Search and select songs to play for everyone in the room</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-white">3</span>
                    </div>
                    <p>Use the video controls to play, pause, or seek - all participants will sync automatically</p>
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
