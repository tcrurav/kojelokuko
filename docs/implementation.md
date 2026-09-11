# Implementación y comprobaciones

La aplicación está implementada como monorepo npm: servicios Express/Sequelize en `backend`, pantallas React/Vite/Tailwind en `frontend` y assets estáticos servidos por Caddy. Las instrucciones de arranque están en `README.md`.

## Decisiones concretas

- `READY` significa competición iniciada, pendiente de la primera pregunta. El emparejamiento y los nombres se editan únicamente en `LOBBY`.
- El profesor puede iniciar con jugadores sin pareja tras confirmar que serán espectadores. Se necesita al menos un equipo completo.
- Las preguntas cierran al responder todos los equipos, al expirar el tiempo o mediante el profesor. Nunca avanzan automáticamente a la siguiente.
- `TeamMember` refuerza los roles con restricciones únicas por jugador y por pareja/posición. La creación de ambos miembros es atómica.
- Las mutaciones se serializan mediante bloqueo de la fila Game, además de la restricción única de TeamAnswer. Los conflictos de respuesta devuelven `already_answered`.
- Durante una pregunta activa se ocultan corrección, explicación y puntos de esa ronda, incluidos los rankings. Se permite mostrar recepción, opción elegida y persona que respondió a su propio equipo.
- Los snapshots son transaccionales. Autorización y lectura reutilizan su conexión; las publicaciones Socket.IO se ordenan por partida.
- La presencia se deriva de sockets actuales. La identidad persistente se recupera mediante token aleatorio de jugador, del que solo se almacena el hash. No se borra a un jugador desconectado.
- Caddy sirve el build frontend directamente; no hace falta un contenedor adicional para Vite en producción. La configuración confía en un salto de proxy para rate limiting porque el backend no está publicado.
- Se mantiene una instancia backend. Los eventos locales de expiración notifican el cierre después del commit, incluso si lo detectó una petición REST.

## Validación realizada en el workspace

- Build TypeScript de ambos proyectos y assets Vite.
- Nueve pruebas unitarias: puntuación, códigos, orientación, estados, comentarios, seeder, atributos Sequelize, JWT y teclado.
- Integración MySQL real mediante Caddy y exclusivamente HTTP polling: ocho jugadores simultáneos, espectadores y partida completa de cinco preguntas con cuatro jugadores, carrera de respuestas, timeout y reconexión.
- Chromium: registro de profesor, creación, dos sesiones de jugador independientes, confirmación de roles, nombre de equipo, ENTER, respuesta móvil, recarga, rankings y podio. Capturas inspeccionadas de escritorio y móvil.
- Docker Compose construido y arrancado; MySQL/backend saludables y Caddy publicado en 8080.
- Consulta directa a MySQL: exactamente 20 preguntas; restricciones únicas de respuesta y membresía presentes.
- Auditoría de dependencias de producción sin vulnerabilidades reportadas en esta ejecución.

El entorno de pruebas es local. La ruta institucional IsardVDI/bastión requiere una comprobación desde esa red, siguiendo el procedimiento de `README.md`.
