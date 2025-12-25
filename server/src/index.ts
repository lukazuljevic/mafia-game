import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { createGame, getGame, joinGame, removePlayer, startGame, restartGame, getAllRoles, updatePlayerId, updateHostId, getAvailableGames, isHostOfAnyGame, deleteGame } from './gameManager';
import { RoleConfig } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../static')));

app.get('{*splat}', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(__dirname, '../static/index.html'));
});

const playerRooms: Map<string, string> = new Map();
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const DISCONNECT_GRACE_PERIOD = 30 * 60 * 1000; // 30 minutes

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('create-game', (roleConfig: RoleConfig, callback) => {
    if (isHostOfAnyGame(socket.id)) {
      callback({ success: false, error: 'Already hosting a game' });
      return;
    }
    const game = createGame(socket.id, roleConfig);
    socket.join(game.code);
    playerRooms.set(socket.id, game.code);
    callback({ success: true, game: { code: game.code, players: game.players, roleConfig: game.roleConfig } });
  });

  socket.on('join-game', ({ code, name }: { code: string; name: string }, callback) => {
    if (isHostOfAnyGame(socket.id)) {
      callback({ success: false, error: 'Cannot join as player while hosting a game' });
      return;
    }
    const game = joinGame(code, { id: socket.id, name });
    if (!game) {
      callback({ success: false, error: 'Game not found or already started' });
      return;
    }
    socket.join(code.toUpperCase());
    playerRooms.set(socket.id, code.toUpperCase());
    
    const gameData = getGame(code);
    io.to(code.toUpperCase()).emit('player-joined', { 
      players: gameData?.players.map(p => ({ id: p.id, name: p.name })) || [],
      hostId: gameData?.hostId
    });
    
    callback({ 
      success: true, 
      game: { 
        code: code.toUpperCase(), 
        players: gameData?.players.map(p => ({ id: p.id, name: p.name })) || [],
        roleConfig: gameData?.roleConfig,
        isHost: gameData?.hostId === socket.id,
        hostId: gameData?.hostId
      } 
    });
  });

  socket.on('reconnect-player', ({ code, playerName }: { code: string; playerName: string }, callback) => {
    const result = updatePlayerId(code, playerName, socket.id);
    if (!result) {
      callback({ success: false, error: 'Player not found in game' });
      return;
    }

    const timerKey = `${code}-${playerName}`;
    const existingTimer = disconnectTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(timerKey);
      console.log(`Reconnect: cancelled removal timer for ${playerName}`);
    }

    socket.join(code.toUpperCase());
    playerRooms.set(socket.id, code.toUpperCase());
    
    callback({
      success: true,
      game: {
        code: result.game.code,
        players: result.game.players.map(p => ({ id: p.id, name: p.name })),
        roleConfig: result.game.roleConfig,
        started: result.game.started,
        isHost: result.isHost,
        hostId: result.game.hostId
      },
      role: result.role
    });
  });

  socket.on('reconnect-host', ({ code }: { code: string }, callback) => {
    const game = updateHostId(code, socket.id);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    socket.join(code.toUpperCase());
    playerRooms.set(socket.id, code.toUpperCase());
    
    callback({
      success: true,
      game: {
        code: game.code,
        players: game.players.map(p => ({ id: p.id, name: p.name })),
        roleConfig: game.roleConfig,
        started: game.started,
        isHost: true,
        hostId: game.hostId
      }
    });
  });

  socket.on('start-game', (code: string, callback) => {
    const game = startGame(code, socket.id);
    if (!game) {
      callback({ success: false, error: 'Cannot start game' });
      return;
    }
    
    game.players.forEach(player => {
      io.to(player.id).emit('game-started', { 
        role: player.role,
        isHost: false
      });
    });
    
    io.to(game.hostId).emit('game-started', {
      role: null,
      isHost: true
    });
    
    callback({ success: true });
  });

  socket.on('restart-game', (code: string, callback) => {
    const game = restartGame(code, socket.id);
    if (!game) {
      callback({ success: false, error: 'Only the host can restart the game' });
      return;
    }
    
    io.to(code.toUpperCase()).emit('game-restarted', {
      players: game.players.map(p => ({ id: p.id, name: p.name })),
      roleConfig: game.roleConfig
    });
    
    callback({ success: true });
  });

  socket.on('get-all-roles', (code: string, callback) => {
    const roles = getAllRoles(code, socket.id);
    if (!roles) {
      callback({ success: false, error: 'Not authorized or game not started' });
      return;
    }
    callback({ success: true, roles });
  });

  socket.on('get-game-info', (code: string, callback) => {
    const game = getGame(code);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    callback({
      success: true,
      game: {
        code: game.code,
        players: game.players.map(p => ({ id: p.id, name: p.name })),
        roleConfig: game.roleConfig,
        started: game.started,
        isHost: game.hostId === socket.id,
        hostId: game.hostId
      }
    });
  });

  socket.on('get-available-games', (callback) => {
    const games = getAvailableGames();
    callback({ success: true, games });
  });

  socket.on('leave-game', ({ code }: { code: string }, callback) => {
    const game = getGame(code);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    
    if (game.hostId === socket.id) {
      callback({ success: false, error: 'Host cannot leave, use delete-game instead' });
      return;
    }

    const updatedGame = removePlayer(code, socket.id);
    if (updatedGame) {
      socket.leave(code.toUpperCase());
      playerRooms.delete(socket.id);
      io.to(code.toUpperCase()).emit('player-left', { 
        players: updatedGame.players.map(p => ({ id: p.id, name: p.name })) 
      });
    }
    
    callback({ success: true });
  });

  socket.on('delete-game', ({ code }: { code: string }, callback) => {
    const game = getGame(code);
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    
    if (game.hostId !== socket.id) {
      callback({ success: false, error: 'Only host can delete the game' });
      return;
    }

    io.to(code.toUpperCase()).emit('game-deleted', {});
    
    deleteGame(code);
    socket.leave(code.toUpperCase());
    playerRooms.delete(socket.id);
    
    callback({ success: true });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomCode = playerRooms.get(socket.id);
    if (roomCode) {
      const game = getGame(roomCode);
      if (game) {
        const player = game.players.find(p => p.id === socket.id);
        if (player) {
          const timerKey = `${roomCode}-${player.name}`;
          console.log(`Starting ${DISCONNECT_GRACE_PERIOD/1000}s removal timer for ${player.name}`);
          
          const timer = setTimeout(() => {
            console.log(`Grace period expired, removing ${player.name}`);
            const updatedGame = removePlayer(roomCode, socket.id);
            if (updatedGame) {
              io.to(roomCode).emit('player-left', { 
                players: updatedGame.players.map(p => ({ id: p.id, name: p.name })) 
              });
            }
            disconnectTimers.delete(timerKey);
          }, DISCONNECT_GRACE_PERIOD);
          
          disconnectTimers.set(timerKey, timer);
        }
      }
      playerRooms.delete(socket.id);
    }
  });
});

const PORT = 9999;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  const { startCleanupInterval } = require('./gameManager');
  startCleanupInterval((code: string) => {
    io.to(code.toUpperCase()).emit('game-deleted', {});
    console.log(`Expired game ${code} deleted and players notified`);
  });
});
