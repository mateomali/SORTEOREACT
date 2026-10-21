# Premios y podios

Los siguientes premios permiten seleccionar uno, dos o tres jugadores, con orden de podio: Pase magistral, El muro, Capocannoniere, Terminator, La guinda, La golosa, La putita, Chenemigo y Goodfellas.

Man of the Match, Gol de la fecha, Lírico, Pelusa, Bochini, El Mariscal, El tractor y Golero imbatible conservan un único destinatario por evaluador. Las categorías siguen siendo opcionales según las reglas vigentes de la fecha. Un jugador puede recibir premios de distintas categorías, pero no ocupar dos puestos del mismo podio.

## Votación

- Un primer puesto suma 3 puntos, un segundo 2 y un tercero 1. Se permiten podios de una o dos personas; no es necesario completar tres puestos.
- Los premios con podio publican hasta los tres candidatos con mayor puntaje, según la cantidad de jugadores que recibieron votos.
- Los empates se resuelven por cantidad de primeros puestos, luego segundos puestos, promedio de las valoraciones, goles en la fecha y nombre. Si todavía coinciden, se usa el ID para tener un orden determinista.
- Los premios individuales mantienen la cantidad de votos y sus criterios anteriores de promedio, goles y nombre.
- Goodfellas permite elegir a cualquier jugador registrado, activo o inactivo, haya estado convocado o no. Los demás premios mantienen la lista de participantes; Golero imbatible conserva su lista de arqueros.
- Las modalidades de fecha (puntajes, premios o ambos), los evaluadores y los plazos existentes siguen vigentes.

## Guardado y compatibilidad

Se agrega `award_position`, con valor inicial 1, a `match_awards` y `match_director_award_votes`. Los índices únicos incluyen la posición. La migración es automática al abrir las pantallas de premios y conserva los registros existentes como primeros puestos; no recalcula resultados ya publicados.

Las lecturas mantienen el primer ganador en el formato anterior y agregan `podium` con la lista completa en orden. Historial, resumen compartido, publicación de votaciones, perfiles, estadísticas y CSV muestran o conservan las posiciones. La carga directa del administrador admite las mismas cantidades y la excepción de Goodfellas. Reducir un podio elimina los puestos sobrantes en la misma transacción.

## Prueba

```text
npx playwright test tests/award-podium.spec.js --workers=1
```

La prueba crea datos temporales y verifica carga móvil, cambios de orden, persistencia, puntaje 3/2/1, desempate por primeros puestos, restricciones de categorías individuales, rechazo atómico de duplicados, publicación de podios, Goodfellas para no participantes activos e inactivos, perfil de un premiado sin asistencia, edición administrativa y exportación CSV. Al terminar elimina las fechas, cuentas, evaluadores y jugadores de prueba.
