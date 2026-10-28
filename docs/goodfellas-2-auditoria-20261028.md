# Goodfellas 2.0 — Auditoría y propuesta de rediseño

Fecha: 28/10/2026. Alcance de esta entrega: Fase 1 y propuesta para las fases siguientes. No se implementa el rediseño ni se despliega.

## Diagnóstico ejecutivo

La plataforma es PHP con MySQL/MariaDB y renderizado del servidor, enriquecida mediante islas React 19 y navegación parcial propia. No conviene reemplazarla por una SPA: sus formularios, permisos, descargas, sesiones y alojamiento ya dependen de esta arquitectura.

El sistema tiene más alcance que un generador de equipos: incluye propuestas de directivos, votaciones, premios con podios, perfiles vinculados a cuentas, disponibilidad, partidos en vivo y aplicación Android. Todos deben entrar en la matriz de conservación.

El principal riesgo del rediseño está en la cascada de estilos y en componentes que mezclan presentación y lógica deportiva. La recomendación es mantener PHP, contratos y algoritmos; cambiar presentación por secciones con paridad funcional demostrable.

Esta auditoría combina lectura de código, documentación existente y pruebas seleccionadas. No constituye una revisión exhaustiva de seguridad ni certifica todas las combinaciones de permisos. Las pantallas privadas y los dispositivos reales requieren una etapa adicional de validación en una base de desarrollo aislada.

## Estado de trabajo y reversibilidad

- Rama independiente: `audit/goodfellas-2-20261028`.
- Base: `b25e517917bfc21a96605d7e48f5efa82f6e4bed`.
- Antes de empezar había un paquete Hostinger del 27/10 sin seguimiento en `dist/`; no se modifica.
- Los únicos archivos nuevos de esta entrega son documentación, herramienta de captura y evidencias. No se edita código funcional, configuración, SQL, CSV, uploads ni compilados.
- Para implementar: commits por superficie, conservar la base anterior y preparar paquetes locales separados. Volver al commit anterior de interfaz no debe requerir restaurar datos.
- Un directorio `backup/` no prueba que exista un respaldo vigente de producción. Antes de probar escrituras, usar una copia aislada y comprobar su recuperación. Nunca restaurar una base antigua sobre producción para revertir CSS.

## Arquitectura y almacenamiento comprobados

| Área | Implementación real | Consecuencia para el rediseño |
|---|---|---|
| Servidor | PHP, `config.php`, PDO en `lib/db.php`, repositorios en `lib/repository.php` | Conservar rutas, formularios, identificadores y consultas |
| Persistencia | MySQL/MariaDB, charset `utf8mb4` | No cambiar esquema ni hacer migraciones por motivos visuales |
| Jugadores | `players`, `match_players`, fotos en archivos y metadatos de encuadre | Distinguir plantilla, convocatoria y participación |
| Fechas y resultados | `matches`, `match_teams`, `match_round_robin_results`, `match_awards`; lógica de goles en `lib/match_goals.php` | Mostrar valores existentes sin recalcular con criterios nuevos |
| En vivo | `lib/live_matches.php`, `lib/live_match_repository.php`, `match_live_sessions` | Mantener revisiones, sincronización y reloj del servidor |
| Cuentas y directivos | `site_users`, `directive_members`, tablas de votos/publicación/invitaciones | Permisos aditivos y visibilidad resueltos en servidor |
| Configuración | `app_settings`, `rental_courts`, `lib/admin_config.php`, política de rating JSON | No sustituir valores reales con valores de maqueta |
| Propuestas y variantes | `match_draw_options`, `match_draw_option_votes`, `lib/director_proposals.php`, `lib/sorteo_multiple.php` | Mantener bloqueos, plazos y publicación |
| Importación/exportación | `jugadores.csv`, migración CSV, backup ZIP con CSV internos, exportación de fecha e imágenes | Preservar nombres de campos, formatos y descargas |
| React | `src/main.jsx`, registro de islas en `src/pages/ReactIslandRegistry.jsx`, componentes en `src/components/` | No reemplazar HTML controlado por otra isla sin revisar sus hooks |
| Navegación | `assets/app.js`, reemplazo de `main.content`, historial del navegador y eventos propios | Probar entrada directa, navegación parcial y volver/avanzar |
| Compilación | Tailwind 4 y Vite 8; bundles estáticos en `assets/react/` | Compatible con hosting PHP sin Node en producción |
| Dependencias de exportación | `html-to-image`, `html2canvas` | Comprobar fotos, fuentes, CORS y resultado exportado |
| Android | `android-goodfellas/`, WebView y puente nativo | Conservar compartir, selector de archivos, JPG/TXT/CSV, impresión, backups y sonido |

