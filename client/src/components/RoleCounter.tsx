import { MAX_PLAYERS, ROLES, countSlots, type Role, type RoleConfig } from '../game';

export default function RoleCounter({ config, onChange }: { config: RoleConfig; onChange: (next: RoleConfig) => void }) {
  const total = countSlots(config);

  const update = (role: Role, delta: number) => {
    onChange({ ...config, [role]: Math.max(0, config[role] + delta) });
  };

  return (
    <div className="role-grid">
      {ROLES.map(role => (
        <div key={role.key} className="role-item">
          <div className="role-info">
            <span className="role-icon" aria-hidden="true">{role.icon}</span>
            <span className="role-name">{role.name}</span>
          </div>
          <div className="role-counter">
            <button
              type="button"
              onClick={() => update(role.key, -1)}
              disabled={config[role.key] === 0}
              aria-label={`Manje: ${role.name}`}
            >
              −
            </button>
            <span aria-live="polite">{config[role.key]}</span>
            <button
              type="button"
              onClick={() => update(role.key, 1)}
              disabled={total >= MAX_PLAYERS}
              aria-label={`Više: ${role.name}`}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
