# Especificación funcional — Juego educativo por parejas

## 1. Visión

Aplicación web para realizar una competición presencial en un aula. El profesor proyecta su pantalla y controla el ritmo. Los participantes, normalmente profesores de ciclos de informática actuando como alumnos/jugadores, se conectan desde sus dispositivos y juegan físicamente por parejas.

El objetivo no es solo acertar: las preguntas deben provocar conversación breve entre las dos personas antes de responder.

## 2. Roles

### Profesor
Tiene cuenta permanente, se registra e inicia sesión. Puede crear y dirigir partidas, decidir cuándo empieza cada pregunta y alternar clasificaciones.

### Alumno/jugador
No se registra. Entra mediante código de partida, elige nombre y avatar y obtiene una identidad temporal asociada a esa partida.

## 3. Home

Mostrar dos accesos principales:
- **Soy profesor**
- **Soy alumno**

La interfaz debe sentirse como un juego educativo moderno, atractiva y clara, no como un panel administrativo.

## 4. Registro y login del profesor

Los nuevos registros quedan pendientes de activación por un administrador y no reciben sesión hasta ser aprobados. Los profesores existentes conservan su acceso al introducir esta función.

El administrador inicia sesión mediante el mismo formulario y accede a `/admin`. Puede buscar profesores por nombre/email, paginar, activar, desactivar y borrar con confirmación. Desactivar revoca las sesiones existentes; reactivar requiere un nuevo login. Borrar anonimiza los datos de acceso, mantiene el historial de partidas y no permite restaurar la cuenta desde el panel. Las cuentas de administrador están protegidas. No se puede obtener el rol administrativo mediante registro público.

Datos mínimos:
- nombre;
- email;
- contraseña.

Permitir registro, login y logout. Las rutas privadas del profesor requieren autenticación.

## 5. Creación de partida

El banco compartido permite a profesores activar y desactivar preguntas sin eliminarlas. Las existentes y las nuevas son activas por defecto. Las desactivadas siguen visibles y editables en gestión, pero solo las activas se sortean para nuevas partidas. El número disponible del formulario cuenta únicamente activas. Las partidas ya creadas mantienen su selección y contenido.

Desde su dashboard, el profesor crea una partida indicando:
- número de preguntas (entre 1 y 20; ofrecer presets 5, 10, 15 y 20);
- tiempo por pregunta (por ejemplo 10, 15, 20 o 30 segundos).
- dificultad: elegir un nivel con preguntas activas o «Todas las dificultades» (por defecto). Las preguntas sin nivel se agrupan como «Sin especificar». El número seleccionable se limita a las preguntas activas del nivel elegido, con un máximo de 20; el servidor rechaza la creación si no hay suficientes.

Al crearla:
- seleccionar aleatoriamente el número solicitado de preguntas de la batería;
- congelar selección y orden mediante `GameQuestion`;
- generar código corto, legible y único entre partidas activas, evitando caracteres ambiguos.

Mostrar el código muy grande para proyección.

## 6. Entrada de alumnos

El alumno introduce el código. Solo puede continuar si la partida existe y admite entradas.

Después:
1. introduce nombre/nickname;
2. elige uno de al menos 12 avatares propios/emoji/CSS sin servicios externos;
3. entra al lobby.

Avatares sugeridos: robot, ninja, astronauta, dinosaurio, alien, pulpo, gato, hacker, mago, científico, caballero y fantasma.

## 7. Lobby

Todos ven actualizaciones en tiempo real:
- avatar;
- nombre;
- estado (`Buscando pareja`, `Formando equipo`, `Equipo preparado`).

El profesor ve número de jugadores y equipos completos.

La aplicación debe seguir funcionando si Socket.IO utiliza únicamente HTTP long-polling.

## 8. Formación de parejas

Un jugador disponible elige a otro disponible y señala la posición física del compañero:
- “Está a mi izquierda”
- “Está a mi derecha”

El destinatario recibe la solicitud y debe aceptarla. La interfaz debe hacer inequívoca la orientación resultante.

Reglas:
- nadie puede emparejarse consigo mismo;
- un jugador solo puede pertenecer a un equipo;
- no seleccionar jugadores ya emparejados;
- impedir solicitudes/aceptaciones obsoletas;
- validar todo en servidor.

Al confirmar:
- persona físicamente a la izquierda → **BLANCO / opción izquierda**;
- persona físicamente a la derecha → **NEGRO / opción derecha**.

La asignación permanece toda la partida.

## 9. Nombre de equipo

Tras formar la pareja, permitir establecer/modificar el nombre del equipo mientras la partida no haya empezado. Ambos miembros lo ven inmediatamente.

Ejemplos de tono: “Los Null Pointer”, “Stack Attack”, “Ctrl+Alt+Elite”, “404 Team Not Found”.

## 10. Lobby del profesor

Mostrar:
- código de partida;
- jugadores conectados;
- equipos listos;
- jugadores sin pareja;
- tarjetas de equipos con nombre, avatares, jugador blanco/izquierdo y negro/derecho.

