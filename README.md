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

## Levantar servidor local
Con doble click en Windows:

```text
dist\levantar-servidor-red-local.bat
```

El lanzador pide permisos de administrador para abrir Windows Firewall, arranca MySQL/PHP y abre la URL de red local en el navegador.

Desde PowerShell:

```powershell
.\scripts\levantar-servidor-local.ps1
```

El script levanta MySQL de XAMPP si hace falta, inicia PHP desde `C:\xampp\php\php.exe` y muestra la URL local.
Tambien muestra `NetworkUrl`; usa esa direccion desde otros equipos conectados a la misma red local.

Ejemplo:

```powershell
.\scripts\levantar-servidor-local.ps1
```

Si Windows Firewall pregunta, permiti el acceso para redes privadas. Si no aparece el aviso y otros equipos no pueden entrar, habilita el puerto mostrado por `NetworkUrl`.

## 3) Flujo recomendado
1. Cargar jugadores en `jugadores.php` o migrar desde CSV en `migrar_csv.php`.
2. Crear partidos y convocados en `encuentros.php`.
3. Sortear equipos en `sorteo_legacy_csv.php`.
4. Finalizar partido (goles y calificaciones) en `finalizar_partido.php`.
5. Analizar ranking en `estadisticas.php`.

## 4) Regla obligatoria de UI

Todo contenido visual nuevo del sitio debe construirse con **Tailwind CSS puro en el markup**.

- No crear nuevas reglas CSS heredadas para componentes visuales.
- No agregar estilos nuevos basados en clases custom tipo `.mi-componente` salvo que sean solo hooks de JS o identificadores semanticos sin estilos.
- No usar `style=""` inline para resolver layout, colores, spacing o responsive.
- No usar `<style>` embebido en paginas PHP.
- Si un bloque se reutiliza en varias pantallas, debe ser un componente/render PHP compartido con clases Tailwind directas.
- Las clases CSS existentes se pueden mantener solo mientras se migran pantallas viejas; no deben ser el patron para trabajo nuevo.
- Cada cambio UI debe correr `npm run build:css`.

## 5) Reglas implementadas en sorteo
- 1 solo arquero por equipo.
- Si un arquero tiene doble posicion y sobra en ARQ, pasa a su otra posicion.
- Maximo 3 jugadores por linea (`ARQ/DEF/MED/DEL`).
- Si una linea supera 3, se reubican multi-posicion automaticamente.
- Balance de puntuacion por `max_diff`.
