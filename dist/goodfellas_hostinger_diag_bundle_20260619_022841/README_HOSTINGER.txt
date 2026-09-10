Goodfellas - Bundle diagnostico Hostinger - 20260619_022841
Commit base: c1a9660

Subir/reemplazar public_html/ dentro de public_html/sorteo.

Diagnostico agregado:
- editar_partidos.php activa logging PHP para esa pagina.
- includes/footer.php captura errores JS del navegador antes de cargar assets.
- diagnostics_log.php recibe errores JS solo con sesion admin.
- diagnostico_logs.php muestra los ultimos logs solo para admin.
- logs/.htaccess bloquea acceso directo a logs/runtime.log.

Para usarlo:
1. Subir este bundle al hosting.
2. Entrar como admin.
3. Abrir https://sudokumerlo.com/sorteo/editar_partidos.php y reproducir pantalla blanca.
4. Abrir https://sudokumerlo.com/sorteo/diagnostico_logs.php y copiar el contenido.

Validacion local:
- php -l en archivos modificados OK.
- npm run build OK.
