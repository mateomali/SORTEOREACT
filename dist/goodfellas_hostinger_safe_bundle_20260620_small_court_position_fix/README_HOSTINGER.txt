Goodfellas - Bundle seguro Hostinger - 20260619_021723
Commit base: c1a9660

Contenido:
- public_html/: archivos listos para subir/descomprimir en public_html/sorteo.
- public_html/config.php: configuracion runtime requerida para login y conexion DB.
- public_html/uploads/: imagenes locales actuales incluidas para merge.
- sql/: deltas SQL disponibles para aplicar manualmente si el servidor aun no los tiene.

Incluye los ultimos ajustes:
- Vista capitanes/formacion compacta.
- editar_partidos.php con UI React/Tailwind compacta desktop/mobile.
- Assets React y Tailwind compilados.

Seguridad / exclusiones intencionales:
- No incluye .git, node_modules, src, tests, scripts, docs, backup, dist, outputs, .tmp ni android-goodfellas.
- No incluye database.sql completo ni dumps locales.
- No incluye hostinger_diag.php, migrar_schema.php ni migrar_csv.php.
- No incluye capturas/previews PNG de trabajo ni assets/tailwind.input.css.
- Incluye config.php porque el runtime lo requiere; si el servidor tiene credenciales distintas, hacer backup/comparar antes de reemplazarlo.

Validacion local antes de generar:
- npm run build OK.
- npm run test:sorteo OK.
- php -l sobre 80 archivos PHP runtime OK.

Pasos recomendados:
1. Hacer backup de archivos y base de datos en Hostinger.
2. Aplicar los SQL de sql/ solo si el servidor no tiene esos cambios.
3. Subir/reemplazar el contenido de public_html/ dentro de public_html/sorteo.
4. Verificar login.php, editar_partidos.php, capitanes.php y sorteo.php.
