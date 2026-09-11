import { randomInt } from "node:crypto";
export const states = [
  "LOBBY",
  "READY",
  "QUESTION_ACTIVE",
  "QUESTION_FINISHED",
  "SHOWING_RANKING",
  "FINISHED",
] as const;
export type Status = (typeof states)[number];
export type Side = "LEFT" | "RIGHT";
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function requireThat(
  condition: unknown,
  code: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(code, status);
}
export function score(correct: boolean, remaining: number, duration: number) {
  return correct
    ? 1000 +
        Math.round(
          (500 * Math.max(0, Math.min(duration, remaining))) /
            Math.max(1, duration),
        )
    : 0;
}
export function gameCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}
export function transition(from: Status, to: Status) {
  const allowed: Record<Status, Status[]> = {
    LOBBY: ["READY"],
    READY: ["QUESTION_ACTIVE"],
    QUESTION_ACTIVE: ["QUESTION_FINISHED"],
    QUESTION_FINISHED: ["SHOWING_RANKING"],
    SHOWING_RANKING: ["QUESTION_ACTIVE", "FINISHED"],
    FINISHED: [],
  };
  requireThat(allowed[from].includes(to), "invalid_transition");
}
export function roles(requester: number, target: number, position: Side) {
  requireThat(requester !== target, "self_pair");
  return position === "LEFT"
    ? { leftPlayerId: target, rightPlayerId: requester }
    : { leftPlayerId: requester, rightPlayerId: target };
}
export function comment(
  correct: number,
  attempts: number,
  time: number,
  streak = 0,
  comeback = false,
) {
  if (!attempts) return "El próximo ENTER puede ser legendario.";
  if (comeback) return "Del bug al despliegue: ¡remontada en marcha!";
  if (streak >= 3) return "Han activado el modo racha. Runtime impecable.";
  if (attempts - correct >= 3)
    return "El debugger sigue buscando. ¡La próxima trae otra pista!";
  if (correct >= 3) return "Compila a la primera. Sospechoso.";
  if (correct && time / correct < 5000)
    return "Más rápidos que un console.log.";
  if (correct) return "Pensar también es un algoritmo.";
  return "Cada intento trae una pista nueva.";
}
