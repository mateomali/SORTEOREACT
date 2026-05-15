Goodfellas - Bundle seguro Hostinger - 20260515_023802
Commit: 59c708c

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.

Seguridad:
- No incluye config.php para no pisar credenciales del servidor.
- No incluye database.sql, jugadores.csv, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, deploy, dist ni backups locales.
- No incluye hostinger_diag.php ni scripts de migracion.

Validacion local antes de generar:
- npm run build OK.
- php -l OK en archivos PHP raiz, includes y lib.

Pasos recomendados:
1. Hacer backup en Hostinger antes de reemplazar archivos.
2. Subir/descomprimir el ZIP dentro de public_html/sorteo.
3. Mantener el config.php existente del servidor.
