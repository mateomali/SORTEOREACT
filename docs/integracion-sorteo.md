# Integración del sorteo

Los cambios del sorteo están integrados en la última versión de GitHub de
`codex/react-tailwind-migration`, descargada en `C:\sorteoreact`
(base `caa6367`, "nueva visual", 2 de octubre de 2026). La rama local es
`integracion-sorteo-ui-actualizada`. El código React y el archivo compilado
`assets/react/react-app.js` están sincronizados.

- Reparto de un arquero seleccionado por equipo, también tras los intercambios.
- Comparación de combinaciones para equilibrar defensa, medio, ataque y puntaje.
- Progreso visible durante la búsqueda y resultado con cantidad de combinaciones.
- Reglas de PHP y React verificadas mediante `npm run test:sorteo`.
- Menú móvil corregido para seguir cerrándose tras la navegación parcial.
- Fotos ausentes en la descarga muestran la silueta existente sin modificar
  la referencia guardada en la base de datos.

## Verificación local

Con PHP disponible en PATH y el servidor local iniciado:

```powershell
npm.cmd run build
npm.cmd run test:sorteo
npm.cmd run test:smoke
```

Las pruebas de pantallas usan `http://127.0.0.1:8000` por defecto. Para otro
puerto, definir `BASE_URL`. Requieren Chromium de Playwright
(`npx.cmd playwright install chromium`).

La integración conserva la nueva UI, la carga de módulos por pantalla y las
pausas de la búsqueda para mantener la interfaz responsiva.

Se comprobó visualmente la UI actualizada en el puerto 8000 y la generación
de tres equipos de siete jugadores para la fecha local 220. Cuando faltan
delanteros naturales, el armado cubre la línea con un jugador de campo y
mantiene la penalización por jugar fuera de posición. Las capturas están en
`outputs/ui-actualizada-local.png` y `outputs/ui-actualizada-sorteo-generado.png`.
