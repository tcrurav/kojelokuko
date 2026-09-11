import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { errorText, ignoresEnter } from "../api";
import type { State } from "../types";
import { ErrorBox } from "../components/ErrorBox";
export default function Play({ teacher = false }: { teacher?: boolean }) {
  const params = useParams();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState("");
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const socket = useRef<Socket | null>(null);
  const sending = useRef(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let token = localStorage.getItem("teacherToken") || "";
    let gameId = Number(params.id);
    if (!teacher) {
      try {
        const saved = JSON.parse(
          localStorage.getItem("player:" + params.code) || "{}",
        ) as { token: string; gameId: number };
        token = saved.token;
        gameId = saved.gameId;
      } catch {
        setError("No se pudo recuperar la sesión. Vuelve a entrar.");
        return;
      }
    }
    if (!token || !gameId) {
      setError("No hay sesión guardada. Vuelve a entrar.");
      return;
    }
    const s = io({
      auth: { token, gameId, kind: teacher ? "teacher" : "player" },
      transports: ["polling", "websocket"],
      upgrade: !new URLSearchParams(location.search).has("polling"),
    });
    socket.current = s;
    s.on("connect", () => {
      setConnected(true);
      setError("");
      setTransport(s.io.engine.transport.name);
      s.io.engine.on("upgrade", () => setTransport(s.io.engine.transport.name));
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (e) => {
      setConnected(false);
      setError(
        e.message === "unauthorized"
          ? "Sesión no válida. Vuelve a entrar."
          : "No hay conexión. Intentando reconectar…",
      );
    });
    s.on("game:state", (next: State) => {
      offset.current = next.serverNow - Date.now();
      setState(next);
    });
    s.on("game:error", () =>
      setError("No se pudo sincronizar. Intentando de nuevo…"),
    );
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => {
      clearInterval(interval);
      s.disconnect();
    };
  }, [teacher, params.id, params.code]);
  const send = (event: string, data: Record<string, unknown> = {}) => {
    if (sending.current || !socket.current?.connected) return;
    sending.current = true;
    setPending(true);
    setError("");
    socket.current
      .timeout(7000)
      .emit(event, data, (err: Error | null, result: { error?: string }) => {
        sending.current = false;
        setPending(false);
        if (err) setError("Sin confirmación. Reconectando el estado…");
        else if (result.error) setError(errorText(result.error));
        if (err || result.error) socket.current?.emit("game:resume");
      });
  };
  const team = !teacher
    ? state?.teams.find(
        (t) =>
          t.leftPlayerId === state.me.id || t.rightPlayerId === state.me.id,
      )
    : undefined;
  const side = team?.leftPlayerId === state?.me.id ? "LEFT" : "RIGHT";
  const canAnswer =
    !!state &&
    state.game.status === "QUESTION_ACTIVE" &&
    !!team &&
    !state.answer &&
    !pending &&
    connected;
  const latest = useRef(() => {});
  latest.current = () => {
    if (canAnswer && state?.question)
      send("answer:submit", { gameQuestionId: state.question.id });
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (ignoresEnter(e, e.target instanceof Element ? e.target : null))
        return;
      e.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (!state)
    return (
      <main className="narrow">
        <h1>Conectando al aula…</h1>
        <ErrorBox message={error} />
        <Link to={teacher ? "/teacher/login" : "/join"}>Volver a entrar →</Link>
      </main>
    );
  const { game, question } = state;
  const person = (id: number) => state.players.find((p) => p.id === id);
  const playerLabel = (id: number) => {
    const p = person(id);
    return p
      ? `${p.avatar} ${p.name}${p.connected ? "" : " · desconectado"}`
      : "Jugador";
  };
  const free = state.players.filter(
    (p) =>
      !state.teams.some(
        (t) => t.leftPlayerId === p.id || t.rightPlayerId === p.id,
      ),
  );
  const active = game.status === "QUESTION_ACTIVE";
  const lobby = game.status === "LOBBY";
  const ranking = ["SHOWING_RANKING", "FINISHED"].includes(game.status);
  const seconds = Math.max(
    0,
    Math.ceil(
      (new Date(game.questionExpiresAt || 0).getTime() - now - offset.current) /
        1000,
    ),
  );
  return (
    <main className={teacher ? "projection" : ""}>
      <div className="heading">
        <Link to={teacher ? "/teacher" : "/"}>
          ← {teacher ? "Mis partidas" : "Inicio"}
        </Link>
        <span className="badge" role="status">
          {connected ? "● En línea" : "○ Reconectando…"}
          {teacher && ` · ${transport}`}
        </span>
      </div>
      <ErrorBox message={error} />
      {lobby ? (
        <>
          <div className="lobby-title">
            <span className="eyebrow">ENTRA EN /JOIN CON EL CÓDIGO</span>
            <h1 className="game-code">{game.code}</h1>
            <p>
              {state.players.filter((p) => p.connected).length} conectados ·{" "}
              {state.teams.length} equipos preparados · {free.length} sin pareja
            </p>
          </div>
          {teacher ? (
            <>
              <button
                disabled={pending || !connected}
                onClick={() =>
                  free.length ? setConfirm(true) : send("game:start")
                }
              >
                Iniciar competición →
              </button>
              {confirm && (
                <div className="card" role="alert">
                  <p>
                    {free.length} jugadores sin pareja quedarán como
                    espectadores.
                  </p>
                  <button
                    onClick={() => {
                      send("game:start", { confirmSpectators: true });
                      setConfirm(false);
                    }}
                  >
                    Confirmar inicio
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setConfirm(false)}
                  >
                    Seguir esperando
                  </button>
                </div>
              )}
            </>
          ) : team ? (
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                send("team:set-name", {
                  name: new FormData(e.currentTarget).get("name"),
                });
              }}
            >
              <h2>¡Equipo preparado! {team.name}</h2>
              <p>
                Eres{" "}
                {side === "LEFT"
                  ? "⚪ BLANCO / IZQUIERDA"
                  : "⚫ NEGRO / DERECHA"}
              </p>
              <label>
                Nombre del equipo
                <input
                  key={team.name}
                  name="name"
                  defaultValue={team.name}
                  maxLength={60}
                  required
                />
              </label>
              <button disabled={pending}>Guardar nombre</button>
            </form>
          ) : (
            <div className="card">
              <h2>Busca a la persona sentada a tu lado</h2>
              <p>
                Elegid vuestra posición física. Los roles se mantendrán toda la
                partida.
              </p>
              {state.requests.map((r) => (
                <div className="request" key={r.id}>
                  {r.targetPlayerId === state.me.id ? (
                    <>
                      <p>
                        {playerLabel(r.requesterPlayerId)} quiere formar equipo.
                        Tú serás{" "}
                        <strong>
                          {r.targetRelativePosition === "LEFT"
                            ? "⚪ BLANCO / IZQUIERDA"
                            : "⚫ NEGRO / DERECHA"}
                        </strong>
                        .
                      </p>
                      <button
                        disabled={pending}
                        onClick={() =>
                          send("team:respond", {
                            requestId: r.id,
                            accept: true,
                          })
                        }
                      >
                        Aceptar pareja
                      </button>
                      <button
                        className="secondary"
                        disabled={pending}
                        onClick={() =>
                          send("team:respond", {
                            requestId: r.id,
                            accept: false,
                          })
                        }
                      >
                        Rechazar
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Esperando a {playerLabel(r.targetPlayerId)}…</p>
                      <button
                        className="secondary"
                        onClick={() => send("team:cancel")}
                      >
                        Cancelar solicitud
                      </button>
                    </>
                  )}
                </div>
              ))}
              {!state.requests.length &&
                free
                  .filter((p) => p.id !== state.me.id)
                  .map((p) => (
                    <div className="request" key={p.id}>
                      <strong>{playerLabel(p.id)}</strong>
                      <div>
                        <button
                          disabled={pending}
                          className="secondary"
                          onClick={() =>
                            send("team:request", {
                              targetPlayerId: p.id,
                              position: "LEFT",
                            })
                          }
                        >
                          ← Está a mi izquierda
                        </button>
                        <button
                          disabled={pending}
                          className="secondary"
                          onClick={() =>
                            send("team:request", {
                              targetPlayerId: p.id,
                              position: "RIGHT",
                            })
                          }
                        >
                          Está a mi derecha →
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          )}
          <h2>Equipos en el aula</h2>
          <div className="grid">
            {state.teams.map((t) => (
              <article className="card" key={t.id}>
                <h3>{t.name}</h3>
                <p>⚪ Izquierda: {playerLabel(t.leftPlayerId)}</p>
                <p>⚫ Derecha: {playerLabel(t.rightPlayerId)}</p>
                <span className="badge">Equipo preparado</span>
              </article>
            ))}
          </div>
          {free.length > 0 && (
            <>
              <h2>Buscando pareja</h2>
              <div className="grid">
                {free.map((p) => (
                  <div className="card" key={p.id}>
                    {playerLabel(p.id)}
                    <p className="muted">
                      {state.requests.some(
                        (r) =>
                          r.requesterPlayerId === p.id ||
                          r.targetPlayerId === p.id,
                      )
                        ? "Formando equipo"
                        : "Buscando pareja"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {game.status === "READY" && (
            <div className="lobby-title">
              <h1>
                Dos mentes.
                <br />
                ¡Un gran equipo!
              </h1>
              <p>El profesor iniciará la primera pregunta.</p>
            </div>
          )}
          {!teacher && (
            <div className={"role " + (side === "LEFT" ? "white" : "black")}>
              {team ? (
                <>
                  <strong>
                    {team.name} ·{" "}
                    {side === "LEFT"
                      ? "← ⚪ BLANCO / IZQUIERDA"
                      : "⚫ NEGRO / DERECHA →"}
                  </strong>
                  <p>
                    Tu pareja:{" "}
                    {playerLabel(
                      side === "LEFT" ? team.rightPlayerId : team.leftPlayerId,
                    )}
                  </p>
                </>
              ) : (
                <strong>Estás de espectador. ¡Sigue el debate!</strong>
              )}
            </div>
          )}
          {question && !ranking && (
            <section>
              <div className="heading">
                <span className="eyebrow">
                  PREGUNTA {game.currentQuestionIndex} / {game.questionCount} ·{" "}
                  {question.category}
                </span>
                {active && (
                  <span className="timer" role="timer">
                    {seconds}s
                  </span>
                )}
              </div>
              <h1 className="question">{question.statement}</h1>
              <div className="choices">
                <article className="option white">
                  <span>← ⚪ BLANCO / IZQUIERDA</span>
                  <h2>{question.leftOption}</h2>
                </article>
                <article className="option black">
                  <span>⚫ NEGRO / DERECHA →</span>
                  <h2>{question.rightOption}</h2>
                </article>
              </div>
              <p className="muted">
                {state.answeredCount} / {state.teams.length} equipos han
                respondido
              </p>
              {active && !teacher && team && (
                <>
                  {state.answer ? (
                    <div className="card" role="status">
                      Respuesta registrada · Respondió{" "}
                      {playerLabel(state.answer.answeredByPlayerId)} ·{" "}
                      {state.answer.selectedOption === "LEFT"
                        ? "BLANCO"
                        : "NEGRO"}
                      . La solución se mostrará al cerrar la pregunta.
                    </div>
                  ) : (
                    <>
                      <p>
                        Habla con tu pareja. Pulsa ENTER cuando estéis de
                        acuerdo.
                      </p>
                      <button
                        className="answer-button"
                        disabled={!canAnswer}
                        onClick={() => latest.current()}
                      >
                        {pending
                          ? "Enviando…"
                          : `↵ RESPONDER COMO ${side === "LEFT" ? "BLANCO" : "NEGRO"}`}
                      </button>
                    </>
                  )}
                </>
              )}
              {question.correctOption && (
                <div className="card feedback">
                  <h2>
                    {!teacher && team
                      ? state.answer
                        ? state.answer.isCorrect
                          ? "✅ ¡Correcto!"
                          : "❌ No era esa."
                        : "⌛ ¡Tiempo agotado!"
                      : "La solución"}
                  </h2>
                  <h3>
                    {question.correctOption === "LEFT"
                      ? "⚪ BLANCO / IZQUIERDA"
                      : "⚫ NEGRO / DERECHA"}
                  </h3>
                  <p>{question.explanation}</p>
                  {state.answer && (
                    <p>
                      Respondió {playerLabel(state.answer.answeredByPlayerId)} ·
                      +{state.answer.scoreAwarded} puntos
                    </p>
                  )}
                  {teacher && state.results && (
                    <p>
                      {state.results.correct} aciertos ·{" "}
                      {state.results.attempts - state.results.correct} errores ·{" "}
                      {state.teams.length - state.results.attempts} sin
                      respuesta
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
          {ranking && (
            <section>
              <span className="eyebrow">
                {game.status === "FINISHED"
                  ? "¡RETO COMPLETADO!"
                  : "ASÍ VA LA COMPETICIÓN"}
              </span>
              <h1>
                {game.status === "FINISHED"
                  ? "¡Un aplauso para el aula!"
                  : "Cada idea cuenta."}
              </h1>
              {game.status === "FINISHED" && (
                <div className="podium">
                  {state.teamRanking.slice(0, 3).map((r, i) => (
                    <div className="card" key={r.id}>
                      <span>{["🥇", "🥈", "🥉"][i]}</span>
                      <h2>{r.name}</h2>
                      <strong>{r.points} puntos</strong>
                    </div>
                  ))}
                </div>
              )}
              <h2>
                {game.rankingView === "teams"
                  ? "Clasificación por equipos"
                  : "Contribución individual"}
              </h2>
              {game.rankingView === "individual" && (
                <p>
                  Cuenta los puntos de las respuestas que lanzó cada persona. La
                  puntuación del equipo es compartida.
                </p>
              )}
              <div className="rankings">
                {(game.rankingView === "teams"
                  ? state.teamRanking
                  : state.individualRanking
                ).map((r, i) => (
                  <article className="rank" key={r.id}>
                    <strong className="place">{i + 1}</strong>
                    <div>
                      <h3>
                        {r.avatar ||
                          state.teams
                            .filter((t) => t.id === r.id)
                            .map(
                              (t) =>
                                `${person(t.leftPlayerId)?.avatar} ${person(t.rightPlayerId)?.avatar}`,
                            )
                            .join("")}{" "}
                        {r.name}
                      </h3>
                      <p>
                        {r.team} {r.correct} aciertos · {r.attempts} respuestas
                      </p>
                      <small>{r.comment}</small>
                    </div>
                    <strong>
                      {r.points}
                      <small> puntos</small>
                    </strong>
                  </article>
                ))}
              </div>
            </section>
          )}
          {teacher && (
            <div className="controls">
              {["READY", "SHOWING_RANKING"].includes(game.status) &&
                game.currentQuestionIndex < game.questionCount && (
                  <button
                    disabled={pending || !connected}
                    onClick={() => send("question:start")}
                  >
                    {game.currentQuestionIndex
                      ? "Siguiente pregunta"
                      : "Empezar primera pregunta"}{" "}
                    →
                  </button>
                )}
              {active && (
                <button
                  className="secondary"
                  disabled={pending || !connected}
                  onClick={() => send("question:finish")}
                >
                  Cerrar pregunta
                </button>
              )}
              {["QUESTION_FINISHED", "SHOWING_RANKING", "FINISHED"].includes(
                game.status,
              ) && (
                <>
                  <button
                    className="secondary"
                    disabled={pending || !connected}
                    onClick={() => send("ranking:set-view", { view: "teams" })}
                  >
                    Clasificación por equipos
                  </button>
                  <button
                    className="secondary"
                    disabled={pending || !connected}
                    onClick={() =>
                      send("ranking:set-view", { view: "individual" })
                    }
                  >
                    Clasificación individual
                  </button>
                </>
              )}
              {game.status === "SHOWING_RANKING" &&
                game.currentQuestionIndex === game.questionCount && (
                  <button
                    disabled={pending || !connected}
                    onClick={() => send("game:finish")}
                  >
                    Mostrar podio final ★
                  </button>
                )}
            </div>
          )}
          {game.status === "FINISHED" && (
            <Link to={teacher ? "/teacher" : "/"}>Volver al inicio →</Link>
          )}
        </>
      )}
    </main>
  );
}
