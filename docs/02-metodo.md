# Método: qué hace la página, cómo se calcula y cada tarea

Aquí está cómo se hace cada tarea y cuándo se da por terminada. Todo usa datos públicos
(FIRMS y CONAFOR).

## Qué responde la página

Para SEDER, Protección Civil, un comisario o un científico, en cualquier municipio de la
península:

1. **¿Cómo va la temporada aquí comparada con lo normal?** La temporada de cualquier año
   contra 25 años de referencia, en la misma semana y el mismo municipio.
2. **¿Cuándo se quema de verdad, y cuándo dice el calendario oficial?** La ventana oficial de
   quema de la zona, sombreada sobre lo que vio el satélite.
3. **¿Dónde se quema año tras año?** El mapa para poner brechas cortafuego y brigadas
   **antes** de la temporada.
4. **¿Puedo comparar 2005 con 2025?** Sí, porque la serie está armonizada, y la página muestra
   las pruebas.

El área es un parámetro: el código sirve para otro lugar del mundo, porque el reto pide «un
área de interés». El demo cuenta la historia de Yucatán.

## Secciones de la página

1. **Mi municipio (entrada):** la página pide la ubicación, encuentra el municipio y muestra
   su gráfica y su ficha. Si la persona no da permiso o está fuera de la península, elige el
   municipio de una lista. Un aviso dice que la ubicación no se guarda.
2. **Mapa:** municipios coloreados según cómo va el año contra lo normal, dónde se quema año
   tras año o qué parte del fuego cae fuera de la ventana oficial.
3. **¿Se puede confiar?:** las cuatro pruebas en lenguaje simple y la descarga de la serie.

Español e inglés, con un selector. **Fuera de alcance:** predicción de incendios, avisos por
cada incendio y chat con IA.

## Método

**Unidad: cuadritos de 1 km con fuego por día.** Se redondean latitud y longitud a 0.01° y se
cuenta cada cuadrito una vez por día y satélite. MODIS ve en píxeles de 1 km y VIIRS en
píxeles de 375 m, así que un mismo fuego produce más focos en VIIRS; contar cuadritos en
lugar de focos quita esa diferencia de tamaño. Es una técnica estándar y se cita.

**Escala de referencia: VIIRS**, porque es el que sigue funcionando; MODIS se retira. La
serie se expresa en «cuadritos-día equivalentes a VIIRS».

**Un satélite por periodo, nunca sumados**, porque el número de satélites cambió con los años
y sumarlos inflaría la serie:

| Periodo | Satélite | Cómo entra |
|---|---|---|
| 1 ene 2001 – 3 jul 2002 | Terra (MODIS) | × su factor Terra→VIIRS |
| 4 jul 2002 – 19 ene 2012 | Aqua (MODIS) | × su factor Aqua→VIIRS |
| 20 ene 2012 – 2 nov 2026 | S-NPP (VIIRS) | Es la referencia (factor 1) |
| Desde el 3 nov 2026 | NOAA-20 (VIIRS) | × su factor NOAA-20→S-NPP |

Aqua es el MODIS de referencia porque pasa a la misma hora que S-NPP (hacia la 1:30 de la
tarde y de la madrugada), y el fuego cambia a lo largo del día. Terra solo cubre el año y
medio antes de que Aqua empezara.

**Los factores MODIS→VIIRS** se calculan por zona y por época:
- **6 zonas:** las 4 zonas de quema de Yucatán (`analisis/zonas_quema_yucatan.csv`), más
  Campeche y Quintana Roo como una zona cada uno.
- **2 épocas:** temporada de quema (marzo a mayo) y el resto del año. La quema agrícola se
  comporta distinto que el incendio forestal, así que un solo factor para todo el año
  probablemente falla justo en la temporada que más importa. La tarea 3 lo comprueba: si los
  dos factores salen iguales, se dice.
- **Se calibra con 2013–2020** (los dos satélites funcionando y antes de la deriva de órbita
  de MODIS) **y se comprueba con 2021–2025**, que no se usaron para calibrar.

