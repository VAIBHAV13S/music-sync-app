import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import YouTubePlayer, { YouTubePlayerRef } from "../components/YouTubePlayer";
import { useSync } from "../hooks/useSync";
import type { PlaybackState } from "../services/realSocketService";

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
  const [currentTrackInfo, setCurrentTrackInfo] = useState<{title?: string, artist?: string}>({});
  
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

  const getConnectionStatus = () => {
    if (!connected) return { status: 'Connecting...', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20' };
    if (connectionQuality === 'excellent') return { status: 'Excellent', color: 'text-green-400', bgColor: 'bg-green-900/20' };
    if (connectionQuality === 'good') return { status: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-900/20' };
    return { status: 'Poor', color: 'text-red-400', bgColor: 'bg-red-900/20' };
  };

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
        console.log(`✅ Room ${roomCode} exists, joining...`);
      } else {
        alert('Room not found. Please check the room code.');
        console.log(`❌ Room ${roomCode} not found`);
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

  const connectionStatus = getConnectionStatus();

  // Join Room Form (Before Joining)
  if (!joined) {
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
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-white">Join a Room</h1>
                    <p className="text-sm text-gray-400">Enter a room code to join a music session</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">Join Music Session</h2>
              <p className="text-gray-300">Enter the room code shared by your host</p>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
                  Room Code
                </label>
                <input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter room code (e.g., ABC123)"
                  className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider uppercase placeholder-gray-400"
                  maxLength={6}
                  disabled={isJoining}
                />
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={!roomCode.trim() || isJoining}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isJoining ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Joining...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Join Room
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 p-4 bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-300">How to join</p>
                  <p className="text-sm text-blue-200 mt-1">
                    Ask the host for their room code and enter it above. You'll be able to listen to music together in real-time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Participant View (After Joining)
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLeaveRoom}
                className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Leave Room
              </button>
              <div className="h-6 w-px bg-gray-600"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Room {roomCode}</h1>
                  <p className="text-sm text-gray-400">Listening together</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${connectionStatus.bgColor} ${connectionStatus.color}`}>
                {connectionStatus.status}
              </div>
              
              {/* Participants Count */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {participantCount} participant{participantCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content - Video Player */}
          <div className="lg:col-span-3 space-y-6">
            {/* Video Player Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Now Playing</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Synchronized with the host and other participants
                </p>
              </div>
              <div className="aspect-video bg-gray-900">
                {currentVideoId ? (
                  <YouTubePlayer
                    ref={playerSyncRef}
                    videoId={currentVideoId}
                    isHost={false}
                    initialSyncState={syncState}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <h4 className="text-xl font-medium mb-2">Waiting for music</h4>
                      <p className="text-gray-400">The host will select a song to play</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Session Stats */}
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Session Info</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Room Code</span>
                  <span className="text-sm font-mono font-semibold text-white">{roomCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Participants</span>
                  <span className="text-lg font-semibold text-white">{participantCount}</span>
                </div>
                {sessionStartTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Session time</span>
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
            <div className="bg-blue-900/20 rounded-xl border border-blue-700/50 p-6">
              <h3 className="text-lg font-medium text-blue-300 mb-3">Listening Mode</h3>
              <div className="space-y-3 text-sm text-blue-200">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p>You're connected to the room and will automatically sync with the host's music</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p>When the host plays, pauses, or seeks, your player will automatically follow</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p>Enjoy the synchronized listening experience with everyone in the room</p>
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
