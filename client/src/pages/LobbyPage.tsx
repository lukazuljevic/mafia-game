import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../socket';

interface Player {
  id: string;
  name: string;
  role?: string;
}

interface RoleConfig {
  mafia: number;
  doktor: number;
  kurva: number;
  policajac: number;
  civil: number;
}

const ROLE_ICONS: Record<string, string> = {
  mafia: '🔫',
  doktor: '💉',
  kurva: '💋',
  policajac: '🔍',
  civil: '👤'
};

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(location.state?.isHost || false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null>(location.state?.roleConfig || null);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

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
        hostId: string;
      } 
    }) => {
      if (response.success && response.game) {
        setPlayers(response.game.players);
        setRoleConfig(response.game.roleConfig);
        setIsHost(response.game.isHost);
        setHostId(response.game.hostId);
        setGameStarted(response.game.started);
      }
    });

    socket.on('player-joined', ({ players: newPlayers, hostId: newHostId }: { players: Player[]; hostId: string }) => {
      setPlayers(newPlayers);
      if (newHostId) setHostId(newHostId);
    });

    socket.on('player-left', ({ players: newPlayers }: { players: Player[] }) => {
      setPlayers(newPlayers);
    });

    socket.on('game-started', ({ role, isHost: playerIsHost }: { role: string | null; isHost: boolean }) => {
      if (playerIsHost) {
        // Host stays on this page, fetch roles
        socket.emit('get-all-roles', code, (response: { success: boolean; roles?: { name: string; role: string }[] }) => {
          if (response.success && response.roles) {
            setPlayers(prev => prev.map(p => {
              const roleInfo = response.roles?.find(r => r.name === p.name);
              return roleInfo ? { ...p, role: roleInfo.role } : p;
            }));
            setGameStarted(true);
          }
        });
      } else {
        // Players go to role page
        navigate(`/role/${code}`, { state: { role, isHost: false } });
      }
    });

    socket.on('game-restarted', ({ players: newPlayers, roleConfig: newRoleConfig }: { players: Player[]; roleConfig: RoleConfig }) => {
      setPlayers(newPlayers.map(p => ({ id: p.id, name: p.name })));
      setRoleConfig(newRoleConfig);
      setGameStarted(false);
    });

    return () => {
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('game-started');
      socket.off('game-restarted');
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

  const handleStopGame = () => {
    if (!socket || !code) return;
    
    socket.emit('restart-game', code, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error(response.error);
      }
    });
  };

  const handleCopyCode = async () => {
    if (!code) return;
    
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canStart = players.length === totalSlots && isHost && !gameStarted;

  return (
    <div className="page lobby-page">
      <button className="back-button" onClick={() => navigate('/')}>←</button>
      
      <div className="container">
        <div className="room-code-display">
          <div className="room-code-label">Kod sobe</div>
          <div className="room-code animate-glow">{code}</div>
          
          <div className="share-buttons">
            <button className="btn btn-secondary btn-small" onClick={handleCopyCode}>
              {copied ? '✓ Kopirano!' : '📋 Kopiraj kod'}
            </button>
          </div>
        </div>

        <div className="players-section">
          <h2>Igrači ({players.length}/{totalSlots})</h2>
          
          <div className="players-list">
            {players.map((player) => (
              <div key={player.id} className="player-item">
                <div className="player-avatar">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="player-name">{player.name}</span>
                {player.id === hostId && <span className="player-host">Host</span>}
                {gameStarted && isHost && player.role && (
                  <span className={`player-role role-tag-${player.role}`}>
                    {ROLE_ICONS[player.role]} {player.role.charAt(0).toUpperCase() + player.role.slice(1)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {!gameStarted && players.length < totalSlots && (
            <div className="waiting-status">
              <span>Čekanje igrača...</span>
            </div>
          )}
        </div>

        {isHost && !gameStarted && (
          <button 
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={!canStart || isStarting}
          >
            {isStarting ? 'Pokrećem...' : canStart ? 'Pokreni Igru' : `Čekaj još ${totalSlots - players.length} igrača`}
          </button>
        )}

        {isHost && gameStarted && (
          <button 
            className="btn btn-danger"
            onClick={handleStopGame}
          >
            🛑 Zaustavi igru
          </button>
        )}
      </div>
    </div>
  );
}