El SQL versionado es una referencia de estructura y un snapshot; no se toma como inventario actual de producción. No se publican credenciales de `config.php`.

Atención: algunas solicitudes GET ejecutan preparación de esquema o cierres/publicaciones vencidos (`index.php`, propuestas y variantes). Las capturas no envían formularios, pero navegar no garantiza ausencia de efectos del servidor. La validación funcional futura debe usar una copia local aislada.

## Inventario de pantallas y funcionalidades a conservar

| Pantalla / familia | Acceso y función | Elementos que deben conservarse |
|---|---|---|
| `index.php` | Inicio público y contenido por rol | Próxima fecha, resultados, equipos, formaciones, premios, accesos y avisos para directivos |
| `historial.php` | Vista de historial sobre inicio | Búsqueda, filtros, detalle, resultados históricos y formaciones |
| `estadisticas.php` | Estadísticas con contexto de usuario | Filtros por temporada/fecha/cancha, rankings, goleadores, participaciones, búsqueda y detalle de premios |
| `jugadores2.php` | Fichas públicas y herramientas según permiso | Búsqueda, filtros, tarjetas, puntuaciones, fotos, pestaña de premios y acciones de administración |
| `jugadores.php` | Directorio/edición con acciones protegidas | Alta, edición AJAX, activar/inactivar, eliminar, atributos, radar e informe; no declararlo obsoleto |
| `perfil.php` | Cuenta autenticada y jugador vinculado | Foto y encuadre, historial, premios y estadísticas; estado de cuenta sin jugador |
| `propuestas_equipos.php` | Próximo partido y visibilidad según estado/rol | Propuestas, voto, plazos, bloqueo, desempate, revelación y publicación autorizadas |
| `crear_propuesta.php`, `preparar_propuesta.php`, `reiniciar_propuesta.php` | Flujos de directivo/admin con restricciones propias | Crear, editar y reiniciar propuesta sin eludir los bloqueos de votación |
| `crear_partido.php`, `editar_partidos.php`, `encuentros.php` | Administración y consulta según rol | Asistente, equipos/camisetas, cancha, convocatoria, selección múltiple, búsqueda, importación de texto, disponibilidad, modos de valoración y acciones por estado |
| `sorteo.php`, `sorteo_partido.php` | Redirecciones al flujo vigente | Mantener enlaces y parámetros compatibles |
| `sorteo_legacy_csv.php` | Sorteo activo; modo propuesta para directivos | Generar/rehacer, arqueros, potes, separaciones, posiciones, colores, balance, ritmo, variantes, suplentes, intercambios, guardado y exportaciones |
| `equipos_manual.php` | Admin o contexto de propuesta autorizado | Asignación manual, búsqueda, arrastre, controles táctiles, formaciones y guardado |
| `capitanes.php` | Admin y acceso por token según contexto | Draft, turnos, elecciones, polling, copiar/compartir enlaces y editor de formaciones |
| `sorteo_multiple.php`, `votar_sorteo.php` | Gestión admin y votación autenticada | Variantes, voto, plazos, ganador y aplicación de opción |
| `partidos_en_vivo.php` | Lectura pública de fechas publicadas; gestión admin/directivo | Relojes, goles/autores, cambios, correcciones, prioridad inicial, secuencia de cruces, sonido y recuperación |
| `seguimiento_en_vivo.php` | Acceso a fechas en marcha | Listado, redirección cuando hay una sola fecha y estado vacío |
| `finalizar_partido.php` | Editor admin, con derivación al flujo en vivo cuando corresponde | Resultados legacy, edición directa autorizada, goles, formaciones, puntajes, premios y cierres |
| `mis_valoraciones.php` | Directivo/admin | Puntajes y/o premios según configuración de cada fecha, envío y estados |
| `junta_votaciones.php` | Acceso controlado, incluidas invitaciones | Votos, pendientes, publicaciones y permisos particulares |
| `personas.php`, `usuarios.php`, `directivos.php` | Admin | Gestión de personas, vinculación de jugador/cuenta, roles, estado y permisos |
| `configuracion.php` | Admin | Pesos por posición, reglas disponibles y horarios de propuestas; restauración de valores predeterminados |
| `backup.php`, `migrar_csv.php`, `exportar_fecha.php` | Admin | Exportar/importar, subida de archivos, descargas y confirmaciones existentes |
| `login.php`, `logout.php` | Sesión | Opciones de ingreso actuales, redirección de retorno, errores y salida |
| `jugadores-card-preview.php`, `card_design_previews.php` | Previews públicas/privadas según ruta | No retirar vistas de comparación o controles existentes |
| Diagnóstico y mantenimiento | Rutas auxiliares y scripts | Clasificar aparte; no convertirlos en navegación pública ni ejecutarlos durante QA visual |

