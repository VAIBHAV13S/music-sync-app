const isDevelopment = process.env.NODE_ENV !== 'production';

export const logProduction = (level: 'info' | 'error' | 'warn', message: string, data?: any): void => {
  if (isDevelopment || level !== 'info') {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] ${message}`, data || '');
  }
};

export const validateRoomCode = (roomCode: string): boolean => {
  return typeof roomCode === 'string' &&
         roomCode.length >= 4 &&
         roomCode.length <= 10 &&
         /^[A-Z0-9]+$/.test(roomCode);
};