import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { authService, authenticateToken } from './auth';
import { connectDatabase } from './database/connection';
import { Room } from './models/Room';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const app = express();
const server = createServer(app);

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const isRenderDev = process.env.RENDER_ENV === 'development'; // Custom flag for Render
const isLocalDev = isDevelopment && !process.env.RENDER; // Only true for local development
const PORT = process.env.PORT || 3001;

// Trust proxy - IMPORTANT: Add this before rate limiting
app.set('trust proxy', 1);

// CORS configuration - MOVE THIS UP BEFORE OTHER MIDDLEWARE
const allowedOrigins = isLocalDev
  ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
  : [
      /^https:\/\/music-sync.*\.vercel\.app$/,
      /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel apps if needed
      // Add your actual deployed URLs here when you know them
    ];

// Update the CORS configuration around line 28
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else {
        return allowedOrigin.test(origin);
      }
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // More detailed logging for blocked origins
      logProduction('warn', `🚫 CORS blocked origin: ${origin}`, {
        blockedOrigin: origin,
        allowedOrigins: allowedOrigins.map(o => typeof o === 'string' ? o : o.toString()),
        environment: isLocalDev ? 'local' : isRenderDev ? 'render-dev' : 'production'
      });
      
      // In development, be more permissive
      if (isRenderDev) {
        logProduction('info', '🔓 Allowing origin in render-dev mode');
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
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
  max: isLocalDev ? 1000 : 100, // 1000 for local dev, 100 for Render and production
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
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
  pingTimeout: isLocalDev ? 60000 : 25000, // Shorter timeout for production
  pingInterval: isLocalDev ? 25000 : 10000, // More frequent pings in production
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  // Add connection state recovery for better reliability
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  // Improve polling for unreliable connections
  allowRequest: (req, callback) => {
    // Allow all requests but log them in production
    if (!isLocalDev) {
      const origin = req.headers.origin;
      logProduction('info', `🔌 Socket connection attempt from: ${origin || 'unknown'}`);
    }
    callback(null, true);
  }
});

// Interfaces
interface Room {
  roomCode: string;
  hostId: string;
  hostUser?: { id: string; username: string; avatar?: string };
  participants: Array<{ socketId: string; userId: string; username: string; avatar?: string }>;
  currentTrack?: PlaybackState | undefined;
  createdAt: number;
  lastActivity: number;
  isPrivate: boolean;
  password?: string;
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
  const timestamp = new Date().toISOString();
  
