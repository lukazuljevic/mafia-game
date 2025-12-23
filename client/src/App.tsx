import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './socket';
import HomePage from './pages/HomePage';
import CreateGamePage from './pages/CreateGamePage';
import LobbyPage from './pages/LobbyPage';
import RolePage from './pages/RolePage';

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateGamePage />} />
          <Route path="/lobby/:code" element={<LobbyPage />} />
          <Route path="/role/:code" element={<RolePage />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}
