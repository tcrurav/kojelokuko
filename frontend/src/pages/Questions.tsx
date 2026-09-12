import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import type { BankQuestion, QuestionList } from "../question-types";
import QuestionEditor from "../components/QuestionEditor";
import { ErrorBox } from "../components/ErrorBox";
export default function Questions() {
  const [data, setData] = useState<QuestionList | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{
    question: BankQuestion | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<BankQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const token = localStorage.getItem("teacherToken");
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!token) return;
    let current = true;
    setLoading(true);
    setError("");
    void api<QuestionList>(
      "/questions?" +
        new URLSearchParams({ search: query, page: String(page) }),
    )
      .then((result) => {
        if (!current) return;
        const last = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (page > last) {
          setPage(last);
          return;
        }
        setData(result);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, page, reload, token]);
  useEffect(() => {
    if (deleting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deleting]);
  if (!token) return <Navigate to="/teacher/login" replace />;
  const open = (question: BankQuestion | null) => {
    setEditor({ question });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <main>
      <Link to="/teacher">← Volver a mis partidas</Link>
      <div className="heading question-heading">
        <div>
          <span className="eyebrow">ESPACIO DEL PROFESOR</span>
          <h1>Banco de preguntas</h1>
          <p className="muted">
            Un banco compartido para preparar el próximo debate. Solo las
            preguntas activas se incluyen en nuevas partidas. Las partidas ya
            creadas conservan su selección.
          </p>
        </div>
        {!editor && (
          <button onClick={() => open(null)}>+ Nueva pregunta</button>
        )}
      </div>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {editor ? (
        <QuestionEditor
          key={editor.question?.id ?? "new"}
          question={editor.question}
          onCancel={() => {
            setEditor(null);
            setReload((n) => n + 1);
          }}
          onSaved={() => {
            setNotice(
              editor.question ? "Pregunta actualizada." : "Pregunta creada.",
            );
            setEditor(null);
            setReload((n) => n + 1);
          }}
        />
      ) : (
        <>
          <div className="card question-toolbar">
            <label>
              Buscar por enunciado o categoría
              <input
                type="search"
                value={search}
                maxLength={120}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar preguntas…"
              />
            </label>
            <p>
              {data
                ? `${data.total} preguntas${query ? " encontradas" : " en el banco"} · ${data.activeTotal} activas en total`
                : "Cargando banco…"}
            </p>
          </div>
          <ErrorBox message={error} />
          {error && (
            <button
              className="secondary"
              onClick={() => setReload((n) => n + 1)}
            >
              Reintentar
            </button>
          )}
          {loading ? (
            <p role="status">Cargando preguntas…</p>
          ) : (
            !error && (
              <>
                {!data?.items.length ? (
                  <div className="card">
                    <h2>
                      {query
                        ? "No hay coincidencias"
                        : "Todavía no hay preguntas"}
                    </h2>
                    <p>
                      {query
                        ? "Prueba otro enunciado o categoría."
                        : "Crea una pregunta para empezar a preparar partidas."}
                    </p>
                  </div>
                ) : (
                  <div className="question-list">
                    {data.items.map((q) => (
                      <article className="card bank-question" key={q.id}>
                        <div className="question-meta">
                          <span className="badge">
                            {q.isActive ? "Activa" : "Desactivada"}
                          </span>
                          <span className="badge">{q.category}</span>
                          {q.difficulty && (
                            <span className="muted">{q.difficulty}</span>
                          )}
                        </div>
                        <h2>{q.statement}</h2>
                        <div className="question-options">
                          <div
                            className={
                              "question-answer white" +
                              (q.correctOption === "LEFT"
                                ? " correct-answer"
                                : "")
                            }
                          >
                            <strong>⚪ BLANCO / IZQUIERDA</strong>
                            <p>{q.leftOption}</p>
                            {q.correctOption === "LEFT" && (
                              <span>✓ Respuesta correcta</span>
                            )}
                          </div>
                          <div
                            className={
                              "question-answer black" +
                              (q.correctOption === "RIGHT"
                                ? " correct-answer"
                                : "")
                            }
                          >
                            <strong>⚫ NEGRO / DERECHA</strong>
                            <p>{q.rightOption}</p>
                            {q.correctOption === "RIGHT" && (
                              <span>✓ Respuesta correcta</span>
                            )}
                          </div>
                        </div>
                        <details>
                          <summary>Ver explicación</summary>
                          <p className="question-explanation">
                            {q.explanation}
                          </p>
                        </details>
                        <div className="question-actions">
                          <button
                            className="secondary"
                            role="switch"
                            aria-checked={q.isActive}
                            aria-label={`Pregunta activa: ${q.statement}`}
                            disabled={busy}
                            onClick={async () => {
                              if (busy) return;
                              setBusy(true);
                              setNotice("");
                              setError("");
                              try {
                                const updated = await api<BankQuestion>(
                                  `/questions/${q.id}/activation`,
                                  { version: q.version, isActive: !q.isActive },
                                  "PUT",
                                );
                                setData((current) =>
                                  current
                                    ? {
                                        ...current,
                                        items: current.items.map((item) =>
                                          item.id === updated.id
                                            ? updated
                                            : item,
                                        ),
                                        activeTotal:
                                          current.activeTotal +
                                          (updated.isActive ? 1 : -1),
                                      }
                                    : current,
                                );
                                setNotice(
                                  updated.isActive
                                    ? "Pregunta activada para nuevas partidas."
                                    : "Pregunta desactivada. No aparecerá en nuevas partidas.",
                                );
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {q.isActive ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => open(q)}
                          >
                            Editar
                          </button>
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={() => {
                              setDeleting(q);
                              setDeleteError("");
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {!!data?.total && (
                  <nav className="pagination" aria-label="Páginas de preguntas">
                    <button
                      className="secondary"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {page} de {Math.ceil(data.total / data.pageSize)}
                    </span>
                    <button
                      className="secondary"
                      disabled={page * data.pageSize >= data.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="question-dialog"
        aria-labelledby="delete-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setDeleting(null);
        }}
      >
        <h2 id="delete-title">¿Eliminar esta pregunta?</h2>
        <p>{deleting?.statement}</p>
        <p className="muted">
          Dejará de aparecer en nuevas partidas. Las partidas ya creadas
          conservarán su copia.
        </p>
        <ErrorBox message={deleteError} />
        <div className="question-actions">
          <button
            className="secondary"
            autoFocus
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Cancelar
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (!deleting || busy) return;
              setBusy(true);
              setDeleteError("");
              try {
                await api(
                  "/questions/" + deleting.id,
                  { version: deleting.version },
                  "DELETE",
                );
                setDeleting(null);
                setNotice("Pregunta eliminada del banco.");
                setReload((n) => n + 1);
              } catch (e) {
                setDeleteError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Eliminando…" : "Eliminar pregunta"}
          </button>
        </div>
      </dialog>
    </main>
  );
}
