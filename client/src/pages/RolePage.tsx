import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../useGame';
import { useWakeLock } from '../useWakeLock';
import { ROLE_BY_KEY } from '../game';
import BackButton from '../components/BackButton';
import ConfirmModal, { type ConfirmOptions } from '../components/ConfirmModal';

const AUTO_HIDE_MS = 5000;

export default function RolePage() {
  const { code: rawCode = '' } = useParams<{ code: string }>();
  const code = rawCode.toUpperCase();
  const navigate = useNavigate();
  const { state, send } = useGame(code);
  useWakeLock();

  const [isRevealed, setIsRevealed] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);

  // The host narrates from the lobby, and everyone returns there when the game is stopped.
  useEffect(() => {
    if (state && (state.isHost || !state.started)) {
      navigate(`/lobby/${state.code}`, { replace: true });
    }
  }, [state, navigate]);

  // Flip the card back so it isn't left face-up on the table.
  useEffect(() => {
    if (!isRevealed) return;
    const timer = setTimeout(() => setIsRevealed(false), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [isRevealed]);

  const role = state?.you?.role ? ROLE_BY_KEY[state.you.role] : null;

  if (!state || !role) {
    return (
      <div className="page page-center">
        <BackButton onClick={() => navigate('/')} />
        <p className="waiting-status"><span>Učitavanje uloge…</span></p>
      </div>
    );
  }

  const toggleReveal = () => {
    if (!isRevealed) navigator.vibrate?.(40);
    setIsRevealed(v => !v);
  };

  const handleLeave = () => {
    setConfirm({
      title: 'Napustiti igru?',
      message: 'Igra je u tijeku. Nakon izlaska nećeš se moći vratiti u ovu rundu.',
      confirmLabel: 'Napusti',
      danger: true,
      onConfirm: async () => {
        const res = await send('leave-game');
        if (res.success) navigate('/', { replace: true });
      },
    });
  };

  return (
    <div className="page role-page">
      <BackButton onClick={handleLeave} label="Napusti igru" />

      <div className="role-reveal-container">
        {state.winner ? (
          <div className={`winner-banner winner-${state.winner}`} role="status">
            {state.winner === 'town' ? '🏆 Građani su pobijedili!' : '🔫 Mafija je pobijedila!'}
          </div>
        ) : state.you?.dead ? (
          <div className="dead-banner" role="status">☠️ Van igre si — ne otkrivaj svoju ulogu</div>
        ) : null}

        <p className="role-reveal-intro">{state.you?.name}, tvoja tajna uloga</p>

        <button
          type="button"
          className={`flip-card ${isRevealed ? 'is-revealed' : ''}`}
          onClick={toggleReveal}
          aria-label={isRevealed ? 'Sakrij ulogu' : 'Prikaži ulogu'}
        >
          <div className="flip-card-inner">
            <div className="card role-card flip-card-face flip-card-front" aria-hidden={isRevealed}>
              <div className="role-icon-large">🃏</div>
              <h2 className="role-title">Skriveno</h2>
              <p className="role-description">Dodirni za otkrivanje</p>
            </div>
            <div className={`card role-card flip-card-face flip-card-back role-${role.key}`} aria-hidden={!isRevealed}>
              <div className="role-icon-large">{role.icon}</div>
              <h1 className="role-title">{role.name}</h1>
              <p className="role-description">{role.description}</p>
              <p className="role-hide-hint">Dodirni za skrivanje</p>
            </div>
          </div>
        </button>

        <div className="role-warning">
          <span>🤫</span>
          <span>Ne pokazuj svoj ekran drugim igračima!</span>
        </div>
      </div>

      <ConfirmModal options={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
