import { useState } from "react";
import { api } from "../api";
import type { BankQuestion, QuestionInput } from "../question-types";
import { ErrorBox } from "./ErrorBox";
const empty: QuestionInput = {
  statement: "",
  leftOption: "",
  rightOption: "",
  correctOption: "LEFT",
  explanation: "",
  category: "",
  difficulty: "",
};
export default function QuestionEditor({
  question,
  onSaved,
  onCancel,
}: {
  question: BankQuestion | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<QuestionInput>(question ?? empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function field<K extends keyof QuestionInput>(
    key: K,
    value: QuestionInput[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return (
    <section className="card question-editor" aria-labelledby="editor-title">
      <h2 id="editor-title">
        {question ? "Editar pregunta" : "Nueva pregunta"}
      </h2>
      <p className="muted">
        Dos opciones para debatir y una única respuesta correcta. Los cambios se
        aplican a las nuevas partidas.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          if (
            draft.leftOption.trim().toLocaleLowerCase() ===
            draft.rightOption.trim().toLocaleLowerCase()
          ) {
            setError("Las dos opciones deben ser diferentes.");
            return;
          }
          setBusy(true);
          const data: QuestionInput = {
            statement: draft.statement,
            leftOption: draft.leftOption,
            rightOption: draft.rightOption,
            correctOption: draft.correctOption,
            explanation: draft.explanation,
            category: draft.category,
            difficulty: draft.difficulty,
          };
          try {
            if (question)
              await api(
                "/questions/" + question.id,
                { version: question.version, question: data },
                "PUT",
              );
            else await api("/questions", data);
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="question-fields">
          <label>
            Enunciado
            <textarea
              autoFocus
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              value={draft.statement}
              onChange={(e) => field("statement", e.target.value)}
            />
          </label>
          <div className="question-options">
            <label>
              ⚪ Respuesta BLANCO / IZQUIERDA
              <textarea
                required
                maxLength={120}
                rows={3}
                value={draft.leftOption}
                onChange={(e) => field("leftOption", e.target.value)}
              />
            </label>
            <label>
              ⚫ Respuesta NEGRO / DERECHA
              <textarea
                required
                maxLength={120}
                rows={3}
                value={draft.rightOption}
                onChange={(e) => field("rightOption", e.target.value)}
              />
            </label>
          </div>
          <label>
            Respuesta correcta
            <select
              value={draft.correctOption}
              onChange={(e) =>
                field("correctOption", e.target.value as "LEFT" | "RIGHT")
              }
            >
              <option value="LEFT">⚪ BLANCO / IZQUIERDA</option>
              <option value="RIGHT">⚫ NEGRO / DERECHA</option>
            </select>
          </label>
          <label>
            Explicación pedagógica
            <textarea
              required
              minLength={5}
              maxLength={4000}
              rows={4}
              value={draft.explanation}
              onChange={(e) => field("explanation", e.target.value)}
            />
          </label>
          <div className="question-options">
            <label>
              Categoría
              <input
                required
                maxLength={120}
                value={draft.category}
                onChange={(e) => field("category", e.target.value)}
                placeholder="Ej.: Testing, SQL, Seguridad"
              />
            </label>
            <label>
              Dificultad (opcional)
              <input
                maxLength={120}
                value={draft.difficulty}
                onChange={(e) => field("difficulty", e.target.value)}
                list="question-difficulties"
              />
              <datalist id="question-difficulties">
                <option value="Fácil" />
                <option value="Media" />
                <option value="Difícil" />
              </datalist>
            </label>
          </div>
        </fieldset>
        <ErrorBox message={error} />
        <div className="question-actions">
          <button disabled={busy}>
            {busy
              ? "Guardando…"
              : question
                ? "Guardar cambios"
                : "Crear pregunta"}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
