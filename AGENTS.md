# AGENTS.md

## Propósito

Este repositorio contiene una aplicación web de competición educativa presencial por parejas.

Un profesor crea y controla una partida. Los alumnos/jugadores entran sin cuenta mediante un código corto, eligen nombre y avatar, forman una pareja con la persona sentada a su lado, asignan un nombre al equipo, debaten preguntas de programación y responden mediante una mecánica BLANCO/IZQUIERDA frente a NEGRO/DERECHA.

Antes de realizar cambios sustanciales, lee:

- `docs/product-spec.md`
- `docs/architecture.md`
- `README.md` cuando exista.

`docs/product-spec.md` define el comportamiento esperado del producto. `docs/architecture.md` define las decisiones técnicas que deben preservarse.

Si un detalle menor no está especificado, adopta una solución razonable, mantenible y coherente; no detengas el trabajo salvo que exista un bloqueo real.

## Stack obligatorio

### Backend
- Node.js
- Express
- TypeScript estricto
- Sequelize
- MySQL
- migraciones Sequelize
- seeders Sequelize
- Socket.IO
- Zod
- JWT
- bcrypt

No usar Prisma. No sustituir MySQL por SQLite. No usar `sequelize.sync()` como mecanismo de creación/migración del esquema en producción.

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Socket.IO Client

### Infraestructura
- Docker
- Docker Compose
- Caddy como proxy inverso y único punto público previsto en producción.

## Restricción IsardVDI / bastión

La aplicación puede desplegarse detrás de IsardVDI y de un bastión/proxy institucional. No se puede asumir que dicho proxy permita el upgrade a WebSocket.

Socket.IO debe funcionar completamente mediante HTTP long-polling. WebSocket es una mejora opcional, no un requisito.

No configurar cliente ni servidor con `transports: ["websocket"]` como única opción. Mantener polling y websocket habilitados, preferiblemente iniciando por polling y permitiendo upgrade automático cuando sea posible.

Deben funcionar usando únicamente polling:
- entrada y reconexión de jugadores;
- lobby;
- formación de parejas;
- nombres de equipos;
- inicio/fin de partida;
- inicio/fin de preguntas;
- envío de respuestas;
- clasificaciones.

Añadir diagnóstico para el profesor del transporte Socket.IO efectivo (`polling` o `websocket`) y un endpoint HTTP `/api/health`.

## Autoridad del servidor

El backend es la única fuente de verdad para:
- estado de partida;
- participantes y equipos;
- roles izquierda/derecha;
- pregunta activa;
- `startedAt` / `expiresAt`;
- aceptación de respuestas;
- respuesta correcta;
- puntuación;
- clasificaciones.

Nunca confiar en puntuaciones, corrección, tiempos o estados calculados por el frontend. No enviar `correctOption` a alumnos mientras la pregunta esté activa.

## Mecánica de parejas

Cada equipo tiene exactamente dos jugadores:
- jugador físicamente a la izquierda = BLANCO = opción izquierda;
- jugador físicamente a la derecha = NEGRO = opción derecha.

Los roles permanecen durante toda la partida.

La pareja debate. Para elegir una respuesta, pulsa ENTER el jugador cuyo rol representa esa opción. En móvil, se muestra un botón grande equivalente al ENTER para el rol propio.

## Concurrencia crítica

Puede haber dos ENTER casi simultáneos. Solo una respuesta puede ser aceptada por equipo y pregunta.

La base de datos debe imponer una restricción única equivalente a:

`UNIQUE(teamId, gameQuestionId)`

Resolver la carrera con transacción y/o manejo del conflicto de restricción única. No confiar solo en flags en memoria.

El primer registro válido que consiga confirmarse en servidor determina la respuesta.

## Tiempo

El servidor controla el tiempo. Mantener autoritativamente:
- `questionStartedAt`;
- `expiresAt`.

El cliente recibe timestamps y dibuja la cuenta atrás. No escribir ticks cada segundo en MySQL. Una respuesta que llega al servidor fuera del plazo se rechaza.

## Máquina de estados

Modelar explícitamente las transiciones. Como mínimo:
- `LOBBY`
- `READY`
- `QUESTION_ACTIVE`
- `QUESTION_FINISHED`
- `SHOWING_RANKING`
- `FINISHED`

