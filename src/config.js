export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
export const ROOM_EXPIRY_MS = process.env.ROOM_EXPIRY_MS ? parseInt(process.env.ROOM_EXPIRY_MS, 10) : 3 * 60 * 60 * 1000; // 3 hours
export const ROOM_ID_LENGTH = process.env.ROOM_ID_LENGTH ? parseInt(process.env.ROOM_ID_LENGTH, 10) : 6;
export const ROOM_PASSWORD_LENGTH = process.env.ROOM_PASSWORD_LENGTH ? parseInt(process.env.ROOM_PASSWORD_LENGTH, 10) : 8;
export const HEARTBEAT_INTERVAL_MS = process.env.HEARTBEAT_INTERVAL_MS ? parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) : 30000; // 30 seconds
export const MAX_MISSED_PINGS = process.env.MAX_MISSED_PINGS ? parseInt(process.env.MAX_MISSED_PINGS, 10) : 2;

