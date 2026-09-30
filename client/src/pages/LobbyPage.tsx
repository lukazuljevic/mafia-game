import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../useGame';
import { useWakeLock } from '../useWakeLock';
import { ROLES, countSlots, roleConfigError, type PlayerState, type RoleConfig } from '../game';
import BackButton from '../components/BackButton';
import ConfirmModal, { type ConfirmOptions } from '../components/ConfirmModal';
import RoleCounter from '../components/RoleCounter';
import NarratorPanel from '../components/NarratorPanel';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

function sameConfig(a: RoleConfig, b: RoleConfig) {
  return ROLES.every(r => a[r.key] === b[r.key]);
}

export default function LobbyPage() {
  const { code: rawCode = '' } = useParams<{ code: string }>();
  const code = rawCode.toUpperCase();
  const navigate = useNavigate();
  const { state, send } = useGame(code);
  useWakeLock();

  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [error, setError] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [draft, setDraft] = useState<RoleConfig | null>(null);
  const [showRoles, setShowRoles] = useState(false);

  // Players go to their role card as soon as the game starts.
  useEffect(() => {
    if (state && !state.isHost && state.started) {
      navigate(`/role/${state.code}`, { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const run = async (event: string, extra?: object) => {
    setError('');
    const res = await send(event, extra);
    if (!res.success) setError(res.error || 'Greška');
    return res;
  };

  if (!state) {
    return (
      <div className="page page-center">
        <BackButton onClick={() => navigate('/')} />
        <p className="waiting-status"><span>Učitavanje sobe…</span></p>
      </div>
    );
  }

  const { isHost, started, players } = state;
  const config = draft && !sameConfig(draft, state.roleConfig) ? draft : state.roleConfig;
  const configError = roleConfigError(config);
  const totalSlots = countSlots(config);
  const missing = totalSlots - players.length;
  const offlineCount = players.filter(p => !p.connected).length;
  const canStart = !configError && missing === 0 && sameConfig(config, state.roleConfig);

  const handleBack = () => {
    if (isHost) {
      setConfirm({
        title: 'Zatvoriti sobu?',
        message: 'Svi igrači bit će izbačeni iz sobe.',
        confirmLabel: 'Zatvori',
        danger: true,
        onConfirm: async () => {
          const res = await run('delete-game');
          if (res.success) navigate('/', { replace: true });
        },
      });
      return;
    }
    run('leave-game').then(res => {
      if (res.success) navigate('/', { replace: true });
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mafia', text: `Pridruži se igri Mafia! Kod sobe: ${code}`, url });
      } catch {
        // Share sheet dismissed.
      }
      return;
    }
    await copyText(url);
    setCopied('link');
  };

  const handleCopyCode = async () => {
    await copyText(code);
    setCopied('code');
  };

  const changeRoles = (next: RoleConfig) => {
    setDraft(next);
    if (!roleConfigError(next)) run('update-roles', { roleConfig: next });
  };

  const fillWithCivilians = () => {
    const specials = totalSlots - config.civil;
    changeRoles({ ...config, civil: Math.max(0, players.length - specials) });
  };

  const handleKick = (player: PlayerState) => {
    setConfirm({
      title: `Ukloniti ${player.name}?`,
      message: started ? 'Igrač će biti uklonjen iz igre koja je u tijeku.' : undefined,
      confirmLabel: 'Ukloni',
      danger: true,
      onConfirm: () => run('kick-player', { playerId: player.id }),
    });
  };

  const handleStart = async () => {
    setIsStarting(true);
    await run('start-game');
    setIsStarting(false);
  };

  const handleStop = () => {
    if (state.winner) {
      run('restart-game');
      return;
    }
    setConfirm({
      title: 'Zaustaviti igru?',
      message: 'Uloge će se poništiti i svi se vraćaju u sobu.',
      confirmLabel: 'Zaustavi',
      danger: true,
      onConfirm: () => run('restart-game'),
    });
  };

  const startLabel = isStarting
    ? 'Pokrećem...'
    : configError
      ? 'Neispravne uloge'
      : missing > 0
        ? `Čekamo još ${missing} igrača`
        : missing < 0
          ? `Previše igrača (${-missing}) — dodaj uloge`
          : 'Pokreni igru';

  return (
    <div className="page lobby-page">
      <BackButton onClick={handleBack} label={isHost ? 'Zatvori sobu' : 'Napusti sobu'} />

      <div className="container">
        <div className={`room-code-display ${started ? 'room-code-compact' : ''}`}>
          <div className="room-code-label">Kod sobe</div>
          <div className="room-code">{code}</div>

          {!started && (
            <div className="share-buttons">
              <button type="button" className="btn btn-secondary btn-small" onClick={handleShare}>
                {copied === 'link' ? '✓ Poveznica kopirana' : '🔗 Podijeli'}
              </button>
              <button type="button" className="btn btn-secondary btn-small" onClick={handleCopyCode}>
                {copied === 'code' ? '✓ Kopirano' : '📋 Kopiraj kod'}
              </button>
            </div>
          )}
        </div>

        {isHost && started ? (
          <NarratorPanel state={state} onToggleDead={p => run('set-dead', { playerId: p.id, dead: !p.dead })} />
        ) : (
          <div className="players-section">
            <h2>
              Igrači ({players.length}/{totalSlots})
            </h2>

            <div className="players-list">
              {players.map(player => (
                <div key={player.id} className={`player-item ${player.connected ? '' : 'player-offline'}`}>
                  <div className="player-avatar">
                    {player.name.charAt(0).toUpperCase()}
                    <span className={`status-dot ${player.connected ? 'online' : 'offline'}`} />
                  </div>
                  <span className="player-name">
                    {player.name}
                    {player.id === state.you?.id && <span className="player-you"> (ti)</span>}
                  </span>
                  {!player.connected && <span className="player-status">nije spojen</span>}
                  {isHost && (
                    <button
                      type="button"
                      className="kick-button"
                      onClick={() => handleKick(player)}
                      aria-label={`Ukloni ${player.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, missing) }, (_, i) => (
                <div key={`empty-${i}`} className="player-item player-empty">
                  <div className="player-avatar">?</div>
                  <span className="player-name">Slobodno mjesto</span>
                </div>
              ))}
            </div>

            {!isHost && (
              <div className="waiting-status">
                <span>{missing > 0 ? 'Čekanje igrača...' : 'Čekamo da voditelj pokrene igru...'}</span>
              </div>
            )}
          </div>
        )}

        {isHost && !started && (
          <div className="role-editor">
            <button
              type="button"
              className="role-editor-toggle"
              onClick={() => setShowRoles(v => !v)}
              aria-expanded={showRoles}
            >
              <span className="role-summary">
                {ROLES.filter(r => config[r.key] > 0).map(r => (
                  <span key={r.key}>
                    {r.icon} {config[r.key]}
                  </span>
                ))}
              </span>
              <span>{showRoles ? 'Gotovo' : 'Uredi uloge'}</span>
            </button>

            {showRoles && <RoleCounter config={config} onChange={changeRoles} />}

            {missing !== 0 && players.length > 0 && (
              <button type="button" className="btn btn-secondary btn-small" onClick={fillWithCivilians}>
                👤 Popuni civilima ({players.length} igrača)
              </button>
            )}

            {configError && <p className="form-error" role="alert">{configError}</p>}
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      {isHost && (
        <div className="action-bar">
          {!started && offlineCount > 0 && missing === 0 && (
            <p className="action-hint">Nespojenih igrača: {offlineCount}</p>
          )}
          {started ? (
            <button
              type="button"
              className={`btn ${state.winner ? 'btn-primary' : 'btn-danger'}`}
              onClick={handleStop}
            >
              {state.winner ? '🔁 Nova runda' : '🛑 Zaustavi igru'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!canStart || isStarting}
            >
              {startLabel}
            </button>
          )}
        </div>
      )}

      <ConfirmModal options={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
