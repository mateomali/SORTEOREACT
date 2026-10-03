# Puntaje por posición y equilibrio de equipos

La política está en `assets/player-rating-policy.json`. PHP la lee directamente; cada página entrega la política efectiva, incluidos los pesos personalizados, al motor `assets/player-rating.js`. Las páginas y sus vistas React consultan esa misma política. La navegación parcial reemplaza la política junto con el contenido.

## Fórmula

1. Normalizar cada atributo entre 1 y 6, con un decimal.
2. Calcular el promedio ponderado de los atributos relevantes para el rol, dividido por la suma efectiva de pesos.
3. Multiplicar por `1 + (regularidad - 3.5) / 50`, limitado entre 1 y 6. La regularidad aporta como máximo ±5%.
4. Aplicar la adaptación: posición principal 100%, secundaria 95%, otras 90%. El sorteo mantiene la regla existente de omitir esta penalización en equipos de menos de siete jugadores.
5. Redondear a un decimal. Convertir para las cartas mediante los mismos puntos de interpolación de 35 a 99; esta conversión es visual, los equipos se comparan en la escala interna.

El general del catálogo representa la primera posición elegida. Los puntajes por posición evalúan cada rol por separado. La posición secundaria sigue disponible y el sorteo puede usarla según sus restricciones; no se cambia automáticamente la posición declarada.

## Pesos predeterminados

| Atributo | ARQ | DEF | LAT | MED | DEL |
|---|---:|---:|---:|---:|---:|
| Habilidad de arquero | 50% | — | — | — | — |
| Solidez | 10% | 36% | 22% | 6% | 2% |
| Velocidad | 4% | 12% | 20% | 10% | 16% |
| Ida y vuelta | 4% | 12% | 18% | 10% | 6% |
| Técnica | 6% | 8% | 10% | 20% | 16% |
| Pase/visión | 8% | 10% | 14% | 28% | 8% |
| Juego en equipo | 8% | 10% | 8% | 14% | 8% |
| Mentalidad | 10% | 10% | 4% | 8% | 8% |
| Ataque | — | 2% | 4% | 4% | 36% |

Los roles tienen mayor sensibilidad a sus atributos principales. Un lateral conserva una combinación de defensa, velocidad, resistencia y pase. Los porcentajes son una propuesta de diseño, no coeficientes estimados científicamente con partidos de este grupo.

Una configuración que coincide exactamente con los pesos predeterminados de la versión anterior usa los nuevos valores. Las configuraciones personalizadas se conservan. La ayuda del editor muestra los porcentajes efectivos.

## Sorteo

Se conserva el optimizador existente: restricciones de arqueros, posiciones, bloqueos, jugadores fuertes, balance por línea y balance de atributos. El puntaje se calcula para la posición asignada. Se conservan los ajustes contextuales de disponibilidad y de rendimiento histórico que ya existían en el sorteo React; por eso el puntaje de una fecha puede diferir del catálogo. El historial aporta un ajuste limitado a ±0.25 puntos y no altera las stats permanentes.

La puntuación seleccionada en el sorteo se recalcula desde las stats para evitar mezclar un general recibido del servidor con una segunda aplicación del historial. La sincronización de `players.skill` también usa el cálculo central, en lugar de una fórmula SQL independiente. Los sorteos y resultados guardados no se regeneran.

## Evidencia y límites

[FIFA: transiciones de alta velocidad](https://www.fifatrainingcentre.com/en/practice/futsal/fitness/high-speed-transitions.php) respalda considerar la condición física y las transiciones en fútbol reducido. [Microsoft Research: TrueSkill](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/) describe cómo estimar fuerza individual e incertidumbre a partir de resultados colectivos. Ninguna de estas fuentes establece estos pesos por posición.

La mejora comprobada aquí es la consistencia del cálculo y sus propiedades: límites, monotonicidad, especialización por rol y respeto de las restricciones del sorteo. No demuestra una mayor precisión predictiva sobre partidos reales. Para calibrar los pesos, conviene comparar las predicciones previas con resultados futuros, controlar compañeros y rivales, y validar en fechas no usadas para ajustar el modelo. Hasta disponer de esa evaluación, no se presenta este modelo como universalmente óptimo.

## Verificación

- `npm run test:rating`: 2.000 comparaciones PHP/JavaScript y los mismos casos a través de las funciones reales del sorteo; límites, monotonicidad y pesos personalizados.
- `npm run test:sorteo`: reglas del servidor y escenarios React de 2, 3 y 4 equipos, distribución por líneas y búsqueda exhaustiva en un caso pequeño.
- `npx playwright test tests/player-rating-browser.spec.js tests/site-pages-smoke.spec.js`: vista de creación, política personalizada en memoria, navegación parcial y carga de páginas públicas y administrativas.
- `npm run build:react`: compilación de las vistas.

## Cobertura de l?neas

En equipos de menos de 8 jugadores no hay m?ximos por l?nea: se exige exactamente 1 arquero, al menos 2 defensores (DEF/LAT), 1 mediocampista y 1 delantero. Esto requiere al menos 5 jugadores por equipo. En equipos mayores se mantienen los l?mites existentes y ninguna l?nea puede quedar vac?a.

El sorteo usa las posiciones principales y secundarias primero. Solo permite adaptar jugadores cuando el plantel completo carece de opciones naturales o secundarias suficientes para cubrir una l?nea. La cantidad de adaptaciones se limita al d?ficit real, considerando tambi?n jugadores con posiciones compartidas. La adaptaci?n se aplica a la formaci?n de esa fecha y su puntaje contextual; no modifica las posiciones ni las stats permanentes.
