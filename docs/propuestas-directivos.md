# Propuestas de equipos y votación

Solo el administrador crea la fecha, completa sus datos y selecciona a todos los jugadores. Con la convocatoria completa se habilita **Crear mi propuesta** para los directivos en **Inicio** y en **Fechas**. Elige **Por sorteo** o **De forma manual**, arma sus equipos y acomoda posiciones, formaciones y suplentes. Sortear y Capitanes quedan en el menu del administrador. En el armado manual, **Acomodar formaciones** abre un borrador privado: no modifica los equipos finales ni publica una propuesta. **Guardar mi propuesta** la hace visible para votar.


Cada directivo publica una propuesta por fecha. Puede modificarla desde **Editar mi formación** hasta el inicio de la votación: se actualiza la misma propuesta y conserva su numero. Al iniciar la votacion queda bloqueada, aunque el editor estuviera abierto. Cada directivo solo puede editar la propia. Publicar una propuesta no modifica los equipos finales de la fecha. Las propuestas son anónimas: se muestran como Propuesta 1, Propuesta 2, etc., y aparecen en el inicio general cuando corresponden a la próxima fecha, además de su página de votación.

Los usuarios con rol `usuario` o `jugador` tienen un voto por fecha, modificable hasta el cierre. No necesitan estar convocados ni tener un jugador vinculado. Los directivos y administradores pueden consultar las propuestas, pero no votar en esta elección. Los permisos personales de los directivos y las valoraciones de partidos no cambian.

**Configuracion** define dos horarios: **Inicio de votacion de propuestas**, por defecto **24 horas antes del partido**, y **Cierre**, por defecto **2 horas antes**. Antes del inicio los directivos preparan, guardan y modifican sus propuestas, pero los usuarios no pueden votar. Desde el inicio ya no se pueden agregar ni modificar propuestas; los usuarios pueden votar y cambiar su voto hasta el cierre. El inicio debe ser anterior al cierre. Al preparar la fecha se copian ambos valores: cambiar Configuracion no altera los horarios de las votaciones ya preparadas. Las horas se muestran en el horario de Argentina.

Al cerrar, si una propuesta tiene más votos que todas las demás, sus equipos quedan guardados y publicados automáticamente. En empate, el administrador puede elegir entre las más votadas al terminar la votación. Si no elige, se sortea automáticamente entre ellas; sin votos, participan todas las propuestas. La ganadora queda publicada como formación oficial. Si no se publicó ninguna propuesta, no se inventan equipos.

Los sorteos tradicionales y las variantes automáticas siguen disponibles. No se pueden mezclar variantes automáticas y propuestas de directivos en una misma votación. Editar o deshacer una fecha conserva el comportamiento previo de reiniciar equipos y variantes; también reinicia esta votación, por lo que deben publicarse propuestas nuevas.

## Cierre sin visitas a la web

El inicio general y la página de propuestas procesan las votaciones vencidas al visitarse. Para que la publicación ocurra aunque nadie navegue, configurar en el hosting una tarea cron **cada minuto**:

```sh
php /ruta/absoluta/public_html/cerrar_votaciones_equipos.php
```

Reemplazar la ruta y usar el ejecutable PHP CLI del hosting. El archivo está en la raíz para que el bundle seguro lo incluya. Su ejecución por HTTP devuelve 404. La tarea no se configura automáticamente desde este repositorio.

La migración es aditiva y se aplica al cargar el esquema: columna `matches.director_proposals_enabled`, autor y clave única por directivo en `match_draw_options`, y tabla `director_proposal_votes`. No convierte ni borra fechas anteriores.

## Verificación local

```sh
php tests/director-proposals.php
npm run build
npx playwright test tests/director-proposals.spec.js tests/site-pages-smoke.spec.js --workers=1
```

La prueba de integración crea sus propias fechas y usuarios temporales y los elimina al terminar. Comprueba votos modificables, permisos, cierre, empates, ausencia de votos, publicación e idempotencia, y conservación de suplentes y disponibilidad.

## Inicio del directivo

Al crear la fecha, el administrador define una camiseta por equipo después de elegir la cantidad de equipos. Puede elegir un color, **Camisado** o **Descamisado**. Todas las propuestas usan esa configuración; el editor del directivo no ofrece un selector de camisetas.

El inicio separa la propuesta de la proxima fecha, las valoraciones del ultimo partido y la consulta de propuestas/votos. La seccion del ultimo partido deja de aparecer al vencer su plazo de valoracion. Las propuestas son visibles al iniciar la votacion o cuando el administrador pulsa **Mostrar propuestas en Inicio**; esta accion no adelanta el inicio de los votos. El directivo consulta los votos y no puede votar.

En **Editar mi formacion**, **Borrar todo y volver a empezar** elimina unicamente la propuesta propia y permite elegir nuevamente sorteo o armado manual. Esta accion solo se permite antes del inicio de la votacion.

## Control del próximo partido

En Inicio, tanto jugadores como directivos ven las propuestas como alineaciones compactas. **Ver en cancha** despliega la formación de esa propuesta y **Volver a vista lista** permite compactarla otra vez. Se conservan los votos, la diferencia de puntaje y el indicador de ganadora.

El menú se llama **Propuestas próximo partido**. Al entrar sin un enlace a una fecha específica, muestra únicamente la última fecha presentada que aún no finalizó y cuyo partido no pasó. Las fechas anteriores conservan sus datos y enlaces individuales.

El administrador puede pulsar **Iniciar votación ahora** y elegir una duración en minutos (60 por defecto). El inicio manual reemplaza el horario programado para esa fecha, revela las propuestas y bloquea su edición. No reinicia una votación que ya comenzó. **Terminar votación ahora** adelanta el cierre y publica automáticamente la propuesta con más votos. El vencimiento usa la misma publicación y conserva el cron existente para procesar cierres sin visitas.

Inicio anuncia la votación habilitada con una cuenta regresiva para jugadores y directivos. Al vencer se recarga para procesar el cierre y mostrar la ganadora como formación oficial. En empate o sin votos, si el administrador no eligió al cerrar, se resuelve por sorteo automático.
