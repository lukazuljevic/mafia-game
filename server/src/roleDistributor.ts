import { Role, RoleConfig, Player } from './types';

export function distributeRoles(players: Player[], roleConfig: RoleConfig): Player[] {
  const roles: Role[] = [];
  
  for (let i = 0; i < roleConfig.mafia; i++) roles.push('mafia');
  for (let i = 0; i < roleConfig.doktor; i++) roles.push('doktor');
  for (let i = 0; i < roleConfig.kurva; i++) roles.push('kurva');
  for (let i = 0; i < roleConfig.policajac; i++) roles.push('policajac');
  for (let i = 0; i < roleConfig.civil; i++) roles.push('civil');
  
  shuffleArray(roles);
  
  return players.map((player, index) => ({
    ...player,
    role: roles[index]
  }));
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function validateRoleConfig(playerCount: number, roleConfig: RoleConfig): boolean {
  const totalRoles = roleConfig.mafia + roleConfig.doktor + roleConfig.kurva + roleConfig.policajac + roleConfig.civil;
  return totalRoles === playerCount;
}
