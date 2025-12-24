import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../socket';

interface AvailableGame {
  code: string;
  playerCount: number;
  totalSlots: number;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const fetchGames = () => {
      socket.emit('get-available-games', (response: { success: boolean; games: AvailableGame[] }) => {
        if (response.success) {
          setAvailableGames(response.games);
        }
      });
    };

    fetchGames();
    const interval = setInterval(fetchGames, 5000);

    return () => clearInterval(interval);
  }, [socket, isConnected]);

  const handleJoin = () => {
    if (!socket || !joinCode.trim() || !playerName.trim()) return;
    
    setIsJoining(true);
    setError('');
    
    socket.emit('join-game', { code: joinCode.toUpperCase(), name: playerName }, 
      (response: { success: boolean; error?: string; game?: { code: string } }) => {
        if (response.success && response.game) {
          navigate(`/lobby/${response.game.code}`, { state: { playerName } });
        } else {
          setError(response.error || 'Greška pri spajanju');
        }
        setIsJoining(false);
      }
    );
  };

  const handleQuickJoin = (code: string) => {
    setJoinCode(code);
    setShowJoinModal(true);
  };

  return (
    <div className="page page-center home-page">
      <div className="animate-in">
        <h1 className="logo animate-float">MAFIA</h1>
        <p className="tagline">Tko je ubojica među nama?</p>
      </div>

      <div className="home-buttons animate-in" style={{ animationDelay: '0.2s' }}>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/create')}
          disabled={!isConnected}
        >
          Nova Igra
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => setShowJoinModal(true)}
          disabled={!isConnected}
        >
          Pridruži se
        </button>
      </div>

      {!isConnected && (
        <p style={{ marginTop: '20px', color: 'var(--color-text-muted)' }}>
          Spajanje na server...
        </p>
      )}

      {isConnected && availableGames.length > 0 && (
        <div className="available-games animate-in" style={{ animationDelay: '0.4s' }}>
          <h3>Aktivne sobe</h3>
          <div className="games-list">
            {availableGames.map(game => (
              <button
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
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="card modal" onClick={e => e.stopPropagation()}>
            <h2>Pridruži se igri</h2>
            
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Tvoje ime</label>
              <input
                type="text"
                className="input"
                placeholder="Unesi ime..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </div>

            <div className="input-group">
              <label>Kod sobe</label>
              <input
                type="text"
                className="input"
                placeholder="ABC123"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
              />
            </div>

            {error && (
              <p style={{ color: '#ff4444', marginTop: '12px', fontSize: '14px' }}>{error}</p>
            )}

            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => setShowJoinModal(false)}>
                Odustani
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleJoin}
                disabled={!joinCode.trim() || !playerName.trim() || isJoining}
              >
                {isJoining ? 'Spajam...' : 'Pridruži se'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
