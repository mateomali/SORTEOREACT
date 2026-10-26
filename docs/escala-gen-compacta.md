# GEN compacto

La versión 3 de `assets/player-rating-policy.json` compacta la conversión de habilidades internas (1–6) a GEN (60–99). No reescribe las habilidades de los jugadores ni las notas de partidos.

| Referencia | GEN |
|---|---|
| Malo | 60–67 |
| Regular | 68–75 |
| Bueno | 76–83 |
| Muy bueno | 84–89 |
| Élite | 90–95 |
| Excepcional | 96–99 |

Anclas de referencia: 2 → 64, 3 → 72, 4 → 80, 4,5 → 87, 5 → 93. Entre anclas se interpola y redondea. La conversión inversa del editor usa la misma escala.

`anchors` controla los valores mostrados; `balanceAnchors` conserva la conversión anterior para criterios del sorteo: categorías, regularidad, fuerza por línea y agrupamiento automático de potes. PHP usa `draw_player_card_overall` y JavaScript `GoodfellasRating.balanceCard` para esos criterios. Las sumas de fuerza siguen usando el valor interno.

La importación local del 26/10/2026 usó únicamente `players` del archivo `BASE JUGADORES OCTUBRE 26.sql`: 66 registros, con los mismos IDs y estados activo/inactivo. No se importaron otras tablas del archivo. Las fotos locales existentes se conservaron cuando el SQL referenciaba archivos nuevos ausentes. El respaldo anterior y el informe están en `.tmp/db-backups/`.

Comprobaciones: `node tests/rating-compaction.cjs`, `npm run test:rating`, `php tests/sorteo-rules.php`, `node tests/sorteo-pots.cjs` y `npx playwright test tests/player-rating-browser.spec.js --workers=1`.
