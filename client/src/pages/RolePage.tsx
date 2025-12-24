import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../socket';

type Role = 'mafia' | 'doktor' | 'kurva' | 'policajac' | 'civil';

interface RoleInfo {
  icon: string;
  name: string;
  description: string;
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
    description: 'Ti zavodiš. Svake noći možeš spavati s jednim igračem.'
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

export default function RolePage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const role = location.state?.role as Role;
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealed(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!socket || !code) return;

    const handleGameRestarted = () => {
      navigate(`/lobby/${code}`);
    };

    socket.on('game-restarted', handleGameRestarted);

    return () => {
      socket.off('game-restarted', handleGameRestarted);
    };
  }, [socket, code, navigate]);

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
        
        <div className={`card role-card role-${role} ${isRevealed ? 'role-revealed' : 'role-hidden'}`}>
          <div className="role-icon-large">{info.icon}</div>
          <h1 className="role-title">{info.name}</h1>
          <p className="role-description">{info.description}</p>
        </div>

        <div className="role-warning">
          <span>🤫</span>
          <span>Ne pokazuj svoj ekran drugim igračima!</span>
        </div>
      </div>
    </div>
  );
}
