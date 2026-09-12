import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ErrorBox } from "../components/ErrorBox";

type Teacher = { id: number; name: string; email: string; isActive: boolean };
type Listing = { teachers: Teacher[]; total: number; page: number };
export default function Administration() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Listing>({
    teachers: [],
    total: 0,
    page: 1,
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  useEffect(() => {
    void api<{ role: string }>("/auth/me")
      .then((me) => setAllowed(me.role === "admin"))
      .catch((e) => {
        setAllowed(false);
        setError(e.message);
      });
  }, []);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    void api<Listing>(
      `/admin/teachers?search=${encodeURIComponent(search)}&page=${page}`,
    )
      .then((result) => {
        if (!cancelled) {
          setData(result);
          if (!result.teachers.length && page > 1) setPage(page - 1);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, search, page, revision]);
  async function change(teacher: Teacher, remove = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(
        `/admin/teachers/${teacher.id}`,
        remove ? undefined : { isActive: !teacher.isActive },
        remove ? "DELETE" : "PUT",
      );
      setDeleting(null);
      setNotice(
        remove
          ? "Profesor eliminado."
          : teacher.isActive
            ? "Profesor desactivado. Sus sesiones han sido revocadas."
            : "Profesor activado.",
      );
      setRevision((value) => value + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!localStorage.getItem("teacherToken"))
    return <Navigate to="/teacher/login" />;
  return (
    <main>
      <div className="heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Profesores</h1>
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
      <ErrorBox message={error} />
      {allowed === null && <p role="status">Comprobando acceso…</p>}
      {allowed === false && (
        <p>
          No tienes acceso a este panel.{" "}
          <Link to="/teacher/login">Volver al acceso</Link>
        </p>
      )}
      {allowed && (
        <>
          <p>
            Activa las cuentas para permitir el acceso a la plataforma. Los
            nuevos registros esperan tu aprobación.
          </p>
          <Link to="/teacher">Ir al espacio del profesor →</Link>
          <form
            className="card"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(
                String(new FormData(event.currentTarget).get("search") || ""),
              );
              setPage(1);
              setError("");
            }}
          >
            <label>
              Buscar por nombre o email
              <input name="search" maxLength={120} type="search" />
            </label>
            <button disabled={busy}>Buscar</button>
          </form>
          <p role="status">{notice}</p>
          {loading ? (
            <p role="status">Cargando profesores…</p>
          ) : (
            <>
              <p>
                {data.total} {data.total === 1 ? "profesor" : "profesores"}
              </p>
              {!data.teachers.length && (
                <p>No hay profesores para esta búsqueda.</p>
              )}
              <div className="grid">
                {data.teachers.map((teacher) => (
                  <article className="card" key={teacher.id}>
                    <h2>{teacher.name}</h2>
                    <p style={{ overflowWrap: "anywhere" }}>{teacher.email}</p>
                    <p className="badge">
                      {teacher.isActive ? "Activo" : "Desactivado / pendiente"}
                    </p>
                    <div className="admin-actions">
                      <button
                        disabled={busy}
                        onClick={() => void change(teacher)}
                        aria-label={`${teacher.isActive ? "Desactivar" : "Activar"} a ${teacher.name}`}
                      >
                        {teacher.isActive ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => setDeleting(teacher)}
                        aria-label={`Borrar a ${teacher.name}`}
                      >
                        Borrar
                      </button>
                    </div>
                    {deleting?.id === teacher.id && (
                      <div role="alert" className="card">
                        <p>
                          ¿Borrar la cuenta de {teacher.name}? Se eliminarán sus
                          datos de acceso y se conservará el historial de
                          partidas. Esta acción no se puede deshacer.
                        </p>
                        <button
                          disabled={busy}
                          onClick={() => void change(teacher, true)}
                        >
                          Confirmar borrado
                        </button>{" "}
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => setDeleting(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <nav className="admin-actions" aria-label="Páginas de profesores">
                <button
                  disabled={busy || page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  disabled={busy || page * 25 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </button>
              </nav>
            </>
          )}
        </>
      )}
    </main>
  );
}
