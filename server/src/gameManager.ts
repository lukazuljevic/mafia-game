import { Game, Player, RoleConfig } from './types';
import { distributeRoles } from './roleDistributor';

const games: Map<string, Game> = new Map();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUniqueCode(): string {
  let code = generateCode();
  while (games.has(code)) {
    code = generateCode();
  }
  return code;
}

export function createGame(hostId: string, roleConfig: RoleConfig): Game {
  const code = generateUniqueCode();
  const game: Game = {
    id: code,
    code,
    hostId,
    players: [],
    roleConfig,
    started: false,
    createdAt: new Date()
  };
  games.set(code, game);
  return game;
}

export function getGame(code: string): Game | undefined {
  return games.get(code.toUpperCase());
}

export function joinGame(code: string, player: Player): Game | null {
  const game = games.get(code.toUpperCase());
  if (!game || game.started) return null;
  
  const totalSlots = game.roleConfig.mafia + game.roleConfig.doktor + 
    game.roleConfig.kurva + game.roleConfig.policajac + game.roleConfig.civil;
  
  if (game.players.length >= totalSlots) return null;
  if (game.players.some(p => p.id === player.id)) return game;
  
  game.players.push(player);
  return game;
}

export function removePlayer(code: string, playerId: string): Game | null {
  const game = games.get(code.toUpperCase());
  if (!game) return null;
  
  game.players = game.players.filter(p => p.id !== playerId);
  return game;
}

export function startGame(code: string, hostId: string): Game | null {
  const game = games.get(code.toUpperCase());
  if (!game || game.hostId !== hostId || game.started) return null;
  
  const totalRoles = game.roleConfig.mafia + game.roleConfig.doktor + 
    game.roleConfig.kurva + game.roleConfig.policajac + game.roleConfig.civil;
  
  if (game.players.length !== totalRoles) return null;
  
  game.players = distributeRoles(game.players, game.roleConfig);
  game.started = true;
  return game;
}

export function restartGame(code: string, hostId: string): Game | null {
  const game = games.get(code.toUpperCase());
  if (!game || game.hostId !== hostId) return null;
  
  game.players = game.players.map(p => ({ id: p.id, name: p.name }));
  game.started = false;
  return game;
}

export function getAllRoles(code: string, hostId: string): { name: string; role: string }[] | null {
  const game = games.get(code.toUpperCase());
  if (!game || game.hostId !== hostId || !game.started) return null;
  
  return game.players.map(p => ({ name: p.name, role: p.role || 'unknown' }));
}

export function deleteGame(code: string): void {
  games.delete(code.toUpperCase());
}
