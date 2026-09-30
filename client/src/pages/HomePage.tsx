import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../socket';
import { emitAck, getSavedName, saveName, type Ack } from '../game';
import ConfirmModal, { type ConfirmOptions } from '../components/ConfirmModal';

interface AvailableGame {
  code: string;
  playerCount: number;
  totalSlots: number;
}

interface Session {
  code: string;
  isHost: boolean;
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code: linkCode } = useParams<{ code: string }>();
  const { socket, isConnected } = useSocket();
  const [showJoinModal, setShowJoinModal] = useState(Boolean(linkCode));
  const [joinCode, setJoinCode] = useState(linkCode?.toUpperCase() ?? '');
  const [playerName, setPlayerName] = useState(getSavedName);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const notice: string | undefined = location.state?.notice;

  const refresh = useCallback(() => {
    emitAck<Ack & { games?: AvailableGame[] }>(socket, 'get-available-games').then(res => {
      if (res.success && res.games) setAvailableGames(res.games);
    });
    emitAck<Ack & { session?: Session | null }>(socket, 'get-session').then(res => {
      if (res.success) setSession(res.session ?? null);
    });
  }, [socket]);

  useEffect(() => {
    if (!isConnected) return;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isConnected, refresh]);

  const closeJoinModal = () => {
    setShowJoinModal(false);
    setError('');
    if (linkCode) navigate('/', { replace: true });
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const name = playerName.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name || code.length !== 6) return;

    setIsJoining(true);
    setError('');
    const res = await emitAck<Ack & { code?: string }>(socket, 'join-game', { code, name });
    setIsJoining(false);

    if (res.success && res.code) {
      saveName(name);
      navigate(`/lobby/${res.code}`, { replace: Boolean(linkCode) });
    } else {
      setError(res.error || 'Greška pri spajanju');
    }
  };

  const handleQuickJoin = (code: string) => {
    setJoinCode(code);
    setError('');
    setShowJoinModal(true);
  };

  const handleLeaveSession = () => {
    if (!session) return;
    setConfirm({
      title: session.isHost ? 'Zatvoriti sobu?' : 'Napustiti sobu?',
      message: session.isHost ? 'Svi igrači bit će izbačeni iz sobe.' : undefined,
      confirmLabel: session.isHost ? 'Zatvori' : 'Napusti',
      danger: true,
      onConfirm: async () => {
        await emitAck(socket, session.isHost ? 'delete-game' : 'leave-game', { code: session.code });
        refresh();
      },
    });
  };

  const dismissNotice = () => navigate(location.pathname, { replace: true });

  return (
    <div className="page page-center home-page">
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="notice-close" onClick={dismissNotice} aria-label="Zatvori">
            ✕
          </button>
        </div>
      )}

      <div className="animate-in">
        <h1 className="logo animate-float">MAFIA</h1>
        <p className="tagline">Tko je ubojica među nama?</p>
      </div>

      {session && (
        <div className="reconnect-banner animate-in">
          <p>
            {session.isHost ? 'Vodiš sobu' : 'Nalaziš se u sobi'} <strong>{session.code}</strong>
          </p>
          <div className="reconnect-buttons">
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => navigate(`/lobby/${session.code}`)}
            >
              Vrati se
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={handleLeaveSession}>
              {session.isHost ? 'Zatvori sobu' : 'Napusti'}
            </button>
          </div>
        </div>
      )}

      <div className="home-buttons animate-in" style={{ animationDelay: '0.2s' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/create')}
          disabled={!isConnected}
        >
          Nova Igra
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowJoinModal(true)}
          disabled={!isConnected}
        >
          Pridruži se
        </button>
      </div>

      {isConnected && availableGames.length > 0 && (
        <div className="available-games animate-in" style={{ animationDelay: '0.4s' }}>
          <h3>Aktivne sobe</h3>
          <div className="games-list">
            {availableGames.map(game => (
              <button
                type="button"
                key={game.code}
                className="game-item"
                onClick={() => handleQuickJoin(game.code)}
              >
                <span className="game-code">{game.code}</span>
                <span className="game-players">{game.playerCount}/{game.totalSlots} igrača</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={closeJoinModal}>
          <form className="card modal" onClick={e => e.stopPropagation()} onSubmit={handleJoin}>
            <h2>Pridruži se igri</h2>

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="player-name">Tvoje ime</label>
              <input
                id="player-name"
                type="text"
                className="input"
                placeholder="Unesi ime..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={20}
                autoComplete="nickname"
                autoCapitalize="words"
                enterKeyHint="next"
                autoFocus={!playerName}
              />
            </div>

            <div className="input-group">
              <label htmlFor="room-code">Kod sobe</label>
              <input
                id="room-code"
                type="text"
                className="input input-code"
                placeholder="ABC123"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                autoFocus={Boolean(playerName) && !joinCode}
              />
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="modal-buttons">
              <button type="button" className="btn btn-secondary" onClick={closeJoinModal}>
                Odustani
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={joinCode.trim().length !== 6 || !playerName.trim() || isJoining}
              >
                {isJoining ? 'Spajam...' : 'Uđi'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal options={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
