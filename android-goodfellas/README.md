# Goodfellas Android WebView

APK Android simple que carga `https://www.sudokumerlo.com/sorteo` dentro de una WebView.

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
