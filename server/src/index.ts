import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import path from "path";
import {
  createGame,
  getGame,
  findMembership,
  joinGame,
  removePlayer,
  updateRoles,
  startGame,
  restartGame,
  setDead,
  getWinner,
  getAvailableGames,
  deleteGame,
  startCleanupInterval,
} from "./gameManager";
import {
  sanitizeClientId,
  sanitizeCode,
  sanitizeName,
  sanitizeRoleConfig,
} from "./validation";
import { Game, Player } from "./types";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../static")));

app.get("{*splat}", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(__dirname, "../static/index.html"));
});

type Reply = (response: object) => void;

// Every device has its own room, so events reach it after any reconnect.
const clientRoom = (secret: string) => `client:${secret}`;

function isConnected(secret: string): boolean {
  return (io.sockets.adapter.rooms.get(clientRoom(secret))?.size ?? 0) > 0;
}

function hostView(game: Game) {
  return {
    code: game.code,
    isHost: true,
    started: game.started,
    roleConfig: game.roleConfig,
    winner: getWinner(game),
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: isConnected(p.secret),
      role: p.role ?? null,
      dead: p.dead,
    })),
  };
}

function playerView(game: Game, me: Player) {
  return {
    code: game.code,
    isHost: false,
    started: game.started,
    roleConfig: game.roleConfig,
    winner: getWinner(game),
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: isConnected(p.secret),
      dead: p.dead,
    })),
    you: { id: me.id, name: me.name, role: me.role ?? null, dead: me.dead },
  };
}

function broadcastState(game: Game) {
  io.to(clientRoom(game.hostSecret)).emit("game-state", hostView(game));
  game.players.forEach((p) => {
    io.to(clientRoom(p.secret)).emit("game-state", playerView(game, p));
  });
}

function notifyDeleted(game: Game, skipSecret?: string) {
  const rooms = [game.hostSecret, ...game.players.map((p) => p.secret)]
    .filter((s) => s !== skipSecret)
    .map(clientRoom);
  if (rooms.length) io.to(rooms).emit("game-deleted", {});
}

function leaveCurrentGame(secret: string) {
  const membership = findMembership(secret);
  if (!membership || membership.isHost) return;
  removePlayer(membership.game, (p) => p.secret === secret);
  broadcastState(membership.game);
}

io.use((socket, next) => {
  const clientId = sanitizeClientId(socket.handshake.auth?.clientId);
  if (!clientId) return next(new Error("Invalid client id"));
  socket.data.clientId = clientId;
  next();
});

