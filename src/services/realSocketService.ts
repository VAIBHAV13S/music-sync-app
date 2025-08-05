import { io, Socket } from 'socket.io-client';

export interface PlaybackState {
  videoId: string;
  currentTime: number;
  isPlaying: boolean;
  timestamp: number;
}

export interface RoomData {
  roomCode: string;
  hostId: string;
  participants: string[];
  currentTrack?: PlaybackState;
  createdAt: number;
  lastActivity: number;
}

interface RoomResponse {
  success: boolean;
  room?: RoomData;
  error?: string;
}

interface EventCallback<T = any> {
  (data: T): void;
}

class RealSocketService {
  private socket: Socket | null = null;
  private _connected = false;
  private _connecting = false;
  private serverUrl = this.getServerUrl();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isProduction = import.meta.env.PROD;
  private currentRoomCode: string | null = null;
  private eventListeners = new Map<string, Set<EventCallback>>();
  private connectionPromise: Promise<void> | null = null;

  private getServerUrl(): string {
    // Priority: Environment variable > Production detection > Development fallback
    if (import.meta.env.VITE_SOCKET_SERVER_URL) {
      return import.meta.env.VITE_SOCKET_SERVER_URL;
    }
    
    // Detect if we're on Vercel production
    if (import.meta.env.PROD || window.location.hostname.includes('vercel.app')) {
      return 'https://music-sync-server-nz0r.onrender.com';
    }
    
    // Development fallback
    return 'http://localhost:3001';
  }

  private log(level: 'info' | 'error' | 'warn', message: string, data?: any): void {
    if (this.isProduction && level === 'info') return;
    
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    const timestamp = new Date().toLocaleTimeString();
    
    if (data) {
      console[level](`[${timestamp}] ${prefix} ${message}`, data);
    } else {
      console[level](`[${timestamp}] ${prefix} ${message}`);
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.log('info', 'WebSocket connected successfully');
      this._connected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason: string) => {
      this.log('warn', `WebSocket disconnected: ${reason}`);
      this._connected = false;
      
      // Don't log manual disconnects as errors
      if (reason !== 'io client disconnect') {
        this.log('info', 'Will attempt to reconnect...');
      }
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      this.log('info', `WebSocket reconnected after ${attemptNumber} attempts`);
      this._connected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error: Error) => {
      this.log('error', 'Reconnection failed', error.message);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect_failed', () => {
      this.log('error', 'Reconnection failed permanently');
      this._connected = false;
    });

    this.socket.on('connect_error', (error: Error) => {
      this.log('error', 'Connection error', error.message);
      this._connected = false;
      
      // If connection fails and we detect we might be on the wrong URL, try alternative
      if (error.message.includes('timeout') || error.message.includes('connection')) {
        this.log('warn', `Connection failed to ${this.serverUrl}, checking alternatives...`);
      }
    });

    // Set up forwarding for tracked events
    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    if (!this.socket) return;

    const events = [
      'playback-sync',
      'user-joined', 
      'user-left',
      'room-update',
      'host-changed',
      'room-error',
      'video-load-sync' 
    ];

