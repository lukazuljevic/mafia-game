import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider, useSocket } from './socket';
import HomePage from './pages/HomePage';
import CreateGamePage from './pages/CreateGamePage';
import LobbyPage from './pages/LobbyPage';
import RolePage from './pages/RolePage';

function ConnectionBanner() {
  const { isConnected } = useSocket();
  if (isConnected) return null;
  return (
    <div className="connection-banner" role="status">
      Spajanje na server…
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <ConnectionBanner />
        <Routes>
          <Route path="/" element={<HomePage key="home" />} />
          <Route path="/join/:code" element={<HomePage key="join" />} />
          <Route path="/create" element={<CreateGamePage />} />
          <Route path="/lobby/:code" element={<LobbyPage />} />
          <Route path="/role/:code" element={<RolePage />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}
