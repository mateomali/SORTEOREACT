Goodfellas - Bundle seguro Hostinger - 20260614_233931
Commit base: 471f936

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/config.php: configuracion runtime requerida para login y conexion DB.
- public_html/uploads/players/: imagenes locales actuales incluidas para merge.
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene.

Cambio de base de datos de esta tanda:
- Ejecutar sql/20260614_add_director_vote_manually_modified.sql antes o junto con la subida si el server aun no tiene director_player_stat_votes.manually_modified.
- Ese script es idempotente: si la columna ya existe, no vuelve a crearla.
- Los registros existentes quedan en 0 por diseno; un jugador queda Modificado solo cuando el directivo guarda esa fila.

Seguridad:
- No incluye database.sql completo, package.json, package-lock.json, node_modules, src, tests, .git, .tmp, dist, backup/ ni backups locales.
- No incluye hostinger_diag.php, migrar_schema.php, migrar_csv.php, capturas/previews PNG de trabajo ni fuentes Tailwind.
- Incluye config.php porque el runtime lo requiere; si el servidor tiene credenciales distintas, comparar o hacer backup antes de reemplazarlo.

Validacion local antes de generar:
- npm run build OK.
- npm run test:sorteo OK.
- php -l sobre 46 archivos PHP runtime OK.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Ejecutar sql/20260614_add_director_vote_manually_modified.sql en phpMyAdmin si falta la columna.
3. Subir/reemplazar el contenido de public_html/ dentro de public_html/sorteo.
4. Verificar login.php, mis_valoraciones.php, jugadores2.php y sorteo.php.
