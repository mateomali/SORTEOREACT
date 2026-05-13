GOODFELLAS - Bundle seguro Hostinger
Generado: 20260512_150418
Commit: 28afd51

Contenido:
- public_html/: subir estos archivos al public_html del hosting.
- sql/database_full_update.sql: respaldo SQL completo para importar manualmente si hace falta.

Incluye:
- Guardado de resultado en finalizar_partido.php por POST tradicional, sin navegacion parcial.
- Etiquetas de equipos/camisetas respetando team_name y color_name en Inicio e Historial.
- Correccion para que Inicio muestre la ultima fecha finalizada con resultado aunque exista una proxima fecha.

Excluido intencionalmente:
- .git, node_modules, dist previo, backup/, docs/, tests/, src/, package*.json, vite/tailwind config y fuentes no necesarias para produccion.

Notas:
- Subir el contenido de public_html, no la carpeta contenedora completa.
- Revisar public_html/config.php si el entorno requiere otras credenciales.
