import { generateUserId } from '../utils/idGenerator.js';
import {
  createRoom,
  getRoomById,
  addMember,
  deleteRoom,
  isRoomNameTaken
} from './roomStore.js';

/**
 * Sends a JSON stringified message over the given WebSocket connection.
 * 
 * @param {import('ws').WebSocket} ws
 * @param {string} type
 * @param {Object} payload
 */
function sendJSON(ws, type, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

/**
 * Orchestrates creating a room.
 * - Validates inputs (non-empty roomName, non-empty username, uniqueness of room name).
 * - Creates the room using roomStore.
 * - Configures room auto-expiry handler (broadcasts room_expired, closes sockets, deletes room).
 * - Generates admin userId and associates it with the WebSocket connection.
 * - Adds admin to the room.
 * - Responds with room_created success payload.
 * 
 * @param {import('ws').WebSocket} ws
 * @param {Object} payload
 * @param {string} payload.roomName
 * @param {string} payload.username
 */
export function handleCreateRoom(ws, { roomName, username } = {}) {
  // Validation
  if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Room name cannot be empty.' });
    return;
  }
  if (!username || typeof username !== 'string' || username.trim() === '') {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Username cannot be empty.' });
    return;
  }

  const trimmedRoomName = roomName.trim();
  const trimmedUsername = username.trim();

  if (isRoomNameTaken(trimmedRoomName)) {
    sendJSON(ws, 'error', { code: 'ROOM_NAME_TAKEN', message: 'Room name is already taken.' });
    return;
  }

  // Define expiry callback to run when room timer fires
  const onExpire = (expiredRoomId) => {
    const room = getRoomById(expiredRoomId);
    if (!room) return;

    const expiredMsg = JSON.stringify({ type: 'room_expired', payload: { roomId: expiredRoomId } });
    
    // Broadcast expiry and close connections
    for (const member of room.members.values()) {
      if (member.ws && member.ws.readyState === member.ws.OPEN) {
        member.ws.send(expiredMsg);
        member.ws.close();
      }
    }
    // Delete room from store
    deleteRoom(expiredRoomId);
  };

  // Create room
  let room;
  try {
    room = createRoom({ roomName: trimmedRoomName, onExpire });
  } catch (err) {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: err.message });
    return;
  }

  // Generate Admin user info & track on WebSocket connection
  const adminId = generateUserId();
  ws.userId = adminId;
  ws.roomId = room.roomId;

  // Add Admin to room
  addMember(room.roomId, {
    userId: adminId,
    username: trimmedUsername,
    ws,
    isAdmin: true,
    joinedAt: Date.now()
  });

  // Respond to the creator
  sendJSON(ws, 'room_created', {
    roomId: room.roomId,
    roomName: room.roomName,
    password: room.password,
    userId: adminId,
    expiresAt: room.expiresAt
  });
}

/**
 * Orchestrates joining a room.
 * - Validates inputs (roomId, password, username, room existence, correct password, unique username).
 * - Generates member userId and associates it with the WebSocket connection.
 * - Adds member to room.
 * - Responds with join_success payload.
 * - Broadcasts user_joined to other members in the room.
 * 
 * @param {import('ws').WebSocket} ws
 * @param {Object} payload
 * @param {string} payload.roomId
 * @param {string} payload.password
 * @param {string} payload.username
 */
export function handleJoinRoom(ws, { roomId, password, username } = {}) {
  // Validation
  if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Room ID cannot be empty.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Password cannot be empty.' });
    return;
  }
  if (!username || typeof username !== 'string' || username.trim() === '') {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Username cannot be empty.' });
    return;
  }

  const trimmedRoomId = roomId.trim();
  const trimmedPassword = password.trim();
  const trimmedUsername = username.trim();

  // Fetch Room
  const room = getRoomById(trimmedRoomId);
  if (!room) {
    sendJSON(ws, 'error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
    return;
  }

  // Verify password
  if (room.password !== trimmedPassword) {
    sendJSON(ws, 'error', { code: 'INVALID_PASSWORD', message: 'Invalid password.' });
    return;
  }

  // Verify username uniqueness inside this room
  const isUsernameTaken = Array.from(room.members.values()).some(
    m => m.username.toLowerCase() === trimmedUsername.toLowerCase()
  );
  if (isUsernameTaken) {
    sendJSON(ws, 'error', { code: 'USERNAME_TAKEN', message: 'Username is already taken in this room.' });
    return;
  }

  // Generate User ID & track on WebSocket connection
  const userId = generateUserId();
  ws.userId = userId;
  ws.roomId = room.roomId;

  // Add Member
  addMember(room.roomId, {
    userId,
    username: trimmedUsername,
    ws,
    isAdmin: false,
    joinedAt: Date.now()
  });

  // Fetch membership list
  const membersList = Array.from(room.members.values()).map(m => ({
    userId: m.userId,
    username: m.username,
    isAdmin: m.isAdmin
  }));

  // Respond to the joiner
  sendJSON(ws, 'join_success', {
    roomId: room.roomId,
    roomName: room.roomName,
    userId,
    members: membersList,
    expiresAt: room.expiresAt
  });

  // Broadcast user_joined to other members in the room
  const joinBroadcastMsg = JSON.stringify({
    type: 'user_joined',
    payload: {
      userId,
      username: trimmedUsername
    }
  });

  for (const member of room.members.values()) {
    if (member.userId !== userId && member.ws && member.ws.readyState === member.ws.OPEN) {
      member.ws.send(joinBroadcastMsg);
    }
  }
}

/**
 * Handles incoming chat messages from a user.
 * Validates connection room status and message length.
 * Relays the message to all other members in the room without persistence.
 * 
 * @param {import('ws').WebSocket} ws
 * @param {Object} payload
 * @param {string} payload.text
 */
export function handleChatMessage(ws, { text } = {}) {
  const { roomId, userId } = ws;

  // 1. Validate that the user is currently in a room
  if (!roomId || !userId) {
    sendJSON(ws, 'error', { code: 'UNAUTHORIZED', message: 'You are not currently in a room.' });
    return;
  }

  const room = getRoomById(roomId);
  if (!room) {
    sendJSON(ws, 'error', { code: 'ROOM_NOT_FOUND', message: 'Your room was not found.' });
    return;
  }

  const sender = room.members.get(userId);
  if (!sender) {
    sendJSON(ws, 'error', { code: 'UNAUTHORIZED', message: 'You are not a member of this room.' });
    return;
  }

  // 2. Validate message text
  if (typeof text !== 'string' || text.trim() === '') {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Message text cannot be empty.' });
    return;
  }

  if (text.length > 2000) {
    sendJSON(ws, 'error', { code: 'BAD_REQUEST', message: 'Message text cannot exceed 2000 characters.' });
    return;
  }

  // 3. Broadcast to all other members in the room (not the sender)
  const chatBroadcastMsg = JSON.stringify({
    type: 'chat_message',
    payload: {
      userId,
      username: sender.username,
      text,
      sentAt: Date.now()
    }
  });

  // NOTE: messages are relayed only, never persisted, per product requirement.
  for (const member of room.members.values()) {
    if (member.userId !== userId && member.ws && member.ws.readyState === member.ws.OPEN) {
      member.ws.send(chatBroadcastMsg);
    }
  }
}
