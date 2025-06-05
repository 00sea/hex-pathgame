import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { networkInterfaces } from 'os';
import { GameManager } from './GameManager';
import { SocketEvents } from '../../shared/types/socket';

const app = express();
const server = createServer(app);

// Configure CORS for local network development
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for local development
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3001', 10);  // Always number
const gameManager = new GameManager();

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeGames: gameManager.getActiveGameCount(),
    timestamp: new Date().toISOString()
  });
});

// Get network info for easy connection from other devices
app.get('/network-info', (req, res) => {
  const networks = networkInterfaces();
  const addresses: string[] = [];
  
  for (const name of Object.keys(networks)) {
    const network = networks[name];
    if (network) {
      for (const net of network) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
  }
  
  res.json({
    port: PORT,
    localAddresses: addresses,
    connectUrls: addresses.map(addr => `http://${addr}:${PORT}`)
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Create game
  socket.on('create-game', (data: SocketEvents['create-game']) => {
    try {
      const { gameId, gameState } = gameManager.createGame(
        data.playerName, 
        data.gridRadius || 3
      );
      
      socket.join(gameId);
      socket.emit('game-created', { gameId, gameState, playerId: socket.id });
      
      console.log(`Game created: ${gameId} by ${data.playerName}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to create game' });
    }
  });
  
  // Join existing game
  socket.on('join-game', (data: SocketEvents['join-game']) => {
    try {
      const gameState = gameManager.joinGame(data.gameId, data.playerName, socket.id);
      
      socket.join(data.gameId);
      
      // Notify both players
      io.to(data.gameId).emit('game-updated', { gameState });
      socket.emit('game-joined', { gameState, playerId: socket.id });
      
      console.log(`${data.playerName} joined game: ${data.gameId}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to join game' });
    }
  });
  
  // Make move
  socket.on('make-move', (data: SocketEvents['make-move']) => {
    try {
      const gameState = gameManager.makeMove(data.gameId, data.move, socket.id);
      
      // Broadcast updated state to all players in the game
      io.to(data.gameId).emit('game-updated', { gameState });
      
      // Check if game ended
      if (gameState.phase === 'finished') {
        io.to(data.gameId).emit('game-ended', { 
          winner: gameState.winner || 'unknown',
          reason: 'Player isolated'
        });
        
        console.log(`Game ${data.gameId} ended. Winner: ${gameState.winner}`);
      }
    } catch (error) {
      socket.emit('move-invalid', { 
        reason: error instanceof Error ? error.message : 'Invalid move' 
      });
    }
  });
  
  // Get list of available games
  socket.on('list-games', () => {
    const games = gameManager.getAvailableGames();
    socket.emit('games-list', { games });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameManager.handlePlayerDisconnect(socket.id);
  });
});

// Function to get local IP address for easy reference
function getLocalIPAddress(): string {
  const networks = networkInterfaces();
  
  for (const name of Object.keys(networks)) {
    const network = networks[name];
    if (network) {
      for (const net of network) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  
  return 'localhost';
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIPAddress();
  
  console.log('\n🎮 Hex Grid Game Server Started!');
  console.log('=====================================');
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🌐 Network URL: http://${localIP}:${PORT}`);
  console.log(`📊 Health Check: http://${localIP}:${PORT}/health`);
  console.log(`🔧 Network Info: http://${localIP}:${PORT}/network-info`);
  console.log('=====================================');
  console.log('💡 Share the Network URL with friends to play together!');
  console.log('🔄 Server will auto-restart on file changes\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});