# Dirección visual de la página: diseño

Fecha: 15 de noviembre de 2026. Publicado en `main` con el #68, el #77 y el #80.

## Para qué

La página tiene que decir por sí sola por qué gana. Quien la toque dos minutos debe salir con
razones a favor y sin una lista de «le faltó». Antes de este rediseño cargaba rápido y decía la
verdad, pero:

- no se veía que resuelve el reto (unir MODIS y VIIRS es una nota de 9 px en la portada);
- se rompía en la laptop más común (a 1366×629 y 1024×600 la barra de la temporada tapa el buscador);
- los datos guardaban mejores historias que las que enseñaba;
- la página, el guion y el README no daban las mismas cifras.

## Reglas (valen para todo lo que se construya)

1. **Una afirmación por pantalla**, con su prueba ahí mismo y un gesto. Lo que no cabe se va a
   su página o desaparece.
2. **Cifras, no adjetivos.** Ningún texto elogia al producto. Nada de frases de tres partes con
   cadencia de anuncio, etiquetas en mayúsculas chicas sobre un número gigante, ni «el producto
   hablando de sí mismo».
3. **Una palabra para cada cosa.** La unidad es «foco de calor» (nunca «quema», «cuadrito-día»
   ni «incendio»). Los años se dicen «desde 2001». «Lo normal» es la mediana de 2001 a 2025.
4. **Un color por significado.** El rojo (`--rojo`) es 2026. El rojo claro (`#E9837D`) son los años con más
   fuego que lo normal y, rayado, lo que la corrección añade a los años de MODIS. En las gráficas de las
   pruebas, lo corregido va en rojo y lo que está sin corregir, en gris. El fuego de cada día va en
   naranja/ámbar. (Cambió el 15 de noviembre: antes el rojo era solo 2026 y «Cómo lo medimos» iba en tinta.)
   Lo calibrado, lo de otro satélite y lo demás va en tinta, gris o rayado.
5. **Nada borroso, cortado ni encimado** de 1024×600 a 2560×1440 y en teléfono (390×844).
   En escritorio la portada no se desplaza en vertical.
6. **Las limitaciones se quedan**, en chico. La honestidad cuenta en validez.
7. **Hechos con guarda.** Todo hecho generado de los datos lleva un mínimo de muestra, y lo que
   compara a escala de municipio usa solo 2012 en adelante (los años de MODIS salen exagerados
   a esa escala). Nunca «tu peor año» con los 26 años. Nunca «quemas ilegales». Nunca «el fuego
   va a la baja» ni «en aumento».
8. **Configurable y bilingüe.** Todo texto vive en `web/textos/es.json` y `en.json` (las dos).
   Letra de 11 px o más en cualquier gráfica.
9. **Accesible como hoy:** teclado, lector de pantalla, «reducir movimiento», blancos de 44 px
   en teléfono. Las pruebas de `tests/web` siguen en verde (se actualizan con su porqué).

## La historia: tres momentos y un cierre

Cada página termina con un enlace, escrito como oración, a la siguiente. Quien presenta solo
sigue el enlace.

| Página | Pregunta | Gesto | Sorpresa |
|---|---|---|---|
| Portada | ¿Cómo va mi municipio? | Arrastrar sobre las barras de los años | La península entera cambia de color: 2003 en rojo, 2026 en verde, 2024 con Campeche encendido |
| Fechas | ¿Se quemó cuando se podía? | Elegir la zona en el mapa | En el norte y oriente, 9 de cada 10 focos aparecen después de que cierran las fechas |
| Cómo lo medimos | ¿Por qué creerle? | El interruptor de 2012 | El fuego «se triplica» en 2012 y con un toque el salto desaparece |
| Municipio y ficha | ¿Y en mi pueblo? | Mandarla por WhatsApp | Su mapa, sus hechos y su ficha |

## Contrato de datos (lo escribe el pipeline; lo leen las páginas)

Los campos nuevos se **suman**; ningún campo existente cambia de nombre ni de forma.

### `web/datos/portada.json`
- `estados[].d`: el contorno de cada estado pasa a calcularse como la unión de sus municipios
  (hoy viene de otra fuente y no calza con los bordes municipales).
- `reciente`: `{ "dias": 7, "desde": "AAAA-MM-DD", "hasta": "AAAA-MM-DD", "yuc": n, "peninsula": n }`
  focos de calor de los últimos 7 días con datos.
- `satDia`: `{ "base": "S-NPP", "otros": { "<día de temporada 0–91>": "NOAA-20", … } }` qué
  satélite cuenta cada día de marzo a mayo de 2026 (los días que rellenó el respaldo).