Las transiciones se validan en backend. React no determina el estado autoritativo.

## Sesiones y reconexión de alumnos

Los alumnos no tienen cuentas permanentes. `Player` pertenece a una partida.

No identificar al jugador únicamente con `socket.id`. Crear un token temporal de jugador/sesión que permita recuperar tras recarga:
- identidad;
- equipo;
- rol;
- estado de partida;
- pregunta activa cuando proceda.

Validar el token en backend.

## Profesor

Los profesores sí tienen cuentas permanentes. Las contraseñas se hashean con bcrypt, nunca se registran en logs ni se devuelven por API. Las operaciones privadas requieren JWT y autorización sobre la partida.

## Validación y seguridad

Validar entradas externas con Zod. Limitar longitudes y rangos. Usar Helmet y rate limiting razonable en registro/login. Configurar CORS solo cuando sea necesario según el despliegue.

Verificar siempre pertenencia/propiedad de IDs enviados por clientes.

## Base de datos

Todo cambio de esquema requiere migración Sequelize. Al modificar un modelo:
1. crear/actualizar migración;
2. actualizar modelo;
3. actualizar validación/servicio;
4. actualizar tests;
5. actualizar seeds cuando corresponda.

Las 20 preguntas iniciales deben proceder de un seeder Sequelize real.

## Preguntas

La base inicial contiene exactamente 20 preguntas en español. Cada una tiene:
- enunciado;
- opción izquierda/blanca;
- opción derecha/negra;
- opción correcta;
- explicación;
- categoría;
- dificultad opcional.

Deben favorecer debate razonable y no mera memorización. Temas preferentes: mantenibilidad, legibilidad, testing, Git, SQL, bases de datos, APIs, seguridad, algoritmos, debugging, arquitectura, concurrencia y diseño de software.

## Puntuación y rankings

La puntuación se calcula solo en backend. El acierto debe pesar claramente más que la velocidad. Aislar la fórmula en una función/servicio testeable.

Mantener ranking por equipos e individual. Los comentarios divertidos se generan localmente mediante reglas/plantillas basadas en estadísticas, sin IA externa, sin insultos ni referencias personales.

## UX

Es una aplicación para uso en aula y proyección. Priorizar:
- tipografía grande;
- jerarquía evidente;
- contraste;
- accesibilidad;
- teclado;
- responsive;
- estados de conexión claros;
- baja carga cognitiva.

No depender exclusivamente del color: BLANCO/NEGRO debe reforzarse con texto, posición e iconos.

No capturar ENTER mientras se escribe en `input`, `textarea`, `select` o elementos editables. Prevenir `key repeat`, listeners duplicados y dobles envíos en frontend, sin sustituir las garantías de backend.

## Calidad

Usar TypeScript estricto y evitar `any`. Preferir controladores delgados, lógica de negocio en servicios, manejo centralizado de errores, validadores reutilizables y módulos pequeños. Evitar sobreingeniería y dependencias innecesarias.

## Tests prioritarios

Cubrir especialmente:
1. puntuación;
2. códigos de partida;
3. formación de parejas;
4. coherencia izquierda/derecha;
5. una respuesta por equipo/pregunta;
6. respuestas simultáneas;
7. timeout;
8. autorización;
9. máquina de estados;
10. reconexión básica.

Los bugs de lógica crítica deben incorporar test de regresión.

## Forma de trabajar

Para cambios sustanciales:
1. inspeccionar primero el repositorio;
2. leer esta guía y la documentación relevante;
3. reutilizar patrones existentes;
4. hacer el conjunto mínimo pero completo de cambios;
5. crear migraciones si cambia el esquema;
6. añadir/actualizar tests;
7. actualizar documentación;
8. ejecutar verificaciones relevantes;
9. informar solo de resultados realmente ejecutados.

No detenerse en scaffolding si la funcionalidad solicitada puede implementarse. No dejar TODOs críticos sin un bloqueo real.

Como mínimo, cuando el entorno lo permita, ejecutar:
- `npm run build`
- `npm test`

Para infraestructura:
- `docker compose config`

No afirmar que un comando pasó si no se ejecutó con éxito.
