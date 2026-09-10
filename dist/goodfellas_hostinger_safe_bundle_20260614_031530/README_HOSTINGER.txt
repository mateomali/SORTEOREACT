Goodfellas - Bundle seguro Hostinger - 20260614_031530
Commit base: d24dd07

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/uploads/players/: imagenes actuales de jugadores incluidas (47 archivos).
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene (4 archivos).

Seguridad:
- No incluye config.php para no pisar credenciales del servidor.
- No incluye database.sql completo, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php, migrar_schema.php, migrar_csv.php, capturas/previews PNG de trabajo ni fuentes Tailwind.
- Mantener el config.php existente en Hostinger o configurar variables de entorno equivalentes.

Validacion local antes de generar:
- npm run build:react OK.
- npm run build:css OK.
- php -l sobre 32 archivos PHP runtime OK.

Notas de base de datos:
- Esta tanda de UI no agrega cambios estructurales nuevos.
- Aplicar solo los SQL de sql/ que aun no esten aplicados en el servidor.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Descomprimir este ZIP localmente o en Hostinger.
3. Subir/reemplazar el contenido de public_html/ dentro de public_html/sorteo.
4. No borrar ni reemplazar config.php del servidor.
5. Subir tambien public_html/uploads/players/ para que las fotos queden disponibles.
6. Verificar https://www.sudokumerlo.com/sorteo/ y login admin.
