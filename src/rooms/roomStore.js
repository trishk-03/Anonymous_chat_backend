import { generateRoomId, generateRoomPassword } from '../utils/idGenerator.js';
import { ROOM_EXPIRY_MS, ROOM_ID_LENGTH, ROOM_PASSWORD_LENGTH } from '../config.js';

/**
 * In-memory Map-based store for active rooms.
 * Key: roomId (string)
 * Value: room object
 */
export const roomStore = new Map();

/**
 * Creates a new room and stores it in the in-memory store.
 * Also configures an auto-expiry timer.
 * 
 * @param {Object} params
 * @param {string} params.roomName
 * @returns {Object} The created room object
 * @throws {Error} If the room name is already taken
 */
export function createRoom({ roomName }) {
  if (isRoomNameTaken(roomName)) {
    throw new Error(`Room name "${roomName}" is already taken.`);
  }

  // Generate a unique roomId
  let roomId;
  do {
    roomId = generateRoomId(ROOM_ID_LENGTH);
  } while (roomStore.has(roomId));

  const password = generateRoomPassword(ROOM_PASSWORD_LENGTH);
  const createdAt = Date.now();
  const expiresAt = createdAt + ROOM_EXPIRY_MS;

  // Setup auto-expiry timer
  const expiryTimer = setTimeout(() => {
    deleteRoom(roomId);
  }, ROOM_EXPIRY_MS);

  const room = {
    roomId,
    roomName,
    password,
    adminId: null, // Set when the admin/first member joins
    members: new Map(),
    createdAt,
    expiresAt,
    expiryTimer
  };

  roomStore.set(roomId, room);
  return room;
}

/**
 * Retrieves a room by its unique ID.
 * 
 * @param {string} roomId
 * @returns {Object|undefined} The room object or undefined if not found
 */
export function getRoomById(roomId) {
  return roomStore.get(roomId);
}

/**
 * Finds a room by its name using a case-insensitive check.
 * 
 * @param {string} roomName
 * @returns {Object|null} The room object or null if not found
 */
export function getRoomByName(roomName) {
  const lowerName = roomName.toLowerCase();
  for (const room of roomStore.values()) {
    if (room.roomName.toLowerCase() === lowerName) {
      return room;
    }
  }
  return null;
}

/**
 * Deletes a room, clears its auto-expiry timer, and removes it from the store.
 * 
 * @param {string} roomId
 * @returns {boolean} True if the room was deleted, false if not found
 */
export function deleteRoom(roomId) {
  const room = roomStore.get(roomId);
  if (!room) return false;

  if (room.expiryTimer) {
    clearTimeout(room.expiryTimer);
  }
  
  return roomStore.delete(roomId);
}

/**
 * Adds a member to the specified room.
 * Assigns admin status to this member if the room does not yet have an admin.
 * 
 * @param {string} roomId
 * @param {Object} memberObject
 * @param {string} memberObject.userId
 * @param {string} memberObject.username
 * @param {import('ws').WebSocket} memberObject.ws
 * @param {boolean} [memberObject.isAdmin]
 * @param {number} [memberObject.joinedAt]
 * @returns {Object} The added member object
 */
export function addMember(roomId, memberObject) {
  const room = roomStore.get(roomId);
  if (!room) {
    throw new Error(`Room with ID ${roomId} not found.`);
  }

  const { userId, username, ws, isAdmin, joinedAt } = memberObject;
  const newMember = {
    userId,
    username,
    ws,
    isAdmin: !!isAdmin,
    joinedAt: joinedAt || Date.now()
  };

  room.members.set(userId, newMember);

  // If this member is marked as admin or the room has no adminId yet, assign them as admin
  if (newMember.isAdmin || !room.adminId) {
    room.adminId = userId;
    newMember.isAdmin = true;
  }

  return newMember;
}

/**
 * Removes a member from the specified room.
 * If the removed member was the admin, promotes the oldest remaining member.
 * 
 * @param {string} roomId
 * @param {string} userId
 * @returns {boolean} True if the member was removed, false otherwise
 */
export function removeMember(roomId, userId) {
  const room = roomStore.get(roomId);
  if (!room) return false;

  const memberExists = room.members.has(userId);
  if (!memberExists) return false;

  room.members.delete(userId);

  // If the removed member was the admin, promote the next oldest member
  if (room.adminId === userId) {
    room.adminId = null;

    if (room.members.size > 0) {
      let oldestMember = null;
      for (const m of room.members.values()) {
        if (!oldestMember || m.joinedAt < oldestMember.joinedAt) {
          oldestMember = m;
        }
      }
      if (oldestMember) {
        room.adminId = oldestMember.userId;
        oldestMember.isAdmin = true;
      }
    }
  }

  return true;
}

/**
 * Checks if a room name is already in use (case-insensitive).
 * 
 * @param {string} roomName
 * @returns {boolean} True if the room name is taken, false otherwise
 */
export function isRoomNameTaken(roomName) {
  return !!getRoomByName(roomName);
}

/**
 * Returns all active rooms stored in memory (primarily for debugging).
 * 
 * @returns {Array<Object>} An array of all active room objects
 */
export function getAllRooms() {
  return Array.from(roomStore.values());
}
