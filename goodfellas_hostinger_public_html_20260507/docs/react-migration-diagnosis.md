# Diagnostico de Migracion React

Fecha: 2026-05-05

## Nota de alcance

El pedido menciona ejemplos como `Consulta`, `Ingreso`, `Entregados`, estados `PENDIENTE/LISTA/CANCELADA` e imagenes. En este repositorio el sistema actual es **Goodfellas Futbol**, con jugadores, fechas, sorteos, capitanes, estadisticas, backup y resultados. La migracion React debe aplicarse a las pantallas reales de este sistema sin inventar modulos ajenos.

## Pantallas actuales

- `index.php`: inicio publico, proxima fecha, historial y visualizacion de formaciones.
- `historial.php`: wrapper que carga `index.php` en modo historial.
- `estadisticas.php`: filtros por temporada/fecha, rankings, premios y busqueda de jugador.
- `jugadores.php`: alta, edicion, listado, stats, radar, informe, activar/inactivar, eliminar.
- `crear_partido.php`: wrapper de `encuentros.php` para crear fecha.
- `editar_partidos.php`: wrapper de `encuentros.php` para editar fechas.
- `encuentros.php`: administracion de fechas, convocados, importacion de texto, acciones sobre fechas.
- `sorteo_legacy_csv.php`: sorteo de equipos, CSV local, ordenamiento, exportacion e imagen.
- `equipos_manual.php`: asignacion manual de jugadores a equipos.
- `capitanes.php`: draft de capitanes y editor de formaciones.
- `finalizar_partido.php`: carga de resultado, goles, ratings y premios.
- `backup.php`: exportacion/importacion ZIP con CSV internos.
- `migrar_csv.php`: importacion de `jugadores.csv` o archivo CSV subido.
- `login.php` / `logout.php`: sesion admin.

## Endpoints y formularios existentes

- `capitanes_api.php`: JSON para estado, picks y formaciones.
- `guardar_sorteo.php`: JSON para guardar sorteo/manual.
- `finalizar_partido.php`: HTML y acciones JSON parciales para resultado.
- `jugadores.php`: formularios POST con compatibilidad HTML y guardado AJAX existente.
- `encuentros.php`: POST tradicional para crear/editar/eliminar fechas e importar convocados.
- `backup.php`: POST tradicional para exportar/importar backup.
- `migrar_csv.php`: POST tradicional para importar CSV.

## Datos principales

- MySQL/MariaDB.
- Tablas principales: `players`, `matches`, `match_players`, `match_teams`, `match_awards`, `captain_drafts`, `captain_picks`, `match_round_robin_results`.
- CSV vigente:
  - `jugadores.csv` para importacion legacy.
  - backup ZIP genera CSV internos por tabla.
- No se deben cambiar nombres de campos, IDs, rutas ni formatos.

## Interacciones ya existentes en JavaScript

- Menu responsive.
- Toasts.
- Carga parcial de algunos formularios.
- Busqueda/filtros en jugadores, estadisticas, historial y encuentros.
- Guardado AJAX de jugadores.
- Toggle de estado de jugadores.
- Drag/drop y swaps en finalizacion/formaciones.
- Sorteo manual/capitanes via `fetch`.

## Estrategia propuesta

Migracion progresiva por islas React:

1. Mantener PHP como renderer y API.
2. Compilar React como asset estatico en `assets/react/react-app.js`.
3. Montar componentes solo donde exista `data-react-root`.
4. Migrar una superficie por vez, manteniendo el HTML/PHP anterior hasta verificar paridad.
5. Convertir endpoints a JSON solo cuando haga falta y siempre preservando compatibilidad POST tradicional.

## Etapas

1. Base React + Vite compatible Hostinger.
2. Componentes compartidos: Card, Button, Modal, ConfirmDialog, SearchBox, Filters.
3. Migrar busquedas/filtros de bajo riesgo.
4. Migrar listado/cards de `jugadores.php`.
5. Migrar acciones AJAX de jugadores.
6. Migrar modales/informes/radar si conviene.
7. Migrar encuentros y formularios administrativos.
8. Migrar sorteo/capitanes solo despues de estabilizar API y pruebas.
9. Retirar JS viejo solo cuando una pantalla completa este cubierta y verificada.

## Cambios implementados en esta primera pasada

Se agrego la base React progresiva:

- `vite.config.js`
- `src/main.jsx`
- `src/components/*`
- `src/pages/*`
- `src/services/api.js`
- `src/utils/*`
- `src/styles/app.css`

Tambien se migro una interaccion de bajo riesgo:

