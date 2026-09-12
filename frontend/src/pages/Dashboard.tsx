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
  const navigate = useNavigate();
  useEffect(() => {
    void api<{ role: string }>("/auth/me")
      .then((me) => setAdmin(me.role === "admin"))
      .catch(() => undefined);
    void api<QuestionList>("/questions")
      .then((data) => setAvailable(data.activeTotal))
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
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const game = await api<Game>("/games", {
              questionCount: Number(f.get("count")),
              questionDurationSeconds: Number(f.get("duration")),
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
          Preguntas
          <select
            name="count"
            aria-describedby="suggested-rounds"
            key={available}
            disabled={!available}
            defaultValue={Math.min(5, available ?? 5)}
          >
            {Array.from({ length: Math.min(20, available ?? 0) }, (_, i) => (
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
        <button disabled={busy || !available}>Crear partida →</button>
        <small id="suggested-rounds" className="config-help">
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