**Día de un foco, en hora local:** FIRMS da la fecha y la hora en UTC. Antes de asignar día y
semana se pasa a hora solar del lugar, `hora UTC + longitud / 15` (en la península, unas 6
horas menos). Sin eso, todos los focos del paso nocturno de Terra (hacia las 4:00 UTC, las
22:00 en la península) caen en el día siguiente. Se usa la hora solar y no la oficial porque
la oficial cambió con los años (horario de verano hasta 2022, y Quintana Roo en otra zona
desde 2015).

**Semana:** `min((día del año − 1) // 7 + 1, 52)`, de 1 a 52. Los uno o dos días que sobran al
final del año van a la semana 52, para que todas las semanas tengan el mismo peso.

**Estado y zona de un foco:** salen de su municipio, con `analisis/municipios_zona.csv`. No se
usa ninguna otra tabla para eso. Los focos sin municipio (0.2 %) no entran en nada municipal.

**Lo normal:** por municipio y semana, sobre 2001–2025 armonizado, tres valores: el que solo
superan 1 de cada 10 años (percentil 90), la mediana (percentil 50) y el que solo queda por
debajo 1 de cada 10 años (percentil 10). Lo mismo para el **acumulado del año** (todo el
fuego desde el 1 de enero hasta esa semana).

**Cómo va el año** (la frase de la ficha y el color del mapa). Se compara el acumulado del
año hasta la última semana con datos contra lo normal del acumulado a esa misma semana:
- Si lo normal es menos de 5 cuadritos-día (percentil 90 del acumulado), la frase es «Aquí casi
  no hay fuego en esta época del año» y no se compara. Así, un solo foco no pone en rojo a un
  municipio que casi nunca se quema.
- Si está por arriba del percentil 90: «por encima de lo normal».
- Si está por debajo del percentil 10: «por debajo de lo normal».
- En otro caso: «dentro de lo normal».
La semana sola se ve en la gráfica, pero no decide la frase: una semana suelta cambia mucho
de un año a otro.

**Ventana oficial de quema:** solo hay listas oficiales por zona para 2025 y 2026, con las
mismas fechas los dos años (docs/01). Antes, el esquema era otro (en 2024, dos zonas) y no
tenemos la lista por municipio. Por eso:
- la página dibuja la ventana con la etiqueta «ventana oficial 2025–2026», en cualquier año;
- el porcentaje de fuego fuera de la ventana solo se calcula para 2025 y 2026;
- Campeche y Quintana Roo no tienen calendario por zona, así que no llevan ventana.

**Filtro de focos** (el de `datos_peninsula/LEEME.md`): solo vegetación (`type` 0 o vacío) y
confianza nominal o alta (VIIRS `n` o `h`; MODIS 30 o más).

**Validación:** cuatro pruebas (tarea 7). La base con CONAFOR ya existe
(`analisis/cruce_conafor.py`): S-NPP ve el 53 % de los incendios registrados en 2015–2024 y
el 84 % de los de más de 100 ha, contra 9 % por azar.

## Tecnología

- **Cálculo:** Python (pandas, shapely, pytest), en `pipeline/`.
- **Página:** HTML, CSS y JavaScript sin framework, en `web/`. Mapa en SVG sobre una foto satelital sin nubes y gráficas en SVG, sin Leaflet ni Chart.js;
  la ficha dibujada con la API de Canvas del navegador. Los textos
  viven en `web/textos/es.json` y `web/textos/en.json`, nunca escritos dentro del código.
  Los colores y la letra (Space Grotesk, licencia OFL) son los de la imagen del proyecto; la
  letra va dentro de `web/fuentes/` para que la copia sin internet se vea igual.
- **Publicación:** Cloudflare Pages, conectado al repo (funciona aunque el repo sea privado y
  da HTTPS, que la ubicación necesita). Cada cambio en `main` publica la página sola.
- **Probar en tu computadora:** `python -m http.server -d web 8000` y abrir
  <http://localhost:8000>.