- `yuc.rango`: `[p25, p75]` de los totales de marzo a mayo de 2001 a 2025.
- `datoHasta`: `{ "S-NPP": "AAAA-MM-DD", "NOAA-20": …, "MODIS": … }` fecha del último dato de cada sensor.

### `web/datos/municipio/<id>.json`
- `rango`: `[p25, p75]` de sus totales de marzo a mayo de 2001 a 2025.
- `focos26`: lista de `[lon, lat, "MM-DD", "satélite"]` de sus focos de calor de 2026 (la unidad
  de la página: un cuadrito de 1 km con fuego en un día; el centro del cuadrito). Año completo.
- `repetidos`: lista de `[lon, lat, años]` de los cuadritos con fuego en 5 o más temporadas de
  2012 a 2025, sin los que tienen historial de fuente fija (`type == 2`).
- `caja`: `[lon0, lat0, lon1, lat1]` del municipio.
- `hechos`: objeto con lo que tenga sentido; una clave ausente quiere decir «no se dice»:
  - `puesto26`: lugar de 2026 entre sus temporadas de 2012 a 2026, de menos a más fuego (1 = la
    de menos fuego), y `temporadas` (15). Solo si normal ≥ 5.
  - `racha`: temporadas seguidas, contando hacia atrás desde 2026, por debajo de lo normal. Solo si ≥ 3.
  - `empieza`: `"MM-DD"` en que un año normal lleva el 10 % de su fuego, y `empiezaZona` (la
    mediana de su zona). Solo si normal ≥ 20.
  - `semanaPico`: `["MM-DD", "MM-DD"]`. Solo si normal ≥ 20.
  - `lugar`: lugar en su estado por fuego de un año normal (1 = el de más), y `de` (cuántos).
  - `mitad`: `"MM-DD"` en que un año normal lleva la mitad de su fuego. Solo si normal ≥ 20.

### `web/datos/zonas.json` (cada zona)
- `porAnio`: `{ "2001": [antes, dentro, despues], … }` en proporciones de enero a junio.
- `tipico`: `[antes, dentro, despues]` mediana de 2012 a 2025, y `minFuera`: la menor proporción
  fuera de fechas en los 26 años.
- `lugar`: nombre llano de la zona («el sur y oriente», «el centro y norte», «el sur»,
  «el norte y oriente»), también en inglés (`lugarEn`).

### `web/datos/metodo.json`
- `paso`: `{ "Terra": { "2001": "10:47", … }, "Aqua": {…}, "S-NPP": {…} }` hora local mediana
  del paso de día, por año, con los focos de Yucatán.
- `sinDatos`: `{ "dias": 47, "rellenados": 12 }` (de `salidas/dias_sin_datos.csv`).
- `fuenteFija`: `{ "municipio": "Mérida", "detecciones": n, "fijas": n }`.
- `conafor.porDuracion`: `[{ "dias": "1", "vistos": 16, "n": 139 }, …]` (1, 2–3, 4–7, más de 7).
- `nocturnos`: proporción de focos de S-NPP en Yucatán que son del paso de la madrugada.
- `salto`: las cifras de Yucatán (sin calibrar y calibrado) salen del mismo cálculo que
  `validacion.json` (`razonCrudaYucatan`, `razonArmonizadaYucatan`): una sola fuente.

### Arreglo de datos
En los datos casi en tiempo real el campo `type` llega vacío y desde julio de 2026 se cuelan los
focos de una fuente fija al suroeste de Mérida. Se descartan los cuadritos con historial de
`type == 2`. Con prueba.

## Portada

### Disposición
- La portada llena la ventana sin desplazarse en escritorio (se quita el `min-height: 620px`).
- El texto (cartel) y la barra de la temporada (instrumento) se alinean con el escenario, no
  con la foto. Nunca se tocan entre sí ni con la tarjeta, de 1024×600 a 2560×1440.
- **Instrumento en una fila:** botón, fecha, «2026 3,320 · Año normal 6,712» y la tira de días.
  Unos 64 px de alto. La lista del buscador se abre por encima de él y tiene alto máximo con
  desplazamiento propio.
- **Foto:** `web/img/mosaico.jpg` mide 3440×2000 y cubre más que el lienzo: en unidades del
  lienzo, de x = −400 a 976 y de y = −150 a 650 (el lienzo va de x 0 a 825 y de y −90 a 591).
  La foto llena siempre el escenario; no hay franjas del color de fondo ni bordes visibles.
- **Teléfono:** el mapa va primero; debajo, la respuesta, la leyenda y el buscador.

### Al abrir (foto)
- Título según la fecha de los datos: en temporada (1 mar–31 may), «¿Este año se quema más de lo
  normal en tu municipio?»; fuera de temporada, «¿Se quemó este año más de lo normal en tu municipio?».