No todas las rutas son destinos de menú: varias son wrappers, endpoints o acciones. `sorteo original.php`, snapshots de hosting, `backup/`, `dist/`, imágenes anteriores y bundles generados se consideran referencias; no se borran ni se usan para reemplazar a ciegas el código vigente.

## Contratos y reglas deportivas protegidos

1. No alterar los motores de sorteo de `src/pages/SorteoLegacyPageIsland.jsx`, `lib/sorteo.php` y `lib/sorteo_multiple.php`. Son flujos diferentes; conservar sus resultados y restricciones respectivos.
2. Mantener selección de ARQ naturales/manuales/emergencia, posiciones principales/secundarias, LAT y líneas, mínimos/límites por tamaño, tiers/platinum, potes, separaciones, disponibilidad, ritmo, regularidad, historial de compañeros y política de rehacer. La auditoría previa de octubre sirve de contexto; la paridad se mide contra el código vigente.
3. Mantener puntuación interna y conversión visual GEN existentes. Hay conversiones/renderizadores en varios archivos; no unificarlos cambiando valores durante una refactorización visual.
4. En vivo con varios equipos: solo el primer cruce utiliza el primer gol para prioridad tras empate. Si se desconoce el orden, preguntar; en 0–0 preguntar prioridad. No inferirla del orden de carga. No se aplica a partidos de dos equipos ni a empates posteriores.
5. Las fechas históricas no se corrigen por el calendario actual de viernes: antes se jugaba los miércoles. Cualquier contradicción se resuelve con fuentes y confirmación.
6. Goodfellas puede premiar a cualquier jugador de la plantilla sin convocatoria ni participación. No crear `match_players` al mostrar o asignar ese premio.
7. Directivo sigue siendo jugador cuando está vinculado: conservar acceso a perfil, foto, partidos, premios y estadísticas.
8. Respetar `valuation_mode`: `both`, `ratings`, `awards`; el predeterminado de fechas nuevas es `awards`, pero no debe aplicarse retroactivamente a las anteriores.
9. Preservar nombres, criterios, destinatarios y podios de premios desde `lib/awards.php`, incluida la categoría legacy cuando corresponda. No reinterpretar Terminator ni usar dorado para cambiar su significado.
10. Mantener visibilidad de equipos/resultados, CSRF, sesiones, validaciones, transacciones y autorizaciones del servidor. Un botón oculto no sustituye un permiso.

## Hallazgos de interfaz y arquitectura