- La busqueda del historial en `index.php` / `historial.php` ahora se monta como isla React `home_history_search`.
- Sigue usando las cards renderizadas por PHP y los mismos atributos `data-home-history-card` / `data-search`.
- No cambia consultas SQL, endpoints, rutas ni estructura de datos.

## Segunda pasada: UX tipo Facebook

Se agrego una capa global de interaccion progresiva en `assets/app.js`:

- Links internos seguros navegan con `fetch` y reemplazo de `main.content`.
- Formularios seguros se envian con `fetch` y renderizan la respuesta en la misma pagina.
- Se rehidratan controles existentes y se vuelven a montar islas React despues de cada reemplazo parcial.
- Se ejecutan scripts de pagina necesarios al entrar por navegacion parcial, excluyendo `assets/app.js` y el bundle React para no duplicarlos.
- Se excluyen flujos que deben seguir completos por seguridad o tipo de respuesta: logout, backups, uploads `multipart`, archivos descargables y formularios con manejadores especificos.

Prueba agregada:

- `tests/react-partial-smoke.spec.js` valida navegacion parcial publica en desktop y 390px mobile, busqueda React del historial y ausencia de overflow horizontal.

## Tercera pasada: Jugadores

Se migraron partes de `jugadores.php` a React:

- Isla `player_list_controls` para busqueda, contador y link de activos/inactivos.
- Filtra simultaneamente cards moviles y tabla de escritorio usando los mismos `data-player-table-row` y `data-search`.
- Isla `player_create` para el alta de jugador con los mismos nombres de campos y `POST` actual.
- El alta calcula General en vivo, alterna Ataque/Habilidad de arquero segun posicion ARQ y mantiene radar/ayuda de stats.
- Mantiene intactas las acciones existentes: editar, guardar, activar/inactivar, eliminar e informe.
- Se agrego estado vacio compartido para escritorio y mobile.
- La prueba Playwright ahora cubre la busqueda React de jugadores en desktop y 390px mobile, mas apertura del alta admin sin crear registros.

## Cuarta pasada: Encuentros / Fechas

Se migraron controles de `encuentros.php` a React:

- Isla `encounter_history_controls` para busqueda, contador y filtro por estado.
- Los paneles PHP existentes (`Programados`, `Listos para finalizar`, `Finalizados`) quedan como UI visible, pero React maneja el estado activo.
- Isla `participant_controls` para busqueda de convocados, seleccion de visibles y seleccion al azar.
- Las cards, formularios, acciones y endpoints de fechas se mantienen renderizados por PHP.
- El selector de convocados sigue usando las filas PHP y el JS existente para contadores, lista de seleccionados y boton movil.
- Paginacion se oculta automaticamente cuando hay busqueda o filtro activo, igual que el comportamiento anterior.
- La prueba Playwright cubre login admin, busqueda sin resultados, limpiar filtro de estado y controles de convocados en mobile 390px.

## Quinta pasada: Finalizar Partido

Se agrego una primera isla React en `finalizar_partido.php`:

- Isla `finish_valuation_controls` para buscar jugadores dentro de la carga de valoraciones.
- Filtra filas ya renderizadas por PHP usando `data-finish-player-row`.
- Oculta equipos sin filas visibles y muestra estado vacio cuando no hay coincidencias.
- No modifica el guardado de resultado, goles, puntajes, premios ni todos-contra-todos.
- La prueba Playwright cubre carga de la pagina y usa la busqueda de valoraciones cuando esta disponible.

## Sexta pasada: Capitanes

Se agrego una isla React segura en `capitanes.php`:

- Isla `captain_tokens` para renderizar tarjetas de token por capitan.
- Mantiene copiar, compartir y abrir enlace de capitan.
- No toca polling, turnos, picks, guardado de formaciones ni `capitanes_api.php`.
- La prueba Playwright cubre carga admin de la pagina y verifica que no haya overflow en mobile.

## Septima pasada: Equipos Manuales y Estadisticas

Se agregaron islas React en pantallas restantes de uso frecuente:

- `manual_teams_search_assist` en `equipos_manual.php`: mejora la busqueda existente con contador y limpieza sin tocar tablero, asignaciones, drag/drop, long press ni guardado.
- `stats_player_search` en `estadisticas.php`: controla la busqueda de jugador, resalta/filtra filas y actualiza el resumen del jugador seleccionado.
- Se mantienen las consultas PHP, filtros por fecha y popovers de premios existentes.

## Pantallas de Soporte

Las pantallas `login.php`, `backup.php` y `migrar_csv.php` se mantienen como flujos seguros:

- Login funciona con navegacion parcial/global.
- Backup y migracion CSV conservan submit tradicional para descargas y uploads `multipart`.
- La prueba Playwright valida carga en mobile y ausencia de overflow.