**Cómo empezar:**
1. `git clone https://github.com/Ghosflot/kaak-yucatan.git && cd kaak-yucatan`
2. Python 3.11 o más nuevo: `python -m venv .venv`, actívalo y corre
   `pip install -r requirements.txt`.
3. Comprueba que todo corre: `python analisis/cifras_yucatan.py` debe dar las cifras de docs/01.
4. Tu rama se llama `nombre/numero-tarea` (por ejemplo, `gadiel/2-rejilla`), y el título del PR
   empieza con el número de tarea («2: cuadritos de 1 km»).
5. Antes de abrir un PR: `pytest` en verde y, si tocaste el cálculo, `python
   pipeline/correr_todo.py` para regenerar `salidas/` y `web/datos/`.

**Archivos generados:** `salidas/` y `web/datos/` los escribe solo el código, nunca a mano. Si
al actualizar tu rama chocan, no se resuelve a mano: se corre `pipeline/correr_todo.py` y se
sube lo que salga.

```
pipeline/   rejilla.py, armonizar.py, validar.py, recurrencia.py, exportar_web.py
salidas/    resultados del cálculo (parquet, csv, json)
web/        la página: index.html, js/, css/, textos/, datos/ (lo genera exportar_web.py)
tests/      pruebas automáticas
```

## Contrato de datos

El cálculo (Gadiel y Nico) llena `salidas/`. La tarea 10 lo convierte en lo que lee la
página (`web/datos/`). Así, cada lado trabaja sin esperar al otro: la página empieza con el
calendario provisional y, cuando llega el armonizado, solo se reemplaza el archivo.

| Archivo | Una fila por | Columnas |
|---|---|---|
| `datos_peninsula/focos_peninsula.parquet` | foco | El historial hasta el 7 nov 2026. Ya no cambia |
| `datos_peninsula/focos_recientes.parquet` | foco | Lo que baja la actualización diaria desde el 8 nov (tarea 18). Mismas columnas |
| `analisis/municipios_zona.csv` | municipio | `municipio`, `estado`, `zona`, `ventana_inicio`, `ventana_fin` (mes-día; vacío fuera de Yucatán) |
| `salidas/calendario.parquet` | municipio × año × semana | `estado`, `municipio`, `zona`, `anio`, `semana`, `cuadritos_viirs_eq` (armonizado), `cuadritos_modis_crudo`, `cuadritos_viirs_crudo`, `p10`, `p50`, `p90` (de la semana), `acum`, `acum_p10`, `acum_p50`, `acum_p90` (del acumulado del año), `en_ventana` |
| `salidas/calendario_mensual.parquet` | municipio × año × mes | `estado`, `municipio`, `anio`, `mes`, `cuadritos_viirs_eq` |
| `salidas/factores.csv` | zona × época × satélite | `zona`, `epoca`, `satelite`, `factor`, `factor_min`, `factor_max`, `cuadritos_dia_usados`, `debil` |
| `salidas/recurrencia.parquet` | municipio | `estado`, `municipio`, `cuadritos_recurrentes`, `pct_recurrente`, `semana_pico`, `pct_fuera_ventana` |
| `salidas/cuadritos_recurrencia.parquet` | cuadrito de 1 km | `lat`, `lon`, `temporadas_con_fuego` (de 14) |
| `salidas/validacion.json` | prueba | nombre, número, frase en lenguaje simple y ruta de su gráfica |
| `salidas/serie_armonizada.csv` | municipio × año × semana | lo mismo que el calendario, para descargar |

---

## Tareas

Cada tarea dice qué hay que hacer, qué se entrega, cuándo está terminada, de qué depende y
cuántas horas lleva (cálculo aproximado para quien ya conoce la herramienta).

### Armonización

#### 1. Calendario provisional
- **Qué:** `salidas/calendario.parquet` solo con S-NPP (2012–2026), sin calibrar. Las
  columnas de la serie armonizada y de lo normal van con el dato de S-NPP o vacías.
