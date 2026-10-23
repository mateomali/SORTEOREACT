# Goodfellas Android WebView

APK Android que carga `https://www.sudokumerlo.com/sorteo/` dentro de una WebView.

## Version 1.2

- Dialogos nativos para avisos, confirmaciones y entrada de texto del sitio. Las acciones que requieren confirmar pueden aceptarse o cancelarse desde Android.

- Exportacion JPG de equipos, TXT, CSV y archivos del servidor mediante el selector de guardado de Android.
- Exportacion de backups por POST, conservando la sesion y el token del formulario.
- Compartir texto y un archivo mediante el panel de Android, copiar al portapapeles e imprimir/guardar PDF con el servicio de impresion.
- Selector de archivos para subir fotos y restaurar backups. Enlaces externos en las aplicaciones correspondientes.
- Cookies persistentes, reintento de la ultima pagina que fallo y navegacion atras.
- Icono nuevo tomado de la imagen entregada por el usuario, con variantes adaptables y redondas.

Las exportaciones estan limitadas a 32 MB por archivo. No se solicitan permisos generales de almacenamiento: el usuario elige el destino. El puente nativo solo acepta mensajes de la ventana principal del sitio HTTPS de Goodfellas. Se necesita Android System WebView actualizado.

## Compilar la actualizacion firmada

Ejecutar desde la raiz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File android-goodfellas/scripts/build-apk.ps1
```

El script usa la clave local original en `.tmp/signing/`; no la incluye en la APK ni en el ZIP del sitio. Se pueden especificar otras rutas con `-SigningStore` y `-SigningPasswordFile`. Conservar esa clave y su contraseña fuera del hosting. La APK resultante se encuentra en `app/build/outputs/apk/release/app-release.apk`.

Instalar la APK 1.2 sobre la anterior conserva los datos de la aplicacion siempre que se mantengan la firma y el identificador `com.goodfellas.sorteo`. La version nueva lleva `versionCode=3`. No se requiere migrar la base de datos.

## Verificacion

`testDebugUnitTest` comprueba las URLs admitidas y los nombres seguros. `lintRelease` revisa compatibilidad y APIs Android. Desde la raiz, `npx playwright test tests/android-native-bridge.spec.js --workers=1` verifica el puente y genera equipos de prueba para comprobar el JPG y el texto reales; limpia esos registros al terminar.

## Requisitos

- Android Studio reciente.
- JDK 17.
- Android SDK con API 35 instalada.
- Dispositivo o emulador Android 8.0+.

## Compilar desde Android Studio

1. Abrir Android Studio.
2. `File > Open` y elegir la carpeta `android-goodfellas`.
3. Esperar la sincronizacion de Gradle.
4. Ejecutar `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
5. El APK queda en `app/build/outputs/apk/debug/app-debug.apk`.

## Compilar desde terminal

Si tenes Gradle instalado:

```bash
gradle assembleDebug
```

Si Android Studio genera el Gradle Wrapper:

```bash
./gradlew assembleDebug
```

En Windows:

```powershell
.\gradlew.bat assembleDebug
```

## Configuracion

- Nombre visible: `Goodfellas`
- Package name: `com.goodfellas.sorteo`
- URL inicial: `https://www.sudokumerlo.com/sorteo`
- Min SDK: 26, Android 8.0
