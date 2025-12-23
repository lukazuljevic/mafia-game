import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../socket';

interface Player {
  id: string;
  name: string;
}

interface RoleConfig {
  mafia: number;
  doktor: number;
  kurva: number;
  policajac: number;
  civil: number;
}

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(location.state?.isHost || false);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null>(location.state?.roleConfig || null);
  const [isStarting, setIsStarting] = useState(false);

  const totalSlots = roleConfig 
    ? roleConfig.mafia + roleConfig.doktor + roleConfig.kurva + roleConfig.policajac + roleConfig.civil
    : 0;

  useEffect(() => {
    if (!socket || !code) return;

    socket.emit('get-game-info', code, (response: { 
      success: boolean; 
      game?: { 
        players: Player[]; 
        roleConfig: RoleConfig;
        isHost: boolean;
        started: boolean;
      } 
    }) => {
      if (response.success && response.game) {
        setPlayers(response.game.players);
        setRoleConfig(response.game.roleConfig);
        setIsHost(response.game.isHost);
        if (response.game.started) {
          navigate(`/role/${code}`);
        }
      }
    });

    socket.on('player-joined', ({ players: newPlayers }: { players: Player[] }) => {
      setPlayers(newPlayers);
    });

    socket.on('player-left', ({ players: newPlayers }: { players: Player[] }) => {
      setPlayers(newPlayers);
    });

    socket.on('game-started', ({ role }: { role: string }) => {
      navigate(`/role/${code}`, { state: { role } });
    });

    return () => {
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('game-started');
    };
  }, [socket, code, navigate]);

  const handleStartGame = () => {
    if (!socket || !code) return;
    
    setIsStarting(true);
    socket.emit('start-game', code, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error(response.error);
      }
      setIsStarting(false);
    });
  };

  const canStart = players.length === totalSlots && isHost;

  return (
    <div className="page lobby-page">
      <button className="back-button" onClick={() => navigate('/')}>←</button>
      
      <div className="container">
        <div className="room-code-display">
          <div className="room-code-label">Kod sobe</div>
          <div className="room-code animate-glow">{code}</div>
        </div>

        <div className="players-section">
          <h2>Igrači ({players.length}/{totalSlots})</h2>
          
          <div className="players-list">
            {players.map((player, index) => (
              <div key={player.id} className="player-item">
                <div className="player-avatar">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="player-name">{player.name}</span>
                {index === 0 && <span className="player-host">Host</span>}
              </div>
            ))}
          </div>

          {players.length < totalSlots && (
            <div className="waiting-status">
              <span>Čekanje igrača...</span>
            </div>
          )}
        </div>

        {isHost && (
          <button 
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={!canStart || isStarting}
          >
            {isStarting ? 'Pokrećem...' : canStart ? 'Pokreni Igru' : `Čekaj još ${totalSlots - players.length} igrača`}
          </button>
        )}
      </div>
    </div>
  );
}