- **Terminada cuando:** la tarea 10 lo puede convertir, y el total de Tekax en 2024 coincide
  con contar a mano los cuadritos-día de S-NPP de Tekax en 2024. Si la tarea 2 no está lista,
  se cuenta con la misma regla (latitud y longitud redondeadas a 0.01°, un cuadrito por día).
- **Depende de:** nada · **Horas:** 2 · **Saber:** pandas.

#### 2. Contar el fuego en cuadritos de 1 km
- **Qué:**
  - `pipeline/cargar.py`, con una función `cargar_focos()` que es la **única puerta de entrada
    de los datos**: lee `focos_peninsula.parquet` y, si existe, `focos_recientes.parquet`; quita
    repetidos; aplica el filtro de «Método», calcula el día en hora local (ver «Método») y une
    la zona con `analisis/municipios_zona.csv`.
    Nadie más lee los parquet directamente.
  - `pipeline/rejilla.py`, que convierte los focos en cuadritos-día por satélite.
- **Entrega:** `pipeline/cargar.py`, `pipeline/rejilla.py` y `tests/test_rejilla.py`.
- **Terminada cuando:** la prueba demuestra que dos focos en el mismo cuadrito y el mismo día
  cuentan como uno, que dos satélites distintos nunca se suman y que un foco de Terra a las
  4:00 UTC del 2 de abril cuenta para el 1 de abril.
- **Depende de:** nada · **Horas:** 3 · **Saber:** pandas, pytest.

#### 3. Factor MODIS→VIIRS
- **Qué:** para cada zona y época, en 2013–2020, cuadritos-día de S-NPP entre cuadritos-día de
  Aqua. Lo mismo con Terra (para 2001–2002).
- **Entrega:** `pipeline/armonizar.py` y `salidas/factores.csv`.
- **Terminada cuando:** están los 12 factores de Aqua y los 12 de Terra. Un factor que se
  apoye en menos de 100 cuadritos-día se marca `debil` y se reemplaza por el de la misma
  época con todas las zonas juntas.
- **Margen de cada factor:** se recalcula ocho veces, dejando fuera cada vez uno de los años
  2013–2020, y se guardan el menor y el mayor (`factor_min`, `factor_max`). Un número sin su
  margen es más fácil de atacar en las preguntas de los jueces.
- **Depende de:** 2 · **Horas:** 6 · **Saber:** pandas, proporciones.

#### 4. Factor NOAA-20→S-NPP
- **Qué:** el mismo cálculo, NOAA-20 entre S-NPP, de 2018 a 2026, por época.
- **Entrega:** dos filas más en `salidas/factores.csv`.
- **Terminada cuando:** el factor está y queda entre 0.95 y 1.06, como en docs/01, o el PR
  explica por qué no.
- **Depende de:** 2 · **Horas:** 1.

#### 5. Serie de 25 años y lo normal
- **Qué:** armar la serie con la tabla de periodos de «Método» y calcular p10, p50 y p90, de
  la semana y del acumulado del año.
- **Entrega:** `salidas/calendario.parquet` definitivo, `salidas/calendario_mensual.parquet`
  (para el calendario de 25 años de la tarea 13) y `salidas/serie_armonizada.csv`.
- **Terminada cuando:** la página funciona con solo reemplazar el archivo, y la gráfica
  anual de Yucatán ya no tiene el salto de 2012.
- **Depende de:** 3 y 4 · **Horas:** 3.

#### 6. Dónde y cuándo se quema año tras año
- **Qué:** por cuadrito, en cuántas de las temporadas 2012–2025 tuvo fuego. Por municipio:
  cuántos cuadritos tuvieron fuego en 7 o más de las 14 temporadas, qué porcentaje del
  municipio son (`pct_recurrente`: entre todos los cuadritos de 0.01° que caen dentro de él;
  así un municipio grande no gana solo por tamaño), la semana en que más se
  quema (la de mayor mediana en 2001–2025) y qué porcentaje del fuego cayó fuera de la ventana
  oficial en 2025 y en 2026 (solo Yucatán; ver «Método»).
