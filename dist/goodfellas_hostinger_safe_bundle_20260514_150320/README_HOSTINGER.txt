GOODFELLAS - Bundle seguro Hostinger
Generado: 20260514_150320
Commit: 037dd66

Contenido:
- public_html/: subir estos archivos al public_html del hosting.
- sql/database_full_update.sql: respaldo SQL completo para importar manualmente si hace falta.

Incluye:
- Login actualizado con visual Tailwind directa.
- Toggle de contrasena con iconos de ojo abierto/cerrado, sin textos Ver/Ocultar visibles.
- assets/tailwind.css y assets/react/react-app.js regenerados para produccion.

Excluido intencionalmente:
- .git, node_modules, dist previo, backup/, docs/, tests/, src/, package*.json, vite/tailwind config y fuentes no necesarias para produccion.

Notas:
- Subir el contenido de public_html, no la carpeta contenedora completa.
- Revisar public_html/config.php si el entorno requiere otras credenciales.
- Importar sql/database_full_update.sql solo si corresponde actualizar o restaurar datos/esquema.
