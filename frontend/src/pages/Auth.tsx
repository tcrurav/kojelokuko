import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ErrorBox } from "../components/ErrorBox";
export default function Auth({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  return (
    <main className="narrow">
      <span className="eyebrow">ESPACIO DEL PROFESOR</span>
      <h1>{register ? "Crea tu cuenta" : "Vuelve al aula"}</h1>
      {registered ? (
        <div className="card" role="status">
          <h2>Cuenta creada</h2>
          <p>
            El administrador debe activar tu cuenta antes de que puedas entrar.
          </p>
          <Link to="/teacher/login">Volver al acceso</Link>
        </div>
      ) : (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const result = await api<{
                token?: string;
                role?: string;
                pendingActivation?: boolean;
              }>("/auth/" + (register ? "register" : "login"), data);
              if (result.pendingActivation) {
                setRegistered(true);
                return;
              }
              if (!result.token)
                throw new Error("No se pudo iniciar la sesión.");
              localStorage.setItem("teacherToken", result.token);
              navigate(result.role === "admin" ? "/admin" : "/teacher");
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
      )}
      <Link to={register ? "/teacher/login" : "/teacher/register"}>
        {register ? "Ya tengo cuenta" : "Crear una cuenta de profesor"} →
      </Link>
    </main>
  );
}
