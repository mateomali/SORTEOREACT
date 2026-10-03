# Auditoría previa del sorteo (2026-10-02)

El flujo activo de `sorteo_legacy_csv.php` carga participantes SQL, atributos efectivos,
disponibilidad, ajustes históricos, historial de compañeros y política de rehacer.
Monta `src/pages/SorteoLegacyPageIsland.jsx`; `assets/sorteo-legacy.js` no ejecuta este flujo.
Las funciones PHP de `lib/sorteo.php` atienden otros flujos y no deben duplicarse aquí.

Antes del cambio:
- `buildCandidateTeams` reserva arqueros manuales y completa con naturales/emergencia.
- `teamsRespectGoalkeepers` comprueba candidatos, pero solo exige exactamente uno de
  los manuales cuando su cantidad coincide con equipos. No verifica el ARQ asignado.
- `buildTeamAssignmentImpl` puede improvisar DEF/MED/DEL para llenar mínimos y
  desplazar un ARQ sobrante a MED aunque no tenga esa posición.
- `applyPositionCountsToTeam` permite improvisación en variantes; elegir después una
  variante individual puede cambiar las posiciones cuyo balance optimizó el sorteo.
- `scoreTeams` mezcla diferencia total y sumas/promedios por línea; no incluye ARQ
  en `lineStrengthBalance`. Los pesos de atributos y penalizaciones son secundarios.
- `isBetterDraw` prioriza firmas no repetidas, mínimos y estrellas, luego
  `diff + strengthGap`: permite compensar calidad por línea con total.
- Dos equipos hasta 20 participantes usan enumeración exhaustiva con ancla para
  romper simetría; otros casos usan 120–180 construcciones y swaps de ocho finalistas.
- El constructor usa solo `value`, aunque el selector usa otras prioridades.
- Rehacer conserva contador y firmas en sesión y base; las firmas dominan calidad.
- Ritmo bajo es atributo <=3, no solamente etiqueta lento; se balancea junto con
  irregularidad, tiers, atributos, uso de posiciones e historial de compañeros.
- Ratings: escala 1–6; pesos por posición, regularidad, historial y disponibilidad.
  Hay descuentos de posición secundaria y neutralización visual en cancha pequeña.

Datos locales: 64 jugadores, 79 partidos; posiciones ARQ/DEF/LAT/MED/DEL, hasta
dos por jugador. LAT comparte línea DEF. Partidos de dos equipos: 12–18 jugadores;
triangulares registrados: 21. La partición de 28 jugadores en cuatro equipos ya
es demasiado grande para enumeración general: se reutilizará búsqueda multinicio.

Decisiones previas: preservar política de rehacer y controles, puntuaciones y esquema
persistido. Distribución platinum <=1 sigue siendo obligatoria cuando es viable.
Los mínimos tácticos no justifican fabricar posiciones: el generador comprueba
cobertura posible con el plantel; faltantes reales se documentan en evaluación.
Prioridades: restricciones, estructura, calidad independiente por línea (incluido
máximo desequilibrio), total, secundarios. Firmas solo dentro de tolerancia de calidad.
Las formaciones manuales siguen siendo acciones explícitas del usuario.

## Implementación y entrega

1. **Arqueros.** En esta revisión ya había una corrección parcial para manuales:
   el caso exacto de tres manuales no se reprodujo como fallo en la prueba previa.
   Los huecos comprobables estaban en validar candidatos sin comprobar quién ocupa
   ARQ, no fijar todas las reservas naturales/secundarias y recalcular formaciones
   después de optimizar. Ahora se seleccionan N reservas antes de repartir; todos
   los swaps y resultados verifican exactamente un ARQ asignado y elegible por
   equipo. Con exactamente N definidos, se exige uno de ellos en cada equipo.
   Los puros se reservan obligatoriamente; un polivalente sobrante puede ocupar
   únicamente su posición de campo permitida. No se cambia `players.positions`.
2. **Archivos.** Lógica central en `src/pages/SorteoLegacyPageIsland.jsx`;
   scripts de pruebas en `package.json`; regresión existente en
   `tests/sorteo-goalkeepers.cjs`; cobertura nueva en
   `tests/sorteo-football-balance.cjs`, `tests/sorteo-football-browser.spec.js` y
   `tests/fixtures/football-balance-baseline.json`. El selector de la prueba
   `tests/sorteo-workflow.spec.js` ahora obtiene nombres de la base, porque el SQL
   importado cambió nombres; no depende de dos nombres particulares. Se recompiló
   `assets/react/react-app.js` y el chunk de SorteoLegacy. Sin cambios de esquema.
