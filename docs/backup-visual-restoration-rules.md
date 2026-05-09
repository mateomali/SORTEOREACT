# Backup Visual Restoration Rules

Objetivo: mantener la funcionalidad actual del sitio sin perder la visual que estaba validada en `backup/`.

## Regla principal

La visual base del sitio sale de `backup/assets/tailwind.input.css`.

No se debe reconstruir una pagina copiando a ciegas el PHP viejo si eso elimina funcionalidades actuales. El flujo correcto es:

1. Comparar la pagina actual contra su equivalente en `backup/`.
2. Recuperar estructura visual, clases y CSS del backup.
3. Mantener funciones actuales: permisos, roles, AJAX, React islands, atributos `data-*`, tokens, filtros, ordenamiento, dialogos y endpoints.
4. Reintegrar las funcionalidades nuevas con componentes visuales compatibles con el backup.
5. Compilar y probar en navegador.

## CSS

- `assets/tailwind.input.css` es la fuente visual principal.
- `assets/contrast-overrides.css` no carga por defecto. Solo una pagina puede activarlo explicitamente con:

```php
$disableContrastOverrides = false;
```

- Si una funcionalidad nueva necesita estilos, se agregan a `assets/tailwind.input.css` usando la paleta del backup:
  - Fondo pagina: `#f1f5f9`
  - Superficie: `#ffffff`
  - Superficie suave: `#ecfdf5`
  - Borde: `#dbe7e2` / emerald claro
  - Texto principal: `#07130f`
  - Verde oscuro: `#022c22`
  - Acento lima: `#d9f99d`
  - Acento verde: `#00a36c`

## React

Los React islands deben respetar los estilos del backup. No deben introducir:

- paneles oscuros nuevos,
- sombras pesadas,
- gradientes,
- clases `text-lime-*` sobre fondos claros,
- botones activos con texto claro sobre fondo claro,
- markup visual duplicado que contradiga el PHP.

Cuando React agrega funcionalidad sobre HTML existente, debe usar las mismas clases semanticas del backup y reforzar solo lo necesario.

## Jugadores como referencia

`jugadores.php` queda como ejemplo de migracion:

- visual restaurada desde `backup/jugadores.php`,
- funcionalidades actuales reintroducidas de forma puntual,
- stats en barras, no estrellas,
- filtros y ordenamiento React conservados,
- `contrast-overrides.css` desactivado.

## Verificacion minima

Antes de cerrar un cambio visual:

```powershell
npm run build:css
npm run build:react
php -l pagina.php
```

Despues, abrir la pagina en el servidor local y revisar:

- no hay errores de consola,
- no carga `contrast-overrides.css` salvo opt-in explicito,
- los labels tienen contraste suficiente,
- los controles activos se leen claramente,
- las funcionalidades nuevas siguen respondiendo.
