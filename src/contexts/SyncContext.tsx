import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode, useRef } from 'react';
import { realSocketService, PlaybackState, RoomData } from '../services/realSocketService';

interface SyncContextState {
  // Connection Status
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: string;
  
  // Room State
  room: RoomData | null;
  isHost: boolean;
  participantCount: number;
  
  // Playback State
  currentPlaybackState: PlaybackState | null;

  // Actions
  createRoom: (roomCode: string) => Promise<void>;
  joinRoom: (roomCode: string) => Promise<void>;
  leaveRoom: () => void;
  
  // Host Actions
  syncPlay: (videoId: string, currentTime: number) => void;
  syncPause: (videoId: string, currentTime: number) => void;
  syncSeek: (videoId: string, currentTime: number, isPlaying: boolean) => void;
  syncVideoLoad: (videoId: string) => void;
}

const SyncContext = createContext<SyncContextState | undefined>(undefined);

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
};

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(realSocketService.isConnected);
  const [isConnecting, setIsConnecting] = useState(realSocketService.isConnecting);
  const [connectionState, setConnectionState] = useState(realSocketService.connectionState);
  
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [currentPlaybackState, setCurrentPlaybackState] = useState<PlaybackState | null>(null);

  const lastSyncRef = useRef(0);

  const handlePlaybackSync = useCallback((state: PlaybackState) => {
    setCurrentPlaybackState(state);
    setRoom(prev => prev ? { ...prev, currentTrack: state } : null);
  }, []);

  const handleUserJoined = useCallback((data: { participantCount: number }) => {
    setParticipantCount(data.participantCount);
  }, []);

  const handleUserLeft = useCallback((data: { participantCount: number }) => {
    setParticipantCount(data.participantCount);
  }, []);

  const handleHostChanged = useCallback((data: { newHostId: string }) => {
    setRoom(prev => prev ? { ...prev, hostId: data.newHostId } : null);
    // If this client is the new host, update its state
    if (realSocketService.socketId === data.newHostId) {
      setIsHost(true);
    }
  }, []);

  const handleVideoLoad = useCallback((data: { videoId: string }) => {
    setCurrentPlaybackState(prev => ({
        ...(prev || { videoId: '', currentTime: 0, isPlaying: false, timestamp: 0 }),
        videoId: data.videoId,
    }));
  }, []);

  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];
    cleanupFunctions.push(realSocketService.onPlaybackSync(handlePlaybackSync));
    cleanupFunctions.push(realSocketService.onUserJoined(handleUserJoined));
    cleanupFunctions.push(realSocketService.onUserLeft(handleUserLeft));
    cleanupFunctions.push(realSocketService.onHostChanged(handleHostChanged));
    cleanupFunctions.push(realSocketService.onVideoLoadSync(handleVideoLoad));

    const interval = setInterval(() => {
        setIsConnected(realSocketService.isConnected);
        setIsConnecting(realSocketService.isConnecting);
        setConnectionState(realSocketService.connectionState);
    }, 500);

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
      clearInterval(interval);
    };
  }, [handlePlaybackSync, handleUserJoined, handleUserLeft, handleHostChanged, handleVideoLoad]);

  const createRoom = async (roomCode: string) => {
    console.log(`[SyncContext] createRoom called for code: ${roomCode}. Current socket connection state: ${connectionState}`);
    if (!realSocketService.isConnected) {
      console.log('[SyncContext] Socket not connected, attempting to connect first...');
      await realSocketService.connect();
      console.log('[SyncContext] Socket connected.');
    }
    console.log(`[SyncContext] Emitting 'create-room' to server...`);
    const roomData = await realSocketService.createRoom(roomCode);
    console.log('[SyncContext] Received room data from server:', roomData);
    setRoom(roomData);
    setIsHost(true);
    setParticipantCount(roomData.participants.length);
    setCurrentPlaybackState(roomData.currentTrack || null);
  };

  const joinRoom = async (roomCode: string) => {
    if (!realSocketService.isConnected) await realSocketService.connect();
    const roomData = await realSocketService.joinRoom(roomCode);
    setRoom(roomData);
    setIsHost(false);
    setParticipantCount(roomData.participants.length);
    setCurrentPlaybackState(roomData.currentTrack || null);
  };

  const leaveRoom = () => {
    realSocketService.leaveRoom();
    realSocketService.disconnect();
    setRoom(null);
    setIsHost(false);
    setParticipantCount(0);
    setCurrentPlaybackState(null);
  };

  const syncPlay = useCallback((videoId: string, currentTime: number) => {
    if (!isHost || !isConnected) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 100) return;
    lastSyncRef.current = now;
    realSocketService.syncPlay(videoId, currentTime);
  }, [isHost, isConnected]);

  const syncPause = useCallback((videoId: string, currentTime: number) => {
    if (!isHost || !isConnected) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 100) return;
    lastSyncRef.current = now;
    realSocketService.syncPause(videoId, currentTime);
  }, [isHost, isConnected]);

  const syncSeek = useCallback((videoId: string, currentTime: number, isPlaying: boolean) => {
    if (!isHost || !isConnected) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 200) return;
    lastSyncRef.current = now;
    realSocketService.syncSeek(videoId, currentTime, isPlaying);
  }, [isHost, isConnected]);

  const syncVideoLoad = useCallback((videoId: string) => {
    if (!isHost || !isConnected) return;
    realSocketService.syncVideoLoad(videoId);
  }, [isHost, isConnected]);

  const value: SyncContextState = {
    isConnected, isConnecting, connectionState, room, isHost, participantCount,
    currentPlaybackState, createRoom, joinRoom, leaveRoom, syncPlay, syncPause,
    syncSeek, syncVideoLoad,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};