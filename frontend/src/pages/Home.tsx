import { Link } from "react-router-dom";
export default function Home() {
  return (
    <main className="hero">
      <span className="eyebrow">DOS MENTES. UNA RESPUESTA.</span>
      <h1>
        Piensa.
        <br />
        Debate.
        <br />
        <em>¡Dale al ENTER!</em>
      </h1>
      <p>
        El juego de programación que se juega en pareja.
        <br />
        Una persona a la izquierda. Otra a la derecha. ¿Os ponéis de acuerdo?
      </p>
      <div className="choices">
        <Link className="card home-card" to="/teacher">
          <span>✦</span>
          <h2>Soy profesor</h2>
          <p>Prepara el reto y dirige la clase →</p>
        </Link>
        <Link className="card home-card lime" to="/join">
          <span>↵</span>
          <h2>Soy alumno</h2>
          <p>Entra con tu código y busca pareja →</p>
        </Link>
      </div>
      <p className="muted">
        ⚪ BLANCO / IZQUIERDA &nbsp; + &nbsp; ⚫ NEGRO / DERECHA
      </p>
    </main>
  );
}
