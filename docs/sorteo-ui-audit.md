# Auditoría UI de sorteo_legacy_csv.php

## Mapa previo a la implementación
- PHP: sorteo_legacy_csv.php prepara el payload de la isla con participantes, historial, pesos, permisos e intentos. lib/repository.php ya ofrece repo_match_participants y repo_match_teams para recuperar asignaciones y camisetas persistidas.
- Montaje: includes/header.php carga assets/tailwind.css; includes/footer.php carga app-ui.js, app.js y assets/react/react-app.js. ReactIslandRegistry resuelve SorteoLegacyPageIsland. assets/sorteo-legacy.js es una implementación anterior y no se carga en esta página.
- Header, preparación, generación, equipos, guardado y análisis: src/pages/SorteoLegacyPageIsland.jsx. CompactPlayerCard y gf-formation comparten la presentación de cancha con el editor de formaciones.
- Generación: generateTeams, generateBalancedTeams, scoreTeams y generateTeamFormationVariants. No se alteran algoritmos, pesos, reglas ni límites.
- Interacción: eventos pointer y fallback touch; pulsación mantenida de 450 ms; validación y mutación centralizadas en validateDropTarget y movePlayer. Tap → tap ya existe; la bandeja permite ficha, banco, posiciones e intercambio.
- Guardado: guardar_sorteo.php recibe JSON, valida convocados, arqueros, colores, permisos, firmas distintas e intentos; persiste equipos, posiciones, suplentes y disponibilidad en una transacción. El frontend redirigía a Fechas después de guardar.
- Formaciones: finalizar_partido.php?match_id=…&edit_formations=1#formaciones monta la misma isla en mode=formation_editor. Su POST save_formations ya acepta JSON y valida/persiste asignaciones y camisetas.
- Exportación: JPG con html-to-image y clon aislado; texto y copia de equipos existentes. La exportación apila los equipos independientemente del layout interactivo.
- CSS: assets/tailwind.input.css contiene estilos generales, capas de reglas heredadas y el sistema gf-formation. El refactor nuevo se delimita con gf-draw-workflow y excluye mode=formation_editor.

## Decisiones por arquitectura real
- Recuperar equipos guardados con repositorios existentes; no introducir estados ni tablas en backend.
- Después de guardar el sorteo permanecer en la página y ofrecer la ruta existente de Formaciones.
- Un sorteo con distinta composición sigue usando guardar_sorteo.php y sus límites. Para cambios de camiseta/posición/banco sin cambiar composición se reutiliza save_formations, pues guardar_sorteo.php rechaza explícitamente una firma idéntica.
- Comparar el estado persistible actual con el último snapshot guardado para detectar cambios reales y restauraciones, sin falsos positivos por expandir paneles.
- En pantallas estrechas mantener dos canchas simultáneas y repartir líneas densas en subfilas dentro de la misma zona; preservar nombres, fotos, badges y controles.
- Toda información avanzada se conserva mediante secciones expandibles. El editor de finalizar_partido.php conserva su flujo y layout actuales.


## Implementación entregada
- Cabecera compacta y progreso Jugadores → Arqueros → Equipos → Formaciones; preparación editable y cerrada al completar, generación secundaria, resumen y comparación rápida.
- Dos columnas desde 320 px. Subgrid sincroniza la altura de los bloques de ambos equipos al desplegar herramientas. Cuatro zonas iguales en cada campo; las líneas densas se reparten dentro de su zona. Las cartas mantienen fotos, nombres, valoraciones e indicadores.
- Opciones tácticas, navegación, estadísticas y análisis avanzado se despliegan a demanda. Banco compacto cuando está vacío; acciones y jugadores del banco se conservan.
- Acción móvil sticky en el flujo, con safe-area. Detección de cambios basada en jugadores/equipo/posición/suplencia/disponibilidad/camiseta frente al snapshot enviado y confirmado. Abrir paneles no genera cambios.
- Guardar conserva la pantalla. Formaciones se habilita solamente con equipos persistidos y sin cambios pendientes. Se reutilizan los endpoints actuales sin cambiar sus validaciones ni transacciones.
- Código compartido: presentación de cartas y guardado; las reglas de interfaz nuevas están acotadas a gf-draw-workflow. El editor de formaciones conserva su modo propio y su redirección al guardar.

## Validación y alcance
- Playwright: geometría de ambas canchas en 320, 360, 390, 430, 768, 1024 y 1440 px; contenido de cartas también a 760, 1280 y 1920 px; stress de 1–5 cartas por línea, nombres largos, fotos y penalizaciones.
- Fecha temporal aislada: abrir/cancelar editor de jugador, definir arqueros, generar/rehacer y consumir intento, seleccionar alternativas, desplegar/cerrar análisis, guardar en MySQL, recargar, verificar camisetas/posiciones, detectar cambio real y ausencia de falso cambio, actualizar camiseta sin consumir intento, entrar a Formaciones y regresar. Se registran errores de JavaScript, consola y respuestas HTTP fallidas.
- Interacción: arrastre con mouse en ambos sentidos; tap → tap; pulsación mantenida y arrastre touch; desplazamiento vertical sin mover jugadores; bandeja de destinos; retorno y deshacer; banco y controles de líneas.
- Exportación: JPG móvil, escritorio y densidad 2x, con nombres de equipos y canchas completas apiladas; acción móvil de 44 px.
- Regresión: sorteo determinista con semillas fijas, respuesta de interfaz durante generación, reglas PHP, persistencia real del banco, penalizaciones por posición y restauración de intercambios dependientes.
- No se validó en teléfonos físicos, Safari/iOS ni Hostinger. No se enviaron ediciones de fichas personales a la base: se comprobó apertura/cancelación para preservar datos reales. Exportación de texto/copia y cargas CSV se mantienen en el código, sin una nueva prueba funcional de esas acciones en este refactor.

Resultado final: build de producción correcto, lint PHP y git diff --check correctos; 15/15 pruebas Playwright pasaron en la corrida final. Reglas PHP, persistencia PHP del banco y pruebas Node de penalizaciones/restauración también pasaron. Fixtures temporales eliminados.

## Ajuste posterior solicitado
Guardar equipos y continuar vuelve a editar_partidos.php tras confirmar el guardado, también al actualizar camisetas/posiciones con save_formations. La fecha destacada se conserva arriba y se excluye del historial inferior antes de filtrar y paginar. Build correcto y dos pruebas aprobadas: persistencia con regreso a Editar fechas y ausencia de duplicación, incluso al buscar la fecha destacada.
