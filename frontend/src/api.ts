export const messages: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  unauthorized: "Tu sesión ha caducado. Vuelve a entrar.",
  game_not_found: "No encontramos ese código.",
  game_closed: "La partida ya no admite entradas.",
  already_paired: "Uno de los jugadores ya tiene pareja.",
  pending_request:
    "Hay una solicitud pendiente. Acéptala, recházala o cancélala.",
  stale_request: "Esta solicitud ya no está disponible.",
  already_answered: "Tu equipo ya respondió.",
  timeout: "¡Tiempo agotado!",
  question_closed: "La pregunta está cerrada.",
  forbidden: "No tienes permiso para esta acción.",
  invalid_input: "Revisa los campos introducidos.",
  already_exists: "Ese email ya está registrado.",
  no_teams: "Hace falta al menos un equipo completo.",
  busy: "Espera un instante y vuelve a intentarlo.",
  stale_question: "La pregunta ha cambiado. Espera a la sincronización.",
};
export const errorText = (code: string) =>
  messages[code] || "No se pudo completar la acción. Inténtalo de nuevo.";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (localStorage.getItem("teacherToken") || ""),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(errorText(result.error));
  return result as T;
}
export function ignoresEnter(
  event: { key: string; repeat: boolean },
  target: Element | null,
) {
  return (
    event.key !== "Enter" ||
    event.repeat ||
    !!target?.closest(
      'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"])',
    )
  );
}
