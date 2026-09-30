import { io, Socket } from 'socket.io-client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getClientId } from './game';

interface SocketContextType {
  socket: Socket;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState(() =>
    io(window.location.origin, { auth: { clientId: getClientId() }, autoConnect: false })
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside SocketProvider');
  return context;
}
