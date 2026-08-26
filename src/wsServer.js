import { WebSocketServer } from 'ws';
import { generateUserId } from './utils/idGenerator.js';

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

    ws.on('message', (message) => {
      // Message handling will be implemented later
      const msgTime = new Date().toISOString();
      console.log(`[${msgTime}] [WS] Received message from ${connectionId}`);
    });

    ws.on('close', (code, reason) => {
      const closeTimestamp = new Date().toISOString();
      console.log(`[${closeTimestamp}] [WS] Connection closed. Connection ID: ${connectionId} (Code: ${code})`);
    });

    ws.on('error', (error) => {
      const errorTimestamp = new Date().toISOString();
      console.error(`[${errorTimestamp}] [WS] Connection error on ${connectionId}:`, error);
    });
  });

  return wss;
}
