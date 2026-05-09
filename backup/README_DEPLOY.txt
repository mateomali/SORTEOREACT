Bundle seguro Hostinger - Goodfellas Futbol
Fecha: 2026-05-05 15:27

Contenido
- Archivos PHP/CSS/JS listos para subir a public_html/sorteo.
- SQL/regularidad_stat_migration.sql con la migracion completa del stat Regularidad.

Orden recomendado
1. En Hostinger, generar backup completo de archivos y base de datos.
2. Subir/reemplazar los archivos del bundle en la carpeta de la app.
3. Entrar a phpMyAdmin, seleccionar la base de datos de produccion y ejecutar:
   SQL/regularidad_stat_migration.sql
4. Abrir la pagina Jugadores y verificar que:
   - aparece el stat Regularidad;
   - los arqueros muestran Habilidad de arquero en lugar de Ataque;
   - el promedio General se recalcula correctamente;
   - el informe del jugador menciona la regularidad.

Notas de seguridad
- El SQL es idempotente: no falla si players.regularity ya existe.
- Antes de modificar datos, crea:
  players_backup_before_regularity_20260505
- La app tambien tiene migracion automatica en lib/schema.php, pero se incluye este SQL para ejecutar el cambio de base de datos de forma controlada en Hostinger.

Cambios incluidos
- Nuevo stat Regularidad.
- Regularidad ajusta el promedio General con un maximo aproximado de +/-5%.
- Formularios, listados, radar e informe del jugador actualizados.
- Resumenes de equipo y armado manual/capitanes actualizados.
- Ajustes visuales del radar y del campo General.
- Guardado de jugador en escritorio mantiene foco y posicion.
