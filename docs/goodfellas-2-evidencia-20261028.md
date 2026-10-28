# Evidencia de auditoría — Goodfellas 2.0

## Capturas públicas ejecutadas

Origen: https://www.sudokumerlo.com/sorteo/. Chromium headless mediante Playwright, sin autenticación ni envío de formularios. Alto de viewport: 900 px; capturas de página completa.

Se completaron **48 capturas**: seis rutas por ocho anchos.

| Rutas | Anchos, en px |
|---|---|
| `index.php`, `jugadores2.php`, `estadisticas.php`, `historial.php`, `login.php`, `propuestas_equipos.php` | 320, 360, 390, 430, 768, 1024, 1440, 1920 |

- Las 48 respuestas de documento fueron HTTP 200.
- En las 48 cargas, `document.documentElement.scrollWidth` coincidió con `innerWidth`.
- No se capturaron eventos `pageerror` ni mensajes de consola de nivel error durante estas cargas.
- Evidencia estructurada: [baseline.json](../outputs/goodfellas-2-audit-20261028/baseline.json).
- Herramienta reproducible: [audit-goodfellas-public.cjs](../scripts/audit-goodfellas-public.cjs).

Esto verifica carga inicial y desbordamiento global. No prueba menús abiertos, diálogos, tablas expandidas, navegación parcial, formularios, permisos ni ausencia de scroll horizontal dentro de un componente. El script espera `networkidle`; no es una auditoría de rendimiento ni de accesibilidad.

## Inspección visual realizada

Se inspeccionaron visualmente estas siete capturas; las otras 41 quedaron generadas como referencia y con medición automática. La captura completa del historial se revisó como panorama general, no como verificación de legibilidad de cada fila:

- [Inicio móvil, 390 px](../outputs/goodfellas-2-audit-20261028/index-390.png).
- [Inicio escritorio, 1440 px](../outputs/goodfellas-2-audit-20261028/index-1440.png).
- [Estadísticas móvil, 390 px](../outputs/goodfellas-2-audit-20261028/estadisticas-390.png).
- [Jugadores escritorio, 1440 px](../outputs/goodfellas-2-audit-20261028/jugadores2-1440.png).
- [Login móvil, 390 px](../outputs/goodfellas-2-audit-20261028/login-390.png).
- [Próximo partido móvil, 390 px](../outputs/goodfellas-2-audit-20261028/propuestas_equipos-390.png).
- [Historial móvil, 390 px](../outputs/goodfellas-2-audit-20261028/historial-390.png).

Observaciones concretas:

1. Inicio mezcla header verde oscuro, contenido blanco y bloque dorado de ganador. El dark solicitado requerirá revisar superficies y textos juntos.
2. El resumen de la última fecha de varios equipos presenta nombres/camisetas; la tabla aporta la clasificación y los puntos. No conviene reducirlo a un marcador binario que perdería el significado del fixture.
3. La clasificación de inicio tiene desplazamiento horizontal interno en móvil, indicado por un texto de ayuda. La ausencia de overflow global no implica que todas sus columnas sean visibles. Ofrecer resumen y detalle completo es una oportunidad de mejora sin eliminar datos.
4. Estadísticas móvil inicia con secciones plegadas y filtros también plegados. Una captura de carga inicial no valida las tablas interiores. La versión nueva debe conservar y probar esos controles.
5. Jugadores escritorio es un directorio largo con filtros, ordenamiento, puntuaciones por posición, credencial y ficha. Sustituirlo íntegramente por tarjetas grandes perjudicaría el escaneo y podría perder controles. Proponer tarjetas deportivas para detalle y una lista densa para consulta.
6. El acceso público «Admin» de inicio es un acceso existente. No se retira por el rediseño: el servidor debe seguir controlando el ingreso y las acciones.
7. Próximo partido mostró un estado vacío real. Las capturas no cubren una votación activa ni propuestas cargadas.
8. Login conserva tres opciones: ingreso, creación de usuario y administrador, además de mostrar/ocultar clave. Todas deben formar parte de la verificación del rediseño.

Las capturas contienen datos públicos del momento; no son fixtures para recalcular estadísticas ni evidencia de valores históricos permanentes.

## Límites y pendientes

- Navegador integrado: intento fallido por host no disponible. Lectura web alternativa también falló. Playwright pudo completar la captura tras habilitar acceso de red.
- MySQL local no estaba escuchando; la prueba de rating dependiente de DB no pudo ejecutarse correctamente.
- No se inició sesión en producción ni se realizaron pruebas de escritura. No se puede acreditar desde esta sesión la ausencia de cambios automáticos del servidor al visitar GET que cierran plazos o preparan esquema.
- Las pantallas privadas y los flujos con datos deben probarse en copia aislada antes de rediseñarlos.
- Pendientes: orientación horizontal, Safari/iPhone, Android WebView real, teclado abierto, contraste medido, lectores de pantalla y todos los estados interactivos.
- Sin compilación de assets: no hubo cambios visuales ni funcionales que compilar.

## Resultado adicional de balance

`node tests/sorteo-football-balance.cjs` terminó con éxito. El reporte generado por la prueba se preservó en [sorteo-football-results.json](../outputs/goodfellas-2-audit-20261028/sorteo-football-results.json). Los tiempos corresponden al harness local, no a rendimiento de la interfaz en celulares. Este resultado no anula la aserción fallida de la suite `sorteo-goalkeepers.cjs`; ambas observaciones deben conservarse hasta investigar la diferencia.

La prueba de permisos se repitió con `session.save_path` dentro de `.tmp` y pasó sin advertencias. La sintaxis del script de captura también fue verificada con `node --check`.
