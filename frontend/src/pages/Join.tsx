import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ErrorBox } from "../components/ErrorBox";
const avatars = [
  "🤖",
  "🥷",
  "🚀",
  "🦖",
  "👽",
  "🐙",
  "🐱",
  "💻",
  "🧙",
  "🧪",
  "🛡️",
  "👻",
];
export default function Join() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [valid, setValid] = useState(false);
  const [avatar, setAvatar] = useState(avatars[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="narrow">
      <span className="eyebrow">EL RETO OS ESPERA</span>
      <h1>{valid ? "¿Quién juega?" : "Entra en la partida"}</h1>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            if (!valid) {
              await api("/join/" + code);
              setValid(true);
            } else {
              const session = await api<{
                token: string;
                gameId: number;
                code: string;
              }>("/join", { code, name: form.get("name"), avatar });
              localStorage.setItem("player:" + code, JSON.stringify(session));
              navigate("/play/" + code);
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {!valid ? (
          <label>
            Código de 6 caracteres
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
              minLength={6}
              maxLength={6}
              required
              autoComplete="off"
            />
          </label>
        ) : (
          <>
            <p>
              Partida <strong>{code}</strong>
            </p>
            <label>
              Tu nombre
              <input
                name="name"
                required
                maxLength={40}
                autoComplete="nickname"
              />
            </label>
            <fieldset>
              <legend>Elige tu avatar</legend>
              <div className="avatars">
                {avatars.map((a) => (
                  <button
                    type="button"
                    key={a}
                    aria-label={"Avatar " + a}
                    aria-pressed={avatar === a}
                    className={avatar === a ? "selected" : "secondary"}
                    onClick={() => setAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <ErrorBox message={error} />
        <button disabled={busy}>
          {busy ? "Conectando…" : valid ? "¡Dentro! →" : "Comprobar código →"}
        </button>
      </form>
    </main>
  );
}
