# Koje lo Kuko

Competición presencial de programación por parejas. Un profesor dirige el ritmo; los jugadores entran con un código, acuerdan su posición física y responden con ENTER o un botón móvil. Izquierda = BLANCO; derecha = NEGRO.

## Arranque con Docker

1. Copia `.env.example` a `.env` y cambia las tres contraseñas/secretos por valores aleatorios distintos. `JWT_SECRET` necesita al menos 32 caracteres.
2. Ejecuta `docker compose up -d --build`.
3. Abre `http://localhost`. Registra una cuenta de profesor; no hay credenciales predeterminadas.

Caddy es el único servicio publicado. MySQL conserva sus datos en `mysql_data`; backend y DB solo están en la red interna. El frontend se compila dentro de la imagen de Caddy y se sirve como SPA. El backend espera el healthcheck MySQL y ejecuta migraciones y seeders Sequelize antes de arrancar. Se despliega **una sola instancia backend**.

El seeder contiene exactamente 20 preguntas. Sequelize registra su ejecución en DB, por lo que reiniciar no duplica preguntas. No se usa `sync()`. `db:seed:undo:all` solo debe emplearse sobre una base de desarrollo sin partidas que referencien esas preguntas.

## Desarrollo

Node.js 22 o posterior y MySQL 8.4. `npm ci`, `npm run build`, `npm test`. En PowerShell con ejecución de scripts restringida, utiliza `npm.cmd`.

El backend y Sequelize CLI cargan `.env` desde la raíz automáticamente. Para desarrollo local, usa un MySQL de desarrollo accesible mediante `DB_HOST`/`DB_PORT`. No se publica el MySQL de producción por defecto.

- Migraciones: `npm run db:migrate`.
- Preguntas: `npm run db:seed`.
- Backend: `npm run dev -w backend` (puerto 3000).
- Frontend: `npm run dev -w frontend` (puerto 5173, proxy REST y Socket.IO).

## Verificación

- `npm run build`: TypeScript estricto backend/frontend y build Vite.
- `npm test`: pruebas unitarias de reglas, seeder y teclado, sin requerir DB.
- `docker compose config --quiet`: validación de infraestructura.
- Con el despliegue arrancado: `npm run test:integration -w backend`. Prueba contra MySQL real a través de Caddy con cuatro jugadores y profesor usando exclusivamente polling; crea datos de prueba identificados por emails `integration-*`/`other-*`. Usa `TEST_URL` para otro servidor de pruebas. No ejecutar sobre una clase en curso.
- `npx playwright install chromium` y `npm run test:e2e`: prueba de interfaz con profesor, dos navegadores independientes, viewport móvil, ENTER, botón de respuesta, recarga y podio. Guarda capturas en `test-results/`.

La prueba de integración cubre registro/login, autorización, cinco preguntas, orientación, solicitudes obsoletas, respuestas simultáneas, ocultación de soluciones/puntos, timeout, reconexión y rankings. Incluye una regresión con ocho jugadores, superior al tamaño del pool MySQL, y confirmación de espectadores. Los emails de prueba también usan los prefijos `pool-*` y `browser-*`. No sustituye una prueba presencial de red institucional.

## Uso en el aula

El profesor crea una partida (1–20 preguntas y 10–120 segundos), proyecta el código y espera equipos. Cada jugador invita a la persona de al lado indicando su posición; el destinatario confirma su rol. Ambos pueden cambiar el nombre del equipo en el lobby. Al iniciar con jugadores sin pareja se pide confirmación y pasan a espectadores.

El profesor inicia cada pregunta manualmente. La pregunta cierra al agotarse el tiempo, al responder todos los equipos o mediante el control del profesor. Hasta ese momento se confirma recepción, pero no se revela corrección ni puntuación. Después se muestran explicación y estadísticas, se elige clasificación y se inicia la siguiente. Tras la última, el profesor muestra el podio.

