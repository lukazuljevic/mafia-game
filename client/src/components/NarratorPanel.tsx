import { ROLES, type GameState, type PlayerState } from '../game';

interface Props {
  state: GameState;
  onToggleDead: (player: PlayerState) => void;
}

export default function NarratorPanel({ state, onToggleDead }: Props) {
  const alive = state.players.filter(p => !p.dead);
  const mafiaAlive = alive.filter(p => p.role === 'mafia').length;
  const townAlive = alive.length - mafiaAlive;
  const nightSteps = ROLES.filter(r => r.nightAction && alive.some(p => p.role === r.key));

  return (
    <div className="narrator">
      {state.winner && (
        <div className={`winner-banner winner-${state.winner}`} role="status">
          {state.winner === 'town' ? '🏆 Građani su pobijedili!' : '🔫 Mafija je pobijedila!'}
        </div>
      )}

      <div className="narrator-stats">
        <div className="stat stat-mafia">
          <span className="stat-value">{mafiaAlive}</span>
          <span className="stat-label">Mafija u igri</span>
        </div>
        <div className="stat stat-town">
          <span className="stat-value">{townAlive}</span>
          <span className="stat-label">Građana u igri</span>
        </div>
      </div>

      <details className="night-order">
        <summary>🌙 Redoslijed noći</summary>
        <ol>
          <li>Svi zatvaraju oči</li>
          {nightSteps.map(role => (
            <li key={role.key}>
              {role.icon} {role.nightAction}
            </li>
          ))}
          <li>☀️ Svi se bude — objavi što se dogodilo</li>
        </ol>
      </details>

      <p className="host-hint">Dodirni igrača da ga označiš kao ispalog iz igre</p>

      {ROLES.map(role => {
        const group = state.players.filter(p => p.role === role.key);
        if (group.length === 0) return null;
        const groupAlive = group.filter(p => !p.dead).length;

        return (
          <section key={role.key} className="role-group">
            <h3 className={`role-group-title role-text-${role.key}`}>
              <span>
                {role.icon} {role.name}
              </span>
              <span className="role-group-count">
                {groupAlive}/{group.length}
              </span>
            </h3>
            {group.map(player => (
              <button
                type="button"
                key={player.id}
                className={`role-list-item ${player.dead ? 'player-dead' : ''}`}
                onClick={() => onToggleDead(player)}
                aria-pressed={player.dead}
              >
                <span className="role-list-name">{player.name}</span>
                {!player.connected && <span className="status-dot offline" title="Nije spojen" />}
                <span className="role-list-status">{player.dead ? '☠️ Van igre' : 'U igri'}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}