| Hallazgo comprobable en código | Riesgo | Tratamiento propuesto |
|---|---|---|
| `assets/tailwind.input.css`: 783.306 bytes; compilado: 965.375 bytes | Cascada extensa y coste de descarga; son tamaños de archivo sin compresión, no mediciones de red | Tokens compartidos y migración gradual; medir transferencia real antes de optimizar |
| CSS global, CSS por pantalla, utilidades y reglas con `!important` | Cambios globales pueden mezclar fondos claros con texto claro o afectar otras pantallas | Matriz de propiedad de estilos; retirar reglas solo tras comprobar equivalencia |
| `SorteoLegacyPageIsland.jsx`: 443.893 bytes de fuente; lógica y JSX juntos | Un cambio de estructura puede afectar cálculo, posiciones o exportación | Primera intervención limitada a renderizado; extracción posterior solo con tests de paridad |
| `assets/app.js`: 182.986 bytes de fuente y navegación parcial | Rehidratación, eventos duplicados, estilos acumulados y estado de página anterior | Probar navegación directa/parcial, atrás/adelante y desmontaje de islas |
| Componentes compartidos y variantes locales de tarjetas, formularios y modales | Inconsistencia; centralizar de golpe puede perder controles específicos | Inventariar variantes y migrar una por una |
| `src/components/Modal.jsx` declara diálogo pero no implementa por sí mismo trampa/restauración de foco ni Escape | Teclado y lector de pantalla requieren verificación contextual | Incorporar gestión de foco y verificar usos reales |
| Header tiene controles de 32/40 px y textos de 11 px en algunos accesos móviles | Riesgo de precisión táctil y legibilidad | Objetivo 44 px y texto legible, sin eliminar accesos |
| `Button.jsx` propaga props después de `disabled` calculado | Una prop puede sobrescribir el bloqueo por carga | Revisar en fase de componentes y probar doble envío; no corregido en esta entrega |
| Documentos antiguos exigen visual clara/restauración de backup; guía actual mezcla Tailwind puro con clases legacy | Decisiones visuales contradictorias | El pedido actual autoriza dark; conservar Tailwind como herramienta y actualizar guía al implementar |

Los problemas de desbordamiento, solapamiento y contraste de pantallas privadas son riesgos pendientes de medición, no defectos visuales confirmados. No usar `overflow-x:hidden` global para esconderlos ni retirar columnas/datos como solución.

## Propuesta de sistema visual — para revisión antes de implementar

Dirección: lectura de resultados y estadísticas sobria; canchas, jugadores y reconocimientos con carácter deportivo. Evitar fondos con brillo, tarjetas anidadas decorativas y efectos que compitan con los datos.

| Token propuesto | Valor | Uso |
|---|---|---|
| `canvas` | `#101513` | Fondo general |
| `surface` | `#19211D` | Secciones y formularios |
| `surface-raised` | `#232E27` | Menús y diálogos |
| `border` | `#3B4B40` | Separación de superficies; controles requieren contraste adicional |
| `text` | `#F3F6F1` | Contenido principal |
| `text-muted` | `#B8C5BA` | Etiquetas y contenido secundario |
| `primary` | `#80D69A` | Acción principal, con texto `#102117` |
| `gold` | `#D6B66A` | Reconocimientos y posiciones destacadas |
| `danger` | `#FF9B93` | Error y acciones destructivas, con etiqueta explícita |
| `focus` | `#C4F1CE` | Contorno de teclado de 2 px y separación de 2 px |

La paleta se propone; no se presenta como contraste ya validado. Comprobar WCAG AA en las combinaciones reales: 4,5:1 para texto normal y 3:1 para texto grande/elementos interactivos pertinentes.

