export interface Room {
  roomCode: string;
  hostId: string;
  participants: string[];
  currentTrack?: PlaybackState;
  createdAt: number;
  lastActivity: number;
}

export interface PlaybackState {
  videoId: string;
  currentTime: number;
  isPlaying: boolean;
  timestamp: number;
}