Botón **Iniciar competición**. Puede iniciarse con jugadores sin pareja, pero mostrar confirmación; esos jugadores quedan como espectadores/no participantes.

## 11. Estados de partida

Estados funcionales:
- `LOBBY`
- `READY`
- `QUESTION_ACTIVE`
- `QUESTION_FINISHED`
- `SHOWING_RANKING`
- `FINISHED`

El backend controla y valida las transiciones.

## 12. Inicio de competición y preguntas

El profesor controla el ritmo. No avanzar automáticamente.

Al iniciar una pregunta:
1. backend determina `GameQuestion`;
2. establece `questionStartedAt` y `expiresAt`;
3. envía enunciado y dos opciones sin revelar la correcta;
4. los clientes sincronizan visualmente la cuenta atrás.

El profesor puede mantener pantallas de explicación/clasificación el tiempo que desee antes de iniciar la siguiente.

## 13. Pantalla de pregunta del alumno

Mostrar de forma prominente:
- “Pregunta X / N”;
- enunciado;
- opción izquierda: ⚪ BLANCO;
- opción derecha: ⚫ NEGRO;
- temporizador;
- rol propio;
- instrucción: “Habla con tu pareja. Pulsa ENTER cuando estéis de acuerdo.”

El rol propio debe ser imposible de confundir.

## 14. Respuesta

Cada integrante representa una de las dos respuestas:
- izquierda = BLANCO;
- derecha = NEGRO.

La pareja debate. Si elige la opción negra, debe pulsar ENTER el jugador negro; si elige la blanca, el blanco.

El primer ENTER válido que el servidor consigue aceptar para ese equipo/pregunta fija la respuesta. No puede modificarse.

Registrar:
- pregunta;
- equipo;
- jugador que respondió;
- opción;
- instante de recepción/aceptación;
- tiempo de respuesta;
- corrección;
- puntos.

El backend debe resolver respuestas simultáneas de forma robusta mediante la restricción única de base de datos.

En móvil, mostrar un botón grande “RESPONDER COMO BLANCO” o “RESPONDER COMO NEGRO”, según el rol, con la misma acción que ENTER.

## 15. Timeout

El backend es autoridad. Una respuesta recibida tras `expiresAt` se considera fuera de tiempo aunque la animación local todavía muestre otra cosa.

Al finalizar el tiempo, cerrar la pregunta para todos.

## 16. Feedback

Tras respuesta aceptada:
- correcta: `✅ ¡Correcto!`
- incorrecta: `❌ No era esa.`
- timeout: `⌛ ¡Tiempo agotado!`

Cuando proceda: `Respondió María · NEGRO`.

No revelar la solución antes de que la pregunta quede cerrada según las reglas del servidor.

## 17. Puntuación

Fórmula inicial recomendada:
- incorrecta/no respondida: 0;
- correcta: 1000 puntos base;
- bonus de velocidad: 0–500 según proporción de tiempo restante.

Ejemplo:

`score = 1000 + round(500 * remainingMs / durationMs)`

acotando `remainingMs` a `[0, durationMs]`.

La fórmula vive solo en backend y debe estar aislada para poder cambiarla.

## 18. Clasificación por equipos

El profesor dispone de un interruptor de ranking por equipos, apagado al crear la partida y persistido al recargar. Al activarlo, se muestra tras cada pregunta junto a la explicación para todos. Puede volver a ocultarlo y avanzar sin mostrar ranking. El podio final sigue disponible independientemente del interruptor.

Después de cada pregunta, permitir mostrar:
- posición;
- avatares;
- nombre del equipo;
- puntos acumulados;
- aciertos;
- comentario divertido.

Desempates recomendados:
1. mayor puntuación;
2. mayor número de aciertos;
3. menor suma de tiempos en respuestas correctas;
4. identificador estable como último criterio.

## 19. Clasificación individual

La clasificación individual está desactivada: no se muestra ni se publica por API o Socket.IO. La siguiente descripción queda como referencia histórica, sin funcionalidad activa.

Individual:
- posición;
- avatar;
- nombre;
- equipo;
- contribución individual;
- respuestas lanzadas;
- aciertos al responder;
- comentario.

Métrica: cuando un jugador pulsa ENTER y la respuesta resulta correcta, recibe como contribución individual los puntos otorgados al equipo por esa respuesta. El equipo siempre comparte su puntuación total; la contribución solo mide quién ejecutó las respuestas.

## 20. Comentarios divertidos

Generar localmente mediante reglas basadas en estadísticas, sin APIs de IA.

Categorías:
- muchas correctas;
- muchas incorrectas;
- rapidez;
- lentitud con acierto;
- racha;
- remontada;
- poca participación.

Ejemplos:
- “Hoy desayunaron Stack Overflow.”
- “Compila a la primera. Sospechoso.”
- “Van con O(1) de confianza.”
- “Su debugger ha pedido vacaciones.”
- “404: respuesta correcta no encontrada.”
- “Más rápidos que un console.log.”
- “Pensar también es un algoritmo.”
- “Han activado el modo god.”
- “Runtime impecable.”

