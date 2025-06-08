import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import type { PlaybackState } from '../services/realSocketService';

interface YouTubePlayerProps {
  videoId?: string;
  onPlayerReady?: () => void;
  onStateChange?: (state: number) => void;
  onSyncPlay?: (videoId: string, currentTime: number) => void;
  onSyncPause?: (videoId: string, currentTime: number) => void;
  onSyncSeek?: (videoId: string, currentTime: number, isPlaying: boolean) => void;
  onVideoLoad?: (videoId: string) => void;
  isHost?: boolean;
  initialSyncState?: PlaybackState | null;
}

export interface YouTubePlayerRef {
  applySyncState: (state: PlaybackState) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  forceSync: () => void;
}

const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(({ 
  videoId, 
  onPlayerReady, 
  onStateChange, 
  onSyncPlay,
  onSyncPause, 
  onSyncSeek,
  onVideoLoad, // ✅ Fixed: Added missing prop
  isHost = false,
  initialSyncState
}, ref) => {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(videoId || "");
  const [volume, setVolume] = useState(50);
  const [trackInfo, setTrackInfo] = useState<any>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  
  // Enhanced sync control with state tracking
  const isSyncingRef = useRef(false);
  const lastEventTimeRef = useRef(0);
  const lastPlayerStateRef = useRef(-1);
  const hasReceivedInitialSyncRef = useRef(false);
  const initializationCompleteRef = useRef(false);

  useImperativeHandle(ref, () => ({
    applySyncState: (state: PlaybackState) => {
      if (!playerRef.current || !state || isHost) return;
      
      console.log('🔄 Participant applying sync:', state);
      
      isSyncingRef.current = true;
      hasReceivedInitialSyncRef.current = true;
      
      try {
        // Calculate time compensation for network delay
        const now = Date.now();
        const timeSinceSync = (now - state.timestamp) / 1000;
        const compensatedTime = state.currentTime + (state.isPlaying ? timeSinceSync : 0);
        
        console.log(`⏰ Time compensation: +${timeSinceSync.toFixed(2)}s to ${compensatedTime.toFixed(2)}s`);
        
        // Change video if needed
        if (state.videoId !== currentVideoId) {
          console.log('📹 Participant changing video:', state.videoId);
          setCurrentVideoId(state.videoId);
          playerRef.current.loadVideoById(state.videoId, Math.max(0, compensatedTime));
        } else {
          // Seek to compensated time
          playerRef.current.seekTo(Math.max(0, compensatedTime), true);
        }

        // Apply play/pause state with minimal delay
        setTimeout(() => {
          try {
            if (state.isPlaying) {
              console.log('🔄 Sync: Starting playback');
              playerRef.current.playVideo();
            } else {
              console.log('🔄 Sync: Pausing playback');
              playerRef.current.pauseVideo();
            }
          } catch (error) {
            console.error('Error applying playback state:', error);
          }
          
          // Release sync block
          setTimeout(() => {
            isSyncingRef.current = false;
            console.log('✅ Sync block released');
          }, 300);
        }, 50);
        
      } catch (error) {
        console.error('Error in applySyncState:', error);
        isSyncingRef.current = false;
      }
    },
    
    getCurrentTime: () => {
      try {
        return playerRef.current?.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    },
    
    getPlayerState: () => {
      try {
        return playerRef.current?.getPlayerState() || -1;
      } catch {
        return -1;
      }
    },
    
    forceSync: () => {
      if (!isHost || !playerRef.current) return;
      try {
        const currentTime = playerRef.current.getCurrentTime() || 0;
        const playerState = playerRef.current.getPlayerState();
        
        console.log('🔄 Force sync:', { playerState, currentTime });
        
        if (playerState === 1) {
          onSyncPlay?.(currentVideoId, currentTime);
        } else {
          onSyncPause?.(currentVideoId, currentTime);
        }
      } catch (error) {
        console.error('Error in force sync:', error);
      }
    }
  }));

  // In YouTubePlayer.tsx, update the video loading useEffect:

  useEffect(() => {
    console.log('📹 Video ID changed:', videoId);
    
    if (videoId && videoId !== currentVideoId) {
      setCurrentVideoId(videoId);
      setPlayerError(null);
      setBuffering(false);
      
      // Only call onVideoLoad for hosts, and only when video actually changes
      if (isHost && onVideoLoad) {
        console.log('👑 Host video changed, sending load sync:', videoId);
        onVideoLoad(videoId);
      }
      
      // Load video if player is ready
      if (playerRef.current && isReady) {
        console.log('🔄 Loading new video:', videoId);
        isSyncingRef.current = true;
        
        try {
          // Use cueVideoById to prevent auto-play
          playerRef.current.cueVideoById(videoId);
          console.log('📹 Video cued (no auto-play)');
          
          setTimeout(() => {
            isSyncingRef.current = false;
            console.log('✅ Video load sync released');
          }, 500);
        } catch (error) {
          console.error('Error loading video:', error);
          setPlayerError('Failed to load video');
          isSyncingRef.current = false;
        }
      }
    }
  }, [videoId, currentVideoId, isReady, isHost, onVideoLoad]);

  // Handle initial sync state
  useEffect(() => {
    if (initialSyncState && !isHost && playerRef.current && !initializationCompleteRef.current) {
      console.log('🎬 Applying initial sync state:', initialSyncState);
      initializationCompleteRef.current = true;
      
      // Apply initial state with slight delay to ensure player is ready
      setTimeout(() => {
        if (playerRef.current) {
          setCurrentVideoId(initialSyncState.videoId);
          
          if (initialSyncState.isPlaying) {
            playerRef.current.loadVideoById(initialSyncState.videoId, initialSyncState.currentTime);
            setTimeout(() => playerRef.current?.playVideo(), 500);
          } else {
            playerRef.current.cueVideoById(initialSyncState.videoId);
            playerRef.current.seekTo(initialSyncState.currentTime);
          }
          
          hasReceivedInitialSyncRef.current = true;
        }
      }, 1000);
    }
  }, [initialSyncState, isHost]);

  const onReady: YouTubeProps['onReady'] = (event) => {
    console.log('🎵 Player ready, video:', currentVideoId);
    playerRef.current = event.target;
    setIsReady(true);
    setPlayerError(null);
    setBuffering(false);
    
    try {
      setVolume(playerRef.current.getVolume() || 50);
    } catch (error) {
      console.warn('Could not get initial volume:', error);
    }
    
    // Reset state
    isSyncingRef.current = false;
    lastPlayerStateRef.current = -1;
    
    // Load initial video WITHOUT auto-play
    if (currentVideoId && currentVideoId !== '') {
      try {
        playerRef.current.cueVideoById(currentVideoId);
        console.log('📹 Initial video cued (no auto-play)');
      } catch (error) {
        console.error('Error loading initial video:', error);
        setPlayerError('Failed to load initial video');
      }
    }
    
    onPlayerReady?.();
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    const playerState = event.data;
    const now = Date.now();
    
    console.log(`🎵 Player state: ${playerState} | Host: ${isHost} | Syncing: ${isSyncingRef.current}`);
    
    // Update buffering state
    setBuffering(playerState === 3);
    
    // Block events during sync
    if (isSyncingRef.current) {
      console.log('🚫 BLOCKED: Currently syncing');
      return;
    }
    
    // Participant logic - block unauthorized actions
    if (!isHost) {
      console.log('🚫 BLOCKED: Not host - participant cannot control playback');
      
      // Block unauthorized play attempts
      if (playerState === 1 && !hasReceivedInitialSyncRef.current) {
        console.log('🛑 Participant tried to play without sync - pausing');
        setTimeout(() => {
          if (playerRef.current && !isSyncingRef.current) {
            playerRef.current.pauseVideo();
          }
        }, 100);
      }
      return;
    }
    
    // HOST LOGIC ONLY BELOW
    
    // Skip duplicate states
    if (playerState === lastPlayerStateRef.current) {
      console.log(`🚫 BLOCKED: Duplicate state ${playerState}`);
      return;
    }
    
    // Handle different player states
    let requiredDelay = 50;
    let shouldSync = true;
    
    switch (playerState) {
      case -1: // Unstarted
      case 3:  // Buffering
      case 5:  // Cued
        shouldSync = false;
        break;
      case 0:  // Ended
        requiredDelay = 100;
        break;
      case 1:  // Playing
        requiredDelay = 50;
        break;
      case 2:  // Paused
        requiredDelay = 50;
        break;
    }
    
    if (!shouldSync) {
      lastPlayerStateRef.current = playerState;
      return;
    }
    
    // Debouncing for smooth sync
    if (now - lastEventTimeRef.current < requiredDelay) {
      console.log(`🚫 BLOCKED: Too soon (${now - lastEventTimeRef.current}ms < ${requiredDelay}ms)`);
      return;
    }
    
    lastEventTimeRef.current = now;
    lastPlayerStateRef.current = playerState;
    
    // Call state change callback
    onStateChange?.(playerState);
    
    // Update track info on play
    if (playerState === 1 && playerRef.current) {
      try {
        const videoData = playerRef.current.getVideoData();
        if (videoData) {
          setTrackInfo({
            title: videoData.title || "Unknown Title",
            channel: videoData.author || "Unknown Artist",
            duration: playerRef.current.getDuration() || 0
          });
        }
      } catch (error) {
        console.error('Error getting video data:', error);
      }
    }
    
    // Send sync events
    if (playerRef.current) {
      try {
        const currentTime = playerRef.current.getCurrentTime() || 0;
        
        console.log(`👑 HOST SYNC: State ${playerState} at ${currentTime.toFixed(1)}s`);
        
        switch (playerState) {
          case 1: // Playing
            onSyncPlay?.(currentVideoId, currentTime);
            break;
          case 2: // Paused
          case 0: // Ended
            onSyncPause?.(currentVideoId, currentTime);
            break;
        }
      } catch (error) {
        console.error('Error in sync event:', error);
      }
    }
  };

  // Optimized player options
  const opts: YouTubeProps['opts'] = {
    height: '315',
    width: '560',
    playerVars: {
      autoplay: 0,
      controls: isHost ? 1 : 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      fs: isHost ? 1 : 0,
      disablekb: isHost ? 0 : 1,
      enablejsapi: 1,
      iv_load_policy: 3,
      cc_load_policy: 0,
      playsinline: 1,
      origin: window.location.origin,
      widget_referrer: window.location.origin,
      ...(isHost ? {} : {
        start: 0,
        end: 0,
      })
    },
  };

  const onError = (event: { data: number }) => {
    console.error('YouTube player error:', event.data);
    
    const errorMessages: { [key: number]: string } = {
      2: 'Invalid video ID - Please check the video URL',
      5: 'HTML5 player error - Try refreshing the page',
      100: 'Video not found or is private',
      101: 'Video cannot be embedded',
      150: 'Video cannot be embedded'
    };
    
    const errorMessage = errorMessages[event.data] || `Player error (${event.data})`;
    setPlayerError(errorMessage);
    setBuffering(false);
    
    // Reset syncing state on error
    isSyncingRef.current = false;
  };

  // Handle volume changes
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (playerRef.current?.setVolume) {
      try {
        playerRef.current.setVolume(newVolume);
      } catch (error) {
        console.warn('Could not set volume:', error);
      }
    }
  };

  // Show placeholder when no video is selected
  if (!currentVideoId || currentVideoId === '') {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-bold text-white mb-2">No video selected</h3>
            <p className="text-gray-400">
              {isHost ? 'Search and select a video to start playing' : 'Waiting for host to select a video'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      
      {/* Sync Status for Participants */}
      {!isHost && (
        <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
          <p className="text-blue-300 text-sm text-center">
            {buffering ? '⏳ Buffering...' :
             isSyncingRef.current ? '🔄 Syncing...' : 
             hasReceivedInitialSyncRef.current ? '✅ Synced with host' : '⏳ Waiting for host to start'}
          </p>
        </div>
      )}

      {/* Error Display */}
      {playerError && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-300 text-sm text-center">
            ⚠️ {playerError}
          </p>
          <button 
            onClick={() => setPlayerError(null)}
            className="mt-2 px-3 py-1 bg-red-500/30 hover:bg-red-500/50 rounded text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
        
        {/* Track Info */}
        <div className="mb-6 text-center">
          <h3 className="text-xl font-bold text-white mb-1">
            {trackInfo?.title || (currentVideoId ? 'Loading video...' : 'No video selected')}
          </h3>
          <p className="text-gray-400">
            {trackInfo?.channel || (currentVideoId ? "Getting video info..." : "Select a video to get started")}
          </p>
          {trackInfo?.duration && (
            <p className="text-gray-500 text-sm mt-1">
              Duration: {Math.floor(trackInfo.duration / 60)}:{(trackInfo.duration % 60).toString().padStart(2, '0')}
            </p>
          )}
          <p className="text-sm mt-2">
            {isHost ? (
              <span className="text-purple-400">👑 You are the host - You control playback</span>
            ) : (
              <span className="text-blue-400">👥 Participant - Synced with host</span>
            )}
          </p>
        </div>

        {/* YouTube Player Container */}
        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-inner mb-6 relative">
          {buffering && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <div className="text-white text-lg">⏳ Buffering...</div>
            </div>
          )}
          
          <div className="flex justify-center">
            <YouTube
              videoId={currentVideoId}
              onReady={onReady}
              onStateChange={onPlayerStateChange}
              onError={onError}
              opts={opts}
              className="w-full max-w-[560px]"
            />
          </div>
          
          {/* Participant overlay to block interaction */}
          {!isHost && (
            <div 
              className="absolute inset-0 bg-transparent cursor-not-allowed z-10" 
              title="Only the host can control playback"
              onClick={(e) => {
                e.preventDefault();
                console.log('🚫 Participant interaction blocked');
              }}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
            />
          )}
        </div>

        {/* Volume Control for Participants */}
        {!isHost && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-gray-400 text-sm">🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              onMouseUp={(e) => handleVolumeChange(parseInt((e.target as HTMLInputElement).value))}
              className="w-32 accent-purple-500"
            />
            <span className="text-gray-400 text-sm w-8">{volume}%</span>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center text-sm text-gray-400 mb-4">
          {isHost ? (
            <>
              <p>🎮 Use the video controls above to play, pause, and seek</p>
              <p>📡 All participants will automatically sync to your actions</p>
            </>
          ) : (
            <>
              <p>👀 Watch mode: You'll automatically sync with the host</p>
              <p>🎵 Adjust volume above if needed</p>
            </>
          )}
        </div>
        
        {/* Debug Info (Development Only) */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-2 bg-gray-800/50 rounded text-xs text-gray-400">
            <p>Video: {currentVideoId} | Ready: {isReady ? '✅' : '❌'}</p>
            <p>Syncing: {isSyncingRef.current ? '🔄' : '✅'} | Host: {isHost ? '👑' : '👥'}</p>
            <p>State: {lastPlayerStateRef.current} | HasSync: {hasReceivedInitialSyncRef.current ? '✅' : '❌'}</p>
            <p>Error: {playerError || 'None'} | Buffering: {buffering ? '⏳' : '✅'}</p>
          </div>
        )}
      </div>
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;