3. **Búsqueda.** Se reutiliza enumeración de particiones de dos equipos hasta 20
   jugadores, con ancla, poda de arqueros y platinum. Para más equipos/jugadores,
   120–180 construcciones con variación controlada de orden, ocho finalistas
   distintos e intercambios entre todos los pares de equipos hasta converger o
   doce pasadas. La asignación natural/secundaria usa programación dinámica por
   cantidades. Los swaps ceden control al navegador cada ~60 ms. Los resultados
   heurísticos no implican una prueba de óptimo global; la búsqueda exacta prueba
   la mejor partición bajo la política determinista de asignación de posiciones.
4. **Fuerza.** ARQ, DEF (incluye LAT), MED y DEL usan `adjustedPositionRating`:
   atributos ponderados por posición, disponibilidad, regularidad y ajuste
   histórico, en escala 1–6. Cada línea expone cantidad, suma, promedio, mínimo
   y máximo. El indicador de fuerza comparable es el promedio; las cantidades
   se comparan primero y las sumas permanecen disponibles. Total también conserva
   suma original (`diff`) y promedio (`totalBalance`). No se redondea el fitness.
5. **Desigualdad.** `max - min` sobre todos los equipos, no solo el primer par.
   `positionalBalance` suma cuadrados de diferencias de cantidades.
6. **Prioridades y pesos.** `isBetterDraw` compara lexicográficamente:
   violaciones duras → distribución → calidad por líneas → total → secundarios.
   Calidad = suma por línea de `(peso/260) * (gapPromedio² +
   0.15*(gapMínimo² + gapMáximo²)) + 2*maxLineGap²`.
   Pesos ARQ/DEF/MED/DEL = 240/280/240/260. TOTAL está en el nivel siguiente:
   ninguna mejora del total compensa una calidad de líneas inferior. `totalCost`
   es un diagnóstico compuesto; la selección usa el vector de prioridades,
   no solo ese número. Los signos de DEF/MED/DEL no pueden cancelarse.
7. **Ritmo y otros criterios.** Conserva ritmo bajo <=3, irregularidad, tiers,
   platinum, atributos configurados, compañeros repetidos y preferencia de posición.
   Actúan después del total, salvo la distribución platinum <=1, conservada como
   restricción existente. Los datos de análisis siguen disponibles.
8. **Polivalencia y escasez.** Principal antes que secundaria al elegir formación;
   la secundaria conserva el factor existente 0.95. Ninguna improvisación automática
   de campo. Mínimos se limitan por capacidad del plantel: la comprobación por
   subconjuntos evita contar dos veces al mismo MED/DEL. Se prioriza cubrir líneas
   disponibles y luego sus mínimos. `hardConstraints.shortage` explica carencias.
   Una formación manual explícita continúa permitiendo la funcionalidad anterior.
9. **Rehacer.** Conserva permiso, límite, contador y guardado. Se elige al azar
   entre hasta 64 soluciones dentro de tolerancia: misma validez y estructura,
   costo de líneas <= mejor +0.015, máximo gap <= mejor +0.05 y gap total medio
   <= mejor +0.05, sin empeorar dispersión de lentos o irregulares y secundarios
   <= mejor +30. Dentro del grupo se prefieren firmas no vistas. Si solo hay una
   solución comparable puede repetirse; nunca se amplía el desequilibrio para
   obtener variedad. Las firmas canónicas eliminan permutaciones de colores.
10. **Formación visible.** Se presenta la asignación evaluada. Las variantes siguen
    disponibles, pero no sustituyen automáticamente el resultado optimizado por
    una combinación de variantes individuales que no fue evaluada globalmente.
11. **Pruebas.** PHP de reglas; Node de arqueros, oracle exhaustivo independiente,
    sorteos consecutivos 2/3/4, cantidades pares/impares, 7 DEF/5 MED/6 DEL,
    estrellas 6/5.8/5.7/3.2/3/2.9, posiciones compartidas, falta de delanteros,
    emergencia, arqueros sobrantes y duplicados. Playwright comprueba ejecución en
    navegador y flujo real de rehacer → variantes → guardar → recargar → finalizar.
    También pasan indicadores/penalización por posición, restauración de
    intercambios y páginas públicas/admin. El test Vite de posición emite un aviso
    de cierre del escáner de dependencias tras pasar sus aserciones; no es un fallo
    de las páginas ni del build.
