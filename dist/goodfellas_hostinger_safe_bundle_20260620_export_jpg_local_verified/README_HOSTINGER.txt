Goodfellas - Bundle seguro Hostinger - 20260620_export_jpg_local_verified
Commit base: be6d232

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/config.php: configuracion runtime requerida para login y conexion DB.
- public_html/uploads/: imagenes locales actuales incluidas para merge.
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene.

Incluye los ultimos ajustes:
- Nuevos stats: Velocidad, Ida y vuelta y Pase/Vision en edicion, visuales, promedios, radares y sorteo.
- Balance de sorteo actualizado con nuevos stats y sin penalizar posicion primaria/secundaria en canchas de menos de 7 por equipo.
- Comparador antes/despues para cambios manuales.
- Exportar JPG reforzado contra CSS oklch/color-mix y validado localmente en /sorteo_legacy_csv.php?match_id=192.
- Fix de pantalla blanca por players_per_team en sorteo legacy.

Seguridad / exclusiones intencionales:
- No incluye .git, node_modules, src, tests, scripts, docs, backup local, dist completo, outputs, tmp ni android-goodfellas.
- No incluye database.sql completo ni dumps locales.
- No incluye hostinger_diag.php, migrar_schema.php ni migrar_csv.php.
- No incluye assets/tailwind.input.css.
- Incluye config.php porque el runtime lo requiere; si el servidor tiene credenciales distintas, hacer backup/comparar antes de reemplazarlo.

Validacion local antes de generar:
- npm run build OK.
- npm run test:sorteo OK.
- php -l sobre archivos PHP runtime OK.
- Exportar JPG local en /sorteo_legacy_csv.php?match_id=192 OK.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Aplicar los SQL de sql/ solo si el servidor no tiene esos cambios.
3. Subir/reemplazar el contenido de public_html/ dentro de public_html/sorteo.
4. Verificar login.php, jugadores2.php y sorteo_legacy_csv.php?match_id=192.
5. Probar Exportar JPG luego de generar equipos.
