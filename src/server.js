import express from 'express';
import http from 'http';
import * as config from './config.js';
import { setupWebSocketServer } from './wsServer.js';

const app = express();
const server = http.createServer(app);


app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// Attach WebSocket server to the HTTP server
setupWebSocketServer(server);

// Start the server
server.listen(config.PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SERVER] Anonymous Chat Backend is listening on port ${config.PORT}`);
  console.log(`[${timestamp}] [SERVER] Health check URL: http://localhost:${config.PORT}/health`);
});