- Fuera de temporada, una línea: cuándo cerró la temporada, que los datos se actualizan cuatro
  veces al día y cuántos focos hubo en los últimos 7 días (`reciente`).
- El texto va sobre el mar y la península queda a la derecha.

### Repaso (día por día)
- Igual que hoy (gustó). Se suma el satélite del día junto a la fecha («visto por NOAA-20» el
  30 de abril, `satDia`).

### Cierre
- El titular es la respuesta («93 de 106 municipios de Yucatán tuvieron menos fuego que lo
  normal.»). La pregunta ya no se repite. Se quita la frase de las cifras del estado (las dice
  la barra) y las dos notas.
- Leyenda: los cinco colores con «mucho menos / normal / mucho más» y, al lado, el gris con
  «casi nunca hay fuego».
- **Los tres estados a color** con la misma escala. Yucatán lleva contorno blanco (`estados`).
  La cámara abre enfocada en Yucatán.
- **Acercar y arrastrar:** rueda, pellizco, botones (+, −, ver todo) y teclado (+, −, 0),
  dentro de los límites de la foto. Acercamiento máximo: 4 veces el encuadre de Yucatán. Los
  bordes, nombres y puntos se redibujan nítidos; la foto se ablanda y está bien. En teléfono,
  un dedo desplaza la página y dos dedos mueven el mapa, salvo que el mapa ya esté acercado.
- **Buscar un municipio** hace volar la cámara hasta él y abre su tarjeta.
- **Tarjeta:** nombre, estado, las dos cifras, el veredicto, sus años en barras a la vista (ya
  no escondidas tras mantener presionado) y un hecho propio calculado de `porAnio.v`: «La
  temporada con menos fuego desde 2012» o «Lleva N temporadas seguidas por debajo de lo normal»
  (N ≥ 3). Si no aplica ninguno, no se dice nada.
- La cifra del titular rueda al cambiar de año.

### Panel derecho: una sola historia
- Titular de 2026 y las barras por año. La primera vez que se llega al cierre, las barras suben
  una por una de 2001 a 2026 y la roja llega al final (sin animación con «reducir movimiento»).
- Bajo los años, **quién vio cada periodo**: Terra (2001–2002), Aqua (2003–2011), S-NPP
  (2012–2026) y, al final, NOAA-20 como el que sigue. Las barras de Terra y Aqua siguen rayadas,
  con la leyenda «Terra y Aqua, pasados a la escala de hoy».
- «Lo normal: 6,712, como 2014» (si un año coincide con lo normal; si no, solo la cifra). La
  franja de lo normal (`yuc.rango`) va detrás de las barras.
- Un asa o pista que diga que se puede **arrastrar para recorrer los años**. Al elegir un año:
  «El mapa muestra 2005, visto por el satélite Aqua. Toca su barra otra vez para volver a 2026.»
- Una oración llana y un enlace: «Los años de 2001 a 2011 los vieron satélites que detectan
  menos fuego. Los pasamos a la escala de hoy y lo comprobamos de cuatro maneras. Ver cómo lo
  comprobamos».
- Sale del panel la historia de las fechas permitidas (titular, tira y nota). En su lugar, el
  enlace a la siguiente página: «¿Y se quemó en las fechas permitidas?».
- Pie con la fecha de actualización, como hoy.

## Las demás páginas

- **Municipio y ficha:** mapa del municipio con `focos26` y `repetidos`; hechos de `hechos`;
  franja de lo normal; criterio de «la mitad» corregido (menos de la mitad si es menos de 0.5);
  fuera de Yucatán, la ficha dice cuándo se quema ahí en vez de «Consulta el calendario de tu
  estado»; tabla descargable con fecha, coordenadas y satélite; la ficha con el rayado.
- **Fechas:** la afirmación arriba con el nombre del lugar; tira de 26 años por zona; mapa de
  zonas con bordes y nombres; días tocables con el dedo; la tabla como «calendario por mes» con
  pasos de color que se distinguen y sin columnas vacías.
- **Cómo lo medimos:** abre con la gráfica sin calibrar y el interruptor; la hora de paso de
  Terra y Aqua; las cuatro pruebas como preguntas con su respuesta, que se abren; qué se
  descarta; un solo verbo para el veredicto.
- **Todo el sitio:** pie con el equipo y el repositorio; un formato de cifras y fechas; los 316
  textos en inglés reescritos; las cifras del guion y del README alineadas con la página.

## Estado al 15 de noviembre (todo construido y en `main`)

