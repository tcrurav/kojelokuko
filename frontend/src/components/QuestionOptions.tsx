export function QuestionOptions({ leftOption, rightOption }: {
  leftOption: string | null;
  rightOption: string | null;
}) {
  return (
    <div className="choices">
      {leftOption !== null && (
        <article className="option white">
          <span>← ⚪ BLANCO / IZQUIERDA</span>
          <h2>{leftOption}</h2>
        </article>
      )}
      {rightOption !== null && (
        <article className="option black">
          <span>⚫ NEGRO / DERECHA →</span>
          <h2>{rightOption}</h2>
        </article>
      )}
    </div>
  );
}
