import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ErrorBox } from "../components/ErrorBox";
export default function Auth({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="narrow">
      <span className="eyebrow">ESPACIO DEL PROFESOR</span>
      <h1>{register ? "Crea tu cuenta" : "Vuelve al aula"}</h1>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ token: string }>(
              "/auth/" + (register ? "register" : "login"),
              data,
            );
            localStorage.setItem("teacherToken", result.token);
            navigate("/teacher");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            Nombre
            <input name="name" required maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="email"
          />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        <small>Al menos 10 caracteres.</small>
        <ErrorBox message={error} />
        <button disabled={busy}>
          {busy ? "Un momento…" : register ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
      <Link to={register ? "/teacher/login" : "/teacher/register"}>
        {register ? "Ya tengo cuenta" : "Crear una cuenta de profesor"} →
      </Link>
    </main>
  );
}
