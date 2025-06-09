import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';

const app = express();
const server = createServer(app);

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3001;

// Trust proxy - IMPORTANT: Add this before rate limiting
app.set('trust proxy', 1);

// CORS configuration - MOVE THIS UP BEFORE OTHER MIDDLEWARE
const allowedOrigins = isDevelopment 
  ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
  : [
      'https://music-sync-1hhi4k2ew-vaibhav13s-projects.vercel.app',
    ];

// Apply CORS FIRST - before other middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, log the rejected origin
    if (isDevelopment) {
      console.log('CORS rejected origin:', origin);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200 // Support legacy browsers
}));

// Handle preflight requests explicitly
app.options('*', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Production security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Rate limiting with proper proxy support - MOVED AFTER CORS AND EXPRESS.JSON
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  // Skip rate limiting for OPTIONS requests (preflight)
  skip: (req) => req.method === 'OPTIONS'
});

// Apply rate limiting only to API routes
app.use('/api', limiter);

// Socket.IO server with proper CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
});

// Interfaces
interface Room {
  roomCode: string;
  hostId: string;
  participants: string[];
  currentTrack?: PlaybackState | undefined;
  createdAt: number;
  lastActivity: number;
}

interface PlaybackState {
  videoId: string;
  currentTime: number;
  isPlaying: boolean;
  timestamp: number;
}

// Data storage
const rooms = new Map<string, Room>();
const userRooms = new Map<string, string>();
const userLastActivity = new Map<string, number>();