- **Por qué solo 2012–2025:** MODIS no ve los fuegos chicos, así que un año MODIS sin fuego
  puede ser un fuego que no vio. Los 25 años sirven para contar cuánto fuego hubo, no para
  decir dónde no lo hubo.
- **Entrega:** `pipeline/recurrencia.py`, `salidas/recurrencia.parquet` y
  `salidas/cuadritos_recurrencia.parquet`. Este último no va a la página (pesa demasiado); se
  usa para una imagen del pitch.
- **Terminada cuando:** Tekax y Tizimín salen entre los municipios con más cuadritos
  recurrentes, o el PR explica por qué no. Son los dos municipios más grandes de Yucatán, así
  que el PR dice también dónde quedan por `pct_recurrente`.
- **Depende de:** 2 · **Horas:** 3.

#### 7. Las cuatro pruebas de que funciona
Cada prueba lleva un número, una gráfica y una frase que se pueda decir en el pitch:
- **El salto de 2012 desaparece:** el promedio de 2009–2011 contra el de 2013–2015, en la
  serie sin calibrar y en la armonizada.
- **Funciona en años que no se usaron:** convertir Aqua 2021–2025 con los factores y comparar
  con S-NPP de esos años; error en porcentaje por año. Se compara también contra un solo
  factor para todo (sin zonas ni épocas): es la prueba de que calibrar por zona y época vale
  la pena. Si el factor único sale igual o mejor, se usa el único y se dice. Desde 2022 la
  órbita de Aqua se desvía y pasa más tarde, así que es posible que el error crezca esos años:
  si pasa, se dice y se explica, no se esconde.
- **Coincide con CONAFOR:** repetir `analisis/cruce_conafor.py` con la serie armonizada.
- **Los VIIRS coinciden entre sí:** S-NPP contra NOAA-20 y NOAA-21.
- **Entrega:** `pipeline/validar.py`, `salidas/validacion.json` y las gráficas en
  `salidas/graficas/`.
- **Antes de correrlas:** el PR de la tarea 3 o un PR aparte dice qué resultado cuenta como
  que pasa cada prueba (por ejemplo, que el error de la segunda quede por debajo de un
  porcentaje), y eso no se cambia después de ver los números. Así nadie puede decir que
  elegimos la prueba a la medida del resultado.
- **Terminada cuando:** las cuatro tienen número, gráfica y frase. Si una sale mal, se dice
  tal cual: también es un resultado.
- **Depende de:** 5 · **Horas:** 5.

#### 8. Cargador para el kit de la sede
- **Qué:** si el kit trae focos de FIRMS, se usan tal cual. Si trae otra cosa, se agrega a
  `pipeline/cargar.py` una función que lo convierta a las columnas de
  `datos_peninsula/focos_peninsula.parquet`. No se toca ningún otro archivo.
- **Terminada cuando:** las tareas 2 a 7 corren con los datos del kit sin cambiar nada más.
- **Horas:** 1 a 3.

#### 9. Explicar la calibración
- **Qué:** 10 minutos con el equipo, con la gráfica del salto de 2012. Después, cada
  integrante la explica en 2 minutos sin ayuda.

### Página

#### 10. Pasar los datos de Python a la página
- **Qué:** `pipeline/exportar_web.py` convierte `salidas/` en `web/datos/`:
  - un JSON por municipio con su calendario por semana, su calendario por mes y su ficha;
  - `municipios.geojson` con un identificador por municipio;
  - `recurrencia.json`;
  - `validacion.json`;
  - `serie_armonizada.csv`.
- **Terminada cuando:** corre con el calendario provisional y otra vez con el definitivo sin
  cambios, y ningún archivo de `web/datos/` pasa de 2 MB.
- **Depende de:** 1 · **Horas:** 2.

#### 11. Esqueleto de la página
- **Qué:** `web/index.html` con las tres secciones, la lista de municipios, el selector de
  idioma que lee `web/textos/*.json` y un diseño que se vea bien en un teléfono.
