import { test } from "node:test";
import assert from "node:assert/strict";
import { io, Socket } from "socket.io-client";
import type { State, Game } from "../../frontend/src/types";
const base = process.env.TEST_URL || "http://localhost";
test(
  "ocho jugadores sincronizan sin agotar el pool y los espectadores no responden",
  { timeout: 30000 },
  async () => {
    const sockets: Socket[] = [];
    try {
      const teacherSession = await http<{ token: string }>("/auth/register", {
        name: "Carga",
        email: `pool-${Date.now()}@example.test`,
        password: "Pool-regression-12345",
      });
      const game = (
        await http<Game>(
          "/games",
          { questionCount: 1, questionDurationSeconds: 10 },
          teacherSession.data.token,
        )
      ).data;
      const teacher = await connect(
        teacherSession.data.token,
        "teacher",
        game.id,
      );
      sockets.push(teacher);
      const sessions = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          http<{ token: string; playerId: number }>("/join", {
            code: game.code,
            name: "Jugador " + i,
            avatar: "🐙",
          }),
        ),
      );
      const players = await Promise.all(
        sessions.map((s) => connect(s.data.token, "player", game.id)),
      );
      sockets.push(...players);
      const snapshots = await Promise.all(
        players.map((p) => state(p, (s) => s.players.length === 8)),
      );
      assert.ok(snapshots.every((s) => s.game.id === game.id));
      assert.equal(
        (
          await emit(players[0], "team:request", {
            targetPlayerId: sessions[1].data.playerId,
            position: "RIGHT",
          })
        ).ok,
        true,
      );
      const request = (await state(players[1], (s) => s.requests.length === 1))
        .requests[0];
      assert.equal(
        (
          await emit(players[1], "team:respond", {
            requestId: request.id,
            accept: true,
          })
        ).ok,
        true,
      );
      assert.equal(
        (await emit(teacher, "game:start")).error,
        "confirm_spectators",
      );
      assert.equal(
        (await emit(teacher, "game:start", { confirmSpectators: true })).ok,
        true,
      );
      assert.equal((await emit(teacher, "question:start")).ok, true);
      const active = await state(
        players[2],
        (s) => s.game.status === "QUESTION_ACTIVE",
      );
      assert.equal(
        (
          await emit(players[2], "answer:submit", {
            gameQuestionId: active.question!.id,
          })
        ).error,
        "spectator",
      );
      await emit(teacher, "question:finish");
      await emit(teacher, "ranking:set-view", { view: "teams" });
      await emit(teacher, "game:finish");
    } finally {
      for (const s of sockets) s.disconnect();
    }
  },
);
async function http<T>(path: string, body?: unknown, token?: string) {
  const response = await fetch(base + "/api" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (token || ""),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: (await response.json()) as T };
}
function emit(
  socket: Socket,
  event: string,
  data: unknown = {},
): Promise<{ ok?: boolean; error?: string }> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(8000)
      .emit(
        event,
        data,
        (e: Error | null, r: { ok?: boolean; error?: string }) =>
          e ? reject(e) : resolve(r),
      ),
  );
}
async function connect(token: string, kind: string, gameId: number) {
  const socket = io(base, {
    transports: ["polling"],
    upgrade: false,
    forceNew: true,
    auth: { token, kind, gameId },
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  assert.equal(socket.io.engine.transport.name, "polling");
  return socket;
}
async function state(
  socket: Socket,
  predicate: (s: State) => boolean = () => true,
): Promise<State> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("game:state", onState);
      reject(new Error("State timeout for " + predicate.toString()));
    }, 8000);
    function onState(s: State) {
      if (predicate(s)) {
        clearTimeout(timer);
        socket.off("game:state", onState);
        resolve(s);
      }
    }
    socket.on("game:state", onState);
    socket.emit("game:resume");
  });
}
test(
  "partida completa de 5 preguntas con cuatro jugadores, polling, carreras y reconexión",
  { timeout: 90000 },
  async () => {
    const sockets: Socket[] = [];
    try {
      assert.equal((await http("/health")).status, 200);
      const email = `integration-${Date.now()}@example.test`;
      const password = "Integration-only-12345";
      const registered = await http<{ token: string }>("/auth/register", {
        name: "Prueba automática",
        email,
        password,
      });
      assert.equal(registered.status, 201);
      const logged = await http<{ token: string }>("/auth/login", {
        email,
        password,
      });
      assert.equal(logged.status, 200);
      const token = logged.data.token;
      assert.equal(
        (await http("/auth/login", { email, password: "wrong-password" }))
          .status,
        401,
      );
      const me = await http<Record<string, unknown>>(
        "/auth/me",
        undefined,
        token,
      );
      assert.equal(me.status, 200);
      assert.equal(me.data.passwordHash, undefined);
      const made = await http<Game>(
        "/games",
        { questionCount: 5, questionDurationSeconds: 10 },
        token,
      );
      assert.equal(made.status, 201);
      const game = made.data;
      const other = await http<{ token: string }>("/auth/register", {
        name: "Otro profesor",
        email: `other-${Date.now()}@example.test`,
        password,
      });
      assert.equal(
        (await http("/games/" + game.id, undefined, other.data.token)).status,
        403,
      );
      assert.equal(
        (
          await http(
            "/games",
            { questionCount: 21, questionDurationSeconds: 10 },
            token,
          )
        ).status,
        400,
      );
      assert.equal((await http("/join/AAAAAA")).status, 404);
      const teacher = await connect(token, "teacher", game.id);
      sockets.push(teacher);
      const sessions = [];
      for (const name of ["Ada", "Beto", "Cora", "Dani"]) {
        const joined = await http<{ token: string; playerId: number }>(
          "/join",
          { code: game.code, name, avatar: "🤖" },
        );
        assert.equal(joined.status, 201);
        sessions.push(joined.data);
        const client = await connect(joined.data.token, "player", game.id);
        sockets.push(client);
      }
      const [a, b, c, d] = sockets.slice(1);
      assert.equal((await emit(a, "game:start")).error, "forbidden");
      assert.equal(
        (
          await emit(a, "team:request", {
            targetPlayerId: sessions[0].playerId,
            position: "LEFT",
          })
        ).error,
        "self_pair",
      );
      for (const [requester, target, idx, position] of [
        [a, b, 1, "RIGHT"],
        [c, d, 3, "LEFT"],
      ] as const) {
        assert.equal(
          (
            await emit(requester, "team:request", {
              targetPlayerId: sessions[idx].playerId,
              position,
            })
          ).ok,
          true,
        );
        const pending = await state(target, (s) => s.requests.length > 0);
        const requestId = pending.requests[0].id;
        assert.equal(
          (await emit(target, "team:respond", { requestId, accept: true })).ok,
          true,
        );
        assert.equal(
          (await emit(target, "team:respond", { requestId, accept: true }))
            .error,
          "stale_request",
        );
      }
      await emit(a, "team:set-name", { name: "Los Null Pointer" });
      await emit(c, "team:set-name", { name: "Stack Attack" });
      const lobby = await state(teacher, (s) => s.teams.length === 2);
      assert.equal(lobby.teams[0].leftPlayerId, sessions[0].playerId);
      assert.equal(lobby.teams[1].leftPlayerId, sessions[3].playerId);
      assert.equal((await emit(teacher, "game:start")).ok, true);
      assert.equal(
        (await http("/join", { code: game.code, name: "Tarde", avatar: "🤖" }))
          .status,
        400,
      );
      for (let round = 1; round <= 5; round++) {
        assert.equal((await emit(teacher, "question:start")).ok, true);
        const active = await state(
          a,
          (s) =>
            s.game.status === "QUESTION_ACTIVE" &&
            s.game.currentQuestionIndex === round,
        );
        assert.ok(active.question);
        assert.equal(active.question.correctOption, undefined);
        assert.equal(active.question.explanation, undefined);
        assert.equal(
          (
            await emit(a, "answer:submit", {
              gameQuestionId: active.question.id,
              scoreAwarded: 9999,
            })
          ).error,
          "invalid_input",
        );
        if (round === 1) {
          const [first, second] = await Promise.all([
            emit(a, "answer:submit", { gameQuestionId: active.question.id }),
            emit(b, "answer:submit", { gameQuestionId: active.question.id }),
          ]);
          assert.equal([first, second].filter((r) => r.ok).length, 1);
          assert.equal(
            [first, second].filter((r) => r.error === "already_answered")
              .length,
            1,
          );
          const hidden = await state(a, (s) => !!s.answer);
          assert.equal(hidden.answer?.isCorrect, undefined);
          assert.equal(hidden.answer?.scoreAwarded, undefined);
          assert.equal(hidden.teamRanking[0].points, 0);
          b.disconnect();
          const resumed = await connect(sessions[1].token, "player", game.id);
          sockets.push(resumed);
          const restored = await state(resumed);
          assert.equal(restored.me.id, sessions[1].playerId);
          assert.ok(restored.answer);
          assert.equal(restored.teams[0].rightPlayerId, sessions[1].playerId);
          await emit(c, "answer:submit", {
            gameQuestionId: active.question.id,
          });
        } else if (round === 2) {
          await new Promise((resolve) => setTimeout(resolve, 10500));
          assert.ok(
            ["question_closed", "timeout"].includes(
              (
                await emit(a, "answer:submit", {
                  gameQuestionId: active.question.id,
                })
              ).error || "",
            ),
          );
        } else {
          assert.equal(
            (
              await emit(a, "answer:submit", {
                gameQuestionId: active.question.id - 1,
              })
            ).error,
            "stale_question",
          );
          await emit(a, "answer:submit", {
            gameQuestionId: active.question.id,
          });
          await emit(d, "answer:submit", {
            gameQuestionId: active.question.id,
          });
        }
        const finished = await state(
          teacher,
          (s) => s.game.status === "QUESTION_FINISHED",
        );
        assert.ok(finished.question?.correctOption);
        assert.equal(finished.results?.attempts, round === 2 ? 0 : 2);
        assert.equal(
          (await emit(teacher, "ranking:set-view", { view: "individual" })).ok,
          false,
        );
        assert.equal(
          (await emit(teacher, "ranking:set-view", { view: "teams" })).ok,
          true,
        );
        await state(teacher, (s) => s.game.rankingView === "teams");
        assert.equal(
          (await emit(teacher, "ranking:set-view", { view: "hidden" })).ok,
          true,
        );
        await state(teacher, (s) => s.game.rankingView === "hidden");
      }
      assert.equal((await emit(teacher, "game:finish")).ok, true);
      const final = await state(teacher, (s) => s.game.status === "FINISHED");
      assert.equal(
        final.teamRanking.reduce((sum, r) => sum + r.attempts, 0),
        8,
      );
      assert.equal(
        (await emit(teacher, "question:start")).error,
        "no_more_questions",
      );
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  },
);
