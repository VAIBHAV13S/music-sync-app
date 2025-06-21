import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { logProduction, validateRoomCode } from './src/utils';
import { PlaybackState } from './src/types';
import * as roomManager from './src/roomManager';
import { redis } from './src/redisClient';

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
      /^https:\/\/music-sync.*\.vercel\.app$/, // Allow all music-sync Vercel deployments
    ];

// Update CORS to handle regex
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      // Handle regex patterns
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    if (isDevelopment) {
      console.log('CORS rejected origin:', origin);
    }
    
    return callback(new Error('Not allowed by CORS'));
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
app.use(limiter);

app.get('/api/search', async (req: Request, res: Response) => {
  const { q } = req.query;
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key is not configured on the server.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query "q" is required.' });
  }

  try {
    // Step 1: Search for video IDs
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=10&key=${YOUTUBE_API_KEY}`;
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) throw new Error('Failed to fetch from YouTube API (search)');
    const searchData = await searchResponse.json() as any;

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    if (!videoIds) {
      res.json([]);
      return;
    }

    // Step 2: Get video details (including duration) for the found IDs
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) throw new Error('Failed to fetch from YouTube API (details)');
    const detailsData = await detailsResponse.json() as any;

    // Step 3: Format the response to match what the client expects
    const results = detailsData.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.default.url,
      duration: item.contentDetails.duration, // Send ISO duration, client will format it
      description: item.snippet.description,
    }));

    return res.json(results);
  } catch (error) {
    console.error('YouTube search failed:', error);
    return res.status(500).json({ error: 'Failed to perform YouTube search.' });
  }
});


// Socket.IO server setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // This should now include your actual URL
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
});

// Socket connection handling
io.on('connection', (socket) => {
  logProduction('info', `👤 User connected: ${socket.id}`);

  // Create room handler
  socket.on('create-room', async (data, callback) => {
    try {
      const { roomCode } = data;
      if (!validateRoomCode(roomCode)) {
        return callback({ success: false, error: 'Invalid room code format' });
      }

      if (await roomManager.getRoom(roomCode)) {
        return callback({ success: false, error: 'Room already exists' });
      }

      const room = await roomManager.createRoom(roomCode, socket.id);
      socket.join(roomCode);

      logProduction('info', `🏠 Room created: ${roomCode} by ${socket.id}`);
      callback({ success: true, room });

    } catch (error) {
      logProduction('error', 'Create room error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Join room handler
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomCode } = data;
      if (!validateRoomCode(roomCode)) {
        return callback({ success: false, error: 'Invalid room code format' });
      }

      const room = await roomManager.getRoom(roomCode);
      if (!room) {
        return callback({ success: false, error: 'Room not found' });
      }

      if (!room.participants.includes(socket.id)) {
        await roomManager.joinRoom(roomCode, socket.id);
      }
      
      socket.join(roomCode);
      const updatedRoom = await roomManager.getRoom(roomCode); // Get updated state

      socket.to(roomCode).emit('user-joined', {
        userId: socket.id,
        roomCode,
        participantCount: updatedRoom?.participants.length || 1
      });

      if (updatedRoom?.currentTrack) {
        socket.emit('playback-sync', updatedRoom.currentTrack);
      }

      logProduction('info', `👥 User joined room: ${roomCode}`);
      callback({ success: true, room: updatedRoom });

    } catch (error) {
      logProduction('error', 'Join room error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });

  // Leave room handler
  socket.on('leave-room', async () => {
    const roomCode = await roomManager.getUserRoomCode(socket.id);
    if (roomCode) {
      socket.leave(roomCode);
      const { newHostId, remainingCount } = await roomManager.leaveRoom(roomCode, socket.id);
      logProduction('info', `👋 User left room: ${roomCode}`);

      if (newHostId) {
        io.to(roomCode).emit('host-changed', { newHostId, roomCode });
        logProduction('info', `Host transferred in room ${roomCode} to ${newHostId}`);
      }
      io.to(roomCode).emit('user-left', { userId: socket.id, roomCode, participantCount: remainingCount });
    }
  });

  // Generic Sync Handler
  const handleSync = async (data: any, isPlaying: boolean, isSeeking: boolean = false) => {
    try {
      const roomCode = await roomManager.getUserRoomCode(socket.id);
      if (!roomCode) return;

      const room = await roomManager.getRoom(roomCode);
      if (!room || room.hostId !== socket.id) return;

      if (!data.videoId || typeof data.currentTime !== 'number') return;

      const playbackState: PlaybackState = {
        videoId: data.videoId,
        currentTime: Math.max(0, data.currentTime),
        isPlaying: isSeeking ? data.isPlaying : isPlaying,
        timestamp: Date.now()
      };

      await roomManager.setRoomTrack(roomCode, playbackState);
      io.to(roomCode).emit('playback-sync', playbackState);

    } catch (error) {
      logProduction('error', 'Sync event error:', error);
    }
  };

  socket.on('sync-play', (data) => handleSync(data, true));
  socket.on('sync-pause', (data) => handleSync(data, false));
  socket.on('sync-seek', (data) => handleSync(data, data.isPlaying, true));

  // Video load sync handler
  socket.on('sync-video-load', async (data: { videoId: string }) => {
    const roomCode = await roomManager.getUserRoomCode(socket.id);
    if (!roomCode) return;

    const room = await roomManager.getRoom(roomCode);
    if (!room || room.hostId !== socket.id) return;

    socket.to(roomCode).emit('video-load-sync', {
      videoId: data.videoId,
      timestamp: Date.now()
    });
  });

  // Disconnect handler
  socket.on('disconnect', async (reason) => {
    logProduction('info', `👤 User disconnected: ${socket.id} (${reason})`);
    const roomCode = await roomManager.getUserRoomCode(socket.id);
    if (roomCode) {
      const { newHostId, remainingCount } = await roomManager.leaveRoom(roomCode, socket.id);
       if (newHostId) {
        io.to(roomCode).emit('host-changed', { newHostId, roomCode });
      }
      io.to(roomCode).emit('user-left', { userId: socket.id, roomCode, participantCount: remainingCount });
    }
  });
});

// API Routes
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
  // A more robust health check that doesn't use the blocking KEYS command.
  const redisStatus = redis.status;
  const connectionsCount = await io.engine.clientsCount;

  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    redisStatus: redisStatus, // 'ready', 'connecting', 'reconnecting', etc.
    connections: connectionsCount,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/stats', async (_req: Request, res: Response): Promise<void> => {
  if (!isDevelopment) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // Use SCAN instead of KEYS for non-blocking iteration
  const stream = redis.scanStream({ match: 'room:*', type: 'hash' });
  const roomKeys: string[] = [];
  for await (const keys of stream) {
    roomKeys.push(...keys);
  }

  const rooms = await Promise.all(roomKeys.map(k => roomManager.getRoom(k.replace('room:', ''))));

  const roomStats = rooms.filter(Boolean).map(room => ({
    roomCode: room!.roomCode,
    participantCount: room!.participants.length,
    hasCurrentTrack: !!room!.currentTrack,
    lastActivity: new Date(room!.lastActivity).toISOString()
  }));

  res.json({
    totalRooms: roomStats.length,
    totalConnections: io.engine.clientsCount,
    rooms: roomStats
  });
});

// API route for room info
app.get('/api/rooms/:roomCode', async (req: Request, res: Response): Promise<void> => {
  const { roomCode } = req.params;
  
  if (!validateRoomCode(roomCode)) {
    res.status(400).json({ error: 'Invalid room code format' });
    return;
  }

  const room = await roomManager.getRoom(roomCode);
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