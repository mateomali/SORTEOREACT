GOODFELLAS - Bundle seguro Hostinger
Generado: 20260512_015058
Commit base: afa63fa
Incluye cambios locales no commiteados al momento de generar el bundle si existian.

Contenido:
- public_html/: subir estos archivos al public_html del hosting.
- sql/database_full_update.sql: respaldo SQL completo para importar manualmente si hace falta.

Excluido intencionalmente:
- .git, node_modules, dist previo, backup/, docs/, tests/, src/, package*.json, vite/tailwind config y fuentes no necesarias para produccion.

Notas:
- No reemplaza credenciales por defecto: revisar public_html/config.php antes de subir si el entorno requiere cambios.
- Subir el contenido de public_html, no la carpeta contenedora completa.
