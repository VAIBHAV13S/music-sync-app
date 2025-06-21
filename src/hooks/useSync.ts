import { useState, useEffect, useRef, useCallback } from 'react';
import { realSocketService } from '../services/realSocketService';
import type { PlaybackState } from '../services/realSocketService';

interface UseSyncProps {
  roomCode: string;
  isHost: boolean;
  onSyncReceived?: (state: PlaybackState) => void;
  onVideoLoadReceived?: (videoId: string) => void;
}

// Global state to prevent multiple connections
const connectionState = {
  isConnecting: false,
  connectedRoomCode: null as string | null,
  activeConnections: new Set<string>()
};

export const useSync = ({ roomCode, isHost, onSyncReceived, onVideoLoadReceived }: UseSyncProps) => {
  const [connected, setConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const lastSyncRef = useRef(0);
  const isInitializedRef = useRef(false);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Create unique connection ID for this hook instance
  const connectionId = useRef(`${isHost ? 'host' : 'participant'}-${Date.now()}`);

  // Stable callback for sync received - NO DEBOUNCING
  const stableSyncReceived = useCallback((data: PlaybackState) => {
    console.log('🎯 Participant received sync:', data);
    onSyncReceived?.(data);
  }, [onSyncReceived]);

  // Faster sync functions
  const syncPlay = useCallback((videoId: string, currentTime: number) => {
    if (!isHost || !connected) return;
    
    const now = Date.now();
    if (now - lastSyncRef.current < 100) { // Reduced from 500ms to 100ms
      console.log('🚫 Sync PLAY blocked - too soon');
      return;
    }
    lastSyncRef.current = now;
    
    console.log('👑 Host sending PLAY sync:', { videoId, currentTime });
    realSocketService.syncPlay(videoId, currentTime);
  }, [isHost, connected]);

  const syncPause = useCallback((videoId: string, currentTime: number) => {
    if (!isHost || !connected) return;
    
    const now = Date.now();
    if (now - lastSyncRef.current < 100) { // Reduced from 500ms to 100ms
      console.log('🚫 Sync PAUSE blocked - too soon');
      return;
    }
    lastSyncRef.current = now;
    
    console.log('👑 Host sending PAUSE sync:', { videoId, currentTime });
    realSocketService.syncPause(videoId, currentTime);
  }, [isHost, connected]);

  const syncSeek = useCallback((videoId: string, currentTime: number, isPlaying: boolean) => {
    if (!isHost || !connected) return;
    
    const now = Date.now();
    if (now - lastSyncRef.current < 200) { // Reduced from 800ms to 200ms
      console.log('🚫 Sync SEEK blocked - too soon');
      return;
    }
    lastSyncRef.current = now;
    
    console.log('👑 Host sending SEEK sync:', { videoId, currentTime, isPlaying });
    realSocketService.syncSeek(videoId, currentTime, isPlaying);
  }, [isHost, connected]);
  const syncVideoLoad = useCallback((videoId: string) => {
  if (!isHost || !connected) return;
  
  console.log('👑 Host sending VIDEO LOAD sync:', { videoId });
  realSocketService.syncVideoLoad(videoId);
  }, [isHost, connected]);

  useEffect(() => {
    // Prevent multiple connections to the same room
    if (!roomCode || isInitializedRef.current) return;
    
    // Check if already connected to this room
    if (connectionState.connectedRoomCode === roomCode) {
      console.log('⚠️ Already connected to this room, skipping...');
      return;
    }

    // Prevent concurrent connections
    if (connectionState.isConnecting) {
      console.log('⚠️ Connection already in progress, skipping...');
      return;
    }

    const connect = async () => {
      isInitializedRef.current = true;
      connectionState.isConnecting = true;
      connectionState.activeConnections.add(connectionId.current);
      
      console.log(`🔌 Connecting ${connectionId.current} to room ${roomCode}`);
      
      try {
        // Only connect if not already connected
        if (!realSocketService.isConnected) {
          await realSocketService.connect();
          console.log('✅ WebSocket connected');
        }
        
        // 🚨 THIS IS THE CRITICAL FIX - MOVE THIS OUTSIDE THE IF BLOCK!
        const syncCleanup = realSocketService.onPlaybackSync(stableSyncReceived);
        cleanupFunctionsRef.current.push(syncCleanup);

        // Set up event listeners and store cleanup functions
        const userJoinedCleanup = realSocketService.onUserJoined((data) => {
          console.log('👥 User joined:', data);
          setParticipantCount(data.participantCount);
        });
        cleanupFunctionsRef.current.push(userJoinedCleanup);

        const userLeftCleanup = realSocketService.onUserLeft((data) => {
          console.log('👋 User left:', data);
          setParticipantCount(data.participantCount);
        });
        cleanupFunctionsRef.current.push(userLeftCleanup);

        // Set up video load listener for participants only
        if (!isHost) {
          const videoLoadCleanup = realSocketService.onVideoLoadSync((data) => {
            console.log('📹 Participant received video load:', data);
            onVideoLoadReceived?.(data.videoId);
          });
          cleanupFunctionsRef.current.push(videoLoadCleanup);
        }

        // Join or create room
        let roomData;
        if (isHost) {
          roomData = await realSocketService.createRoom(roomCode);
          console.log('👑 Host created room:', roomCode);
        } else {
          roomData = await realSocketService.joinRoom(roomCode);
          console.log('👥 Joined room:', roomCode);
        }
        
        // Set initial participant count from room data
        if (roomData?.participants) {
          setParticipantCount(roomData.participants.length);
        }
        
        connectionState.connectedRoomCode = roomCode;
        setConnected(true);
        
      } catch (error) {
        console.error('❌ Sync connection failed:', error);
        setConnected(false);
        isInitializedRef.current = false;
      } finally {
        connectionState.isConnecting = false;
      }
    };

    connect();

    // Cleanup function
    return () => {
      console.log(`🧹 Cleaning up ${connectionId.current}...`);
      
      // Remove from active connections
      connectionState.activeConnections.delete(connectionId.current);
      
      // Only cleanup if this is the last connection
      if (connectionState.activeConnections.size === 0) {
        console.log('🧹 Last connection, performing full cleanup...');
        
        // Call all cleanup functions
        cleanupFunctionsRef.current.forEach(cleanup => cleanup());
        cleanupFunctionsRef.current = [];
        
        // Leave room
        realSocketService.leaveRoom();
        
        // Reset connection state
        connectionState.connectedRoomCode = null;
        connectionState.isConnecting = false;
      }
      
      setConnected(false);
      setParticipantCount(0);
      isInitializedRef.current = false;
    };
  }, [roomCode, isHost, stableSyncReceived, onVideoLoadReceived]);

  return {
    connected,
    participantCount,
    syncPlay,
    syncPause,
    syncSeek,
    syncVideoLoad,
  };
};