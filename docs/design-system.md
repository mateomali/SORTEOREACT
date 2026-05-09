# Guia de diseño interna

Esta guia resume las reglas visuales que deben mantenerse para que el sitio GOODFELLAS siga consistente en desktop y mobile.

## Regla obligatoria: Tailwind puro

Desde ahora, todo contenido visual nuevo debe hacerse con **Tailwind CSS puro, directamente en el markup**.

- No crear nuevas reglas CSS heredadas para componentes visuales.
- No usar clases custom como fuente de estilos nuevos. Las clases propias solo pueden quedar como hooks JS, anchors, identificadores semanticos o compatibilidad temporal.
- No usar `style=""` para layout, color, spacing, tipografia, sombras, bordes o responsive.
- No agregar bloques `<style>` en paginas PHP.
- No ampliar `assets/tailwind.input.css` para componentes nuevos, salvo tokens/base globales realmente compartidos o migraciones temporales justificadas.
- Si una vista se repite en varias partes del sitio, crear un render/componente compartido y aplicar ahi las clases Tailwind.
- Las reglas CSS antiguas se consideran deuda tecnica: pueden seguir funcionando, pero todo trabajo nuevo debe evitar depender de ellas.

Ejemplo esperado:

```php
<article class="rounded-2xl border border-lime-200/35 bg-emerald-950/85 p-3 shadow-md shadow-emerald-950/15">
```

Ejemplo a evitar:

```php
<article class="nueva-card-custom">
```

## Principios

- Mobile primero en el rango 360px a 430px, con prueba adicional entre 320px y 480px.
- Una columna en mobile salvo grillas compactas ya validadas, como resumen de partido y estadisticas.
- Sin overflow horizontal: todo contenedor debe usar `max-width: 100%`, `min-width: 0`, `flex-wrap` o grillas responsivas.
- Las acciones secundarias en mobile se compactan en menus desplegables cuando haya mas de dos botones.
- Mantener jerarquia clara: titulo de pagina, descripcion breve, tarjeta/seccion, acciones.

## Colores

- Primario: emerald oscuro para acciones principales, navegacion y encabezados activos.
- Primario suave: emerald claro para fondos de resumen, badges y estados positivos.
- Neutro: slate para textos secundarios, bordes y superficies.
- Peligro: red para eliminar o advertencias destructivas.
- Advertencia: amber para acciones de sorteo o estados pendientes.
- Exito: green/emerald para finalizado, guardado y confirmado.

## Tipografia

- Titulos de pagina: bold/extrabold, emerald oscuro.
- Subtitulos: slate medio, line-height amplio para lectura.
- Labels: bold, slate/emerald oscuro, siempre encima del input en mobile.
- Badges y metricas: uppercase o small text solo cuando el espacio lo requiere.
- Evitar `nowrap` en textos largos; usar wrap o ellipsis solo en celdas compactas.

## Espaciado y radios

- Spacing base: multiplos de 4px.
- Cards: radio amplio y borde suave, sin anidar cards decorativas innecesarias.
- Inputs y botones tactiles: alto minimo comodo en mobile.
- Separacion entre secciones: suficiente para escaneo, sin grandes vacios verticales.

## Botones

- `.btn` es la base para botones y enlaces con aspecto de accion.
- `.btn-primary`: accion principal o guardar.
- `.btn-warning`: sorteo o accion pendiente importante.
- `.btn-danger`: eliminar.
- `.btn-muted`: cancelar, volver o accion secundaria.
- `.btn-disabled`: accion no disponible; no debe parecer clickeable.
- En mobile, acciones multiples dentro de partidos deben ir en `Acciones`.

## Cards y secciones

- `.card` es la superficie estandar para formularios, filtros y bloques de datos.
- Las cards deben ocupar el ancho disponible y no depender de alturas fijas.
- En mobile, los formularios pasan a una columna.
- En desktop, usar grillas solo cuando mejoran lectura y comparacion.

## Tablas y datos

- Desktop puede usar tablas completas.
- Mobile debe usar grilla compacta validada o panel de detalle flotante para datos extensos.
- Premios acumulados se muestran resumidos; el detalle completo va en panel emergente.
- No forzar todas las columnas si compromete legibilidad en 360px.

## Formularios

- Labels visibles, inputs de ancho completo en mobile.
- Evitar campos en la misma fila si el texto o input se comprime.
- Los botones de envio deben quedar debajo del contenido principal en mobile.
- Errores deben aparecer cerca del bloque afectado y permitir correccion.

## Navegacion

- Header compacto en mobile con boton `Menu`.
- Desktop mantiene navegacion horizontal.
- No duplicar accesos si una accion pertenece a un flujo especifico.

## Checklist antes de cerrar cambios UI

- Ejecutar `npm run build:css`.
- Revisar que no haya nuevos `style=`, `<style>`, `!important` ni reglas visuales custom fuera de Tailwind.
- Confirmar que los componentes nuevos usan Tailwind directo en el markup.
- Probar mobile 360px y desktop.
- Verificar que no haya scroll horizontal.
- Verificar PHP con `php -l` en paginas modificadas o en todas las paginas raiz.
