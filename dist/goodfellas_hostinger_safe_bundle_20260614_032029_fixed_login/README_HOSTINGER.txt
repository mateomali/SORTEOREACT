Goodfellas - Bundle seguro Hostinger REPARADO LOGIN - 20260614_032029
Commit base: d24dd07

Cambio respecto al bundle anterior:
- Este bundle SI incluye public_html/config.php porque login.php, includes/header.php y lib/db.php lo requieren.
- .htaccess bloquea acceso web directo a config.php.

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/config.php: configuracion runtime requerida para que el login funcione.
- public_html/uploads/players/: imagenes actuales de jugadores incluidas (47 archivos).
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene (4 archivos).

Seguridad:
- No incluye database.sql completo, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php, migrar_schema.php, migrar_csv.php, capturas/previews PNG de trabajo ni fuentes Tailwind.
- Antes de subir, si el config.php del servidor tiene credenciales distintas, hacer backup o comparar ese archivo.

Validacion local antes de generar:
- npm run build:react OK.
- npm run build:css OK.
- php -l sobre 32 archivos PHP runtime OK.

Notas de base de datos:
- Esta tanda de UI no agrega cambios estructurales nuevos.
- No ejecutar SQL salvo que sepas que alguno de los deltas de sql/ falta en el servidor.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Subir/reemplazar el contenido de public_html/ dentro de public_html/sorteo.
3. Si ya tenias un config.php custom en Hostinger, revisar DB_HOST, DB_NAME, DB_USER, DB_PASS y ADMIN_PASSWORD.
4. Verificar https://www.sudokumerlo.com/sorteo/login.php e ingresar como admin.
