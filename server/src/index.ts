import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { createGame, getGame, joinGame, removePlayer, startGame, restartGame, getAllRoles } from './gameManager';
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

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('create-game', (roleConfig: RoleConfig, callback) => {
    const game = createGame(socket.id, roleConfig);
    socket.join(game.code);
    playerRooms.set(socket.id, game.code);
    callback({ success: true, game: { code: game.code, players: game.players, roleConfig: game.roleConfig } });
  });

  socket.on('join-game', ({ code, name }: { code: string; name: string }, callback) => {
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

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomCode = playerRooms.get(socket.id);
    if (roomCode) {
      const game = removePlayer(roomCode, socket.id);
      if (game) {
        io.to(roomCode).emit('player-left', { 
          players: game.players.map(p => ({ id: p.id, name: p.name })) 
        });
      }
      playerRooms.delete(socket.id);
    }
  });
});

const PORT = 9999;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
