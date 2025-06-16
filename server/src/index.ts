import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { networkInterfaces } from 'os';
import { GameManager } from './GameManager';
import { LobbyManager } from './LobbyManager';
import { SocketEvents } from '../../shared/types';
import { dehydrateGameState } from '../../shared/utils/gameStateUtils';

const app = express();
const server = createServer(app);

// Configure CORS for local network development
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for local development
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize managers - GameManager first, then LobbyManager with reference to it
const gameManager = new GameManager();
const lobbyManager = new LobbyManager(gameManager);

// Track connected players for testing
const connectedPlayers = new Map<string, string>(); // socketId -> playerName
const playerConnections = new Map<string, {
  socketId: string;
  playerName: string;
  lobbyId?: string;
  gameId?: string;
  connectedAt: Date;
}>(); // Enhanced player tracking

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  const lobbyStats = lobbyManager.getLobbyStats();
  const gameStats = gameManager.getGameStats();
  
  res.json({ 
    status: 'ok',
    lobbies: lobbyStats,
    games: gameStats,
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
  
  // ======================
  // PLAYER SETUP
  // ======================
  
  // Set player name
  socket.on('set-player-name', (data: { playerName: string }) => {
    const playerName = data.playerName;
    connectedPlayers.set(socket.id, playerName);
    
    // Initialize player connection tracking
    playerConnections.set(socket.id, {
      socketId: socket.id,
      playerName,
      connectedAt: new Date()
    });
    
    console.log(`Player named: ${playerName} (${socket.id})`);
    
    // Broadcast updated player list
    broadcastPlayerList();
  });
  
  // ======================
  // LOBBY SYSTEM (NEW)
  // ======================
  
  // Create lobby
  socket.on('create-lobby', (data: SocketEvents['create-lobby']) => {
    try {
      const { lobbyId, lobby, playerId } = lobbyManager.createLobby(
        data.playerName,
        data.config
      );
      
      // Join the lobby room
      socket.join(lobbyId);
      lobbyManager.addSocketToLobby(lobbyId, socket);
      
      // Update player connection tracking
      const connection = playerConnections.get(socket.id);
      if (connection) {
        connection.lobbyId = lobbyId;
      }
      
      // Send confirmation to lobby creator
      socket.emit('lobby-created', { lobbyId, lobby, playerId });
      
      console.log(`Lobby created: ${lobbyId} by ${data.playerName} with playerId: ${playerId}`);
    } catch (error) {
      console.error('Error creating lobby:', error);
      socket.emit('error', { message: 'Failed to create lobby' });
    }
  });
  
  // Join existing lobby
  socket.on('join-lobby', (data: SocketEvents['join-lobby']) => {
    try {
      const result = lobbyManager.joinLobby(data.lobbyId, data.playerName, socket.id);
      
      // Join the lobby room
      socket.join(data.lobbyId);
      lobbyManager.addSocketToLobby(data.lobbyId, socket);
      
      // Update player connection tracking
      const connection = playerConnections.get(socket.id);
      if (connection) {
        connection.lobbyId = data.lobbyId;
      }
      
      // Notify all players in lobby about the new player
      io.to(data.lobbyId).emit('lobby-updated', { lobby: result.lobby });
      
      // Send specific confirmation to joining player
      socket.emit('lobby-joined', { lobby: result.lobby, playerId: result.playerId });
      
      console.log(`${data.playerName} joined lobby: ${data.lobbyId} with playerId: ${result.playerId}`);
      
      // ✅ REMOVED: Auto-start logic - players now manually start
      // if (result.gameTransition) {
      //   handleGameTransition(data.lobbyId, result.gameTransition);
      // }
      
    } catch (error) {
      console.error('Error joining lobby:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to join lobby' });
    }
  });
  
  // Leave lobby
  socket.on('leave-lobby', (data: SocketEvents['leave-lobby']) => {
    try {
      socket.leave(data.lobbyId);
      lobbyManager.removeSocketFromLobby(data.lobbyId, socket.id);
      
      // Update player connection tracking
      const connection = playerConnections.get(socket.id);
      if (connection) {
        delete connection.lobbyId;
      }
      
      console.log(`Player left lobby: ${data.lobbyId}`);
    } catch (error) {
      console.error('Error leaving lobby:', error);
    }
  });
  
  // List available lobbies
  socket.on('list-lobbies', () => {
    try {
      const lobbies = lobbyManager.getAvailableLobbies();
      socket.emit('lobbies-list', { lobbies });
    } catch (error) {
      console.error('Error listing lobbies:', error);
      socket.emit('error', { message: 'Failed to get lobby list' });
    }
  });
  
  // ✅ NEW: Manual game start
  socket.on('start-game', (data: SocketEvents['start-game']) => {
    try {
      console.log(`🎮 Manual game start requested for lobby: ${data.lobbyId}`);
      
      const gameTransition = lobbyManager.startGame(data.lobbyId);
      
      if (gameTransition) {
        handleGameTransition(data.lobbyId, gameTransition);
        console.log(`🚀 Game started manually: ${gameTransition.gameId}`);
      }
      
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to start game' });
    }
  });
  
  // ======================
  // ACTIVE GAME SYSTEM
  // ======================
  
  // Make move in active game
  socket.on('make-move', (data: SocketEvents['make-move']) => {
    try {
      const gameState = gameManager.makeMove(data.gameId, data.move, socket.id);
      
      // Get updated valid moves for the new current player
      const validMoves = gameManager.getValidMoves(data.gameId);
      
      // Broadcast updated state to all players in the game
      io.to(data.gameId).emit('game-updated', { gameState: dehydrateGameState(gameState), validMoves });
      
      // Check if game ended
      if (gameState.phase === 'finished') {
        io.to(data.gameId).emit('game-ended', { 
          winner: gameState.winner || 'unknown',
          reason: 'Player isolated',
          finalState: gameState
        });
        
        console.log(`Game ${data.gameId} ended. Winner: ${gameState.winner}`);
      }
    } catch (error) {
      console.error('Error making move:', error);
      socket.emit('move-invalid', { 
        reason: error instanceof Error ? error.message : 'Invalid move' 
      });
    }
  });
  
  // Request valid moves for current player
  socket.on('request-valid-moves', (data: SocketEvents['request-valid-moves']) => {
    try {
      const validMoves = gameManager.getValidMoves(data.gameId);
      if (validMoves) {
        socket.emit('game-updated', { 
          gameState: gameManager.getGameState(data.gameId)!, 
          validMoves 
        });
      }
    } catch (error) {
      console.error('Error getting valid moves:', error);
    }
  });
  
  // Leave active game
  socket.on('leave-game', (data: SocketEvents['leave-game']) => {
    try {
      socket.leave(data.gameId);
      gameManager.removeSocketFromGame(data.gameId, socket.id);
      
      // Update player connection tracking
      const connection = playerConnections.get(socket.id);
      if (connection) {
        delete connection.gameId;
      }
      
      console.log(`Player left game: ${data.gameId}`);
    } catch (error) {
      console.error('Error leaving game:', error);
    }
  });
  
  // List active games (for monitoring/admin)
  socket.on('list-games', () => {
    try {
      const games = gameManager.getActiveGames();
      socket.emit('games-list', { games });
    } catch (error) {
      console.error('Error listing games:', error);
      socket.emit('error', { message: 'Failed to get game list' });
    }
  });
  
  // ======================
  // DEPRECATED EVENTS (Remove after migration)
  // ======================
  
  // Legacy create-game (redirect to create-lobby)
  socket.on('create-game', (data: any) => {
    console.log('⚠️ Legacy create-game event used, redirecting to create-lobby');
    socket.emit('create-lobby', {
      playerName: data.playerName,
      config: data.config || { gridRadius: 3 }
    });
  });
  
  // Legacy join-game (redirect to join-lobby)  
  socket.on('join-game', (data: any) => {
    console.log('⚠️ Legacy join-game event used, redirecting to join-lobby');
    socket.emit('join-lobby', {
      lobbyId: data.gameId, // Assume gameId is actually lobbyId in legacy calls
      playerName: data.playerName
    });
  });
  
  // ======================
  // TEST EVENTS (Temporary)
  // ======================
  
  // Handle test messages
  socket.on('test-message', (message: any) => {
    const playerName = connectedPlayers.get(socket.id) || 'Unknown';
    console.log(`Message from ${playerName}: ${message.message}`);
    // Broadcast to all connected clients
    io.emit('test-message', message);
  });
  
  // ======================
  // DISCONNECTION HANDLING
  // ======================
  
  // Handle disconnection
  socket.on('disconnect', () => {
    const playerName = connectedPlayers.get(socket.id) || 'Unknown';
    console.log(`Player disconnected: ${socket.id} (${playerName})`);
    
    // Clean up from managers
    lobbyManager.handlePlayerDisconnect(socket.id);
    gameManager.handlePlayerDisconnect(socket.id);
    
    // Remove from tracking
    connectedPlayers.delete(socket.id);
    playerConnections.delete(socket.id);
    
    // Broadcast updated player list
    broadcastPlayerList();
  });
  
  // ======================
  // HELPER FUNCTIONS
  // ======================
  
  /**
   * Handle transition from lobby to active game
   */
  function handleGameTransition(
    lobbyId: string, 
    transition: { gameId: string; gameState: any; validMoves: any }
  ) {
    console.log(`Transitioning lobby ${lobbyId} to game ${transition.gameId}`);
    
    // Move all players from lobby room to game room
    io.in(lobbyId).socketsJoin(transition.gameId);
    
    // Update all player connections to point to game instead of lobby
    for (const connection of playerConnections.values()) {
      if (connection.lobbyId === lobbyId) {
        delete connection.lobbyId;
        connection.gameId = transition.gameId;
      }
    }
    
    // Notify all players that the game is starting
    io.to(transition.gameId).emit('game-starting', {
      gameId: transition.gameId,
      gameState: dehydrateGameState(transition.gameState),
      validMoves: transition.validMoves
    });
    
    // Leave the lobby room since it's no longer needed
    io.in(lobbyId).socketsLeave(lobbyId);
    
    console.log(`Game transition complete: ${lobbyId} → ${transition.gameId}`);
  }
  
  /**
   * Helper function to broadcast current player list
   */
  function broadcastPlayerList() {
    const playerNames = Array.from(connectedPlayers.values());
    io.emit('players-updated', playerNames);
  }
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

// Periodic cleanup of old lobbies and games
setInterval(() => {
  lobbyManager.cleanupOldLobbies(30); // Clean lobbies older than 30 minutes
  gameManager.cleanupOldGames(120);   // Clean games older than 2 hours
}, 5 * 60 * 1000); // Run every 5 minutes

// Start server
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIPAddress();
  
  console.log('\n🎮 Vertex Strategy Game Server Started!');
  console.log('=========================================');
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🌐 Network URL: http://${localIP}:${PORT}`);
  console.log(`📊 Health Check: http://${localIP}:${PORT}/health`);
  console.log(`🔧 Network Info: http://${localIP}:${PORT}/network-info`);
  console.log('=========================================');
  console.log('🏠 Lobby System: Create → Join → Auto-start games');
  console.log('🎯 Game System: Active games with exactly 2 players');
  console.log('💡 Share the Network URL with friends to play together!');
  console.log('🔄 Server will auto-restart on file changes\n');
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutdown signal received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);