import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../socket';

interface RoleConfig {
  mafia: number;
  doktor: number;
  kurva: number;
  policajac: number;
  civil: number;
}

const ROLES = [
  { key: 'mafia', name: 'Mafia', icon: '🔫' },
  { key: 'doktor', name: 'Doktor', icon: '💉' },
  { key: 'kurva', name: 'Kurva', icon: '💋' },
  { key: 'policajac', name: 'Policajac', icon: '🔍' },
  { key: 'civil', name: 'Civil', icon: '👤' },
] as const;

export default function CreateGamePage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [roleConfig, setRoleConfig] = useState<RoleConfig>({
    mafia: 1,
    doktor: 1,
    kurva: 1,
    policajac: 1,
    civil: 2,
  });
  const [isCreating, setIsCreating] = useState(false);

  const totalPlayers = Object.values(roleConfig).reduce((sum, count) => sum + count, 0);

  const updateRole = (role: keyof RoleConfig, delta: number) => {
    setRoleConfig(prev => ({
      ...prev,
      [role]: Math.max(0, prev[role] + delta)
    }));
  };

  const handleCreate = () => {
    if (!socket || totalPlayers < 3) return;
    
    setIsCreating(true);
    socket.emit('create-game', roleConfig, (response: { success: boolean; game?: { code: string } }) => {
      if (response.success && response.game) {
        navigate(`/lobby/${response.game.code}`, { state: { isHost: true, roleConfig } });
      }
      setIsCreating(false);
    });
  };

  return (
    <div className="page create-page">
      <button className="back-button" onClick={() => navigate('/')}>←</button>
      
      <div className="container">
        <h1>Nova Igra</h1>
        <p className="create-subtitle">Konfiguriraj uloge za igru</p>

        <div className="player-count">
          <div className="player-count-label">Ukupno igrača</div>
          <div className="player-count-value">{totalPlayers}</div>
        </div>

        <div className="role-grid">
          {ROLES.map(role => (
            <div key={role.key} className="role-item">
              <div className="role-info">
                <span className="role-icon">{role.icon}</span>
                <span className="role-name">{role.name}</span>
              </div>
              <div className="role-counter">
                <button 
                  onClick={() => updateRole(role.key, -1)}
                  disabled={roleConfig[role.key] === 0}
                >
                  −
                </button>
                <span>{roleConfig[role.key]}</span>
                <button onClick={() => updateRole(role.key, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        <button 
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={isCreating || totalPlayers < 3}
        >
          {isCreating ? 'Kreiram...' : 'Kreiraj Igru'}
        </button>
      </div>
    </div>
  );
}
