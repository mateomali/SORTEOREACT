GOODFELLAS - Bundle seguro Hostinger
Generado: 20260513_020145
Commit: 5771d9e

Contenido:
- public_html/: subir estos archivos al public_html del hosting.
- sql/database_full_update.sql: respaldo SQL completo para importar manualmente si hace falta.

Incluye:
- Cambios recientes de jugadores.php: radar ampliado en escritorio, nombres guardados en mayusculas y ajustes visuales.
- Cambios recientes de capitanes.php: seleccion obligatoria de camiseta antes de iniciar modo capitanes y persistencia en equipos.
- Schema auto-migrable desde lib/schema.php para columnas nuevas de camisetas en captain_drafts.

Excluido intencionalmente:
- .git, node_modules, dist previo, backup/, docs/, tests/, src/, package*.json, vite/tailwind config y fuentes no necesarias para produccion.

Notas:
- Subir el contenido de public_html, no la carpeta contenedora completa.
- Revisar public_html/config.php si el entorno requiere otras credenciales.
