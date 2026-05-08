Goodfellas Futbol - Bundle seguro Hostinger
Generado: 2026-05-08 16:57:03
Commit base: dd0d6aa + working tree remove save formation validation

Verificacion sorteo_legacy_csv.php:
- cache bust sorteo-legacy.js: True

Verificacion sorteo-legacy.js:
- player-card-rating: True
- re-sorteo configurable: True

Verificacion guardar_sorteo.php:
- sin validate_teams_legacy: True
- sin mensaje reglas guardado: True
- mantiene integridad convocados/repetidos: True

Verificacion SQL:
- allow_redraw: True
- redraw_limit: True
- redraw_count: True

Contenido:
- public_html/: subir/reemplazar en public_html de Hostinger.
- sql/: ejecutar solo si necesitas actualizar estructura; no borra datos.

No incluye node_modules, src, tests, backups locales ni archivos de desarrollo.
