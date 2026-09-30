import { randomBytes } from 'crypto';
import { Game, Player, RoleConfig, Winner } from './types';
import { countSlots, distributeRoles } from './roleDistributor';

const games: Map<string, Game> = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
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

function touch(game: Game): void {
  game.lastActivity = Date.now();
}

export function createGame(hostSecret: string, roleConfig: RoleConfig): Game {
  const code = generateUniqueCode();
  const game: Game = {
    code,
    hostSecret,
    players: [],
    roleConfig,
    started: false,
    lastActivity: Date.now(),
  };
  games.set(code, game);
  return game;
}

export function getGame(code: string): Game | undefined {
  return games.get(code.toUpperCase());
}

export function findMembership(secret: string): { game: Game; isHost: boolean } | null {
  for (const game of games.values()) {
    if (game.hostSecret === secret) return { game, isHost: true };
    if (game.players.some(p => p.secret === secret)) return { game, isHost: false };
  }
  return null;
}

export function joinGame(game: Game, secret: string, name: string): string | null {
  if (game.players.some(p => p.secret === secret)) return null;
  if (game.started) return 'Igra je već počela';
  if (game.players.length >= countSlots(game.roleConfig)) return 'Soba je puna';
  if (game.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return 'To ime je već zauzeto u ovoj sobi';
  }

  const player: Player = { id: randomBytes(6).toString('hex'), secret, name, dead: false };
  game.players.push(player);
  touch(game);
  return null;
}

export function removePlayer(game: Game, predicate: (p: Player) => boolean): Player | null {
  const player = game.players.find(predicate);
  if (!player) return null;
  game.players = game.players.filter(p => p !== player);
  touch(game);
  return player;
}

export function updateRoles(game: Game, roleConfig: RoleConfig): string | null {
  if (game.started) return 'Uloge se ne mogu mijenjati tijekom igre';
  game.roleConfig = roleConfig;
  touch(game);
  return null;
}

export function startGame(game: Game): string | null {
  if (game.started) return 'Igra je već počela';
  const totalRoles = countSlots(game.roleConfig);
  if (game.players.length !== totalRoles) {
    return `Broj igrača (${game.players.length}) ne odgovara broju uloga (${totalRoles})`;
  }

  game.players = distributeRoles(game.players, game.roleConfig);
  game.started = true;
  touch(game);
  return null;
}

export function restartGame(game: Game): void {
  game.players = game.players.map(({ id, secret, name }) => ({ id, secret, name, dead: false }));
  game.started = false;
  touch(game);
}

export function setDead(game: Game, playerId: string, dead: boolean): string | null {
  if (!game.started) return 'Igra nije počela';
  const player = game.players.find(p => p.id === playerId);
  if (!player) return 'Igrač nije pronađen';
  player.dead = dead;
  touch(game);
  return null;
}

export function getWinner(game: Game): Winner {
  if (!game.started) return null;
  const alive = game.players.filter(p => !p.dead);
  const mafia = alive.filter(p => p.role === 'mafia').length;
  const town = alive.length - mafia;
  if (mafia === 0) return 'town';
  if (mafia >= town) return 'mafia';
  return null;
}

export function getAvailableGames(excludeSecret: string): { code: string; playerCount: number; totalSlots: number }[] {
  const available: { code: string; playerCount: number; totalSlots: number }[] = [];

  games.forEach(game => {
    if (game.started || game.hostSecret === excludeSecret) return;
    if (game.players.some(p => p.secret === excludeSecret)) return;

    const totalSlots = countSlots(game.roleConfig);
    if (game.players.length < totalSlots) {
      available.push({ code: game.code, playerCount: game.players.length, totalSlots });
    }
  });

  return available;
}

export function deleteGame(code: string): boolean {
  return games.delete(code.toUpperCase());
}

const GAME_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours of inactivity

export function cleanupExpiredGames(): Game[] {
  const now = Date.now();
  const expired: Game[] = [];

  games.forEach(game => {
    if (now - game.lastActivity > GAME_EXPIRY_MS) {
      expired.push(game);
    }
  });

  expired.forEach(game => {
    console.log(`Cleaning up expired game: ${game.code}`);
    games.delete(game.code);
  });

  return expired;
}

export function startCleanupInterval(onGameExpired?: (game: Game) => void): NodeJS.Timeout {
  return setInterval(() => {
    const expired = cleanupExpiredGames();
    if (onGameExpired) {
      expired.forEach(game => onGameExpired(game));
    }
  }, 60 * 60 * 1000); // Check every hour
}
