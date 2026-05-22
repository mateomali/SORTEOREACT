Goodfellas - Bundle seguro Hostinger - 20260519_034857
Commit: 9972639

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- sql/delta_lat_formaciones_20260519.sql: delta DB para LAT y nombres de formacion.

Seguridad:
- No incluye config.php para no pisar credenciales del servidor.
- No incluye database.sql, jugadores.csv, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, deploy, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php ni scripts de migracion.

Cambios incluidos desde el bundle anterior:
- exportar_fecha.php para exportar datos de una fecha.
- Vista publica de formaciones base alineada al sorteo/capitanes.
- Correccion de LAT en inicio/historial cuando falta assigned_position.
- Card de formacion sin posicion duplicada.

Validacion local antes de generar:
- npm run build:css OK.
- php -l OK en archivos PHP raiz, includes y lib.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Subir/descomprimir el ZIP dentro de public_html/sorteo.
3. Mantener el config.php existente del servidor.
4. Ejecutar sql/delta_lat_formaciones_20260519.sql en phpMyAdmin si aun no fue aplicado.
