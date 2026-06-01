Goodfellas - Bundle seguro Hostinger - 20260601_020529
Commit base: 7be45f3

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/uploads/players/: imagenes actuales de jugadores incluidas (71 archivos).
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene.

Seguridad:
- No incluye config.php para no pisar credenciales del servidor.
- No incluye database.sql completo, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php ni scripts de migracion local.

Validacion local antes de generar:
- npm run build OK.
- php -l sorteo_legacy_csv.php OK.
- php -l finalizar_partido.php OK.
- php -l capitanes.php OK.
- php -l jugadores2.php OK.
- php -l index.php OK.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Subir/descomprimir el contenido de public_html/ dentro de la carpeta del sitio.
3. Mantener el config.php existente del servidor.
4. Subir tambien public_html/uploads/players/ para que las fotos queden en la ruta esperada.
5. Aplicar solo los SQL de sql/ que aun no esten aplicados.