  if (isLocalDev) {
    // Colorful local development logging
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };
    console.log(`${colors[level]}[${level.toUpperCase()}]${colors.reset} ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  } else {
    // Structured logging for Render and production
    console.log(JSON.stringify({ 
      level, 
      message, 
      data, 
      timestamp,
      environment: isRenderDev ? 'render-dev' : 'production'
    }));
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

  // Fix: Filter by comparing socketId property of participant objects
  room.participants = room.participants.filter(participant => participant.socketId !== socketId);
  updateRoomActivity(roomCode);

  io.to(roomCode).emit('user-left', {
    userId: socketId,
    roomCode,
    participantCount: room.participants.length
  });

  if (room.hostId === socketId) {
    if (room.participants.length > 0) {
      // Fix: Use socketId property of the first participant
      room.hostId = room.participants[0].socketId;
      io.to(roomCode).emit('host-changed', {
        newHostId: room.hostId,
        roomCode
      });
      logProduction('info', `Host transferred in room ${roomCode}`);
    } else {
      // Clean up both memory and database
      rooms.delete(roomCode);
      
      // Clean up database room async (don't wait for it)
      Room.deleteOne({ roomCode }).catch(error => {
        logProduction('error', `Failed to delete room ${roomCode} from database:`, error);
      });
      
      logProduction('info', `Room deleted: ${roomCode}`);
    }
  } else if (room.participants.length === 0) {
    // Clean up empty room
    rooms.delete(roomCode);
    
    // Clean up database room async
    Room.deleteOne({ roomCode }).catch(error => {
      logProduction('error', `Failed to delete empty room ${roomCode} from database:`, error);
    });
    
    logProduction('info', `Empty room deleted: ${roomCode}`);
  }

  userRooms.delete(socketId);
}

// Cleanup inactive rooms
setInterval(async () => {
  const now = Date.now();
  const inactivityTimeout = 2 * 60 * 60 * 1000; // 2 hours
  const emptyRoomTimeout = 30 * 60 * 1000; // 30 minutes

  // Clean up memory rooms
  for (const [roomCode, room] of rooms.entries()) {
    const shouldDelete = 
      (room.participants.length === 0 && now - room.lastActivity > emptyRoomTimeout) ||
      (now - room.lastActivity > inactivityTimeout);

    if (shouldDelete) {
      rooms.delete(roomCode);
      logProduction('info', `🧹 Cleaned up memory room: ${roomCode}`);
    }
  }

  // Clean up stale database rooms
  try {
    const cutoffTime = new Date(now - inactivityTimeout);
    const result = await Room.deleteMany({
      lastActivity: { $lt: cutoffTime }
    });
    
    if (result.deletedCount > 0) {
      logProduction('info', `🧹 Cleaned up ${result.deletedCount} stale database rooms`);
    }
  } catch (error) {
    logProduction('error', 'Database cleanup error:', error);
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

  // Room restoration handler for reconnections
  socket.on('restore-room', async (data, callback) => {
    try {
      const { roomCode } = data;
      const user = socket.data.user;

      if (!validateRoomCode(roomCode)) {
        callback({ success: false, error: 'Invalid room code format' });
        return;
      }

      const dbRoom = await Room.findOne({ roomCode });
      if (!dbRoom) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Restore room to memory if not present
      let memoryRoom = rooms.get(roomCode);
      if (!memoryRoom) {
        memoryRoom = {
          roomCode,
          hostId: dbRoom.hostId,
          hostUser: dbRoom.hostUser,
          participants: [],
          createdAt: new Date(dbRoom.createdAt).getTime(),
          lastActivity: Date.now(),
          isPrivate: dbRoom.isPrivate,
          password: dbRoom.password,
          currentTrack: undefined
        };
        rooms.set(roomCode, memoryRoom);
        logProduction('info', `🔄 Restored room ${roomCode} to memory from database`);
      }

      // Update user's participation
      const existingParticipant = memoryRoom.participants.find(p => p.userId === user.id);
      if (!existingParticipant) {
        memoryRoom.participants.push({
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          avatar: user.avatar
        });
      } else {
        // Update socket ID for existing participant
        existingParticipant.socketId = socket.id;
      }

      userRooms.set(socket.id, roomCode);
      socket.join(roomCode);
      memoryRoom.lastActivity = Date.now();

      logProduction('info', `🔄 ${user.username} restored connection to room: ${roomCode}`);
      callback({ 
        success: true, 
        room: { 
          ...dbRoom.toObject(), 
          password: undefined,
          currentTrack: memoryRoom.currentTrack 
        } 
      });

    } catch (error) {
      logProduction('error', 'Restore room error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Create room handler
  socket.on('create-room', async (data, callback) => {
    try {
      const { roomCode, isPrivate, password } = data;
      const user = socket.data.user;

      if (!validateRoomCode(roomCode)) {
        callback({ success: false, error: 'Invalid room code format' });
        return;
      }

      // Check if room already exists in database OR in-memory
      const existingDbRoom = await Room.findOne({ roomCode });
      const existingMemoryRoom = rooms.get(roomCode);
      
      if (existingDbRoom || existingMemoryRoom) {
        // Try to clean up stale database room if no active participants
        if (existingDbRoom && !existingMemoryRoom) {
          const timeSinceLastActivity = Date.now() - new Date(existingDbRoom.lastActivity).getTime();
          if (timeSinceLastActivity > 30 * 60 * 1000) { // 30 minutes
            await Room.deleteOne({ roomCode });
            logProduction('info', `🧹 Cleaned up stale database room: ${roomCode}`);
          } else {
            callback({ success: false, error: 'Room already exists' });
            return;
          }
        } else {
          callback({ success: false, error: 'Room already exists' });
          return;
        }
      }

      // Create room in database
      const dbRoom = new Room({
        roomCode,
        hostId: socket.id,
        hostUser: { id: user.id, username: user.username, avatar: user.avatar },
        participants: [{ socketId: socket.id, userId: user.id, username: user.username, avatar: user.avatar }],
        isPrivate: isPrivate || false,
        password: password || undefined
      });

      await dbRoom.save();

      // Create room in memory for active session management
      const memoryRoom: Room = {
        roomCode,
        hostId: socket.id,
        hostUser: { id: user.id, username: user.username, avatar: user.avatar },
        participants: [{ socketId: socket.id, userId: user.id, username: user.username, avatar: user.avatar }],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isPrivate: isPrivate || false,
        password: password || undefined
      };

      rooms.set(roomCode, memoryRoom);
      socket.join(roomCode);
      userRooms.set(socket.id, roomCode);

      logProduction('info', `🏠 Room created: ${roomCode} by ${user.username} (${user.id})`);
      callback({ success: true, room: { ...dbRoom.toObject(), password: undefined } });

    } catch (error) {
      logProduction('error', 'Create room error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Updated room joining with database
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomCode, password } = data;
      const user = socket.data.user;

      if (!validateRoomCode(roomCode)) {
        callback({ success: false, error: 'Invalid room code format' });
        return;
      }

      const dbRoom = await Room.findOne({ roomCode });
      if (!dbRoom) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Check password for private rooms
      if (dbRoom.isPrivate && dbRoom.password && dbRoom.password !== password) {
        callback({ success: false, error: 'Incorrect room password' });
        return;
      }

      // Get or create memory room
      let memoryRoom = rooms.get(roomCode);
      if (!memoryRoom) {
        // Restore room to memory from database
        memoryRoom = {
          roomCode,
          hostId: dbRoom.hostId,
          hostUser: dbRoom.hostUser,
          participants: [],
          createdAt: new Date(dbRoom.createdAt).getTime(),
          lastActivity: Date.now(),
          isPrivate: dbRoom.isPrivate,
          password: dbRoom.password,
          currentTrack: undefined
        };
        rooms.set(roomCode, memoryRoom);
        logProduction('info', `🔄 Restored room ${roomCode} to memory`);
      }

      // Check if user already in room (memory)
      const existingMemoryParticipant = memoryRoom.participants.find(p => p.userId === user.id);
      if (!existingMemoryParticipant) {
        memoryRoom.participants.push({ 
          socketId: socket.id, 
          userId: user.id, 
          username: user.username, 
          avatar: user.avatar
        });
      }

      // Update database
      const existingDbParticipant = dbRoom.participants.find(p => p.userId === user.id);
      if (!existingDbParticipant) {
        dbRoom.participants.push({ 
          socketId: socket.id, 
          userId: user.id, 
          username: user.username, 
          avatar: user.avatar,
          joinedAt: new Date()
        });
        
        // Update peak participants
        if (dbRoom.participants.length > dbRoom.stats.peakParticipants) {
          dbRoom.stats.peakParticipants = dbRoom.participants.length;
        }
      }

      dbRoom.lastActivity = new Date();
      await dbRoom.save();

      memoryRoom.lastActivity = Date.now();
      userRooms.set(socket.id, roomCode);
      socket.join(roomCode);

      // Notify other participants
      socket.to(roomCode).emit('user-joined', {
        user: { id: user.id, username: user.username, avatar: user.avatar },
        roomCode,
        participantCount: memoryRoom.participants.length
      });

      logProduction('info', `👥 ${user.username} joined room: ${roomCode} (${memoryRoom.participants.length} total)`);
      callback({ success: true, room: { ...dbRoom.toObject(), password: undefined } });

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
  socket.on('disconnect', async (reason) => {
    const user = socket.data.user;
    const roomCode = userRooms.get(socket.id);
    
    logProduction('info', `👤 User disconnected: ${user?.username || 'unknown'} (${socket.id}) - ${reason}`);
    
    if (roomCode) {
      try {
        // Update database room to remove this socket
        await Room.updateOne(
          { roomCode },
          { 
            $pull: { participants: { socketId: socket.id } },
            lastActivity: new Date()
          }
        );
        
        leaveRoom(socket.id, roomCode);
        logProduction('info', `🧹 Cleaned up user from room ${roomCode} in database`);
      } catch (error) {
        logProduction('error', `Failed to clean up user from room ${roomCode}:`, error);
        // Still call leaveRoom for memory cleanup
        leaveRoom(socket.id, roomCode);
      }
    }
    
    userLastActivity.delete(socket.id);
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    logProduction('error', `Connection error for ${socket.id}:`, error.message);
  });

  socket.on('error', (error) => {
    logProduction('error', `Socket error for ${socket.id}:`, error.message);
  });
});

// API Routes
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check database connection
    const dbConnected = mongoose.connection.readyState === 1;
    
    // Check room synchronization
    const memoryRoomCount = rooms.size;
    const dbRoomCount = await Room.countDocuments();
    
    res.json({ 
      status: 'ok',
      uptime: process.uptime(),
      database: {
        connected: dbConnected,
        roomCount: dbRoomCount
      },
      memory: {
        roomCount: memoryRoomCount,
        connections: io.engine.clientsCount,
        userRooms: userRooms.size
      },
      environment: isLocalDev ? 'local-dev' : isRenderDev ? 'render-dev' : 'production',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/stats', async (_req: Request, res: Response): Promise<void> => {
  if (!isDevelopment) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const memoryRoomStats = Array.from(rooms.values()).map(room => ({
      roomCode: room.roomCode,
      participantCount: room.participants.length,
      hasCurrentTrack: !!room.currentTrack,
      lastActivity: new Date(room.lastActivity).toISOString(),
      source: 'memory'
    }));

    const dbRoomCount = await Room.countDocuments();
    const dbRooms = await Room.find({}, 'roomCode participants lastActivity').limit(10);
    
    const dbRoomStats = dbRooms.map(room => ({
      roomCode: room.roomCode,
      participantCount: room.participants.length,
      lastActivity: room.lastActivity.toISOString(),
      source: 'database'
    }));

    res.json({
      memory: {
        totalRooms: rooms.size,
        totalConnections: io.engine.clientsCount,
        userRoomMappings: userRooms.size,
        rooms: memoryRoomStats
      },
      database: {
        totalRooms: dbRoomCount,
        recentRooms: dbRoomStats
      },
      synchronization: {
        memoryRooms: rooms.size,
        databaseRooms: dbRoomCount,
        difference: Math.abs(rooms.size - dbRoomCount)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// API route for room info
app.get('/api/rooms/:roomCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomCode } = req.params;
    
    if (!validateRoomCode(roomCode)) {
      res.status(400).json({ error: 'Invalid room code format' });
      return;
    }

    // Check memory first (active rooms)
    const memoryRoom = rooms.get(roomCode);
    if (memoryRoom) {
      res.json({
        success: true,
        room: {
          roomCode: memoryRoom.roomCode,
          participantCount: memoryRoom.participants.length,
          isActive: true,
          createdAt: memoryRoom.createdAt,
          lastActivity: memoryRoom.lastActivity
        }
      });
      return;
    }

    // Check database for inactive rooms
    const dbRoom = await Room.findOne({ roomCode });
    if (dbRoom) {
      const timeSinceLastActivity = Date.now() - new Date(dbRoom.lastActivity).getTime();
      const isStale = timeSinceLastActivity > 30 * 60 * 1000; // 30 minutes
      
      if (isStale) {
        // Clean up stale room
        await Room.deleteOne({ roomCode });
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      res.json({
        success: true,
        room: {
          roomCode: dbRoom.roomCode,
          participantCount: 0, // No active participants
          isActive: false,
          createdAt: new Date(dbRoom.createdAt).getTime(),
          lastActivity: new Date(dbRoom.lastActivity).getTime()
        }
      });
      return;
    }

    res.status(404).json({ error: 'Room not found' });
  } catch (error) {
    logProduction('error', 'Room check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Environment info endpoint for debugging
app.get('/api/environment', (_req: Request, res: Response): void => {
  res.json({
    environment: isLocalDev ? 'local-dev' : isRenderDev ? 'render-dev' : 'production',
    nodeEnv: process.env.NODE_ENV,
    renderEnv: process.env.RENDER_ENV,
    isLocalDev,
    isRenderDev,
    allowedOrigins: allowedOrigins.map(origin => 
      typeof origin === 'string' ? origin : origin.toString()
    ),
    rateLimitMax: isLocalDev ? 1000 : 100,
    timestamp: new Date().toISOString(),
    corsEnabled: true,
    socketsConnected: io.engine.clientsCount
  });
});

// Auth routes with proper error handling
app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔥 Registration attempt:', { 
      username: req.body.username, 
      email: req.body.email,
      hasPassword: !!req.body.password 
    });

    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      console.log('❌ Registration failed: Missing fields');
      res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
      return;
    }

    const result = await authService.register(username, email, password);
    console.log('📊 Registration result:', { success: result.success, error: result.error });
    
    if (result.success) {
      console.log('✅ User registered successfully:', result.user?.username);
      res.status(201).json(result);
    } else {
      console.log('❌ Registration failed:', result.error);
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('💥 Registration server error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during registration' 
    });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔐 Login attempt:', { 
      emailOrUsername: req.body.emailOrUsername,
      hasPassword: !!req.body.password 
    });

    const { emailOrUsername, password, userAgent, ipAddress } = req.body;
    
    if (!emailOrUsername || !password) {
      res.status(400).json({ 
        success: false, 
        error: 'Email/username and password are required' 
      });
      return;
    }

    const result = await authService.login(
      emailOrUsername, 
      password, 
      userAgent || req.get('User-Agent'), 
      ipAddress || req.ip
    );
    
    console.log('📊 Login result:', { success: result.success, error: result.error });
    
    if (result.success) {
      console.log('✅ User logged in successfully:', result.user?.username);
      res.json(result);
    } else {
      console.log('❌ Login failed:', result.error);
      res.status(401).json(result);
    }
  } catch (error: any) {
    console.error('💥 Login server error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during login' 
    });
  }
});

app.post('/api/auth/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken, userAgent, ipAddress } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ 
        success: false, 
        error: 'Refresh token is required' 
      });
      return;
    }

    const result = await authService.refreshToken(
      refreshToken,
      userAgent || req.get('User-Agent'),
      ipAddress || req.ip
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error: any) {
    console.error('💥 Token refresh server error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during token refresh' 
    });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken, allDevices, userId } = req.body;
    const result = await authService.logout(refreshToken, allDevices, userId);
    res.json(result);
  } catch (error: any) {
    console.error('💥 Logout server error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during logout' 
    });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res: Response): Promise<void> => {
  try {
    // ✅ Get full user data including private fields
    const user = await authService.getUserById(req.user.id, true) as any;
    if (user) {
      res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.profile?.displayName,
        avatar: user.avatar,
        bio: user.profile?.bio,
        favoriteGenres: user.profile?.favoriteGenres || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isVerified: user.isVerified,
        preferences: user.preferences,
        profile: {
          totalListeningTime: user.profile?.totalListeningTime || 0,
          joinedRooms: user.profile?.joinedRooms || 0,
          hostedRooms: user.profile?.hostedRooms || 0
        }
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    logProduction('error', '/api/auth/me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update socket authentication
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    logProduction('warn', '🚫 Socket connection denied: No token provided');
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    socket.data.user = decoded;
    logProduction('info', `✅ Socket authenticated: ${decoded.username} (${decoded.id})`);
    next();
  } catch (err) {
    logProduction('warn', `🚫 Socket connection denied: Invalid token for ${socket.id}`);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const origin = req.headers.origin;
  
  // Check if origin matches any allowed pattern (same logic as main CORS)
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      // Handle regex patterns
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  logProduction('error', 'Express error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req: Request, res: Response): void => {
  const origin = req.headers.origin;
  
  // Check if origin matches any allowed pattern (same logic as main CORS)
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      // Handle regex patterns
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
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

// Connect to database before starting server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    // Clean up stale rooms on startup
    try {
      const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = await Room.deleteMany({
        lastActivity: { $lt: cutoffTime }
      });
      
      if (result.deletedCount > 0) {
        logProduction('info', `🧹 Startup cleanup: Removed ${result.deletedCount} stale rooms from database`);
      }
      
      // Log remaining rooms
      const remainingRooms = await Room.countDocuments();
      logProduction('info', `📊 Database has ${remainingRooms} active rooms after cleanup`);
      
    } catch (cleanupError) {
      logProduction('error', 'Startup cleanup error:', cleanupError);
    }
    
    // Start server
    server.listen(PORT, () => {
      const environment = isLocalDev ? 'Local Development' : isRenderDev ? 'Render Development' : 'Production';
      
      logProduction('info', `🎵 Music Sync Server running`, {
        port: PORT,
        environment,
        corsOrigins: allowedOrigins,
        rateLimitMax: isLocalDev ? 1000 : 100,
        nodeEnv: process.env.NODE_ENV,
        renderEnv: process.env.RENDER_ENV || 'not-set'
      });
      
      logProduction('info', `🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      logProduction('info', `📡 WebSocket server ready`);
      logProduction('info', `🔗 Health check: http://localhost:${PORT}/api/health`);
      
      if (isDevelopment) {
        logProduction('info', `📊 Stats endpoint: http://localhost:${PORT}/api/stats`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Add this endpoint for testing database connection:

app.get('/api/test-db', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🧪 Testing database connection...');
    
    // Import User model
    const { User } = await import('./models/User');
    
    // Try to count users
    const userCount = await User.countDocuments();
    console.log('👥 Current user count:', userCount);
    
    // Test creating a simple document (won't save)
    const testUser = new User({
      username: 'testuser' + Date.now(),
      email: 'test@example.com',
      hashedPassword: 'testpassword123'
    });
    
    // Validate without saving
    const validationError = testUser.validateSync();
    
    res.json({
      success: true,
      message: 'Database connection working',
      userCount,
      validationTest: validationError ? 'Failed' : 'Passed',
      validationError: validationError?.message,
      connectionState: mongoose.connection.readyState,
      dbName: mongoose.connection.name
    });
    
  } catch (error: any) {
    console.error('❌ Database test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      connectionState: mongoose.connection.readyState
    });
  }
});