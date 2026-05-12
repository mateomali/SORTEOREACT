GOODFELLAS - Hostinger safe bundle
Generado: 2026-05-11 16:32:38 -03:00
Commit incluido: ce912ec

CONTENIDO
- public_html/: archivos runtime listos para subir al public_html de Hostinger.
- sql/database_full_update.sql: dump completo actual de la base local.

INCLUIDO EN public_html
- Archivos PHP de runtime
- includes/ y lib/
- assets compilados y recursos necesarios
- .htaccess para bloquear acceso web a config.php, database.sql, backups y carpetas internas conocidas

EXCLUIDO INTENCIONALMENTE
- .git/
- node_modules/
- backup/
- dist/ historico
- docs/ y tests/
- src/ y configuracion de build
- package.json / package-lock.json / vite.config.js
- assets/tailwind.input.css
- database.sql dentro de public_html

PASOS RECOMENDADOS
1. En Hostinger, hacer backup de archivos actuales y de la base remota antes de tocar nada.
2. Subir el contenido de public_html/ al public_html del servidor o a la carpeta /sorteo correspondiente.
3. Si corresponde actualizar datos/esquema, importar sql/database_full_update.sql desde phpMyAdmin.

ADVERTENCIA BASE DE DATOS
El SQL es un dump completo: puede incluir DROP TABLE, CREATE TABLE e INSERT de datos actuales.
Importarlo reemplaza las tablas incluidas por el estado local actual.
