Goodfellas - Bundle seguro Hostinger - 20260525_190412
Commit base: 937e6af

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- sql/hostinger_schema_update_20260525_no_player_stats.sql: delta DB seguro para esquema/formaciones.

Seguridad:
- No incluye config.php para no pisar credenciales del servidor.
- No incluye database.sql, jugadores.csv, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, deploy, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php ni scripts de migracion.
- El SQL incluido no recalcula ni modifica stats de jugadores.

Cambios incluidos:
- Cards compactas y full cards modernizadas con fondos PNG por tier.
- Vista cancha de capitanes alineada al formato de historial, con controles laterales y drag/drop.
- Sorteo legacy migrado al island React correspondiente.
- Build CSS/React actualizado.

Validacion local antes de generar:
- npm run build OK.
- php -l capitanes.php OK.
- php -l historial.php OK.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Subir/descomprimir el ZIP dentro de public_html/sorteo.
3. Mantener el config.php existente del servidor.
4. Ejecutar sql/hostinger_schema_update_20260525_no_player_stats.sql en phpMyAdmin si aun no fue aplicado.
