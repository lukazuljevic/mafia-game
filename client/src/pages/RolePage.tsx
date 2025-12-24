import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../socket';

type Role = 'mafia' | 'doktor' | 'kurva' | 'policajac' | 'civil';

interface RoleInfo {
  icon: string;
  name: string;
  description: string;
}

interface PlayerRole {
  name: string;
  role: string;
}

const ROLE_INFO: Record<Role, RoleInfo> = {
  mafia: {
    icon: '🔫',
    name: 'Mafia',
    description: 'Ti si ubojica. Svake noći možeš eliminirati jednog igrača. Ostani skriven.'
  },
  doktor: {
    icon: '💉',
    name: 'Doktor',
    description: 'Ti liječiš. Svake noći možeš spasiti jednog igrača od mafije.'
  },
  kurva: {
    icon: '💋',
    name: 'Kurva',
    description: 'Ti zavodiš. Svake noći možeš blokirati moć jednog igrača.'
  },
  policajac: {
    icon: '🔍',
    name: 'Policajac',
    description: 'Ti istražuješ. Svake noći možeš provjeriti je li netko mafia.'
  },
  civil: {
    icon: '👤',
    name: 'Civil',
    description: 'Ti si običan građanin. Tvoj glas na glasanju je tvoja jedina moć.'
  }
};

const ROLE_ICONS: Record<string, string> = {
  mafia: '🔫',
  doktor: '💉',
  kurva: '💋',
  policajac: '🔍',
  civil: '👤'
};

export default function RolePage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const role = location.state?.role as Role;
  const [isHost] = useState(location.state?.isHost || false);
  const [allRoles, setAllRoles] = useState<PlayerRole[]>([]);
  const [showRoles, setShowRoles] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (!socket || !code) return;

    // Listen for game restart
    socket.on('game-restarted', () => {
      navigate(`/lobby/${code}`, { state: { isHost } });
    });

    // If host, fetch all roles
    if (isHost) {
      socket.emit('get-all-roles', code, (response: { success: boolean; roles?: PlayerRole[] }) => {
        if (response.success && response.roles) {
          setAllRoles(response.roles);
        }
      });
    }

    return () => {
      socket.off('game-restarted');
    };
  }, [socket, code, isHost, navigate]);

  const handleRestart = () => {
    if (!socket || !code) return;
    
    setIsRestarting(true);
    socket.emit('restart-game', code, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error(response.error);
        setIsRestarting(false);
      }
      // Navigation will happen via 'game-restarted' event
    });
  };

  if (!role || !ROLE_INFO[role]) {
    return (
      <div className="page page-center">
        <div className="card">
          <h2>Greška</h2>
          <p>Uloga nije pronađena</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Povratak
          </button>
        </div>
      </div>
    );
  }

  const info = ROLE_INFO[role];

  return (
    <div className="page role-page">
      <div className="role-reveal-container">
        <p className="role-reveal-intro">Tvoja tajna uloga</p>
        
        <div className={`card role-card role-${role}`}>
          <div className="role-icon-large">{info.icon}</div>
          <h1 className="role-title">{info.name}</h1>
          <p className="role-description">{info.description}</p>
        </div>

        <div className="role-warning">
          <span>🤫</span>
          <span>Ne pokazuj svoj ekran drugim igračima!</span>
        </div>

        {isHost && (
          <div className="host-panel">
            <h3 className="host-panel-title">👑 Host Panel</h3>
            
            <button 
              className="btn btn-secondary"
              onClick={() => setShowRoles(!showRoles)}
            >
              {showRoles ? '🙈 Sakrij uloge' : '👀 Prikaži sve uloge'}
            </button>

            {showRoles && allRoles.length > 0 && (
              <div className="all-roles-list">
                {allRoles.map((player, index) => (
                  <div key={index} className="role-list-item">
                    <span className="role-list-icon">{ROLE_ICONS[player.role] || '❓'}</span>
                    <span className="role-list-name">{player.name}</span>
                    <span className={`role-list-role role-tag-${player.role}`}>
                      {player.role.charAt(0).toUpperCase() + player.role.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button 
              className="btn btn-danger"
              onClick={handleRestart}
              disabled={isRestarting}
            >
              {isRestarting ? '⏳ Restartiram...' : '🔄 Restartaj igru'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