12. **Resultado controlado entre versiones.** Plantel de 14: ARQ 5.4/2.6;
    DEF 4.5/4.2/3.8/3.1; MED 4.4/4/3.6/3; DEL 4.7/4.1/3.5/2.9.
    Todos los atributos iguales al rating y regularidad 3.5. Misma distribución
    1 ARQ +2 DEF +2 MED +2 DEL por equipo.

    | Gap de promedios | Versión previa | Versión nueva |
    |---|---:|---:|
    | ARQ (inevitable) | 2.8 | 2.8 |
    | DEF | 0.2 | 0.2 |
    | MED | 0.5 | 0.1 |
    | DEL | 0.6 | 0.0 |
    | TOTAL | 0.02857 | 0.31429 |

    Es el compromiso solicitado: evita debilitar líneas para compensar completamente
    los arqueros. No se oculta que el total empeora. En otro caso con DEF/MED
    cruzados de 5.5/2.5, ambos gaps bajan de 3.0 a 0.0 conservando TOTAL 0.0.
13. **Performance en Chromium local.** Prueba controlada de siete jugadores por
    equipo: 2 equipos/14 jugadores ~0.07 s, 3/21 ~0.44 s, 4/28 ~0.63 s.
    Exactamente un arquero real en cada equipo. En esa corrida los gaps
    ARQ/DEF/MED/DEL fueron 0.456/0/0/0 (2), 0.456/0.1855/0.162/0.163 (3)
    y 0.456/0/0/0 (4). Los gaps totales medios fueron 0.06514, 0.02886 y 0.06514.
    Intervalo máximo entre frames ~61 ms. Los tiempos incluyen búsqueda, no
    animaciones artificiales de las etapas ni render/exportación; varían por equipo
    y máquina. La ejecución instrumentada en Node VM es más lenta que Chromium.
14. **Cantidades impares.** Tres equipos con 7 DEF/5 MED/6 DEL producen
    DEF 3/2/2, MED 1/2/2 y DEL 2/2/2, un arquero cada uno. La baja cantidad de MED
    se acepta y se informa; no se convierte un defensor en mediocampista.
15. **Límites.** Más arqueros puros que equipos es incompatible con un solo ARQ
    por cancha y la prohibición de inventar posiciones: se informa, no se cambia
    su posición. Falta de ARQ sigue usando la emergencia explícita anterior y
    muestra sus nombres. Planteles no divisibles/duplicados se rechazan. El flujo
    de pantalla conserva su mínimo existente de cinco jugadores por equipo.
    Las soluciones ya guardadas no se reescriben automáticamente. Exportaciones,
    `match_id`, vistas, formaciones manuales y estructuras de guardado se conservan.

Para inspección opcional, establecer `window.GOODFELLAS_DRAW_DEBUG = true` antes
del sorteo: se imprime evaluación central con métricas por equipo, gaps de cada
línea, máximo gap, total, ritmo, costo y restricciones. Desactivado por defecto.
Los resultados de pruebas se guardan en `.tmp/sorteo-football-results.json` y
`.tmp/sorteo-football-browser-results.json`.


### Mínimos obligatorios por equipo

Para cualquier tamaño de equipo, los titulares deben tener exactamente 1 ARQ,
al menos 2 jugadores en la línea defensiva (DEF y LAT sumados), 1 MED y 1 DEL.
Los suplentes no cuentan para estos mínimos. Con menos de 5 titulares no es
posible cubrirlos. La generación, optimización, cambios de formación,
intercambios y validación del servidor conservan esta cobertura. Las posiciones
secundarias siguen disponibles; la adaptación solo cubre faltantes reales del
plantel. Un equipo de 8 o más jugadores también puede jugar con un único MED.

Los controles + y - buscan una asignación completa para aumentar o reducir en
uno la línea seleccionada, compensando otra línea. Pueden encadenar cambios
mediante posiciones secundarias; conservan el arquero, los bloqueos y los
mínimos. Priorizan posiciones válidas y pocos cambios antes del puntaje. Cuando
no existe una redistribución válida, mantienen la cancha y muestran el motivo.
Pruebas de regresión: `npm run test:line-controls` (requiere servidor local).
