import { redis } from './redisClient';
import { PlaybackState, Room } from './types'; // We will create this types file next

const ROOM_EXPIRATION_SECONDS = 2 * 60 * 60; // 2 hours

const roomKey = (roomCode: string) => `room:${roomCode}`;
const participantsKey = (roomCode: string) => `room:${roomCode}:participants`;
const userKey = (socketId: string) => `user:${socketId}`;

export async function getRoom(roomCode: string): Promise<Room | null> {
  const roomData = await redis.hgetall(roomKey(roomCode));
  if (!Object.keys(roomData).length) return null;

  const participants = await redis.smembers(participantsKey(roomCode));

  return {
    roomCode: roomData.roomCode,
    hostId: roomData.hostId,
    participants,
    currentTrack: roomData.currentTrack ? JSON.parse(roomData.currentTrack) : undefined,
    createdAt: parseInt(roomData.createdAt, 10),
    lastActivity: parseInt(roomData.lastActivity, 10),
  };
}

export async function createRoom(roomCode: string, hostId: string): Promise<Room> {
  const now = Date.now();
  const newRoom: Omit<Room, 'participants' | 'currentTrack'> = {
    roomCode,
    hostId,
    createdAt: now,
    lastActivity: now,
  };

  const roomDataForRedis = {
    ...newRoom,
    createdAt: newRoom.createdAt.toString(),
    lastActivity: newRoom.lastActivity.toString(),
  };

  const pipeline = redis.pipeline();
  pipeline.hset(roomKey(roomCode), roomDataForRedis);
  pipeline.sadd(participantsKey(roomCode), hostId);
  pipeline.set(userKey(hostId), roomCode, 'EX', ROOM_EXPIRATION_SECONDS);
  pipeline.expire(roomKey(roomCode), ROOM_EXPIRATION_SECONDS);
  pipeline.expire(participantsKey(roomCode), ROOM_EXPIRATION_SECONDS);
  await pipeline.exec();

  return { ...newRoom, participants: [hostId] };
}

export async function joinRoom(roomCode: string, socketId: string): Promise<Room | null> {
  const pipeline = redis.pipeline();
  pipeline.sadd(participantsKey(roomCode), socketId);
  pipeline.set(userKey(socketId), roomCode, 'EX', ROOM_EXPIRATION_SECONDS);
  await pipeline.exec();
  await updateRoomActivity(roomCode);
  // Return the updated room data
  return getRoom(roomCode);
}

export async function leaveRoom(roomCode: string, socketId: string): Promise<{ remainingCount: number; newHostId?: string }> {
  await redis.srem(participantsKey(roomCode), socketId);
  await redis.del(userKey(socketId));

  const remainingParticipants = await redis.smembers(participantsKey(roomCode));
  if (remainingParticipants.length === 0) {
    await redis.del(roomKey(roomCode));
    return { remainingCount: 0 };
  }

  const room = await getRoom(roomCode);
  if (room && room.hostId === socketId) {
    const newHostId = remainingParticipants[0];
    await redis.hset(roomKey(roomCode), 'hostId', newHostId);
    return { remainingCount: remainingParticipants.length, newHostId };
  }

  return { remainingCount: remainingParticipants.length };
}

export async function getUserRoomCode(socketId: string): Promise<string | null> {
  return redis.get(userKey(socketId));
}

export async function updateRoomActivity(roomCode: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.hset(roomKey(roomCode), 'lastActivity', Date.now().toString());
  pipeline.expire(roomKey(roomCode), ROOM_EXPIRATION_SECONDS);
  pipeline.expire(participantsKey(roomCode), ROOM_EXPIRATION_SECONDS);
  await pipeline.exec();
}

export async function setRoomTrack(roomCode: string, playbackState: PlaybackState): Promise<void> {
  await redis.hset(roomKey(roomCode), 'currentTrack', JSON.stringify(playbackState));
  await updateRoomActivity(roomCode);
}