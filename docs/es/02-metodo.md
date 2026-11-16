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
lugar de focos quita esa diferencia de tamaño. No encontramos una publicación que cuente con
esta misma rejilla de 0.01°; lo que sí está publicado es que S-NPP ve varias veces más píxeles
de fuego que Aqua y que la razón cambia de un lugar a otro (White, 2022; ver «Referencias»).

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

**Días sin datos (añadido el 14 nov):** si el satélite del periodo no mandó datos un día, ese
día se cuenta con su respaldo y el factor del respaldo; sigue habiendo un solo satélite por
día. El respaldo es de la misma familia: NOAA-20 por S-NPP y Terra por Aqua. Terra
(2001–2002) y NOAA-20 no tienen respaldo, y NOAA-21 no entra.
- **Cuándo un día no tiene datos:** el satélite del periodo tiene 0 cuadritos-día en toda la
  península y su respaldo tiene 50 o más. Es la misma regla de los días hueco de los factores
  (`armonizar.UMBRAL_HUECO`). Se mira la península completa y el día completo porque un día
  sin fuego de verdad es posible en un municipio, pero no que un satélite vea 0 en toda la
  península mientras el otro ve 50 o más.
- **Caídas confirmadas por NASA** (S-NPP del 26 jul al 20 ago 2022 y Terra del 15 jun al 2 jul
  2001): se reportan y no se rellenan. La de 2022 queda visible a propósito: es fuera de
  temporada y la regla no la detecta. Fuentes en docs/01, «Días sin datos del satélite».
- **Fuera de alcance:** los días con datos a medias y los días en que el respaldo vio menos
  de 50.
- `salidas/dias_sin_datos.csv` lista cada día: cuál se rellenó, con qué satélite y cuánto vio
  el respaldo, y cuál solo se reporta (`pipeline/serie.py`, `dias_sin_datos()` y `elegir()`;
  la página usa la misma función). Con los datos del 14 nov se rellenan 12 días: 11 de S-NPP
  (2024 y 2026) y 1 de Aqua (12 may 2003).

**Los factores MODIS→VIIRS** se calculan por zona y por época:
- **6 zonas:** las 4 zonas de quema de Yucatán (`analisis/zonas_quema_yucatan.csv`), más
  Campeche y Quintana Roo como una zona cada uno.
- **2 épocas:** temporada de quema (marzo a mayo) y el resto del año. La quema agrícola se
  comporta distinto que el incendio forestal, así que un solo factor para todo el año
  probablemente falla justo en la temporada que más importa. La tarea 3 lo comprueba: si los
  dos factores salen iguales, se dice.
- **Se calibra con 2013–2020** (los dos satélites funcionando y antes de la deriva de órbita
  de MODIS) **y se comprueba con 2021–2025**, que no se usaron para calibrar.
- **Por qué por zona y por época:** el factor es un estimador de razón estratificado: una
  razón por estrato (zona × época), en lugar de una sola para todo. Cochran (1977, §6.10–6.12)
  llama a esto la «razón separada» y advierte que, con pocos datos en un estrato, conviene la
  razón combinada; por eso un factor `debil` (menos de 100 cuadritos-día) se reemplaza por el
  de la misma época con todas las zonas juntas. Usar factores por región para pasar de un
  conteo de satélite a otra cantidad también lo hace GFED5 (Chen et al., 2023), y Giglio et
  al. (2025) concluyen que unir los registros de VIIRS y MODIS probablemente pide una
  calibración estadística por región.

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

