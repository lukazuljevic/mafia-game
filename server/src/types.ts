export type Role = 'mafia' | 'doktor' | 'kurva' | 'policajac' | 'civil';

export interface RoleConfig {
  mafia: number;
  doktor: number;
  kurva: number;
  policajac: number;
  civil: number;
}

export interface Player {
  id: string;
  name: string;
  role?: Role;
}

export interface Game {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  roleConfig: RoleConfig;
  started: boolean;
  createdAt: Date;
}
