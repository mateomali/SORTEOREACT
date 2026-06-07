Goodfellas - Bundle seguro Hostinger - 20260607_171238
Commit base: d2a0bac

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/uploads/players/: imagenes actuales de jugadores incluidas (71 archivos).
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene.

Seguridad:
- No incluye config.php para no pisar credenciales del servidor.
- No incluye database.sql completo, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php, scripts de migracion local ni previews/capturas de trabajo.

Validacion local antes de generar:
- npm run build OK.
- php -l sorteo_legacy_csv.php OK.
- php -l finalizar_partido.php OK.
- php -l capitanes.php OK.
- php -l jugadores2.php OK.
- php -l index.php OK.
- php -l encuentros.php OK.
- php -l perfil.php OK.

Notas de base de datos:
- Esta tanda no agrega cambios estructurales nuevos.
- Aplicar solo los SQL de sql/ que aun no esten aplicados en el servidor.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Subir/descomprimir el contenido de public_html/ dentro de la carpeta del sitio.
3. Mantener el config.php existente del servidor.
4. Subir tambien public_html/uploads/players/ para que las fotos queden en la ruta esperada.
5. Aplicar solo los SQL de sql/ que aun no esten aplicados.
