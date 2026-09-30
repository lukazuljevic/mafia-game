import { RoleConfig, ROLE_KEYS } from './types';
import { countSlots } from './roleDistributor';

export const MAX_PER_ROLE = 20;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 30;
export const MAX_NAME_LENGTH = 20;

export function sanitizeRoleConfig(input: unknown): RoleConfig | string {
  if (!input || typeof input !== 'object') return 'Neispravna konfiguracija uloga';

  const config = {} as RoleConfig;
  for (const role of ROLE_KEYS) {
    const value = (input as Record<string, unknown>)[role];
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_PER_ROLE) {
      return 'Neispravna konfiguracija uloga';
    }
    config[role] = value as number;
  }

  const total = countSlots(config);
  if (config.mafia < 1) return 'Potrebna je barem jedna mafija';
  if (total < MIN_PLAYERS) return `Potrebno je barem ${MIN_PLAYERS} igrača`;
  if (total > MAX_PLAYERS) return `Najviše ${MAX_PLAYERS} igrača`;
  if (config.mafia >= total - config.mafia) return 'Mafije mora biti manje od ostalih igrača';

  return config;
}

export function sanitizeName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

export function sanitizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export function sanitizeClientId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  return /^[A-Za-z0-9_-]{16,64}$/.test(input) ? input : null;
}