**Filtro de focos** (el de `datos_peninsula/es/LEEME.md`): solo vegetación (`type` 0 o vacío) y
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
pipeline/   cargar.py, rejilla.py, armonizar.py, serie.py, validar.py, datos_web.py, exportar_web.py,
            actualizar_diario.py, correr_todo.py
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
| `web/datos/municipio/{id}.json` | municipio | entre otros, `repetidos`: `[lon, lat, temporadas]` de cada cuadrito con fuego en 5 o más de las 14 temporadas (tarea 6) |
| `web/datos/zonas.json` | zona de quema de Yucatán | su ventana, el fuego de cada día de enero a junio y qué parte cayó fuera de la ventana cada año |
| `salidas/validacion.json` | prueba | nombre, número, frase en lenguaje simple y ruta de su gráfica |
| `salidas/serie_armonizada.csv` | municipio × año × semana | lo mismo que el calendario, para descargar |
| `datos_peninsula/ganaderia_municipios.csv` | municipio de Yucatán | `municipio`, `estado`, `bovinos_2022` (total del Censo Agropecuario 2022), `bovinos_up_2022` (solo unidades de producción), `km2`, `km2_pastizal` (cultivado e inducido, INEGI Serie VII), `pct_pastizal`, `bovinos_km2`, `focos` y `focos_pastizal` (S-NPP 2013–2025). Lo arma `analisis/preparar_ganaderia.py` (#60) |
| `datos_peninsula/pastizal_yucatan.geojson` | municipio de Yucatán | `municipio` y el pastizal ganadero de la Serie VII, simplificado a 50 m (menos de 2 MB) |
| `web/datos/ganaderia.json` | — | `periodo`, `yucatan` (totales del estado) y `municipios` (`id`, `bovinos`, `bovinosKm2`, `pctPastizal`, `focos`, `focosPastizal`), para la opción «Territorio ganadero» del mapa |
| `salidas/dias_sin_datos.csv` | día sin datos del satélite del periodo | `dia_local`, `satelite_periodo`, `respaldo`, `cuadritos_respaldo`, `motivo` (`umbral` o `caida_confirmada`), `rellenado`, `nota` |

---

## Tareas

Cada tarea dice qué hay que hacer, qué se entrega, cuándo está terminada, de qué depende y
cuántas horas lleva (cálculo aproximado para quien ya conoce la herramienta). Es el plan con el
que se repartió el trabajo; donde la página quedó distinta, la referencia es el código.

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
- **Rango de cada factor:** se recalcula ocho veces, dejando fuera cada vez uno de los años
  2013–2020, y se guardan el menor y el mayor (`factor_min`, `factor_max`). Es un **rango**,
  no un intervalo de confianza: en docs y en el pitch se dice «rango». Un número sin su rango
  es más fácil de atacar en las preguntas de los jueces.
- **Lo que el rango no mide:** el rango es el menor y el mayor de 8 recálculos, cada uno
  dejando fuera un año. Dice qué tan estable es el factor promedio, no cuánto puede
  desviarse un año reconstruido. En estadística cubre apenas unos ±0.5 errores estándar
  jackknife (error estándar jackknife ≈ √(n−1) × desviación estándar de los valores sin un
  año, n = 8). El desvío de un año se midió de la misma forma, dejando fuera un año de
  2013–2020 (marzo a mayo, municipio-años con al menos 20 cuadritos-día de S-NPP). Con Aqua,
  un año suele desviarse cerca de 8 % en una zona entera y cerca de 20 % en un solo
  municipio; por municipio, el percentil 90 es cerca de 62 %, y cerca de 1 de cada 6
  municipio-años se desvía más de 50 %. Con Terra es cerca de 14 % por zona y cerca de 45 %
  por municipio. Se probaron factores por municipio (también acercados al factor de su zona)
  y una curva de potencia, y no lo bajaron: es ruido de un año a otro, así que lo decimos en
  vez de cambiar el método. Un intervalo mejor sería un bootstrap por bloques de años
  (Künsch 1989, *Ann. Stat.* 17:1217); queda como trabajo futuro.
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
- **Cómo quedó (15 nov):** se hizo de otra forma y sin archivo propio en `salidas/`.
  `cuadritos_repetidos` de `pipeline/exportar_web.py` calcula los cuadritos con fuego en 5 o más
  de las 14 temporadas (de marzo a mayo y sin fuentes fijas) y los escribe en el JSON de cada
  municipio; la página los pinta en «¿Dónde se quema en {municipio}?». La semana con más fuego
  sale de `semana_pico` en `pipeline/datos_web.py`, y el fuego fuera de la ventana se muestra
  por municipio («{k} de cada 10 focos aparecen después del…») y por zona (`web/datos/zonas.json`).
  `pipeline/recurrencia.py`, `salidas/recurrencia.parquet` y
  `salidas/cuadritos_recurrencia.parquet` no existen, y el porcentaje del municipio
  (`pct_recurrente`) queda para después.

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
  - Un trabajo de GitHub Actions lo corre cuatro veces al día (1:23, 11:23, 14:23 y 23:23 UTC,
    después de que FIRMS publica los pasos de los satélites; las razones están en
    `.github/workflows/actualizar.yml`) y sube el resultado a
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

## Referencias

Cada una se abrió y se confirmó que dice lo que se le atribuye (14 nov).

- **Cochran, W. G. (1977).** *Sampling Techniques*, 3.ª ed. Nueva York: Wiley. §6.10
  «Ratio estimates in stratified random sampling», §6.11 «The combined ratio estimate» y §6.12
  (comparación). Respalda el factor por zona y época (razón separada por estrato) y el cambio a
  la razón combinada cuando un estrato tiene pocos datos (`debil`).
- **Chen, Y., Hall, J., van Wees, D., et al. (2023).** Multi-decadal trends and variability in
  burned area from the fifth version of the Global Fire Emissions Database (GFED5). *Earth
  System Science Data*, 15, 5227–5259. <https://doi.org/10.5194/essd-15-5227-2023>. Convierte
  focos de MODIS en área quemada con factores que cambian por región GFED, tipo de vegetación
  y cobertura de árboles. Es un precedente de factores por región; no une MODIS con VIIRS.
- **Giglio, L., Boschetti, L., Roy, D. P., et al. (2025).** The NASA VIIRS burned area
  product, global validation, and intercomparison with the NASA MODIS burned area product.
  *Remote Sensing of Environment*, 331, 115006. <https://doi.org/10.1016/j.rse.2025.115006>.
  Concluye que para tener un solo registro largo y consistente probablemente hace falta una
  calibración estadística por región entre los productos de VIIRS y MODIS (son de área
  quemada, no de focos).
- **White, B. L. A. (2022).** Quantitative differences in detection of fire pixels using
  Aqua/MODIS and NPP-Suomi/VIIRS satellites. *Journal of Hyperspectral Remote Sensing*,
  12(6), 379–390. En Sudamérica, 2012–2021, S-NPP detectó en promedio 5.13 veces más píxeles
  de fuego que Aqua; por país, de 3.87 (Chile) a 6.81 (Venezuela); en municipios de Pará, de
  2.84 a 11.25. Concluye que no hay una sola fórmula para ajustar Aqua a S-NPP. Nuestros
  factores de Aqua (2.84 a 5.34, `salidas/factores.csv`) caen en ese rango; se espera que
  sean algo menores porque contamos cuadritos-día y no píxeles.

**Sin agregar:** la serie armonizada MODIS/VIIRS de Boschetti, Roy y Giglio (presentación al
MODIS Science Team, 2023). El servidor de NASA no respondió el 14 nov y no se pudo abrir; en
2023 era un trabajo en preparación, no un artículo publicado.