// Utility functions
const logProduction = (level: 'info' | 'error' | 'warn', message: string, data?: any): void => {
  if (isDevelopment || level !== 'info') {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] ${message}`, data || '');
  }
};

const validateRoomCode = (roomCode: string): boolean => {
  return typeof roomCode === 'string' && 
         roomCode.length >= 4 && 
         roomCode.length <= 10 && 
         /^[A-Z0-9]+$/.test(roomCode);
};

const updateRoomActivity = (roomCode: string): void => {
  const room = rooms.get(roomCode);
  if (room) {
    room.lastActivity = Date.now();
  }
};

// Helper functions
function handleSyncEvent(socketId: string, data: any, isPlaying: boolean): void {
  try {
    const roomCode = userRooms.get(socketId);
    if (!roomCode) {
      logProduction('warn', 'Sync event: User not in room');
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      logProduction('warn', 'Sync event: Room not found');
      return;
    }
    
    if (room.hostId !== socketId) {
      logProduction('warn', 'Sync event: Not authorized - not host');
      return;
    }

    if (!data.videoId || typeof data.currentTime !== 'number') {
      logProduction('warn', 'Invalid sync data received:', data);
      return;
    }

    const now = Date.now();
    const playbackState: PlaybackState = {
      videoId: data.videoId,
      currentTime: Math.max(0, data.currentTime),
      isPlaying,
      timestamp: now
    };

    room.currentTrack = playbackState;
    updateRoomActivity(roomCode);

    logProduction('info', `✅ Host sync: ${isPlaying ? 'PLAY' : 'PAUSE'} ${data.videoId} at ${data.currentTime.toFixed(1)}s to ${room.participants.length - 1} participants`);

    // Broadcast immediately to participants
    io.to(roomCode).emit('playback-sync', playbackState);
    
  } catch (error) {
    logProduction('error', 'handleSyncEvent error:', error);
  }
}

function leaveRoom(socketId: string, roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.participants = room.participants.filter(id => id !== socketId);
  updateRoomActivity(roomCode);

  io.to(roomCode).emit('user-left', {
    userId: socketId,
    roomCode,
    participantCount: room.participants.length
  });

  if (room.hostId === socketId) {
    if (room.participants.length > 0) {
      room.hostId = room.participants[0];
      io.to(roomCode).emit('host-changed', {
        newHostId: room.hostId,
        roomCode
      });
      logProduction('info', `Host transferred in room ${roomCode}`);
    } else {
      rooms.delete(roomCode);
      logProduction('info', `Room deleted: ${roomCode}`);
    }
  }

  userRooms.delete(socketId);
}

// Cleanup inactive rooms
setInterval(() => {
  const now = Date.now();
  const inactivityTimeout = 2 * 60 * 60 * 1000; // 2 hours
  const emptyRoomTimeout = 30 * 60 * 1000; // 30 minutes

  for (const [roomCode, room] of rooms.entries()) {
    const shouldDelete = 
      (room.participants.length === 0 && now - room.lastActivity > emptyRoomTimeout) ||
      (now - room.lastActivity > inactivityTimeout);

    if (shouldDelete) {
      rooms.delete(roomCode);
      logProduction('info', `🧹 Cleaned up room: ${roomCode}`);
    }
  }
}, 10 * 60 * 1000); // Check every 10 minutes

// Socket connection handling
io.on('connection', (socket) => {
  userLastActivity.set(socket.id, Date.now());
  logProduction('info', `👤 User connected: ${socket.id}`);

  // Activity tracking middleware
  socket.use((_, next) => {
    userLastActivity.set(socket.id, Date.now());
    next();
  });

  // Create room handler
  socket.on('create-room', (data, callback) => {
    try {
      const { roomCode } = data;

      if (!validateRoomCode(roomCode)) {
        callback({ success: false, error: 'Invalid room code format' });
        return;
      }

      if (rooms.has(roomCode)) {
        const existingRoom = rooms.get(roomCode)!;
        
        if (existingRoom.hostId === socket.id || existingRoom.participants.includes(socket.id)) {
          updateRoomActivity(roomCode);
          callback({ success: true, room: existingRoom });
          return;
        }
        
        callback({ success: false, error: 'Room already exists' });
        return;
      }

      const room: Room = {
        roomCode,
        hostId: socket.id,
        participants: [socket.id],
        currentTrack: undefined,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      userRooms.set(socket.id, roomCode);

      logProduction('info', `🏠 Room created: ${roomCode} by ${socket.id}`);
      callback({ success: true, room });

    } catch (error) {
      logProduction('error', 'Create room error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Join room handler
  socket.on('join-room', (data, callback) => {
    try {
      const { roomCode } = data;

      if (!validateRoomCode(roomCode)) {
        callback({ success: false, error: 'Invalid room code format' });
        return;
      }

      const room = rooms.get(roomCode);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      if (!room.participants.includes(socket.id)) {
        room.participants.push(socket.id);
      }

      userRooms.set(socket.id, roomCode);
      socket.join(roomCode);
      updateRoomActivity(roomCode);

      // Notify other participants
      socket.to(roomCode).emit('user-joined', {
        userId: socket.id,
        roomCode,
        participantCount: room.participants.length
      });

      // Send current track to new participant
      if (room.currentTrack) {
        socket.emit('playback-sync', room.currentTrack);
        logProduction('info', `📡 Sent current track to new participant: ${room.currentTrack.videoId}`);
      }

      logProduction('info', `👥 User joined room: ${roomCode} (${room.participants.length} total)`);
      callback({ success: true, room });

    } catch (error) {
      logProduction('error', 'Join room error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Leave room handler
  socket.on('leave-room', () => {
    const roomCode = userRooms.get(socket.id);
    if (roomCode) {
      leaveRoom(socket.id, roomCode);
      socket.leave(roomCode);
      logProduction('info', `👋 User left room: ${roomCode}`);
    }
  });

  // Sync event handlers
  socket.on('sync-play', (data) => {
    handleSyncEvent(socket.id, data, true);
  });

  socket.on('sync-pause', (data) => {
    handleSyncEvent(socket.id, data, false);
  });

  socket.on('sync-seek', (data) => {
    handleSyncEvent(socket.id, data, data.isPlaying);
  });

  // Video load sync handler
  socket.on('sync-video-load', (data: { videoId: string }) => {
    const roomCode = userRooms.get(socket.id);
    logProduction('info', `📹 Video load request from ${socket.id}, room: ${roomCode}, video: ${data.videoId}`);
    
    if (!roomCode) {
      logProduction('warn', '❌ Video load sync: User not in room');
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      logProduction('warn', '❌ Video load sync: Room not found');
      return;
    }
    
    if (room.hostId !== socket.id) {
      logProduction('warn', '❌ Video load sync: Not authorized - not host');
      return;
    }

    logProduction('info', `✅ Broadcasting video load: ${data.videoId} to ${room.participants.length - 1} participants`);

    // Broadcast video load to participants
    socket.to(roomCode).emit('video-load-sync', { 
      videoId: data.videoId,
      timestamp: Date.now()
    });
    
    logProduction('info', `📡 Video load broadcast completed for room ${roomCode}`);
  });

  // Disconnect handler
  socket.on('disconnect', (reason) => {
    logProduction('info', `👤 User disconnected: ${socket.id} (${reason})`);
    
    const roomCode = userRooms.get(socket.id);
    if (roomCode) {
      leaveRoom(socket.id, roomCode);
    }
    
    userLastActivity.delete(socket.id);
  });
});

// API Routes
app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    rooms: rooms.size,
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/stats', (_req: Request, res: Response): void => {
  if (!isDevelopment) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const roomStats = Array.from(rooms.values()).map(room => ({
    roomCode: room.roomCode,
    participantCount: room.participants.length,
    hasCurrentTrack: !!room.currentTrack,
    lastActivity: new Date(room.lastActivity).toISOString()
  }));

  res.json({
    totalRooms: rooms.size,
    totalConnections: io.engine.clientsCount,
    rooms: roomStats
  });
});

// API route for room info
app.get('/api/rooms/:roomCode', (req: Request, res: Response): void => {
  const { roomCode } = req.params;
  
  if (!validateRoomCode(roomCode)) {
    res.status(400).json({ error: 'Invalid room code format' });
    return;
  }

  const room = rooms.get(roomCode);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  res.json({
    roomCode: room.roomCode,
    participantCount: room.participants.length,
    hasCurrentTrack: !!room.currentTrack,
    createdAt: new Date(room.createdAt).toISOString(),
    lastActivity: new Date(room.lastActivity).toISOString()
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const origin = req.headers.origin;
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req: Request, res: Response): void => {
  const origin = req.headers.origin;
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logProduction('info', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    logProduction('info', 'Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logProduction('info', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    logProduction('info', 'Process terminated');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logProduction('info', `🚀 Music Sync Server running on port ${PORT}`);
  logProduction('info', `🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  logProduction('info', `📡 WebSocket server ready`);
  logProduction('info', `🔗 Health check: http://localhost:${PORT}/api/health`);
  
  if (isDevelopment) {
    logProduction('info', `📊 Stats endpoint: http://localhost:${PORT}/api/stats`);
  }
});