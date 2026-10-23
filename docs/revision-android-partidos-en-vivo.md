# Revisión Android de Partidos en vivo — 23/10/2026

La versión 1.3 mantiene la pantalla encendida dentro de Partidos en vivo, incluso al entrar mediante navegación parcial. Al salir, libera esa condición. Al regresar a la actividad se resincroniza inmediatamente con el servidor, sin reiniciar el reloj ni pausar el partido.

La WebView del emulador no expone `speechSynthesis`, incluso con WebView 124. Se agregó voz nativa mediante `TextToSpeech` para los dos avisos admitidos. La voz requiere un motor con español disponible; el pitido y la señal visual se conservan. El emulador aceptó las solicitudes de voz, pero se ejecutó sin salida de audio: resta comprobar la audibilidad en el teléfono físico.

## Validación

- Emulador Android 11, WebView AOSP 124.0.6367.219 y APK debug con el mismo código de la release.
- Para cada modalidad de 2, 3 y 4 equipos: inicio, reloj, pausa, reanudación, regreso desde segundo plano, recarga, aviso, tres goles y cierre persistido.
- Con 2 equipos el tercer gol no finaliza el partido; con 3 y 4 sí. Con 2 se comprobó también el vencimiento de los 60 minutos.
- Pérdida simulada de conexión en la API: una pausa fallida no modifica el estado guardado y la recuperación permite seguir registrando goles.
- La bandera Android `KEEP_SCREEN_ON` está activa en el marcador y se libera al volver al inicio.
- Las pruebas del emulador redirigen el sitio HTTPS a PHP local y usan datos temporales que eliminan al terminar. No modifican la base de producción.
- 18 pruebas de navegador y puente aprobadas; 384 rutas triangulares y 180 secuencias cuadrangulares, más las regresiones de reloj, prioridad y dos equipos, aprobadas.
- Compilación firmada, pruebas unitarias Android y `lintRelease`: sin errores. Lint conserva 24 advertencias, entre ellas targetSdk 34 y APIs existentes de compatibilidad.
- Firma de release comparada con la APK anterior: coincide. Paquete conservado y versionCode incrementado a 4.

El emulador incluía inicialmente WebView 83, que no cargaba los controles React. Se actualizó únicamente el emulador con la WebView precompilada oficial de AOSP. Los teléfonos deben mantener Android System WebView actualizado.

## Entrega

APK firmada: `dist/goodfellas-android-1.3-20261023.apk`, también copiada a `goodfellas.apk` para el botón de descarga del sitio. Los cambios PHP y React siguen locales y deben publicarse para que los use la APK, que abre el hosting.

Reproducción: instalar y abrir la APK debug en un emulador y ejecutar `node tests/android-webview-live.cjs`. El script admite `ANDROID_ADB`, `ANDROID_ADB_PORT`, `ANDROID_SERIAL` y `BASE_URL` (con barra final). Para la suite habitual: `npx playwright test tests/android-native-bridge.spec.js tests/live-matches.spec.js --workers=1`.

La app no implementa un servicio de avisos en segundo plano. Mantenerla visible durante el partido. Los timestamps del servidor conservan el tiempo aunque se cierre.

Referencias: [pantalla encendida en Android](https://developer.android.com/develop/background-work/background-tasks/awake/screen-on), [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech), [integración oficial de WebView AOSP](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/aosp-system-integration.md).
