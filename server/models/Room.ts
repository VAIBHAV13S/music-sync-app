import mongoose, { Document, Schema } from 'mongoose';

export interface IRoom extends Document {
  roomCode: string;
  hostId: string;
  hostUser: {
    id: string;
    username: string;
    avatar?: string;
  };
  participants: Array<{
    socketId: string;
    userId: string;
    username: string;
    avatar?: string;
    joinedAt: Date;
  }>;
  currentTrack?: {
    videoId: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: string;
    currentTime: number;
    isPlaying: boolean;
    timestamp: number;
  };
  createdAt: Date;
  lastActivity: Date;
  isPrivate: boolean;
  password?: string;
  settings: {
    allowParticipantRequests: boolean;
    maxParticipants: number;
    autoPlay: boolean;
  };
  stats: {
    totalSongs: number;
    totalTime: number;
    peakParticipants: number;
  };
}

const RoomSchema: Schema = new Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true, // ✅ Keep this
    uppercase: true,
    match: /^[A-Z0-9]{4,10}$/
  },
  hostId: {
    type: String,
    required: true
  },
  hostUser: {
    id: { type: String, required: true },
    username: { type: String, required: true },
    avatar: String
  },
  participants: [{
    socketId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    avatar: String,
    joinedAt: { type: Date, default: Date.now }
  }],
  currentTrack: {
    videoId: String,
    title: String,
    artist: String,
    thumbnail: String,
    duration: String,
    currentTime: { type: Number, default: 0 },
    isPlaying: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: String,
  settings: {
    allowParticipantRequests: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 50 },
    autoPlay: { type: Boolean, default: true }
  },
  stats: {
    totalSongs: { type: Number, default: 0 },
    totalTime: { type: Number, default: 0 },
    peakParticipants: { type: Number, default: 1 }
  }
}, {
  timestamps: true
});

// Auto-delete rooms after 24 hours of inactivity
RoomSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
// ❌ Remove this duplicate - already created by unique: true above
// RoomSchema.index({ roomCode: 1 });
RoomSchema.index({ hostId: 1 });
RoomSchema.index({ createdAt: -1 });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);