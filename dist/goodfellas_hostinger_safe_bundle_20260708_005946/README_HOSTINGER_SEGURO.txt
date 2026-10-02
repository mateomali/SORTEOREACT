Goodfellas - Bundle seguro Hostinger - 20260708_005946
Commit: 75fad66
Rama: codex/react-tailwind-migration

Contenido:
- public_html/ con archivos PHP, assets compilados, includes/ y lib/.
- assets/tailwind.css y assets/react generados con npm run build.
- logs/.htaccess si existe, para proteger logs.

Excluido a proposito para no pisar datos ni subir desarrollo:
- .git, node_modules, src, tests, test-results, scripts, docs.
- backup/, dist/, outputs/, tmp/, .tmp/, logs/runtime.log.
- uploads/ y fotos cargadas por usuarios.
- SQL locales/migraciones: database.sql, hostinger_*.sql.
- capturas PNG de QA/desarrollo en raiz.

Uso seguro:
1. Descomprimir el ZIP localmente o en Hostinger.
2. Subir el contenido de public_html/ dentro de public_html/sorteo/.
3. No borrar uploads/ existente del hosting.
4. Si Hostinger ya tiene config.php personalizado, comparar antes de pisarlo.
