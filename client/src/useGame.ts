import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from './socket';
import { emitAck, type Ack, type GameState } from './game';

// Keeps a page in sync with the server's view of the game, surviving refreshes and reconnects.
export function useGame(code: string) {
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    const onState = (next: GameState) => {
      if (next.code === code) setState(next);
    };
    const onDeleted = () => {
      navigate('/', { replace: true, state: { notice: 'Voditelj je zatvorio sobu' } });
    };
    const onKicked = () => {
      navigate('/', { replace: true, state: { notice: 'Voditelj te uklonio iz sobe' } });
    };

    socket.on('game-state', onState);
    socket.on('game-deleted', onDeleted);
    socket.on('kicked', onKicked);

    return () => {
      socket.off('game-state', onState);
      socket.off('game-deleted', onDeleted);
      socket.off('kicked', onKicked);
    };
  }, [socket, code, navigate]);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;

    emitAck<Ack & { state?: GameState; started?: boolean }>(socket, 'sync-game', { code }).then(res => {
      if (cancelled) return;
      if (res.success && res.state) {
        setState(res.state);
      } else if (res.notMember && !res.started) {
        navigate(`/join/${code}`, { replace: true });
      } else if (res.notMember || res.gone) {
        navigate('/', { replace: true, state: { notice: res.error } });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [socket, isConnected, code, navigate]);

  const send = useCallback(
    (event: string, extra: object = {}) => emitAck(socket, event, { code, ...extra }),
    [socket, code]
  );

  return { state, send, isConnected };
}