    events.forEach(eventName => {
      this.socket!.on(eventName, (data: any) => {
        console.log(`📡 Received ${eventName}:`, data);
        this.emitToListeners(eventName, data);
      });
    });
  }

  private emitToListeners(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.log('error', `Error in event listener for ${eventName}`, error);
        }
      });
    }
  }

  private addListener(eventName: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    
    this.eventListeners.get(eventName)!.add(callback);
    
    // Return cleanup function
    return () => {
      this.eventListeners.get(eventName)?.delete(callback);
    };
  }

  async connect(): Promise<void> {
    // If already connected, return immediately
    if (this._connected && this.socket?.connected) {
      this.log('info', 'Already connected to WebSocket');
      return Promise.resolve();
    }

    // If connection is in progress, return the existing promise
    if (this._connecting && this.connectionPromise) {
      this.log('info', 'Connection already in progress...');
      return this.connectionPromise;
    }

    this._connecting = true;
    this.connectionPromise = this.performConnection();

    try {
      await this.connectionPromise;
    } finally {
      this._connecting = false;
      this.connectionPromise = null;
    }
  }

  private performConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('info', `🔌 Attempting to connect to: ${this.serverUrl}`);
      this.log('info', `📊 Environment: ${import.meta.env.PROD ? 'production' : 'development'}`);
      this.log('info', `🌐 Current location: ${window.location.hostname}`);
      this.log('info', `🔧 Environment variable: ${import.meta.env.VITE_SOCKET_SERVER_URL || 'NOT SET'}`);
      
      // Disconnect any existing socket
      if (this.socket) {
        this.socket.disconnect();
      }

      this.socket = io(this.serverUrl, {
        auth: {
          token: localStorage.getItem('accessToken') // ✅ Fixed: Added authentication token
        },
        transports: ['websocket', 'polling'],
        timeout: 15000,
        forceNew: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Set up socket listeners
      this.setupSocketListeners();

      // Handle connection success
      const onConnect = () => {
        cleanup();
        resolve();
      };

      // Handle connection failure
      const onError = (error: Error) => {
        cleanup();
        this.log('error', 'Initial connection failed', error.message);
        reject(new Error(`Connection failed: ${error.message}`));
      };

      // Setup timeout
      const timeout = setTimeout(() => {
        cleanup();
        this.log('error', 'Connection timeout');
        reject(new Error('Connection timeout'));
      }, 20000);

      // Cleanup function
      const cleanup = () => {
        clearTimeout(timeout);
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
      };

      // Attach one-time listeners
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
    });
  }

  disconnect(): void {
    this.log('info', 'Disconnecting WebSocket...');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this._connected = false;
    this._connecting = false;
    this.currentRoomCode = null;
    this.connectionPromise = null;
    
    // Clear all event listeners
    this.eventListeners.clear();
  }

  async createRoom(roomCode: string): Promise<RoomData> {
    if (!this.socket || !this._connected) {
      throw new Error('Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room creation timeout'));
      }, 10000);

      this.socket!.emit('create-room', { roomCode }, (response: RoomResponse) => {
        clearTimeout(timeout);
        
        if (response?.success && response.room) {
          this.currentRoomCode = roomCode;
          this.log('info', `Room created: ${roomCode}`);
          resolve(response.room);
        } else {
          this.log('error', 'Failed to create room', response?.error);
          reject(new Error(response?.error || 'Failed to create room'));
        }
      });
    });
  }

  async joinRoom(roomCode: string): Promise<RoomData> {
    if (!this.socket || !this._connected) {
      throw new Error('Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 10000);

      this.socket!.emit('join-room', { roomCode }, (response: RoomResponse) => {
        clearTimeout(timeout);
        
        if (response?.success && response.room) {
          this.currentRoomCode = roomCode;
          this.log('info', `Joined room: ${roomCode}`);
          resolve(response.room);
        } else {
          this.log('error', 'Failed to join room', response?.error);
          reject(new Error(response?.error || 'Failed to join room'));
        }
      });
    });
  }

  leaveRoom(): void {
    if (this.socket && this._connected && this.currentRoomCode) {
      this.log('info', `Leaving room: ${this.currentRoomCode}`);
      this.socket.emit('leave-room');
      this.currentRoomCode = null;
    }
  }

  // Sync operations with validation
  syncPlay(videoId: string, currentTime: number): void {
    if (!this.validateSyncParams(videoId, currentTime)) return;
    
    this.log('info', `Syncing PLAY: ${videoId} at ${currentTime}s`);
    this.socket!.emit('sync-play', { videoId, currentTime: Math.max(0, currentTime) });
  }

  syncPause(videoId: string, currentTime: number): void {
    if (!this.validateSyncParams(videoId, currentTime)) return;
    
    this.log('info', `Syncing PAUSE: ${videoId} at ${currentTime}s`);
    this.socket!.emit('sync-pause', { videoId, currentTime: Math.max(0, currentTime) });
  }

  syncSeek(videoId: string, currentTime: number, isPlaying: boolean): void {
    if (!this.validateSyncParams(videoId, currentTime)) return;
    
    this.log('info', `Syncing SEEK: ${videoId} to ${currentTime}s (${isPlaying ? 'playing' : 'paused'})`);
    this.socket!.emit('sync-seek', { 
      videoId, 
      currentTime: Math.max(0, currentTime), 
      isPlaying 
    });
  }

  private validateSyncParams(videoId: string, currentTime: number): boolean {
    if (!this.socket || !this._connected) {
      this.log('warn', 'Cannot sync: not connected');
      return false;
    }

    if (!this.currentRoomCode) {
      this.log('warn', 'Cannot sync: not in a room');
      return false;
    }

    if (!videoId || typeof currentTime !== 'number' || currentTime < 0) {
      this.log('warn', 'Cannot sync: invalid parameters', { videoId, currentTime });
      return false;
    }

    return true;
  }
    // Add this method to RealSocketService class
  syncVideoLoad(videoId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot sync video load: Not connected');
      return;
    }
    
    this.log('info', `Syncing VIDEO LOAD: ${videoId}`);
    this.socket.emit('sync-video-load', { videoId });
  }

  // Add this event listener method
  onVideoLoadSync(callback: EventCallback<{ videoId: string }>): () => void {
    return this.addListener('video-load-sync', callback);
  }
  // Event subscription methods with cleanup
  onPlaybackSync(callback: EventCallback<PlaybackState>): () => void {
    console.log('🎯 Setting up playback sync listener');
    return this.addListener('playback-sync', callback);
  }

  onUserJoined(callback: EventCallback<{ userId: string; roomCode: string; participantCount: number }>): () => void {
    return this.addListener('user-joined', callback);
  }

  onUserLeft(callback: EventCallback<{ userId: string; roomCode: string; participantCount: number }>): () => void {
    return this.addListener('user-left', callback);
  }

  onRoomUpdate(callback: EventCallback<RoomData>): () => void {
    return this.addListener('room-update', callback);
  }

  onHostChanged(callback: EventCallback<{ newHostId: string; roomCode: string }>): () => void {
    return this.addListener('host-changed', callback);
  }

  onRoomError(callback: EventCallback<{ error: string; roomCode?: string }>): () => void {
    return this.addListener('room-error', callback);
  }

  // Health check
  async ping(): Promise<number> {
    if (!this.socket || !this._connected) {
      throw new Error('Not connected');
    }

    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);

      this.socket!.emit('ping', (response: any) => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        resolve(latency);
      });
    });
  }

  // Getters
  get isConnected(): boolean {
    return this._connected && Boolean(this.socket?.connected);
  }

  get isConnecting(): boolean {
    return this._connecting;
  }

  get currentRoom(): string | null {
    return this.currentRoomCode;
  }

  get connectionState(): string {
    if (!this.socket) return 'disconnected';
    if (this._connecting) return 'connecting';
    if (this._connected) return 'connected';
    return 'disconnected';
  }

  // Debug info
  getDebugInfo(): object {
    return {
      connected: this._connected,
      connecting: this._connecting,
      currentRoom: this.currentRoomCode,
      reconnectAttempts: this.reconnectAttempts,
      serverUrl: this.serverUrl,
      socketId: this.socket?.id || null,
      activeListeners: Array.from(this.eventListeners.keys()),
      environment: {
        isProd: import.meta.env.PROD,
        hostname: window.location.hostname,
        envVar: import.meta.env.VITE_SOCKET_SERVER_URL || 'not-set'
      }
    };
  }

  // Method to test connection to server
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/health`);
      const healthy = response.ok;
      this.log('info', `🏥 Server health check: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`, {
        status: response.status,
        url: this.serverUrl
      });
      return healthy;
    } catch (error) {
      this.log('error', '🏥 Server health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const realSocketService = new RealSocketService();
if (typeof window !== 'undefined') {
  (window as any).realSocketService = realSocketService;
}