# Goodfellas Futbol - Version con Base de Datos

## 1) Crear la base en phpMyAdmin
1. Abre phpMyAdmin.
2. Importa el archivo [`database.sql`](./database.sql).
3. Verifica que se creo la base `u552541920_futbol` y sus tablas.

## 2) Configuracion
Configura las credenciales desde variables de entorno antes de publicar:
- `GOODFELLAS_DB_HOST`
- `GOODFELLAS_DB_NAME`
- `GOODFELLAS_DB_USER`
- `GOODFELLAS_DB_PASS`
- `GOODFELLAS_ADMIN_PASSWORD`

Si tu hosting usa otro host de MySQL, cambia `DB_HOST`.

## 3) Flujo recomendado
1. Cargar jugadores en `jugadores.php` o migrar desde CSV en `migrar_csv.php`.
2. Crear partidos y convocados en `encuentros.php`.
3. Sortear equipos en `sorteo_legacy_csv.php`.
4. Finalizar partido (goles y calificaciones) en `finalizar_partido.php`.
5. Analizar ranking en `estadisticas.php`.

## 4) Reglas implementadas en sorteo
- 1 solo arquero por equipo.
- Si un arquero tiene doble posicion y sobra en ARQ, pasa a su otra posicion.
- Maximo 3 jugadores por linea (`ARQ/DEF/MED/DEL`).
- Si una linea supera 3, se reubican multi-posicion automaticamente.
- Balance de puntuacion por `max_diff`.
