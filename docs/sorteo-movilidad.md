# Movilidad y separaciones en el sorteo

El ritmo se evalúa con `ritmo_stat` efectivo (incluye disponibilidad), excluyendo
al arquero asignado. No se modifican las valoraciones ni los equipos guardados al
abrir el análisis.

- Lento: velocidad <= 3. Movilidad muy baja: velocidad <= 2.
- Carga de lentitud individual: `max(0, 3 - velocidad)^2`.
- Se compara la diferencia de cantidad de movilidad muy baja y de carga total.
- La concentración por sector suma los productos de las cargas de cada pareja
  en DEF (incluye LAT), MED y DEL. Detecta también parejas como 1,8 + 2,2 aunque
  solo uno cruce el umbral de 2.

Después de las restricciones obligatorias, el comparador equilibra
Despliegue y puntaje con peso 50/50. Luego busca como objetivo un máximo de un lento
de diferencia y prioriza movilidad muy baja, carga de lentitud y concentración por
sector. El constructor,
la búsqueda de intercambios y el refinamiento conservan estas prioridades. La
diversidad aleatoria no puede empeorar estas métricas.

Las parejas elegidas en **Separar jugadores** son restricciones explícitas: si ambos
participan, deben estar en equipos distintos. No se agrega ninguna pareja por nombre
automáticamente. El algoritmo no relaja la regla si no encuentra una solución.
Los cambios manuales conservan sus controles; una pareja incumplida se señala y
debe resolverse o quitarse antes de guardar. El servidor vuelve a validarla.

Las reglas se guardan en `draw_audit_snapshot.criteria.separated_pairs`. Las
propuestas privadas guardan su lista en el JSON de equipos; al publicar la ganadora
se transfiere a la fecha oficial. La edición de formaciones preserva el resto de
la auditoría al actualizar esta lista. No requiere una migración nueva.

El análisis explica el estado actual. Sus sugerencias son intercambios individuales,
no una prueba de óptimo global. Respetan puestos naturales, posiciones fijadas y
separaciones (también las parejas de potes); la diferencia total y por línea no
puede superar el margen actual o 2 puntos. Se muestran todas las variaciones antes
de aplicar y se usa el movimiento normal de la cancha, con su mecanismo de deshacer.

Verificación: `npm run test:mobility` y `node tests/sorteo-football-balance.cjs`.

## Despliegue y puntaje por habilidad

Por decisión del usuario, Ida y vuelta pasa a llamarse Despliegue conservando sus
notas actuales (`stamina` en SQL y `resistencia` en el cliente). No se ejecuta un
UPDATE de valoraciones. Despliegue mide participación y desplazamiento entre
sectores, distinto de velocidad y de las posiciones habilitadas.

La primera prioridad compartida compara dos indicadores con peso 50/50: desnivel
del general por jugador y desnivel de Despliegue de campo. Ambos se normalizan con
el rango 1–6 y el tamaño de equipo. El componente de Despliegue combina a partes
iguales el desnivel de su suma y la distancia entre las listas de jugadores
ordenadas de mayor a menor Despliegue (distancia media absoluta). Esto distingue
perfiles diferentes con igual suma sin exagerar diferencias pequeñas de notas.

Antes de generar se elige uno de tres cálculos: general fijo (`general`, misma
base de la posición principal en todos los puestos), penalidad por posición
(`penalty`, misma base fija con 0% en principal, −5% en secundaria y −10% en otra),
o habilidad por puesto (`skill`, ponderaciones vigentes por jugador y posición,
sin descuento adicional). Un selector elige el modo. La tabla visible compara los tres resultados en GEN
y sus diferencias respecto del fijo; destaca la columna elegida. Las ponderaciones
y los detalles del equilibrio permanecen en un desplegable. El descuento se aplica
directamente al GEN redondeado (80 pasa a 76 o 72) y se convierte de vuelta a la
escala interna mediante interpolación inversa, sin redondear nuevamente. Las estadísticas originales se conservan.
Las opciones se aplican al siguiente sorteo y el guardado usa las opciones que
realmente generaron los equipos, aunque el selector haya cambiado después.

`matches.position_rating_mode` conserva `legacy` por defecto para fechas anteriores;
`position_rating_discount` conserva su función para `legacy`; para los tres modos
actuales se deriva del modo (solo `penalty` lo activa). La migración automática agrega solo
la columna de configuración. El modo se transporta a perfiles de partido y cartas
públicas. Los modos nuevos comparten cálculo entre PHP y React, con disponibilidad,
regularidad y ajuste histórico. La vista previa muestra los valores por puesto y
las ponderaciones de mayor influencia. El cuadro y las descripciones presentan
GEN en la escala habitual hasta 100, usando la conversión vigente de las cartas;
la escala interna de cálculo no cambia.

Verificación adicional: `npm run test:recorrido`, `node tests/player-rating.cjs` y
`node tests/sorteo-rating-option.cjs`.
