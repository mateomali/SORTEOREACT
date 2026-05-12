GOODFELLAS - Bundle seguro Hostinger
Generado: 20260512_143558
Commit: 7c6b795

Contenido:
- public_html/: subir estos archivos al public_html del hosting.
- sql/database_full_update.sql: respaldo SQL completo para importar manualmente si hace falta.

Incluye:
- Correccion para que Inicio muestre la ultima fecha finalizada con resultado aunque exista una proxima fecha.
- Respeto de index.php?match_id=... para ver una fecha concreta desde Inicio.
- Build CSS y React generado para produccion.

Excluido intencionalmente:
- .git, node_modules, dist previo, backup/, docs/, tests/, src/, package*.json, vite/tailwind config y fuentes no necesarias para produccion.

Notas:
- No reemplaza credenciales por defecto: revisar public_html/config.php antes de subir si el entorno requiere cambios.
- Subir el contenido de public_html, no la carpeta contenedora completa.
