import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Game } from "../types";
import { ErrorBox } from "../components/ErrorBox";
import type { QuestionList } from "../question-types";
export default function Dashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [available, setAvailable] = useState<number | null>(null);
  const [difficulties, setDifficulties] = useState<
    QuestionList["difficulties"]
  >([]);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const eligible =
    difficulty === null
      ? available
      : (difficulties.find((item) => item.difficulty === difficulty)?.count ??
        0);
  const navigate = useNavigate();
  useEffect(() => {
    void api<{ role: string }>("/auth/me")
      .then((me) => setAdmin(me.role === "admin"))
      .catch(() => undefined);
    void api<QuestionList>("/questions")
      .then((data) => {
        setAvailable(data.activeTotal);
        setDifficulties(data.difficulties);
      })
      .catch((e) => setError(e.message));
    void api<Game[]>("/games")
      .then(setGames)
      .catch((e) => setError(e.message));
  }, []);
  if (!localStorage.getItem("teacherToken"))
    return <Navigate to="/teacher/login" />;
  return (
    <main>
      <div className="heading">
        <div>
          <span className="eyebrow">TU AULA, TU RITMO</span>
          <h1>Prepara el próximo reto.</h1>
        </div>
        <button
          className="secondary"
          onClick={() => {
            localStorage.removeItem("teacherToken");
            navigate("/");
          }}
        >
          Cerrar sesión
        </button>
      </div>
      <div className="card bank-access">
        {admin && <Link to="/admin">Administrar profesores →</Link>}
        <div>
          <h2>Preguntas y respuestas</h2>
          <p>
            {available === null
              ? "Consulta y prepara tu banco de preguntas."
              : `${available} preguntas activas disponibles. Crea, revisa y edita los próximos retos.`}
          </p>
        </div>
        <Link className="button-link" to="/teacher/questions">
          Gestionar preguntas →
        </Link>
      </div>
      <form
        className="card config"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !eligible) return;
          setError("");
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const game = await api<Game>("/games", {
              questionCount: Number(f.get("count")),
              questionDurationSeconds: Number(f.get("duration")),
              showPartnerOption: f.get("showPartnerOption") === "true",
              ...(difficulty === null ? {} : { difficulty }),
            });
            navigate("/teacher/games/" + game.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Dificultad
          <select
            name="difficulty"
            value={JSON.stringify(difficulty)}
            disabled={busy || available === null}
            onChange={(e) =>
              setDifficulty(JSON.parse(e.target.value) as string | null)
            }
          >
            <option value="null">Todas las dificultades</option>
            {difficulties.map((item) => (
              <option
                key={item.difficulty}
                value={JSON.stringify(item.difficulty)}
              >
                {item.difficulty || "Sin especificar"} ({item.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          Preguntas
          <select
            name="count"
            aria-describedby="suggested-rounds"
            key={JSON.stringify([difficulty, eligible])}
            disabled={busy || !eligible}
            defaultValue={Math.min(5, eligible ?? 5)}
          >
            {Array.from({ length: Math.min(20, eligible ?? 0) }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
        <label>
          Segundos por pregunta
          <select name="duration" defaultValue="20">
            {[10, 15, 20, 30, 60, 120].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="config-help">
          ¿Los jugadores pueden ver la opción de su compañero?
          <select name="showPartnerOption" defaultValue="true" disabled={busy}>
            <option value="true">Sí, ven las dos opciones</option>
            <option value="false">No, cada jugador ve solo su opción</option>
          </select>
          <small>
            Si eliges «No», tendrán que compartir sus opciones hablando.
          </small>
        </label>
        <button disabled={busy || !eligible}>Crear partida →</button>
        <small id="suggested-rounds" className="config-help">
          {eligible === null
            ? "Cargando preguntas…"
            : `${eligible} preguntas activas disponibles para esta dificultad.`}{" "}
          Rondas sugeridas: 5 · 10 · 15 · 20
        </small>
      </form>
      <ErrorBox message={error} />
      <h2>Tus partidas</h2>
      <div className="grid">
        {games.map((g) => (
          <Link className="card" key={g.id} to={"/teacher/games/" + g.id}>
            <h2 className="code-small">{g.code}</h2>
            <p>
              {g.questionCount} preguntas · {g.questionDurationSeconds} segundos
            </p>
            <span className="badge">
              {g.status === "FINISHED" ? "Finalizada" : "Abrir partida →"}
            </span>
          </Link>
        ))}
      </div>
      {!games.length && (
        <p className="muted">Tu primera partida empieza aquí.</p>
      )}
    </main>
  );
}