- **Terminada cuando:** abre en local, cambia de idioma y al elegir un municipio carga su
  JSON.
- **Depende de:** 10 · **Horas:** 2.

#### 12. Ubicación → municipio
- **Qué:** pedir la ubicación con `navigator.geolocation`, buscar en qué polígono de
  `municipios.geojson` cae (función de punto en polígono) y abrir ese municipio. Si la persona
  no da permiso o queda fuera, se abre la lista.
- **Terminada cuando:** publicada (tarea 17), en un teléfono abre el municipio correcto, y
  al negar el permiso aparece la lista.
- **Depende de:** 11 · **Horas:** 3.

#### 13. Sección «Mi municipio»
- **Qué:** gráfica por semana del año elegido:
  - el fuego de ese año, como línea;
  - la banda de lo normal (p10 a p90) y la mediana;
  - la ventana oficial de quema sombreada, con la etiqueta «ventana oficial 2025–2026» (solo
    Yucatán);
  - los incendios de CONAFOR como puntos (solo hay de 2015 a 2024).
  Arriba, la frase de cómo va el año, con la regla de «Método». Abajo, los datos de la tarea 6
  y el enlace para suscribirse a los correos de FIRMS
  (<https://firms.modaps.eosdis.nasa.gov/alerts/>).
  - **Calendario de 25 años:** una cuadrícula con un renglón por año (2001 a hoy) y una
    columna por mes, coloreada según el fuego de ese mes (`calendario_mensual.parquet`). Es
    el «calendario de quemas» que describe el reto: deja ver de un vistazo qué meses se queman
    y qué años tuvieron más fuego. Al tocar un año, la gráfica de arriba cambia a ese año.
  - **Colores accesibles**, como pide el reto: una escala de un solo tono que va de claro a
    oscuro (tipo viridis o cividis), sin rojo contra verde y con su leyenda.
  - **Descarga del municipio:** un botón que baja en CSV la serie de ese municipio. El reto
    pide poder descargar lo que se buscó; la serie completa está en la tarea 16.
  - Si la zona del municipio es inferida (Baca, Dzán y Tekit; columna `fuente` de
    `analisis/zonas_quema_yucatan.csv`), la ventana dice «zona inferida».
- **Terminada cuando:** en Tekax, 2024 se ve por encima de lo normal y 2025 por debajo, igual
  que todo Yucatán según docs/01 (si Tekax no sigue al estado, se revisa antes de darla por
  buena), y el calendario de 25 años ya no muestra el salto de 2012.
- **Depende de:** 11 · **Horas:** 6.

#### 14. Ficha descargable para WhatsApp
- **Qué:** un botón que dibuja en Canvas una imagen vertical (1080 × 1920) y la descarga. La
  imagen lleva:
  - el municipio y la frase de cómo va el año;
  - las semanas en que más se quema;
  - la ventana oficial de quema;
  - la leyenda «Datos: NASA FIRMS · K'áak'».
  Una versión impresa sirve para el pitch.
- **Terminada cuando:** se descarga en un teléfono, se ve bien al mandarla por WhatsApp y
  alguien de fuera del equipo la entiende sin explicación (Leo la prueba en la tarea 21).
- **Depende de:** 13 · **Horas:** 3.

#### 15. Sección «Mapa»
- **Qué:** municipios coloreados con Leaflet, con tres opciones: cómo va el año elegido contra
  lo normal (misma regla que la frase), cuadritos recurrentes y porcentaje fuera de la ventana
  (2025 o 2026). La recurrencia se pinta con `pct_recurrente`, para que los municipios
  grandes no salgan oscuros solo por su tamaño. Solo datos por municipio. Los colores siguen la
  misma regla de la tarea 13 (semáforo). El mapa de fondo es
  OpenStreetMap, con su crédito visible como pide su licencia. Al tocar un municipio se abre
  su sección «Mi municipio».
- **Terminada cuando:** las tres opciones funcionan en el teléfono, la leyenda se entiende
  sin explicación y los tres colores de «cómo va el año» se distinguen también en una captura
  en blanco y negro.
- **Depende de:** 11 · **Horas:** 3.

#### 16. Sección «¿Se puede confiar?» y descarga
- **Qué:** las cuatro pruebas de `validacion.json` con su gráfica y su frase, la serie sin
  calibrar junto a la armonizada, y el botón para descargar `serie_armonizada.csv` con cómo
  citarla. Los CSV van en UTF-8 con BOM, para que Excel muestre bien los acentos (Tizimín,
  Dzán).
- **Terminada cuando:** alguien de fuera del equipo la lee y dice en una frase por qué la
  serie se puede comparar entre años.
- **Depende de:** 7 y 10 · **Horas:** 3.

### Calidad y publicación

#### 17. Publicar en Cloudflare Pages y probar en teléfonos
- **Qué:**
  - Guille conecta el repo a Cloudflare Pages con su cuenta, una vez. Configuración: sin
    comando de compilación y con `web` como carpeta de salida.
  - Misa lo prueba en un Android, en un iPhone y en una ventana de incógnito.
  - **Plan B para el pitch:** una copia de la página que funciona sin internet
    (`python -m http.server -d web 8000` en la laptop del pitch, probada con el wifi apagado).
- **Terminada cuando:** el enlace abre sin iniciar sesión, la ubicación funciona en los dos
  teléfonos y la copia sin internet abre. Se repite el 11, con la página completa.
- **Horas:** 1, más las pruebas.

#### 18. Actualización diaria automática
- **Por qué así:** `analisis/actualizar_datos.sh` no sirve para esto, porque rearma todo desde
  los ~900 MB de datos crudos, que solo están en el servidor de Guille.
- **Qué:**
  - `pipeline/actualizar_diario.py` baja por la API de FIRMS los focos de NOAA-20, NOAA-21 y
    MODIS (producto casi en tiempo real) para la caja de la península, desde el último día
    que ya tiene cada satélite. La API da como mucho 5 días por consulta, así que pide por
    tramos: si el trabajo deja de correr unos días, el siguiente rellena el hueco.
  - Asigna municipio y estado con `datos_peninsula/municipios_peninsula.geojson`, con la misma
    regla de `analisis/preparar_peninsula.py`.
  - Agrega lo nuevo a `datos_peninsula/focos_recientes.parquet` sin repetir focos y corre
    `pipeline/correr_todo.py`.
  - Un trabajo de GitHub Actions lo corre una vez al día (11:00 UTC, 5:00 en Mérida) y sube el resultado a
    `main`. Es el **único** que sube a `main` sin PR, y solo toca
    `datos_peninsula/focos_recientes.parquet`, `salidas/` y `web/datos/`.
  - La clave de FIRMS es el secreto del repo `FIRMS_MAP_KEY` (ya guardado) y nunca va en un
    archivo. El trabajo necesita `permissions: contents: write` para poder subir a `main`.
- **Terminada cuando:** corrió solo dos días seguidos y la fecha de «datos hasta» de la página
  cambió.
- **Depende de:** 2 y 10 · **Horas:** 3.

#### 19. Revisión de PR y pruebas automáticas
- **Qué:**
  - `pipeline/correr_todo.py` corre todo el cálculo en orden con una sola orden: cargar,
    cuadritos, factores, serie, recurrencia, pruebas y paso a la página. Si una etapa todavía no
    existe, la salta y lo avisa.
  - Un trabajo de GitHub Actions corre `pytest` en cada PR.
  - En un repo privado gratuito, GitHub no deja bloquear `main`. La regla se cumple por acuerdo:
    nadie hace push directo a `main`, salvo el trabajo de la tarea 18.
- **Terminada cuando:** ningún PR entra a `main` con pruebas fallando ni sin revisión, y
  `python pipeline/correr_todo.py` corre de principio a fin.
- **Horas:** 2 para montarlo, más las revisiones.