Todo lo de arriba está publicado (#68, #77 y #80). Lo que cambió respecto a lo escrito:

- **Municipio y ficha:** hechos propios bajo el veredicto (`web/js/hechos.js`), franja de lo
  normal en sus barras, sección «¿Dónde se quema?» (mapa del municipio con los vecinos rotulados,
  los cuadritos repetidos y los focos de marzo a mayo de 2026; al tocar uno se lee su fecha y
  satélite y se abre el lugar en Google Maps; lista plegable para quien no usa el mapa), cierre
  con el enlace a las fechas de su zona y «Ver otro municipio», y una segunda tabla descargable
  con fecha, coordenadas y satélite de cada foco de 2026. El mapa enseña solo los focos de marzo
  a mayo para que su cifra sea la misma del encabezado.
- **«La mitad» y «el doble»** se deciden con las cifras redondeadas que se leen (19 contra 42 es
  «menos de la mitad»), y solo si quedan a 6 % de la mitad o a 10 % del doble.
- **Fechas** abre, sin zona en la dirección, en la zona del municipio que se venía viendo y, si
  no hay, en la de más focos del año.
- **El mapa no dibuja los arrecifes de mar adentro** (Alacranes, Triángulos, Cayo Arcas): eran
  manchas de color en el mar.
- **Inglés:** «hot spot», «a normal year» y «burn window» en todo el sitio.
- La tarjeta de vista previa del enlace (`web/og/inicio.jpg`) usa la extensión de la foto nueva.

- **Cómo lo medimos lleva color** (regla 4): el salto de 2012 enseña en gris lo que contó el
  satélite y, encima, en rojo claro rayado, lo que añade la corrección.
- **El mapa del territorio ganadero** (#60) va dentro del bloque «Territorio ganadero» de cada
  municipio de Yucatán, en un solo tono de tierra.
- **El pie de «Cómo lo medimos» nombra al equipo**, sin enlace al repositorio.

## Cambios sobre trabajo de otros integrantes

Para quien hizo cada parte:

- **La escala automática de la página en pantallas chicas (#64, Nico) se quitó.** Arreglaba dos
  choques de la portada anterior; la portada nueva ya cabe sin choques de 1024 × 600 a
  2560 × 1440, y con la escala la letra más chica bajaba a 8 o 9 px en una laptop de
  1366 × 768. Se quedan su foco de dos tonos, sus contrastes y sus íconos en tinta.
  `tests/web/resolucion.spec.js` se quitó con la escala.
- **Las gráficas de las pruebas (#58, Leo)** conservan sus datos y su dibujo. Cambiaron tres
  cosas: la letra no baja de 11 px (por eso se movieron cuatro rótulos que se encimaban), las
  palabras son las del resto de la página (la equivalencia está en docs/01, «Cifras de la
  página») y el color sigue la regla 4. Las PNG de `salidas/graficas` no cambiaron.
- **Los colores del municipio (#65, Nico) se quedaron** y son ahora la regla 4 de todo el sitio.
- **El ejemplo es Muna** en la página, el guion y las diapositivas (docs/03).

## Lo que no se toca

La pregunta de la portada, la definición de foco de calor, la plantilla del municipio, la ficha
con su enlace corto, las tablas descargables, el rayado de MODIS, la franja de fechas
permitidas y «no siempre es una quema de milpa», las metas fijadas de antemano, «Ver las
limitaciones», «Aún no sabemos por qué», la nota de uso de IA, la página de error y la
velocidad de carga (1.2 MB la primera vez: no subirla más de 600 KB, que es lo que pesa de más
la foto nueva).

## Decisiones tomadas

1. Municipio de ejemplo: Muna en lugar de Umán.
2. Colores del mapa: el verde de «mucho menos» pasó a `#0F5C4A`. Con protanopia, la diferencia
   con el rojo sube de 19 a 27 (ΔE), sin cambiar la familia.
3. El mapa de «¿Dónde se quema?» de cada municipio se queda.
4. «Cómo lo medimos» dice «entre 3 y 5», la cifra del guion, en lugar de «entre 2.8 y 3.8».

Sigue abierta una: la frase «El satélite ya veía fuego cerca el día anterior» está fuera de la
página.

## Cómo se comprueba

- `pytest -q` y `ruff check .` en verde.
- `KAAK_CHROME=1 KAAK_PUERTO=<puerto propio> npx playwright test` en verde.
- Prueba nueva de la portada: en 1024×600, 1280×720, 1366×629, 1366×768, 1536×864, 1920×1080 y
  2560×1440, en los modos foto, repaso y cierre, el cartel no toca al instrumento, nada queda
  fuera de la ventana, no hay desplazamiento vertical y la foto cubre todo el escenario.
- Revisión visual en capturas a 1366×629, 1920×1080 y teléfono, hecha por quien dirige.
