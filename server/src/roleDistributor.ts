import { Role, RoleConfig, Player, ROLE_KEYS } from './types';

export function countSlots(roleConfig: RoleConfig): number {
  return ROLE_KEYS.reduce((sum, role) => sum + roleConfig[role], 0);
}

export function distributeRoles(players: Player[], roleConfig: RoleConfig): Player[] {
  const roles: Role[] = [];
  for (const role of ROLE_KEYS) {
    for (let i = 0; i < roleConfig[role]; i++) roles.push(role);
  }

  shuffleArray(roles);

  return players.map((player, index) => ({
    ...player,
    role: roles[index],
    dead: false,
  }));
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
