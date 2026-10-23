# Revision APK Goodfellas 1.2 — 23/10/2026

## Entrega

- APK: `dist/goodfellas-1.2.apk`.
- Version: 1.2, versionCode 3, identificador `com.goodfellas.sorteo`.
- SHA256: `6964B8D7C491B82488B7F7DC5B3581941685B20FD907AD5938260FC186F1C8A7`.
- Firma v2 verificada. El certificado coincide con `goodfellas.apk` anterior.
- Se agregaron controladores explicitos de alert, confirm y prompt, con aceptar, cancelar y cancelacion por cierre del dialogo.
- Se preservaron los cambios que ya existian en el repositorio.

## Verificacion completada

- Resultado consolidado: 41 pruebas web diferentes correctas, contando las repeticiones tras actualizar pruebas desfasadas. Los cuatro casos de goleadores ya fueron desbloqueados y verificados. Ademas, 2 pruebas unitarias Android correctas.
- assembleRelease, testDebugUnitTest (2 pruebas), lintRelease: correctos. Lint informa 0 errores y 24 advertencias; no equivale a ausencia total de observaciones.
- 14 pruebas web: puente Android simulado, bytes de JPG/TXT/CSV, compartir, portapapeles, imprimir, backup POST, cancelacion, exportacion real de equipos, login, perfiles de jugador/directivo y paginas publicas/administrativas.
- Premios: 4 pruebas correctas; se actualizaron selectores y nombres de campos para el formato vigente de puestos multiples.
- Partidos en vivo: paso la prueba de marcador, reloj persistente, goleadores, concurrencia y cierre. Se actualizo la expectativa de correccion de una fecha ya cerrada: conserva su fixture y no solicita desempate nuevo.
- Pasaron tambien creacion de fechas en 320/390/1440px, propuestas de directivos, fixture de doce partidos, permisos y CSRF, duracion propia de fecha, cambios concurrentes e historial/podios de premios en escritorio y movil.
- Navegacion SPA, sorteo y guardado de jugador: correctos tras actualizar el helper de login de la prueba a los botones vigentes.

## Limites y pendientes

- Resuelto: las pruebas de goleadores crean y eliminan sus propios jugadores y equipos, sin depender de la fecha 243. Se comprueba el rechazo de goles sin autor, la persistencia de dos goles, la apertura de votacion, el guardado real de premios y la visualizacion de goleadores en Inicio e Historial en los cuatro modos.
- Corregido un fallo real del selector de premios: la lista estaba en el flujo del documento y al cerrarse por el cambio de foco movia el boton Guardar antes de terminar el clic. Ahora se despliega sobre el contenido; una comprobacion verifica que no desplaza el boton y el guardado se ejecuta con un solo clic.
- Parche para hosting: `dist/goodfellas-fix-goleadores-20261023.zip`, con `assets/tailwind.css` y la APK 1.2 firmada bajo el nombre `goodfellas.apk`.
- No habia dispositivo Android conectado a ADB. No se verificaron en dispositivo los dialogos agregados, el selector de fotos, el destino real de guardado, las aplicaciones receptoras de compartir ni el servicio de impresion.
- Las pruebas web usan Chromium y un puente Android simulado. La compilacion y las pruebas unitarias no sustituyen la comprobacion completa en Android.
- La APK carga el sitio HTTPS publicado; su contenido depende de la version desplegada en el hosting. No se publico el sitio ni se modifico la base de produccion.
