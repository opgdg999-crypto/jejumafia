import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameManager } from './game/GameManager.js';
import { setupSocketHandlers } from './socket/index.js';
import { getLocalIP } from './utils/network.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const localIP = getLocalIP();

// Static files
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Client view routes
app.get('/', (_req, res) => {
  res.sendFile(path.join(clientPath, 'host', 'index.html'));
});

app.get('/player', (_req, res) => {
  res.sendFile(path.join(clientPath, 'player', 'index.html'));
});

app.get('/monitor', (_req, res) => {
  res.sendFile(path.join(clientPath, 'monitor', 'index.html'));
});

app.get('/api/server-info', (_req, res) => {
  res.json({ ip: localIP, port: PORT });
});

// Game Manager
const gameManager = new GameManager();

// Socket.IO
setupSocketHandlers(io, gameManager, localIP, PORT);

// Start
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('  제주 마피아 게임 서버');
  console.log('='.repeat(50));
  console.log(`  호스트:    http://localhost:${PORT}`);
  console.log(`  플레이어:  http://${localIP}:${PORT}/player`);
  console.log(`  모니터:    http://${localIP}:${PORT}/monitor`);
  console.log('='.repeat(50));
});
