# Partidos en vivo

Las fechas creadas desde esta versión guardan `dynamic_fixture = 1`. Con tres o cuatro equipos, la acción «Partidos en vivo» abre `partidos_en_vivo.php`. Las fechas anteriores conservan el fixture y el editor existentes; la migración usa `DEFAULT 0` y no cambia su modalidad.

## Reglas

- Se eligen los dos equipos iniciales.
- Con tres equipos, sigue el ganador; en empate con goles, quien marcó primero. Con 0–0 se pregunta quién tiene prioridad. Un equipo debe descansar después de dos partidos consecutivos. Si hace falta, tienen prioridad los cruces pendientes para completar exactamente dos partidos por pareja en seis encuentros. El criterio se muestra junto al marcador.
- Con cuatro equipos, después del primer partido entran los otros dos. Se sortean los dos cruces de ganador contra perdedor, luego se sortean los cruces restantes. La vuelta repite el orden de los primeros seis partidos. Los empates usan el primer gol o la elección manual con 0–0 para definir el lugar en los cruces, sin convertir el empate en una victoria para la tabla.
- Después de seis o doce partidos se pueden agregar encuentros individuales. Con tres se mantiene la regla de permanencia y descanso; con cuatro se continúa la secuencia original.
- El reloj descuenta diez minutos por defecto, permite pausa y reanudación, continúa en negativo y solo se detiene al finalizar manualmente. Ajustes define el valor para fechas nuevas; se puede cambiar al crear la fecha y entre partidos. Los partidos existentes conservan su duración.
- Cada gol guarda equipo beneficiado, autor opcional, condición de gol en contra y tiempo si se registró con el reloj. Los goles sin autor y en contra cuentan en el marcador, pero no como goles personales del autor. Si se carga el marcador al terminar, se solicita el primer equipo en marcar cuando hace falta resolver un empate.
- Se pueden completar goleadores después de terminar un partido y corregir resultados. Las correcciones no cambian los equipos de cruces ya armados. Los plazos existentes de valoraciones y premios se conservan por separado.
- El cierre de fecha es independiente del final de cada partido. Permite terminar anticipadamente con una confirmación que informa los partidos pendientes.
- Los premios se guardan por evaluador y categoría. Un jugador puede recibir varias categorías; la búsqueda existente y la selección desde lista permanecen disponibles. Las reglas de puntajes y premios de cada fecha siguen vigentes.

## Persistencia y acceso

`match_live_sessions` contiene el registro de partidos, goles y reloj. El reloj usa tiempo del servidor y se sincroniza al recargar o cambiar de dispositivo. Cada escritura bloquea la fecha y comprueba la revisión; una revisión desactualizada devuelve HTTP 409 sin duplicar la acción. Los cambios requieren una sesión de administrador o directivo y token CSRF. No hay guardado de acciones sin conexión.

Al terminar partidos o corregir datos, se actualizan en la misma transacción `match_round_robin_results`, `match_teams.goals` y `match_players.goals`, para conservar el historial y las estadísticas existentes. Cerrar la fecha actualiza su estado y fecha de finalización. Reiniciar el sorteo desde la administración elimina la sesión de juego asociada.

Las columnas y tabla nuevas se crean automáticamente al abrir la administración o el marcador. Para publicar hay que incluir los archivos PHP nuevos, el CSS y **todo** el resultado de `npm run build:react`; los nombres de los módulos compilados cambian con el build.

## Verificación

```text
npm run test:live
npx playwright test tests/site-pages-smoke.spec.js --workers=1
```

Las pruebas de reglas recorren exhaustivamente 384 rutas con tres equipos y 180 secuencias con cuatro. Las pruebas de navegador crean y limpian fechas y jugadores temporales; comprueban marcador, tiempo extra, pausa, goleadores, goles en contra, correcciones, premios repetidos, acceso directivo, conflictos entre revisiones, fechas anteriores y creación de fechas nuevas.
