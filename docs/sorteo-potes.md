# Sorteo por potes

En la pantalla de sorteo, elegir **Modalidad de sorteo → Sorteo por potes**.
Agregar los grupos, asignar cada convocado a un único pote y ordenarlos con las
flechas para definir el orden de reparto. La numeración no indica nivel: cada
pote reúne alternativas de posición y puntaje similares.

**Armado de potes** permite elegir **Manual** o **Automático por posición y
promedio**. El armado automático usa la posición principal (o el arquero
seleccionado manualmente) y la general de base, incluida la puntuación importada
del servidor. Agrupa jugadores cercanos por puntuación, respetando una diferencia
máxima configurable de general (5 puntos por defecto). Busca tamaños próximos
a la cantidad de equipos, evita grupos de uno cuando hay una alternativa similar
y conserva a todos los seleccionados. Todos los arqueros seleccionados,
incluidos los elegidos manualmente, forman un único pote, sin aplicarles el
límite de diferencia de general ni el tamaño objetivo. Ordena los potes por
posición y, dentro de cada posición, por promedio descendente. Un pote posterior
puede tener mayor promedio que el anterior. Primero se prioriza compartir
posición y puntaje. Si un jugador
de campo queda solo en su posición principal, se busca un pote compatible con
su posición secundaria registrada, respetando el límite de general, sin limitar
el tamaño del pote receptor. Dos jugadores aislados
también pueden formar un pote en una posición secundaria común. Si no hay una
alternativa compatible, una última pasada lo incorpora al pote de jugadores de
campo con promedio GEN más cercano, incluso si requiere combinar posiciones
o superar la diferencia máxima. El mínimo de dos integrantes tiene prioridad;
el grupo se identifica como **Mixto** cuando no comparte la posición del pote.
No se descarta al jugador ni se le inventa una posición. La pertenencia al pote no cambia sus
posiciones registradas ni fuerza su ubicación en la formación.
Un jugador aislado con LAT como posición principal o secundaria también puede
incorporarse a potes DEF o MED como comodín. Se elige el grupo de puntaje más
cercano que respete la diferencia máxima; esta excepción no incluye DEL ni ARQ.
La última pasada por puntaje puede mezclar posiciones de campo, pero nunca
incorpora jugadores de campo al pote de arqueros. Si en toda la selección hay
solamente un jugador de campo (o un solo arquero), no es posible llegar a dos
sin alterar esa separación. Los potes de ausentes guardados se conservan aparte
y no se cuentan como grupos activos para esta regla.
La propuesta queda editable con los mismos controles manuales de pertenencia,
nombre y orden; los miembros guardados que no participan se conservan aparte.

El editor presenta los potes en orden de reparto, con sus jugadores y el
promedio GEN de los convocados. Los jugadores mostrados dentro de cada pote se ordenan por puntuación de base
descendente; los empates se ordenan por nombre. Este orden visual no modifica
la pertenencia ni las posiciones registradas. Cada jugador puede cambiar de pote con el
selector de destino o arrastrándolo al grupo; el botón de quitar lo devuelve a
**Sin pote**. Las flechas cambian la jerarquía del grupo completo. El destino
del arrastre se resalta sin alterar el orden.

**Deshacer** y **Rehacer** recuperan hasta 50 cambios durante la sesión del
editor, incluidos asignaciones, nombres, orden, creación y eliminación.
**Deshacer armado automático** restaura el estado anterior al último armado
automático, incluso después de editar la propuesta. La restauración también
puede deshacerse. Guardar la plantilla no elimina el historial; recargar la
página sí inicia una nueva sesión de edición.

La combinación de arrastre y selector sigue la recomendación de W3C de ofrecer
una alternativa sin arrastre para la misma acción:
https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements

**Guardar potes para próximas fechas** guarda una plantilla compartida en la
base de datos. Los jugadores ausentes conservan su pertenencia y no intervienen
en el sorteo. Los cambios del editor afectan el próximo sorteo; los equipos ya
generados siguen mostrando los potes utilizados al generarlos.

El reparto inicial de cada pote tiene una diferencia de cantidad de hasta un jugador entre
equipos. La cantidad acumulada después de cada pote también difiere como máximo
en uno: los sobrantes se compensan en los siguientes grupos. La búsqueda compara
el puntaje acumulado por pote para favorecer compensaciones de fuerza, manteniendo
las prioridades existentes de velocidad, resistencia, puntaje, posiciones,
arqueros e historial. La fuerza usa los puntajes actuales ajustados a posición
y estado; no implica que el primer pote sea automáticamente superior al segundo.

Un pote con exactamente dos convocados debe mantenerlos en equipos distintos.
La regla es obligatoria durante la generación, el ajuste automático, los
intercambios manuales y el guardado, incluyendo los suplentes asignados a cada
equipo. Cuando hay más de dos convocados en el pote, pueden compartir equipo.
Se cuenta el plantel de la fecha, sin incluir los ausentes de la plantilla.

Para dos equipos y hasta veinte jugadores se evalúan las combinaciones válidas
de forma exhaustiva. Para planteles mayores y tres/cuatro equipos se generan
candidatos compensados y se optimizan por intercambios, favoreciendo el mismo
pote y los potes vecinos. Los saltos grandes se penalizan de manera gradual,
sin prohibirlos. La penalización usa la distancia al cuadrado entre los niveles
intercambiados: un nivel cuesta 1 y cuatro niveles cuestan 16. Cada unidad agrega
0,25 puntos al criterio de diferencia usado para comparar ajustes, después de
las prioridades existentes de restricciones, velocidad y resistencia. Una
mejora suficiente puede justificar el intercambio; la diferencia real de
puntos mostrada al usuario no incluye esa penalización.

En dos equipos se exploran ajustes de los ocho mejores repartos iniciales por
potes; en tres/cuatro equipos se refinan los candidatos seleccionados. Estos
ajustes pueden cambiar las cuotas iniciales para mejorar el equilibrio. La
formación se ajusta con el motor actual. Si no se encuentra un
resultado válido, se informa y se conservan los equipos actuales.

El sorteo habitual sigue disponible. El ajuste manual permite intercambiar entre
cualquier pote, siempre que no reúna a los dos convocados de un mismo pote,
respetando además las restricciones existentes de formación y bloqueo
de posiciones. Los candidatos se ordenan por cercanía y muestran **Mismo pote**,
**1 nivel de distancia**, etc. Los saltos grandes se destacan como orientación,
sin bloquearlos. Esta información utiliza los potes del resultado generado,
aunque se edite la plantilla para el próximo sorteo, y también está disponible
al editar las formaciones de una fecha guardada. Los cambios de posiciones dentro
del equipo y los suplentes conservan sus controles. Guardar equipos conserva en
la fecha una copia de los potes utilizados,
independiente de los cambios posteriores a la plantilla compartida.

La plantilla está en `app_settings.draw_pots_template`; la copia de la fecha,
en `matches.draw_pots_json` (columna creada automáticamente). El endpoint
`guardar_potes.php` requiere permisos de administrador/directivo, valida la
sesión con CSRF, los jugadores registrados y la pertenencia única. Las propuestas
de directivos pueden usar esta modalidad al generarlas; su publicación conserva
el flujo existente de propuestas.

Validación: `npm run build` y `npm run test:potes`. La prueba de navegador crea
una fecha y jugadores temporales, verifica edición, validaciones, guardado,
recarga y tamaños móvil/escritorio, restaura la plantilla y limpia sus fixtures.