Mantener variedad y evitar humillaciones, características personales o humor ofensivo.

## 21. Vista del profesor tras cada pregunta

Mostrar:
- respuesta correcta;
- explicación pedagógica;
- número de equipos que respondieron;
- aciertos;
- errores;
- sin respuesta;
- clasificación.

Controles:
- **Clasificación por equipos**
- **Ranking por equipos tras cada pregunta: activado/desactivado**
- **Siguiente pregunta**

El profesor decide cuándo continuar.

## 22. Fin de partida

Tras la última pregunta:
- podio de equipos (1.º, 2.º, 3.º);
- clasificación completa;
- solo clasificación por equipos;
- mensaje celebratorio;
- volver al dashboard.

No es necesaria revancha automática.

## 23. Batería inicial: exactamente 20 preguntas

Ampliación: un segundo seeder añade 20 preguntas de dificultad `Baja` para docentes con poca experiencia en programación (40 en total). Usa lenguaje cotidiano, cálculos simples y situaciones de aula, sin exigir sintaxis ni vocabulario avanzado. Cada pregunta incluye dos opciones, una solución y una explicación breve.

Crear mediante Seeder Sequelize. Todas en español, con dos alternativas plausibles, una sola correcta y explicación pedagógica. Dificultad accesible para docentes de informática con niveles heterogéneos.

La selección inicial debe cubrir, de forma equilibrada:
1. estructuras de datos;
2. legibilidad;
3. Git;
4. SQL;
5. índices de base de datos;
6. testing;
7. APIs HTTP;
8. seguridad de contraseñas;
9. validación de entrada;
10. concurrencia;
11. asincronía;
12. debugging;
13. diseño modular;
14. duplicación;
15. manejo de errores;
16. tipos;
17. complejidad algorítmica;
18. transacciones;
19. autenticación/autorización;
20. mantenibilidad/refactorización.

Evitar preguntas triviales del tipo “¿HTML es un lenguaje de programación?”. Favorecer escenarios donde ambas respuestas merezcan una discusión breve.

Cada pregunta incluye:
- `statement`;
- `leftOption`;
- `rightOption`;
- `correctOption` (`LEFT`/`RIGHT`);
- `explanation`;
- `category`;
- `difficulty`.

## 24. Reconexión

Al entrar, entregar token temporal de jugador, almacenado en el navegador. Una recarga/reconexión debe intentar recuperar:
- jugador;
- equipo;
- rol;
- estado;
- pregunta activa.

`socket.id` no es identidad persistente.

Mostrar estados “Conexión perdida” y “Reconectando”. El profesor debe poder distinguir desconectados sin borrar inmediatamente su participación.

## 25. Diagnóstico de conectividad

En la interfaz del profesor mostrar discretamente:
- conectado/desconectado;
- transporte actual: `HTTP polling` o `WebSocket`.

`GET /api/health` debe permitir comprobar al menos:
- servicio backend;
- conexión a base de datos.

El despliegue se considera válido aunque Socket.IO permanezca siempre en polling.

## 26. UX y accesibilidad

Priorizar portátiles, pero ser responsive.

Características:
- tipografía grande;
- tarjetas claras;
- buen contraste;
- estados visuales evidentes;
- microanimaciones moderadas;
- esquinas redondeadas;
- identidad propia inspirada en juegos educativos, sin copiar marcas.

BLANCO/NEGRO nunca se comunica solo mediante color: añadir posición, texto e iconos.

La pantalla del profesor debe ser especialmente legible en proyector.

## 27. Estados de error

Tratar explícitamente:
- código inexistente;
- partida cerrada/ya iniciada;
- loading;
- error de red;
- reconexión;
- jugador ya emparejado;
- solicitud de pareja obsoleta;
- compañero desconectado;
- timeout;
- acción no autorizada.

No dejar pantallas en blanco.

## 28. Criterio de aceptación end-to-end

Debe ser posible:
1. registrar profesor;
2. iniciar sesión;
3. crear partida de 5 preguntas/20 segundos;
4. obtener código;
5. entrar cuatro jugadores desde otros navegadores;
6. elegir nombre/avatar;
7. verlos aparecer en tiempo real/polling;
8. formar A+B y C+D;
9. asignar correctamente izquierda=BLANCO y derecha=NEGRO;
10. nombrar equipos;
11. iniciar partida;
12. mostrar misma pregunta;
13. debatir;
14. responder mediante ENTER del color elegido;
15. aceptar una sola respuesta aunque ambos pulsen casi a la vez;
16. mostrar feedback;
17. cerrar pregunta por respuesta/tiempo según el flujo definido;
18. mostrar explicación;
19. activar y ocultar ranking por equipos;
20. mostrar comentarios;
21. avanzar manualmente;
22. mostrar podio final;
23. recuperar razonablemente una sesión tras recarga;
24. completar todo el flujo aun si Socket.IO usa solo HTTP polling.
