export type Role = 'mafia' | 'doktor' | 'kurva' | 'policajac' | 'civil';

export const ROLE_KEYS: Role[] = ['mafia', 'doktor', 'kurva', 'policajac', 'civil'];

export type RoleConfig = Record<Role, number>;

export interface Player {
  id: string;       // public id, safe to broadcast
  secret: string;   // client id of the owning device, never broadcast
  name: string;
  role?: Role;
  dead: boolean;
}

export interface Game {
  code: string;
  hostSecret: string;
  players: Player[];
  roleConfig: RoleConfig;
  started: boolean;
  lastActivity: number;
}

export type Winner = 'mafia' | 'town' | null;
