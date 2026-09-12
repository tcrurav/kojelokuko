import { createServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { app, authenticate, errorPayload } from "./app";
import { db, Game } from "./db";
import { accountEvents, ensureAdministrator } from "./administration";
import { command, snapshot, Identity, expire, gameEvents } from "./services";
const http = createServer(app);
const io = new Server(http, {
  transports: ["polling", "websocket"],
  maxHttpBufferSize: 16384,
});
const positive = z.number().int().positive();
const schemas: Record<string, z.ZodType> = {
  "team:request": z
    .object({ targetPlayerId: positive, position: z.enum(["LEFT", "RIGHT"]) })
    .strict(),
  "team:respond": z
    .object({ requestId: positive, accept: z.boolean() })
    .strict(),
  "team:cancel": z.object({}).strict(),
  "team:set-name": z
    .object({ name: z.string().trim().min(1).max(60) })
    .strict(),
  "game:start": z
    .object({ confirmSpectators: z.boolean().optional() })
    .strict(),
  "question:start": z.object({}).strict(),
  "question:finish": z.object({}).strict(),
  "game:finish": z.object({}).strict(),
  "ranking:set-view": z.object({ view: z.enum(["teams", "hidden"]) }).strict(),
  "answer:submit": z.object({ gameQuestionId: positive }).strict(),
};
io.use((socket, next) => {
  void (async () => {
    const auth = z
      .object({
        token: z.string().min(1).max(2000),
        kind: z.enum(["teacher", "player"]),
        gameId: positive,
      })
      .parse(socket.handshake.auth);
    socket.data.identity = await authenticate(auth.token, auth.kind);
    socket.data.gameId = auth.gameId;
    await snapshot(socket.data.identity, auth.gameId);
    next();
  })().catch(() => next(new Error("unauthorized")));
});
const publications = new Map<number, Promise<void>>();
accountEvents.on("changed", (id: number) => {
  for (const socket of io.sockets.sockets.values()) {
    const who = socket.data.identity as Identity;
    if (who.kind === "teacher" && who.id === id) {
      socket.emit("game:error", { error: "unauthorized" });
      socket.disconnect(true);
    }
  }
});
gameEvents.on("expired", (gameId: number) => {
  void publish(gameId).catch(() => console.error("expiry_publish_failed"));
});
function publish(gameId: number): Promise<void> {
  const next = (publications.get(gameId) || Promise.resolve())
    .catch(() => undefined)
    .then(() => publishSnapshot(gameId));
  publications.set(gameId, next);
  void next
    .finally(() => {
      if (publications.get(gameId) === next) publications.delete(gameId);
    })
    .catch(() => undefined);
  return next;
}
async function publishSnapshot(gameId: number) {
  const sockets = await io.in("game:" + gameId).fetchSockets();
  const connected = sockets
    .filter((s) => (s.data.identity as Identity).kind === "player")
    .map((s) => (s.data.identity as Identity).id);
  await Promise.all(
    sockets.map(async (s) => {
      try {
        await authenticate(
          String(s.handshake.auth.token),
          String(s.handshake.auth.kind),
        );
        s.emit(
          "game:state",
          await snapshot(s.data.identity, gameId, connected),
        );
      } catch {
        s.emit("game:error", { error: "state_unavailable" });
      }
    }),
  );
}
io.on("connection", (socket) => {
  const gameId = socket.data.gameId as number;
  void socket.join("game:" + gameId);
  console.info("socket_connected", {
    gameId,
    transport: socket.conn.transport.name,
  });
  void publish(gameId).catch(() => console.error("publish_failed"));
  let count = 0;
  let windowStart = Date.now();
  socket.on("game:resume", () => {
    void publish(gameId).catch(() => console.error("resume_failed"));
  });
  for (const [event, schema] of Object.entries(schemas))
    socket.on(event, (raw: unknown, ack: unknown) => {
      const reply = (data: unknown) => {
        if (typeof ack === "function") ack(data);
      };
      if (Date.now() - windowStart > 1000) {
        count = 0;
        windowStart = Date.now();
      }
      if (++count > 30) {
        reply({ error: "busy" });
        return;
      }
      void (async () => {
        const payload = schema.parse(raw) as Record<string, unknown>;
        await authenticate(
          String(socket.handshake.auth.token),
          String(socket.handshake.auth.kind),
        );
        await command(socket.data.identity, gameId, event, payload);
        await publish(gameId);
        reply({ ok: true });
        console.info("game_command", { gameId, event });
      })().catch((error) => reply({ error: errorPayload(error).error }));
    });
  socket.on("disconnect", () => {
    console.info("socket_disconnected", { gameId });
    void publish(gameId).catch(() => console.error("publish_failed"));
  });
});
let checking = false;
const timer = setInterval(() => {
  if (checking) return;
  checking = true;
  void (async () => {
    const games = await Game.findAll({ where: { status: "QUESTION_ACTIVE" } });
    for (const game of games) await expire(game.id);
  })()
    .catch(() => console.error("expiry_check_failed"))
    .finally(() => {
      checking = false;
    });
}, 250);
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("Set JWT_SECRET (32+ characters)");
  await db.authenticate();
  await ensureAdministrator();
  http.listen(Number(process.env.PORT || 3000), () =>
    console.info("server_ready"),
  );
}
void start().catch((error) => {
  console.error("startup_failed", error.message);
  clearInterval(timer);
  process.exitCode = 1;
});
process.on("SIGTERM", () => {
  clearInterval(timer);
  io.close();
  http.close(() => {
    void db.close();
  });
});