- Mantener Poppins para lectura y Barlow Condensed para marcadores y títulos deportivos; ambas ya se cargan. Cifras tabulares para resultados. No agregar fuentes ni librerías pesadas.
- Texto general 16 px, tablas 14 px, títulos 24–32 px según espacio. Evitar información esencial a 10–11 px.
- Espaciado 4/8/12/16/24/32 px. Controles de 44 px mínimo como objetivo; radios de 6–10 px; superficies sin sombras dramáticas.
- Mantener escudos, fotos, encuadres, indicadores y colores identificativos de equipos. Contrastar camiseta y fondo de cancha sin reasignar colores almacenados.
- Botones con variantes principal/secundaria/peligro y estados hover, focus, active, disabled y carga. Errores junto al campo, etiquetas persistentes y mensajes anunciables.
- Diálogos con título, cierre, Escape cuando proceda, foco contenido y restaurado. Confirmaciones actuales preservadas.
- Estados vacíos con datos reales y acción pertinente; cero no equivale a dato ausente. No inventar tendencias, porcentajes ni gráficos.
- Transiciones de 120–180 ms para color/opacidad; movimiento solo donde explique asignaciones. `prefers-reduced-motion` sin animaciones de sorteo prolongadas.

Implementar tokens/base global en Tailwind y componentes nuevos con utilidades en markup, siguiendo `docs/design-system.md`. Las reglas legacy permanecen hasta que su reemplazo esté validado; no añadir otra hoja general de overrides.

## Estructura propuesta por pantalla

- Inicio: próxima fecha y última fecha jugada como bloques distintos; marcador/equipos primero, luego ganador, goles y premios disponibles. Accesos a historial, estadísticas y acciones del rol. No suponer ganador en una fecha incompleta.
- Sorteo: configuración y convocatoria antes de generar; luego canchas, resumen comparativo y controles de ajuste. Mantener visibles balance, puntuación, ritmo y restricciones. En móvil, selección de jugador + destino/intercambio ofrece alternativa a arrastrar; no sustituye los gestos actuales.
- Jugadores/perfil: foto, nombre, posición y GEN existentes; detalle de atributos y estadísticas separado del listado. Conservar filtros, edición y premios a personas no participantes.
- Estadísticas: filtros persistentes, ranking legible y detalle de jugador. Tablas completas en escritorio; en móvil priorizar columnas y ofrecer detalle accesible con todos los datos. Gráficos solo cuando aporten información verificable.
- Historial: filas compactas expandibles, fecha exacta, resultado y equipos; detalle de goles, participantes, formaciones y premios sin cambiar fuentes históricas.
- Premios: conservar pestaña y accesos existentes; categorías y podios desde el catálogo actual. Dorado reservado a reconocimientos, sin inventar criterios.
- Administración: formularios por tarea, acciones de guardado claras, selección múltiple y feedback de carga/error. Mantener alternativas de importación, descarga y edición legacy.
- En vivo: marcador, reloj y acciones prioritarias; correcciones y orden de cruces accesibles; controles de sonido y recuperación visibles. Respeto de zonas seguras de Android/iPhone.
- Navegación: escritorio horizontal agrupado y ancho máximo aproximado de 1360 px; canchas pueden ampliar según necesidad. En móvil evaluar barra inferior Inicio/Jugadores/Estadísticas/Historial y conservar menú completo por rol. Si se adopta, verificar teclado, safe area y ausencia de superposición; no quitar accesos.

## Plan de implementación y puertas de validación

| Fase | Trabajo | Condición de salida |
|---|---|---|
| 1. Auditoría | Este inventario, evidencia pública, riesgos y propuesta | Registrar pendientes privados y baseline de tests; no declarar QA completo |
| 2. Sistema visual | Tokens, botones, campos, tarjetas, tablas, diálogos y guía vigente | Contraste medido, teclado y componentes revisados en 320/390/1440 px |
| 3. Responsive | Header, menú, contenedor, layouts, navegación parcial | Todos los accesos por rol, sin solapamientos ni pérdida de foco |
| 4. Deportivas | Inicio, sorteo, formaciones, fichas, perfil y resultados en vivo | Paridad de datos/controles y regresión de sorteo/exportación |
| 5. Información/gestión | Estadísticas, historial, premios, propuestas, valoraciones y administración | Paridad de formularios, filtros, permisos y formatos |
| 6. Refinamiento | Vacíos, carga, errores, microinteracciones, accesibilidad y rendimiento | Reduced motion, navegación por teclado y recursos revisados |
| 7. QA | Matriz completa, capturas comparadas y documentación | Pruebas efectivamente ejecutadas, fallos resueltos o límites explícitos; paquete local revisable |

