import { WebSocketServer } from 'ws';
import { generateUserId } from './utils/idGenerator.js';
import { handleCreateRoom, handleJoinRoom, handleChatMessage } from './rooms/roomManager.js';

/**
 * Sends a JSON stringified error message over the WebSocket.
 * 
 * @param {import('ws').WebSocket} ws
 * @param {string} code
 * @param {string} message
 */
function sendError(ws, code, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { code, message }
    }));
  }
}

/**
 * Attaches the WebSocket Server to the existing HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {WebSocketServer}
 */
export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    const connectionId = generateUserId();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [WS] New connection established. Connection ID: ${connectionId}`);

    ws.on('message', (data) => {
      const msgTime = new Date().toISOString();
      let parsedMessage;

      // 1. Handle parsing errors (invalid JSON)
      try {
        parsedMessage = JSON.parse(data);
      } catch (err) {
        console.warn(`[${msgTime}] [WS] Malformed message received from connection ${connectionId}:`, err.message);
        sendError(ws, 'BAD_REQUEST', 'Malformed JSON payload.');
        return;
      }

      // 2. Validate message structure
      const { type, payload } = parsedMessage;
      if (!type || typeof type !== 'string') {
        console.warn(`[${msgTime}] [WS] Message without valid type received from connection ${connectionId}`);
        sendError(ws, 'BAD_REQUEST', 'Missing or invalid message type.');
        return;
      }

      console.log(`[${msgTime}] [WS] Received message of type "${type}" from connection ${connectionId}`);

      // 3. Route messages to orchestration logic in roomManager.js
      switch (type) {
        case 'create_room':
          handleCreateRoom(ws, payload);
          break;
        case 'join_room':
          handleJoinRoom(ws, payload);
          break;
        case 'chat_message':
          handleChatMessage(ws, payload);
          break;
        default:
          console.warn(`[${msgTime}] [WS] Unknown message type "${type}" from connection ${connectionId}`);
          sendError(ws, 'BAD_REQUEST', `Unknown message type "${type}".`);
      }
    });

    ws.on('close', (code, reason) => {
      const closeTimestamp = new Date().toISOString();
      console.log(`[${closeTimestamp}] [WS] Connection closed. Connection ID: ${connectionId} (Code: ${code})`);
      // Note: Full member disconnect cleanup logic (admin transfer, socket cleanup)
      // will be implemented in subsequent phases.
    });

    ws.on('error', (error) => {
      const errorTimestamp = new Date().toISOString();
      console.error(`[${errorTimestamp}] [WS] Connection error on ${connectionId}:`, error);
    });
  });

  return wss;
}
