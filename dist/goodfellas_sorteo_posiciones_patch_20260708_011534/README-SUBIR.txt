Parche minimo para Hostinger

Subir el contenido de public_html/ al public_html/sorteo/ del hosting, respetando carpetas.

Incluye:
- assets/react/react-app.js
- assets/react/react-SorteoLegacyPageIsland-CxdqySdi.js
- assets/react/react-Jugadores2PageIsland-CJCWkMMp.js

Cambios:
- /sorteo evita asignar jugadores fuera de primaria/secundaria en variantes automaticas.
- LAT deja de ser obligatorio y solo se usa para jugadores que realmente pueden jugar LAT.
- Jugadores con ARQ como segunda posicion muestran el stat de arquero al editar.
