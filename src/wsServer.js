import { WebSocketServer } from 'ws';
import { generateUserId } from './utils/idGenerator.js';
import { HEARTBEAT_INTERVAL_MS, MAX_MISSED_PINGS } from './config.js';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleChatMessage,
  handleDeleteRoom,
  handleDelegateAdmin,
  handleLeaveRoom
} from './rooms/roomManager.js';

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

  // Setup periodic heartbeat ping to detect stale/dropped connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.missedPings = (ws.missedPings || 0) + 1;
        if (ws.missedPings >= MAX_MISSED_PINGS) {
          const timestamp = new Date().toISOString();
          console.warn(`[${timestamp}] [WS] Terminating stale socket (ID: ${ws.userId || 'unbound'}) due to ${ws.missedPings} missed pings.`);
          return ws.terminate(); // Triggers 'close' event -> handleLeaveRoom(ws)
        }
      }

      ws.isAlive = false;
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws, req) => {
    const connectionId = generateUserId();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [WS] New connection established. Connection ID: ${connectionId}`);

    // Heartbeat tracking state
    ws.isAlive = true;
    ws.missedPings = 0;

    ws.on('message', (data) => {
      const msgTime = new Date().toISOString();

      try {
        // 1. Handle parsing errors (invalid JSON)
        let parsedMessage;
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
          case 'delete_room':
            handleDeleteRoom(ws);
            break;
          case 'delegate_admin':
            handleDelegateAdmin(ws, payload);
            break;
          case 'leave_room':
            handleLeaveRoom(ws);
            break;
          case 'pong':
            ws.isAlive = true;
            ws.missedPings = 0;
            break;
          default:
            console.warn(`[${msgTime}] [WS] Unknown message type "${type}" from connection ${connectionId}`);
            sendError(ws, 'BAD_REQUEST', `Unknown message type "${type}".`);
        }
      } catch (err) {
        console.error(`[${msgTime}] [WS] Unhandled error processing message from connection ${connectionId}:`, err);
        sendError(ws, 'SERVER_ERROR', 'An internal server error occurred while processing your request.');
      }
    });

    ws.on('close', (code, reason) => {
      const closeTimestamp = new Date().toISOString();
      console.log(`[${closeTimestamp}] [WS] Connection closed. Connection ID: ${connectionId} (Code: ${code})`);
      handleLeaveRoom(ws);
    });

    ws.on('error', (error) => {
      const errorTimestamp = new Date().toISOString();
      console.error(`[${errorTimestamp}] [WS] Connection error on ${connectionId}:`, error);
    });
  });

  return wss;
}