io.on("connection", (socket: Socket) => {
  const secret: string = socket.data.clientId;
  console.log(`Client connected: ${socket.id}`);
  socket.join(clientRoom(secret));

  const membership = findMembership(secret);
  if (membership) broadcastState(membership.game);

  // Wraps a handler so malformed payloads or a missing ack can't crash the server.
  const on = (event: string, handler: (payload: any, reply: Reply) => void) => {
    socket.on(event, (...args: unknown[]) => {
      const last = args[args.length - 1];
      const reply: Reply = typeof last === "function" ? (last as Reply) : () => {};
      const payload = typeof args[0] === "function" ? undefined : args[0];
      try {
        handler(payload ?? {}, reply);
      } catch (err) {
        console.error(`Error handling ${event}:`, err);
        reply({ success: false, error: "Greška na serveru" });
      }
    });
  };

  // Resolves the game from the payload and checks the caller belongs to it.
  const resolve = (payload: any, reply: Reply, requireHost: boolean) => {
    const code = sanitizeCode(payload.code);
    const game = code ? getGame(code) : undefined;
    if (!game) {
      reply({ success: false, error: "Soba ne postoji", gone: true });
      return null;
    }
    const isHost = game.hostSecret === secret;
    if (requireHost && !isHost) {
      reply({ success: false, error: "Samo voditelj to može" });
      return null;
    }
    if (!isHost && !game.players.some((p) => p.secret === secret)) {
      reply({ success: false, error: "Nisi u ovoj sobi", notMember: true, started: game.started });
      return null;
    }
    return game;
  };

  on("create-game", (payload, reply) => {
    const roleConfig = sanitizeRoleConfig(payload.roleConfig);
    if (typeof roleConfig === "string") {
      reply({ success: false, error: roleConfig });
      return;
    }

    const existing = findMembership(secret);
    if (existing?.isHost) {
      reply({ success: false, error: "Već vodiš sobu", redirect: existing.game.code });
      return;
    }
    leaveCurrentGame(secret);

    const game = createGame(secret, roleConfig);
    broadcastState(game);
    reply({ success: true, code: game.code });
  });

  on("join-game", (payload, reply) => {
    const code = sanitizeCode(payload.code);
    const name = sanitizeName(payload.name);
    if (!code) {
      reply({ success: false, error: "Neispravan kod sobe" });
      return;
    }
    if (!name) {
      reply({ success: false, error: "Unesi ime (do 20 znakova)" });
      return;
    }
    const game = getGame(code);
    if (!game) {
      reply({ success: false, error: "Soba ne postoji" });
      return;
    }

    const existing = findMembership(secret);
    if (existing?.isHost) {
      reply({
        success: false,
        error: "Ne možeš se pridružiti dok vodiš sobu",
        redirect: existing.game.code,
      });
      return;
    }
    if (existing && existing.game !== game) leaveCurrentGame(secret);

    const error = joinGame(game, secret, name);
    if (error) {
      reply({ success: false, error });
      return;
    }

    broadcastState(game);
    reply({ success: true, code: game.code });
  });

  on("sync-game", (payload, reply) => {
    const game = resolve(payload, reply, false);
    if (!game) return;
    const me = game.players.find((p) => p.secret === secret);
    reply({ success: true, state: me ? playerView(game, me) : hostView(game) });
  });

  on("get-session", (_payload, reply) => {
    const membership = findMembership(secret);
    reply({
      success: true,
      session: membership ? { code: membership.game.code, isHost: membership.isHost } : null,
    });
  });

  on("get-available-games", (_payload, reply) => {
    reply({ success: true, games: getAvailableGames(secret) });
  });

  on("update-roles", (payload, reply) => {
    const game = resolve(payload, reply, true);
    if (!game) return;
    const roleConfig = sanitizeRoleConfig(payload.roleConfig);
    if (typeof roleConfig === "string") {
      reply({ success: false, error: roleConfig });
      return;
    }
    const error = updateRoles(game, roleConfig);
    if (error) {
      reply({ success: false, error });
      return;
    }
    broadcastState(game);
    reply({ success: true });
  });

  on("kick-player", (payload, reply) => {
    const game = resolve(payload, reply, true);
    if (!game) return;
    const kicked = removePlayer(game, (p) => p.id === payload.playerId);
    if (!kicked) {
      reply({ success: false, error: "Igrač nije pronađen" });
      return;
    }
    io.to(clientRoom(kicked.secret)).emit("kicked", {});
    broadcastState(game);
    reply({ success: true });
  });

  on("start-game", (payload, reply) => {
    const game = resolve(payload, reply, true);
    if (!game) return;
    const error = startGame(game);
    if (error) {
      reply({ success: false, error });
      return;
    }
    broadcastState(game);
    reply({ success: true });
  });

  on("restart-game", (payload, reply) => {
    const game = resolve(payload, reply, true);
    if (!game) return;
    restartGame(game);
    broadcastState(game);
    reply({ success: true });
  });

  on("set-dead", (payload, reply) => {
    const game = resolve(payload, reply, true);
    if (!game) return;
    const error = setDead(game, payload.playerId, payload.dead === true);
    if (error) {
      reply({ success: false, error });
      return;
    }
    broadcastState(game);
    reply({ success: true });
  });

  on("leave-game", (payload, reply) => {
    const game = resolve(payload, reply, false);
    if (!game) return;
    if (game.hostSecret === secret) {
      reply({ success: false, error: "Voditelj ne može napustiti sobu, može je samo zatvoriti" });
      return;
    }
    removePlayer(game, (p) => p.secret === secret);
    broadcastState(game);
    reply({ success: true });
  });

  on("delete-game", (payload, reply) => {
    const game = resolve(payload, reply, true);
    if (!game) return;
    notifyDeleted(game, secret);
    deleteGame(game.code);
    reply({ success: true });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const membership = findMembership(secret);
    if (membership) broadcastState(membership.game);
  });
});

const PORT = Number(process.env.PORT) || 9999;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  startCleanupInterval((game) => {
    notifyDeleted(game);
    console.log(`Expired game ${game.code} deleted and players notified`);
  });
});
