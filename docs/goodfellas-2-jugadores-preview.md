# Goodfellas 2.0 — Primera implementación en Jugadores

Fecha: 28/10/2026. Vista: `jugadores2.php`. Entorno de revisión: http://127.0.0.1:8000/jugadores2.php. No desplegado a producción.

## Resultado

- Tema oscuro con los tokens propuestos en la auditoría: fondo carbón, superficies verdes neutras, texto claro, acento verde y puntuación secundaria dorada.
- Conservación del listado completo en escritorio, filtros por posición, ordenamiento, búsqueda y todos los accesos a fichas y credenciales.
- Filas móviles reorganizadas en identidad/puntuaciones y acciones; botones de credencial y ficha con etiqueta visible y altura mínima de 44 px.
- Fichas, radar, estadísticas, premios, rankings, historial de premios, alta y edición adaptados a la misma paleta.
- Fotos, encuadres, escalas, cálculos y datos existentes preservados. Las credenciales mantienen sus colores por categoría y la flecha de regularidad.
- El resto de las páginas conserva su tema. El header y el menú compartidos conservan su diseño actual; su rediseño general pertenece a otra fase.

## Implementación

`jugadores2.php` marca la página con `goodfellas-2`. Los tokens compartidos están en `assets/tailwind.input.css`; las utilidades nuevas se aplican directamente en JSX. Se migraron las declaraciones existentes de `assets/jugadores-directory.css` en lugar de sumar una segunda hoja de overrides.

Como transición justificada, esta hoja mantiene su layout legacy y una adaptación pequeña del shell PHP limitada a Jugadores. No se intenta reescribir en esta primera pantalla toda la cascada histórica. Las reglas globales del tema claro con `body[class*="page-"]` excluyen `goodfellas-2` mediante `:where(:not(...))`, sin aumentar su especificidad para las demás pantallas.

Se corrigió un problema detectado al probar el ingreso administrativo: las respuestas de formularios con navegación parcial reemplazaban el contenido sin cargar las hojas de la página de destino. `replaceMainContentFromDocument` ahora espera la misma carga de estilos que ya usaban los enlaces parciales. Sus dos llamadas se actualizaron a `await`. Esto permite ver correctamente Jugadores al llegar desde login, además de entrar directamente.

Se corrigió la expectativa antigua de una prueba pública: `propuestas_equipos.php` ya tiene el título «Próximo partido», no «Propuestas próximo partido». No se cambió esa página.

Los bundles React y Tailwind están recompilados. El cambio de nombre del chunk de Jugadores y la eliminación del chunk anterior son resultado de Vite.

## Evidencias visuales

- [Lista escritorio](../outputs/players-premium/list-1440.png).
- [Lista móvil](../outputs/players-premium/list-390.png).
- [Ficha móvil](../outputs/players-premium/profile-390.png).
- [Premios de la ficha](../outputs/players-premium/profile-awards-390.png).
- [Credencial](../outputs/players-premium/credential-390.png).
- [Edición administrativa en 320 px](../outputs/players-premium/admin-320.png).
- [Alta administrativa en 320 px](../outputs/players-premium/create-320.png).

Las capturas de esta implementación usan la base local; los datos pueden diferir de las capturas públicas de la auditoría. No interpretar esa diferencia como un cambio causado por el rediseño.

## Verificación

- `npm run build`: compilación CSS y React correcta.
- `php -l jugadores2.php`: sin errores de sintaxis.
- `node --check assets/app.js`: sintaxis correcta.
- Pruebas de estilos de primera navegación parcial, premios del directorio e historial de premios: cinco pruebas existentes aprobadas.
- Nueva suite `tests/players-premium.spec.js`: ocho anchos, acciones móviles accesibles, búsqueda sin resultados, filtro por posición, ordenamiento contra el payload, apertura de ficha/credencial/radar, pestaña de premios, navegación parcial de ida/vuelta y formulario administrativo/alta sin guardar.
- Se verifica contraste de texto de título, encabezado, buscador, selector y puntuación en los ocho anchos; también campo de nombre y relato en la ficha admin. Se usa la propiedad de color de texto efectiva y el fondo opaco de los ancestros. Esta medición acotada no equivale a una auditoría completa WCAG.
- Ejecución final: `npx playwright test tests/players-premium.spec.js tests/site-pages-smoke.spec.js tests/players-directory-styles.spec.js --workers=1`: **9 aprobadas** en 26,7 s. Incluye carga pública y administrativa de rutas adicionales. Las cuatro pruebas de premios/historial también aprobaron en la ejecución anterior.

Pendientes para una fase posterior: guardado/importaciones y subidas reales, Safari/iPhone, Android WebView real, auditoría de accesibilidad completa y rediseño de navegación compartida. No se afirma haber ejecutado esos casos. Las pruebas de esta entrega no guardan cambios en los datos deportivos ni hacen pruebas de escritura en producción.

## Reversión

El commit `b4d5eef` conserva todo lo pendiente antes de comenzar el rediseño y está subido a GitHub en la rama `audit/goodfellas-2-20261028`. El rediseño se guarda por separado para poder revertirlo sin modificar una base de datos. No se cambia esquema, autenticación, permisos, endpoints ni formatos de intercambio.