La clasificación individual está desactivada. El interruptor «Ranking por equipos tras cada pregunta» comienza apagado y se sincroniza entre profesor y alumnos. Su valor se conserva al recargar. Al activarlo, el ranking aparece junto a los resultados tras cada pregunta. Se puede avanzar con el ranking oculto; el podio final sigue disponible. Desempates: puntos, aciertos, menor tiempo correcto acumulado e ID estable.

## Sesiones y consistencia

JWT de profesor de 8 horas; contraseñas bcrypt. Token aleatorio de jugador de 256 bits guardado en localStorage por código de partida; DB almacena únicamente SHA-256. Conserva identidad al recargar en el mismo navegador. Para simular varios jugadores usa perfiles/navegadores distintos. El token permite recuperar el resultado de su partida; no concede acceso a otras partidas.

Las mutaciones bloquean la fila Game en una transacción: formación de parejas, inicio/cierre y respuestas se ordenan en MySQL. `TeamMember.playerId UNIQUE` impide pertenecer a dos equipos y `(teamId, side) UNIQUE` impide repetir rol. `TeamAnswer(teamId, gameQuestionId) UNIQUE` garantiza una respuesta incluso entre procesos. Los puntos se derivan en servidor. El cliente envía el ID de la pregunta visible para rechazar ENTER retrasados de otra ronda.

Los timestamps persistidos mandan sobre el contador visual. Un monitor de 250 ms consulta preguntas activas sin escribir ticks y recupera expiraciones tras reiniciar. Cualquier cierre por expiración, también durante una consulta HTTP, notifica a los sockets de la partida después del commit. Las publicaciones se serializan por partida para evitar snapshots fuera de orden. Las comprobaciones de autorización reutilizan la conexión de su transacción. Las reconexiones vuelven a autenticar y reciben un snapshot. La presencia se deriva de las conexiones actuales, sin usar `socket.id` como identidad.

## IsardVDI y diagnóstico

REST y Socket.IO usan el mismo origen. Polling inicia la conexión y WebSocket es opcional. Añade `?polling` a la URL de profesor/jugador para desactivar el upgrade. El profesor muestra el transporte efectivo. Comprueba `/api/health` y completa una partida a través del bastión aunque nunca aparezca WebSocket.

Caddy publica HTTP en el puerto 80 y HTTPS en el 443. Para habilitar HTTPS en Isard, configura en el `.env` del escritorio:

```env
PUBLIC_PORT=80
PUBLIC_HTTPS_PORT=443
SITE_ADDRESS=https://06b9df32-b4e5-4267-8573.74ddeeee70b1.sites.escritorios.ieselrincon.es
```

Ejecuta `docker compose up -d --build`. En la configuración del bastión del escritorio, el puerto HTTP debe apuntar al 80 y el HTTPS al 443. Mantén Proxy Protocol v2 desactivado con esta configuración de Caddy.

Caddy solicita y renueva un certificado público automáticamente. Los volúmenes `caddy_data` y `caddy_config` conservan sus datos entre reinicios. HTTP sigue sirviendo la aplicación: no se fuerza una redirección. El dominio debe resolver al bastión y este debe reenviar las validaciones ACME al escritorio; Caddy necesita salida a Internet. Comprueba la emisión con `docker compose logs --tail=100 caddy` y el acceso con `curl -I https://TU_DOMINIO` (sin omitir la validación del certificado).

En desarrollo, `SITE_ADDRESS=http://localhost` mantiene HTTP sin solicitar un certificado público. Cambia el dominio si recreas el escritorio y cambia su dirección del bastión.

Este comportamiento de reenvío HTTP/HTTPS está documentado en la [guía del bastión de Isard](https://isard.gitlab.io/isardvdi-docs/user/bastion/). Si otra instalación termina TLS en un proxy anterior, puede mantener `SITE_ADDRESS=http://localhost` y reenviar HTTP al puerto 80.

No escalar backend horizontalmente sin adapter compartido y afinidad compatible con polling. Los logs no incluyen tokens, contraseñas ni respuestas.
