import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../socket';
import { DEFAULT_ROLE_CONFIG, countSlots, emitAck, roleConfigError, type Ack, type RoleConfig } from '../game';
import BackButton from '../components/BackButton';
import RoleCounter from '../components/RoleCounter';

export default function CreateGamePage() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [roleConfig, setRoleConfig] = useState<RoleConfig>(DEFAULT_ROLE_CONFIG);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [redirect, setRedirect] = useState<string | null>(null);

  const totalPlayers = countSlots(roleConfig);
  const configError = roleConfigError(roleConfig);

  const handleCreate = async () => {
    if (configError) return;

    setIsCreating(true);
    setError('');
    const res = await emitAck<Ack & { code?: string }>(socket, 'create-game', { roleConfig });
    setIsCreating(false);

    if (res.success && res.code) {
      navigate(`/lobby/${res.code}`, { replace: true });
    } else {
      setError(res.error || 'Greška pri kreiranju igre');
      setRedirect(res.redirect ?? null);
    }
  };

  return (
    <div className="page create-page">
      <BackButton onClick={() => navigate('/')} />

      <div className="container">
        <h1>Nova Igra</h1>
        <p className="create-subtitle">Konfiguriraj uloge za igru</p>

        <div className="player-count">
          <div className="player-count-label">Ukupno igrača</div>
          <div className="player-count-value">{totalPlayers}</div>
          <div className="player-count-hint">Voditelj ne dobiva ulogu i ne ulazi u broj igrača</div>
        </div>

        <RoleCounter config={roleConfig} onChange={setRoleConfig} />

        {(configError || error) && (
          <p className="form-error" role="alert">
            {configError || error}
            {!configError && redirect && (
              <button
                type="button"
                className="link-button"
                onClick={() => navigate(`/lobby/${redirect}`, { replace: true })}
              >
                Otvori sobu {redirect}
              </button>
            )}
          </p>
        )}
      </div>

      <div className="action-bar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={isCreating || !isConnected || Boolean(configError)}
        >
          {isCreating ? 'Kreiram...' : 'Kreiraj Igru'}
        </button>
      </div>
    </div>
  );
}