Antes de cada sección: captura y listado de controles; después: mismo listado, pruebas asociadas, comparación visual y diff de archivos. Los algoritmos y contratos quedan fuera del cambio visual. No desplegar a producción.

## Matriz de pruebas prevista

- Anchos: 320, 360, 390, 430, 768, 1024, 1440 y 1920 px. Agregar móvil horizontal y teclado abierto; el barrido de anchos no sustituye dispositivos reales.
- Roles: visitante, usuario, jugador vinculado, directivo vinculado y admin; capitán por token e invitado cuando proceda.
- Estados: sin jugadores, sin próxima fecha, sin historial, sin foto, búsqueda vacía, fechas programadas/finalizadas, resultados incompletos, permisos insuficientes, sesión vencida, carga y error recuperable.
- Sorteo: suites de ARQ, balance, potes, movilidad, recorrido, líneas, posiciones, determinismo, suplentes, intercambio táctil, rehacer, persistencia y JPG/TXT. Comparar snapshots con semilla donde exista soporte.
- Partidos: `tests/live-matches.php`, pruebas browser de en vivo, correcciones, goleadores, publicación y fixture; comprobar prioridad inicial, 0–0 y que no se pida en cruces posteriores.
- Premios/valoraciones: podios, selección, Goodfellas no convocado, tres modos de valoración y perfil completo de directivo.
- Integración: suites `site-pages-smoke`, `react-partial-smoke`, `spa-progressive-smoke`, login, perfil, personas y puente Android. Revisar fixtures antes de correr: varias pruebas crean, guardan o eliminan datos.
- Exportación/importación: archivos equivalentes, codificación, fotos, carga multipart, backup POST, Android y descargas fuera del mecanismo de navegación parcial.
- Integridad: hash de SQL/CSV versionados y verificación en base aislada antes/después de pruebas; separar escrituras deliberadas de fixtures de cambios inesperados. El rediseño no debe contener migraciones.

## Validación ejecutada en esta auditoría

Se realizaron lecturas de código y pruebas seleccionadas sin cambios funcionales previos:

| Comando | Resultado observado |
|---|---|
| `node tests/player-rating.cjs` | Bloqueado: MySQL local rechazó conexión; hubo además advertencias por carpeta de sesiones PHP sin permiso |
| `node tests/sorteo-goalkeepers.cjs` | Falló aserción `Separate the strongest defenders and midfielders`, valor 2 frente a 0 esperado; requiere investigar antes de usar como puerta verde |
| `node tests/sorteo-football-balance.cjs` | Pasó: restricciones, sorteos repetidos de 2/3/4 equipos, cantidades impares por línea, balance, oráculo, posiciones permitidas, ARQ de emergencia/adicionales y jugadores únicos |
| `node tests/small-team-formations.cjs` | Falló el harness VM con `Unexpected token 'export'`; no demuestra por sí solo un fallo de formaciones en la aplicación |
| `php tests/live-matches.php` | Pasó: 384 caminos de tres equipos, 180 secuencias de cuatro y casos adicionales de reloj, prioridad, correcciones y dos equipos |
| `php tests/player-role-permissions.php` | Aserciones pasaron, con advertencias de sesión en el primer intento; la repetición con `php -d session.save_path=C:/SORTEOREACT/.tmp tests/player-role-permissions.php` pasó sin advertencias |

No se ejecutaron aún todas las suites, pruebas privadas con DB, importaciones/restauraciones ni QA en iPhone/Android reales. No se cambia el algoritmo para hacer pasar pruebas durante la auditoría.

La captura pública reproducible se ejecuta con `node scripts/audit-goodfellas-public.cjs`; guarda capturas y métricas en `outputs/goodfellas-2-audit-20261028/`. Su `baseline.json` es la evidencia de qué rutas y anchos terminaron, códigos HTTP, ancho real del documento y errores de consola. El script no autentica ni envía formularios. Los resultados finales se registran en el documento de evidencia adjunto.
