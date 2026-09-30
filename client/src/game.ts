import type { Socket } from 'socket.io-client';

export type Role = 'mafia' | 'doktor' | 'kurva' | 'policajac' | 'civil';

export type RoleConfig = Record<Role, number>;

export interface RoleInfo {
  key: Role;
  name: string;
  icon: string;
  description: string;
  nightAction?: string;
}

// Ordered as the narrator wakes them up at night.
export const ROLES: RoleInfo[] = [
  {
    key: 'mafia',
    name: 'Mafia',
    icon: '🔫',
    description: 'Ti si ubojica. Svake noći s ostalom mafijom biraš jednog igrača za eliminaciju. Ostani skriven.',
    nightAction: 'Mafia se budi i bira žrtvu',
  },
  {
    key: 'doktor',
    name: 'Doktor',
    icon: '💉',
    description: 'Ti liječiš. Svake noći biraš jednog igrača kojeg štitiš od mafije.',
    nightAction: 'Doktor se budi i bira koga spašava',
  },
  {
    key: 'kurva',
    name: 'Kurva',
    icon: '💋',
    description: 'Ti zavodiš. Svake noći biraš jednog igrača s kojim provodiš noć — on te noći ne može iskoristiti svoju sposobnost.',
    nightAction: 'Kurva se budi i bira s kim provodi noć',
  },
  {
    key: 'policajac',
    name: 'Policajac',
    icon: '🔍',
    description: 'Ti istražuješ. Svake noći možeš provjeriti je li neki igrač mafia.',
    nightAction: 'Policajac se budi i provjerava igrača',
  },
  {
    key: 'civil',
    name: 'Civil',
    icon: '👤',
    description: 'Ti si običan građanin. Tvoj glas na glasanju je tvoja jedina moć.',
  },
];

export const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r])) as Record<Role, RoleInfo>;

export const DEFAULT_ROLE_CONFIG: RoleConfig = { mafia: 1, doktor: 1, kurva: 1, policajac: 1, civil: 2 };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 30;

export function countSlots(config: RoleConfig): number {
  return ROLES.reduce((sum, r) => sum + config[r.key], 0);
}

// Mirrors the server's sanitizeRoleConfig, so the UI can explain why a config is rejected.
export function roleConfigError(config: RoleConfig): string | null {
  const total = countSlots(config);
  if (config.mafia < 1) return 'Potrebna je barem jedna mafija';
  if (total < MIN_PLAYERS) return `Potrebno je barem ${MIN_PLAYERS} igrača`;
  if (total > MAX_PLAYERS) return `Najviše ${MAX_PLAYERS} igrača`;
  if (config.mafia >= total - config.mafia) return 'Mafije mora biti manje od ostalih igrača';
  return null;
}

export interface PlayerState {
  id: string;
  name: string;
  connected: boolean;
  dead: boolean;
  role?: Role | null;
}

export interface GameState {
  code: string;
  isHost: boolean;
  started: boolean;
  roleConfig: RoleConfig;
  winner: 'mafia' | 'town' | null;
  players: PlayerState[];
  you?: { id: string; name: string; role: Role | null; dead: boolean };
}

export interface Ack {
  success: boolean;
  error?: string;
  redirect?: string;
  gone?: boolean;
  notMember?: boolean;
}

// Emits with an acknowledgement and never hangs: offline or slow server resolve to an error.
export function emitAck<T extends Ack = Ack>(socket: Socket, event: string, payload: object = {}): Promise<T> {
  return new Promise(resolve => {
    if (!socket.connected) {
      resolve({ success: false, error: 'Nema veze sa serverom' } as T);
      return;
    }
    socket.timeout(8000).emit(event, payload, (err: Error | null, response: T) => {
      resolve(err ? ({ success: false, error: 'Server ne odgovara, pokušaj ponovno' } as T) : response);
    });
  });
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or storage disabled; the value just won't persist.
  }
}

let cachedClientId: string | null = null;

// Identifies this device to the server across reconnects and refreshes. Never shown to other players.
export function getClientId(): string {
  if (cachedClientId) return cachedClientId;
  let id = storageGet('mafia-client-id');
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    storageSet('mafia-client-id', id);
  }
  cachedClientId = id;
  return id;
}

export function getSavedName(): string {
  return storageGet('mafia-player-name') ?? '';
}

export function saveName(name: string): void {
  storageSet('mafia-player-name', name.trim());
}
