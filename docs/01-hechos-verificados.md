# Hechos verificados

Cada cifra tiene su fuente y se puede reproducir con los scripts de `analisis/` (cuál, en cada
sección). **Regla del
equipo: una cifra que no esté aquí no va al pitch.**

## Dos fuentes que miden cosas distintas

| Fuente | Qué cuenta | Ojo |
|---|---|---|
| **CONAFOR** (gobierno de México) | Incendios *forestales* atendidos: uno por evento, con hectáreas, causa y municipio | No cuenta las quemas agrícolas que no se convierten en incendio forestal |
| **FIRMS** (NASA) | *Focos de calor*: píxeles donde el satélite detectó fuego en una pasada | Un incendio grande produce cientos de focos, y una quema chica puede producir uno. **Focos ≠ incendios** |

Esa diferencia es el punto del proyecto: el satélite ve mucho más fuego del que registra la
estadística forestal. Hay que decirlo así, sin afirmar que «hay X incendios ocultos».

## ¿Hay muchos incendios en Yucatán? (CONAFOR)

Incendios forestales y hectáreas quemadas. Fuente: base de CONAFOR 2015–2024 en datos.gob.mx;
2025 sale del PDF de cierre de temporada.

| Año | Yucatán | Campeche | Quintana Roo | Península (ha) |
|---|---|---|---|---|
| 2015 | 34 · 8,646 ha | 28 · 6,530 ha | 81 · 5,867 ha | 21,043 |
| 2016 | 155 · 7,021 ha | 21 · 5,176 ha | 41 · 2,301 ha | 14,498 |
| 2017 | 103 · 11,008 ha | 29 · 13,818 ha | 64 · 9,631 ha | 34,457 |
| 2018 | 46 · 1,851 ha | 3 · 3,150 ha | 50 · 6,855 ha | 11,856 |
| 2019 | 22 · 5,691 ha | 15 · 14,647 ha | 59 · 12,795 ha | 33,133 |
| 2020 | 26 · 10,015 ha | 21 · 10,946 ha | 68 · 41,678 ha | 62,639 |
| 2021 | 15 · 892 ha | 5 · 2,029 ha | 33 · 1,879 ha | 4,800 |
| 2022 | 36 · 1,289 ha | 15 · 17,897 ha | 44 · 8,245 ha | 27,431 |
| 2023 | 15 · 765 ha | 20 · 10,320 ha | 50 · 10,915 ha | 22,000 |
| **2024** | **29 · 20,334 ha** | **30 · 27,667 ha** | **64 · 91,548 ha** | **139,549** |
| 2025 | 13 · 2,215 ha | 56 · 51,980 ha | 29 · 6,642 ha | 60,837 |

- **2024 fue el peor año de la serie 2015–2025** en Yucatán y en la península. A nivel
  nacional también: 8,002 incendios y 1,672,216 ha, la mayor superficie de la serie.
- **El fuego varía mucho de un año a otro**: Yucatán pasó de 765 ha (2023) a 20,334 ha (2024)
  y de vuelta a 2,215 ha (2025). Por eso sirve un calendario histórico: dice si un año va
  peor de lo normal.
- **Causa más frecuente en Yucatán (2015–2024): «quema para preparación de siembra»**,
  con 204 incendios y 18,182 ha. La causa con más hectáreas es «desconocida» (26,540 ha).
  También aparecen cazadores y actividades apícolas.
- **Municipios con más superficie quemada (2015–2024):** Tekax (89 incendios, 17,845 ha),
  Tizimín (65, 10,359 ha), Dzilam de Bravo (7, 5,879 ha) y Chemax (58, 3,888 ha).
- **Ecosistemas:** selva mediana subcaducifolia, tular y manglar. Por ejemplo, 1,777 ha de
  manglar en Dzilam de Bravo (feb 2024) y 3,178 ha de tular en Halachó (may 2024).
- **Temporada:** el 90 % de los incendios forestales de Yucatán empezó entre marzo y mayo
  (433 de 481, 2015–2024).

## Lo que ve el satélite (FIRMS)

Focos de calor de vegetación con confianza nominal o alta. Un foco es de Yucatán si su
municipio es de Yucatán (`analisis/municipios_zona.csv`); las cifras de Yucatán salen de
`analisis/cifras_yucatan.py` (con Tzucacab).

| Año | Yucatán VIIRS | Península VIIRS | Península MODIS |
|---|---|---|---|
| 2013 | 14,475 | 51,648 | 16,800 |
| 2019 | 11,503 | 47,351 | 15,422 |
| 2020 | 9,348 | 47,843 | 15,552 |
| 2023 | 8,757 | 49,641 | 15,086 |
| 2024 | 11,279 | 51,683 | 17,547 |
| 2025 | 6,867 | 34,044 | 9,648 |

(La tabla completa por año está en la salida del script.)

- **Yucatán tiene entre 6,800 y 14,500 focos al año (VIIRS, 2013–2025)**, mientras CONAFOR
  registra entre 13 y 155 incendios forestales. La mayoría de ese fuego son quemas que no
  entran en la estadística forestal.
- **El 89 % de los focos de Yucatán ocurre entre marzo y mayo**, con el pico en abril
  (unos 4,100 focos en promedio).
- **Los días con más focos en Yucatán en 2024 fueron del 16 al 21 de abril** (332 el día 21).
  Coinciden con incendios registrados por CONAFOR en Tekax (Tres Banderas, desde el 21 de
  abril, 2,428 ha; Ejido Kancab, desde el 14 de abril, 1,804 ha).

## El problema técnico del reto, con números

**VIIRS detecta unas 3 veces más focos que MODIS sobre el mismo territorio y los mismos años.**
En la península, la relación VIIRS/MODIS fue de 2.95 a 4.05 entre 2013 y 2025 (mediana: 3.08).
VIIRS tiene píxeles de 375 m y MODIS de 1 km, así que VIIRS ve fuegos más pequeños.

Consecuencia: si alguien une ingenuamente MODIS (2001–2011) con VIIRS (2012 en adelante),
parece que el fuego se triplicó en 2012. La península pasa de 18,872 focos MODIS en 2011 a
51,648 focos VIIRS en 2013, pero lo único que cambió fue el sensor. **Armonizar los dos
registros es justo lo que pide el reto.** Hay 13 años en que ambos sensores operan a la vez
para calibrar.

## Contexto

### MODIS se está retirando, pero sigue activo
- NASA confirma que Terra y Aqua (los satélites de MODIS) están en fase de cierre, se
  desvían de su órbita y dejarán de recolectar datos científicos al terminar operaciones
  (página de transición MODIS→VIIRS de LAADS). Un documento de NASA de abril de 2025
  estimaba agosto de 2026 para Aqua y enero de 2027 para Terra.
- **Comprobado en vivo:** Terra y Aqua siguen reportando focos
  todos los días en FIRMS. Por eso no se debe decir «MODIS ya se apagó». Lo correcto es:
  «el registro MODIS de 25 años está por cerrarse».
- Hasta el 2 de noviembre hubo **tres** satélites VIIRS en FIRMS: S-NPP, NOAA-20 y NOAA-21.
  Desde entonces quedan NOAA-20 y NOAA-21 (ver «S-NPP deja de entregar datos»). Unir también
  los VIIRS entre sí es parte del problema: la serie sigue con NOAA-20 (docs/02, «Método»).
- Pista de método: NASA diseñó su producto VIIRS de 750 m (VNP14) para dar continuidad al
  registro MODIS de 1 km (guía de usuario VNP14). FIRMS distribuye el de 375 m.
- Hipótesis, no verificada: al desviarse la órbita cambia la hora de paso del satélite, y como
  el fuego varía a lo largo del día, eso podría alterar los conteos MODIS recientes.

### Las quemas están reguladas y tienen calendario oficial
- La norma vigente es la **NOM-015-SEMARNAT-AGRICULTURA-2023**: publicada en el DOF el
  1 de diciembre de 2023, en vigor desde el 29 de mayo de 2024 según el catálogo de la
  Secretaría de Economía. Sustituye a la NOM-015-SEMARNAT/SAGARPA-2007 y regula el uso
  del fuego en terrenos forestales y agropecuarios.
- **Calendario de quemas en Yucatán (2024)**, según el coordinador estatal de Protección
  Civil (Posta, 3 de abril de 2024): milpa tradicional del 1 de marzo al 15 de abril, y zona
  henequenera del 20 de abril al 31 de mayo. En marzo de 2024 se controlaron 434 reportes
  de incendio. Ese número incluye todo tipo de incendios, no solo forestales.
- **Idea para el producto:** comparar el fuego que ve el satélite con las ventanas oficiales
  de quema.
- **Zona henequenera (inferido):** su ventana de 2024 (20 abr–31 may) es idéntica
  a la de la zona 2 de SEDER en 2025 y 2026 (51 municipios del centro-norte, la región
  henequenera de siempre). Todo indica que la zona 2 es la henequenera, así que no hace
  falta otro mapa. Leo lo confirma con gente del campo (tarea 21).

### Lo que viven Protección Civil y SEDER
Antecedentes para el storytelling y el pitch, reunidos por Leo de notas de prensa
(`docs/campo-y-datos-pc-seder.pdf` trae la versión completa con referencias APA). Solo van
aquí las cifras que no chocan con otras fuentes. Todas las notas se abrieron el 14 nov 2026
y cada dato aparece en su nota; los que no aparecían se quitaron.

- **Reportes y permisos:** en los primeros 22 días de marzo de 2023, Protección
  Civil recibió 427 reportes de incidentes de todo tipo, 126 de ellos relacionados con fuego
  (Quadratín, «Recibe Procivy 19 reportes diarios de incendios», 24 mar 2023). En toda la
  temporada 2023 solo se registraron 187 quemas con permiso en el estado (Diario de Yucatán,
  26 feb 2024). Ese mismo año VIIRS detectó 8,757 focos en Yucatán («Lo que ve el satélite»).
  Focos no son quemas. Los 427 son otro dato que los 434 reportes de marzo de 2024 (arriba): no mezclarlos.
- Más del 90 % de los incendios forestales en Yucatán los provocan actividades humanas,
  según Protección Civil de Yucatán (Posta, 3 abr 2025).
- Estos siniestros han afectado parcelas, ranchos y sistemas de riego, y han destruido casas
  de descanso e instalaciones rurales, según pobladores (Por Esto, 6 abr 2026).
- **Casos:**
  - Sucopó, Tizimín (2021): un campesino quemó solo y sin precauciones; nadie avisó a
    Protección Civil. Se dañaron tres parcelas y más de 35 ha (Por Esto, 18 may 2021).
  - Oxkutzcab (2022): 15 ha de limón persa en las unidades San Luis I y II, por una quema de
    maleza que se salió de control. El director de Protección Civil pidió a los vecinos hacer
    bien las guardarrayas antes de quemar (Por Esto, 21 abr 2022).
  - Umán (2025): incendio junto a dos fraccionamientos (Diario de Yucatán, 25 mar 2025). Ese
    año Umán perdió 264.29 ha de selva mediana y Yaxkukul 480.05 ha de selva baja (Diario de
    Yucatán, 12 ene 2026, con cifras preliminares de CONAFOR).
- **El permiso de quema:** es gratuito, se pide en el palacio municipal y solo permite quemar
  de 17:00 a 08:00 (Diario de Yucatán, 26 feb 2024). SEDER coordina cada año el Comité
  Estatal del Programa de Prevención y Combate de Incendios Agrícolas y Forestales (Por Esto,
  26 feb 2026).

### El humo llega a Mérida
- El 14 de mayo de 2024, Mérida estuvo entre las cinco ciudades más contaminadas de México,
  con un índice de calidad del aire de 151 a 162 («muy mala»), atribuido al humo de los
  incendios de los días previos (Diario de Yucatán, con datos de aqi.in).
- **Basurero de Yaxkukul (según la prensa):** el basurero municipal, en el
  km 8 de la carretera Conkal–Yaxkukul, a unos 26 km de Mérida, se incendió la noche del lunes
  9 de noviembre de 2026 (detectado hacia las 19 h) y el fuego empezó a controlarse la mañana
  del martes 10. El humo llegó a varios sectores de Mérida, sobre todo al norte, centro y
  poniente; mucha gente creyó que era neblina. Protección Civil de Yucatán pidió permanecer bajo
  techo, cerrar puertas y ventanas, evitar actividades al aire libre y cuidar a niñas, niños,
  personas mayores, embarazadas y personas con enfermedades respiratorias o del corazón. Se
  atribuyó al viento el desplazamiento del humo hacia Mérida (Diario de Yucatán, 9 y 10 de nov;
  Por Esto, 10 de nov).
  - **Límites:** fue un incendio de basurero, no un incendio forestal ni una quema agrícola, así
    que no es lo que mide K'áak'. No sabemos si el satélite lo vio y no lo verificamos. Las
    notas solo mencionan Mérida (no otros municipios del norte) y no reportan síntomas,
    hospitales ni cifras de calidad del aire. Las notas no dan la causa. Una nota cita a una
    funcionaria que dijo que no implicaba riesgo; Protección Civil recomendó resguardarse. **No
    decir que afectó la salud de la gente ni que se esparció por el norte de Yucatán.**
  - **Para qué sirve:** ejemplo reciente de que el humo de un solo foco viaja kilómetros y
    llega a quien no lo vio empezar. Se usa en la versión de 5 minutos del guion (docs/03).

### Lo que ya existe (y contra qué nos van a comparar)
- **CONABIO, Sistema de Alerta Temprana de Incendios (SATIF):** <https://incendios.conabio.gob.mx>.
  Opera desde cerca del año 2000 (Gaceta UNAM). Según el código de su portal,
  muestra focos por satélite (MODIS, VIIRS y GOES), consultas por estado, municipio
  y fecha (con filtro de hasta tres meses), conteo de focos totales y en áreas protegidas,
  descargas históricas y área quemada mensual de MODIS (2000–2019). **Sí tiene historial.**
  **Confirmado en el portal y en su sección «Información
  disponible»:** da los puntos de calor por sensor y por año, cada uno en su propia columna
  (AVHRR 1999–2003, MODIS desde 2004, VIIRS desde 2014), y su documentación no habla de
  calibrar ni armonizar sensores, así que no hay una serie comparable. Tampoco compara una
  temporada contra lo normal: lo más cercano son un mapa anual de «presión del fuego»
  (periodo de retorno y frecuencia de focos en rejilla de 1 km) y una anomalía de vegetación
  (NDVI) contra 10 años, que no son conteos de focos por semana ni por municipio. Se revisó
  la documentación y las tablas del portal; no se probó cada descarga. Capturas del
  recorrido en `docs/capturas/conabio-satif-*.png`; la que muestra la tabla de sensores por
  año es `conabio-satif-09-tabla1-completa.png`.
- **CONAFOR y la Universidad Juárez de Durango (SPPIF):** <https://forestales.ujed.mx/incendios2/>.
  Predicción de peligro con meteorología, e incendios activos e históricos descargables por
  estado.
- **CONAE (Argentina):** visor de focos MODIS y VIIRS y de área quemada. La foto del reto le
  da crédito a CONAE, así que es probable que el reto venga de ahí. Es una deducción, no un
  dato confirmado.

### S-NPP deja de entregar datos el 2 de noviembre de 2026
- **Aviso de NOAA (3 de agosto de 2026):** la entrega de todos los productos de S-NPP,
  incluido VIIRS, termina el 2 de noviembre de 2026 a las 13:00 UTC, de forma permanente.
  NOAA recomienda NOAA-21 como principal y NOAA-20 como secundario. El aviso no dice si el
  archivo histórico seguirá disponible.
- **Confirmado (actualización 2 de NOAA, del 19 de oct):** la fecha sigue siendo
  el **2 de noviembre a las 13:00 UTC**. Al principio era el 1 de noviembre, pero NOAA la
  movió porque cae en domingo. Algunas páginas de Earthdata (y la de LDOPE, que dice «November
  2, 2026 (2026/305)», aunque el día 305 es el 1) siguen con la fecha vieja: **citar a NOAA**.
  Dato nuevo: del 1 al 12 de diciembre, S-NPP se hará bajar de órbita para que reingrese sobre
  el Pacífico Sur.
  Fuente: <https://www.nesdis.noaa.gov/news/administrative-update-2-cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-november-02-2026-1300-utc-and-decommissioning-issued-october-19-2026-1400-utc>
- Ese corte ocurre 11 días antes del hackatón. Con MODIS en retiro, el registro queda
  repartido entre cinco satélites (Terra, Aqua, S-NPP, NOAA-20 y NOAA-21). El registro completo
  de S-NPP, del 20 de enero de 2012 al 2 de noviembre de 2026, está en
  `datos_peninsula/focos_peninsula.parquet`.

### Los satélites VIIRS coinciden entre sí; la brecha está con MODIS
Focos de vegetación en la península (confianza nominal o alta):

| Año | S-NPP | NOAA-20 | MODIS | NOAA-20 / S-NPP | NOAA-20 / MODIS |
|---|---|---|---|---|---|
| 2019 | 47,351 | 45,549 | 15,422 | 0.96 | 2.95 |
| 2020 | 47,843 | 46,120 | 15,552 | 0.96 | 2.97 |
| 2021 | 24,806 | 24,099 | 8,328 | 0.97 | 2.89 |
| 2022 | 26,506 | 26,234 | 6,549 | 0.99 | 4.01 |
| 2023 | 49,641 | 49,868 | 15,086 | 1.00 | 3.31 |
| 2024 | 51,683 | 54,928 | 17,547 | 1.06 | 3.13 |
| 2025 | 34,044 | 32,393 | 9,648 | 0.95 | 3.36 |

- NOAA-20 y S-NPP dan prácticamente lo mismo (entre 0.95 y 1.06). NOAA-21 también:
  51,829 focos contra 51,683 de S-NPP en 2024 (1.00) y 32,616 contra 34,044 en 2025 (0.96).
  Su registro en FIRMS empieza el 1 de marzo de 2023. En 2018 NOAA-20 sale bajo
  porque en FIRMS su registro empieza el 1 de abril de 2018 y le falta marzo.
- Si se suman dos satélites VIIRS sin quitar duplicados, el mismo fuego se cuenta dos veces.

### 2022: Aqua estuvo apagado 17 días y vio menos fuego de lo normal
Explica por qué 2022 es el peor año de la Prueba 2 (`salidas/validacion.json`): la predicción
con Aqua queda **25 % por debajo** de S-NPP (12,122 cuadritos-día contra 16,136), cuando
2021, 2023, 2024 y 2025 quedan entre −5 % y +11 %. La prueba pasa igual (11 % de error en
2021–2025, límite 25 %). Cifras de focos con `analisis/aqua_2022.py` (vegetación, confianza
nominal o alta).

**Confirmado: Aqua no mandó datos del 31 de marzo al 16 de abril de 2022.**
- El 31 de marzo una falla en el control de energía del satélite lo puso en modo seguro y
  MODIS dejó de tomar datos. NASA da los datos por buenos otra vez desde el 17 de abril
  (Earthdata, MCST). LAADS pone el fin del evento el 21 de abril.
- En la península, esos 17 días Aqua tiene **0 focos** y S-NPP **4,090**. Cayó en lo más
  fuerte de la temporada.
- La Prueba 2 ya quita esos días («días hueco»: un satélite en 0 y el otro con fuego), así que
  el apagón **no** es lo que baja la predicción.

**Confirmado con los datos: el resto de la temporada, Aqua vio menos de lo normal.**
Focos de S-NPP por cada uno de MODIS, marzo a mayo, sin los días del apagón:

| | 2013–2025 sin 2022 | Mediana | **2022** |
|---|---|---|---|
| Por cada foco de Aqua | 4.50 a 5.46 | 5.03 | **6.72** (+34 %) |
| Por cada foco de Terra (control) | 6.71 a 9.51 | 8.24 | 8.62 (+5 %) |

- Con Aqua, 2022 es el año más alto de los 13: Aqua vio como **un 25 % menos** de lo que
  suele ver frente a S-NPP. Es el mismo 25 % que le falta a la predicción.
- **No es por los fuegos de ese año:** Terra, que también es MODIS, sale normal, y la
  intensidad típica de los fuegos que ve S-NPP también (FRP mediana 6.7 MW, como los demás
  años).
- **No es solo el apagón:** marzo ya sale alto (6.4 contra 4.7 de mediana), antes de la falla.
  Abril (6.4 contra 4.6) y mayo (7.0 contra 6.0) también. Quitar los días de recuperación
  (17 al 21 de abril) casi no lo cambia (6.85).
- **No parece la deriva de la órbita de Aqua:** la deriva crece con los años, y en 2023 y
  2024 Aqua vuelve a lo normal (2024 es el año más bajo: 4.52).

**Sin confirmar:** por qué Aqua vio menos en 2022. Ver «Pendiente de verificar».

**Para el pitch:** la Prueba 2 pasa con 2022 incluido. Si preguntan por 2022: «Aqua, uno de
los satélites viejos, estuvo apagado 17 días por una falla que reportó NASA, y ese año vio
menos fuego de lo normal; Terra, su gemelo, no. Aun así el error total es de 11 %».

### Calendario oficial de quemas por zonas (Yucatán)
- En 2026 la Secretaría de Desarrollo Rural (SEDER) dividió el estado en cuatro zonas:
  zona 1, 30 municipios del sur-oriente (1 mar–15 abr); zona 2, 51 del centro-norte
  (20 abr–31 may); zona 3, 13 del sur (10 mar–3 abr); zona 4, 12 del norte y oriente
  (10 mar–3 abr). Fuentes: Heraldo de México (2 mar 2026) y El Cronista Yucatán (14 abr 2026).
- La lista de municipios por zona está en `analisis/zonas_quema_yucatan.csv`. Sale de la nota
  del Diario de Yucatán del 6 de marzo de 2025, que trae 103 de los 106 municipios. Los 3
  faltantes (Baca en la zona 2; Dzan y Tekit en la zona 3) son inferidos: así los totales
  cuadran exacto con los oficiales de 2026. **Falta confirmarlo:** Leo lo pregunta en los
  pueblos (tarea 21) y, mientras tanto, la página los marca como inferidos.
- Nota: «Quintana Roo» en la zona 1 no es un error. Es un municipio de Yucatán.

### Hallazgo: la mayor parte del fuego cae fuera de la ventana de su zona
Focos VIIRS de 2025 en Yucatán, cruzados con la zona de su municipio
(`analisis/cifras_yucatan.py`, con Tzucacab):

| | S-NPP | NOAA-20 |
|---|---|---|
| Dentro de la ventana de su zona | 18.9 % | 18.0 % |
| En temporada (mar–may) pero fuera de su ventana | 66.7 % | 66.6 % |
| Fuera de temporada | 14.4 % | 15.5 % |

- Los dos satélites dan lo mismo, así que el patrón no depende del sensor.
- **No significa «quemas ilegales».** Un foco fuera de su ventana puede ser un incendio
  forestal, una quema que se salió de control o una fuente de calor mal clasificada. Es una
  pregunta para SEDER y Protección Civil, no una acusación.
- Limitaciones: se aplicaron las ventanas de 2025 al año 2025 únicamente, y los límites
  municipales son aproximados (geoBoundaries).

### Las temporadas 2025 y 2026 fueron las más tranquilas del registro
Focos de vegetación en Yucatán de marzo a mayo (confianza nominal o alta). Los datos de 2026
se bajaron por la API de FIRMS (`analisis/descargar_firms_api.py`).

| Satélite | Normal (mediana) | Más alto | 2025 | **2026** |
|---|---|---|---|---|
| S-NPP (2013–2025) | 8,122 | 13,139 (2013) | 5,880 | **3,789** |
| NOAA-20 (2019–2025) | 7,871 | 9,809 (2024) | 5,583 | **4,192** |
| MODIS (2013–2025) | 3,159 | 4,965 (2013) | 1,711 | **933** |

- Los tres satélites coinciden: **2026 es la temporada más baja de la serie** y 2025 la
  segunda (con CONAFOR, 2025 también fue el año con menos incendios forestales: 13).
- **Consecuencia para el pitch:** no podemos decir que el fuego va en aumento en Yucatán.
  Lo valioso de la herramienta es saber si una temporada se sale de lo normal, en cualquier
  dirección. La caída de MODIS puede estar exagerada por la deriva de su órbita.
- **Pregunta abierta:** ¿qué cambió en 2025 y 2026? ¿Lluvias, el calendario de quemas por
  zonas, más vigilancia o menos milpa? Leo la lleva al campo (tarea 21).

### Validación con CONAFOR: el satélite ve la mayoría de los incendios registrados
Calculado con `analisis/cruce_conafor.py` (detalle por incendio en
`analisis/salidas/cruce_conafor.csv`). Se tomaron los 1,222 incendios que CONAFOR registró
en la península entre 2015 y 2024, todos con coordenadas y fechas. Cuenta como «visto» si
hay al menos un foco a menos de 2 km entre un día antes del inicio y un día después del
término.

| Satélite | Incendios con foco cerca | Por azar (control) |
|---|---|---|
| **S-NPP (VIIRS)** | **53 %** | 9 % |
| MODIS (Terra + Aqua) | 36 % | 4–5 % |
| Cualquier satélite | 58 % | 12 % |

El control repite el cruce con el mismo lugar un año antes y uno después, y con las mismas
fechas a 20 km de distancia. Mide cuánto coincidiría por casualidad, porque en temporada
hay fuego en todas partes. Lo real es unas **6 veces** el azar.

| Tamaño del incendio (CONAFOR) | Incendios | S-NPP | MODIS |
|---|---|---|---|
| 0 a 5 ha | 275 | 18 % | 5 % |
| 6 a 10 ha | 126 | 29 % | 11 % |
| 11 a 20 ha | 124 | 40 % | 23 % |
| 21 a 50 ha | 167 | 57 % | 29 % |
| 51 a 100 ha | 134 | 66 % | 40 % |
| Más de 100 ha | 395 | **84 %** | 72 % |

- **Cuanto más grande el incendio, más lo ve el satélite.** La correlación entre hectáreas
  y número de focos es de 0.64 (Spearman). En 2024, el peor año, S-NPP vio el 84 % de los
  123 incendios registrados.
- **La brecha MODIS–VIIRS depende del tamaño:** en incendios chicos VIIRS ve 3.5 veces más
  que MODIS, y en los de más de 100 ha solo 1.2 veces más. Es una prueba independiente de
  que un solo factor de conversión no basta, y respalda calibrar por zona y por tipo de
  fuego (docs/02).
- **Por estado:** Campeche 72 %, Quintana Roo 57 % y Yucatán 42 %. Yucatán sale más bajo
  porque sus incendios son más chicos (mediana de 20 ha, contra 33 ha en Quintana Roo y
  132 ha en Campeche). Con 50 ha o más, Yucatán llega al 74 %.
- **Frase para el pitch:** «De los incendios que CONAFOR registró en la península, el
  satélite vio más de la mitad, y 84 % de los de más de 100 hectáreas; por azar
  coincidiría menos del 10 %.»
- **Límites:** CONAFOR registra incendios forestales, no quemas agrícolas, así que esto
  valida la detección, no el calendario de quemas. El punto de CONAFOR es uno por
  incendio, aunque el incendio sea grande. El incendio de 0 ha (1 caso) se dejó como está.

### Lo que dice la gente del campo

Los reúne Leo con su abuelo, que es agricultor, y con gente de los pueblos (tarea 21 de
docs/02). Cada dato lleva de quién viene. Sirven para contar la historia y para revisar la
ficha; no son cifras.

**Lorenzo de Jesús López Nabte, abuelo de Leo** (confirmado por Leo): 73 años, vive en Muna
y trabaja su parcela desde los 15 años, hace más de 50.

- **En Muna las quemas empiezan en abril** (confirmado por él con Leo, 14 nov 2026). Muna está
  en la zona 3 de SEDER, cuya ventana es del 10 de marzo al 3 de abril
  (`analisis/zonas_quema_yucatan.csv`): la ventana cierra justo cuando él dice que empiezan.
  Coincide con lo que ve el satélite en todo Yucatán: el 89 % de los focos cae entre marzo y
  mayo, con el pico en abril («Lo que ve el satélite»). Respalda la frase «en abril» del
  guion (docs/03).

- «La gente del campo cuenta con sus propios calendarios para quemar y cosechar.»
- «No se adaptan a la tecnología. Es muy difícil que puedan adaptar todo lo que llevan
  haciendo casi toda su vida con tecnología.»
- Hay fechas de quema en las que cada dueño tiene su fecha. Las fechas se acuerdan en una
  junta de todos los dueños de las parcelas (quema controlada).
- Causas accidentales que menciona: sol fuerte sobre basura, que prende y se extiende, y
  quemas controladas que se salen de control.
- **Para qué sirve:** explica por qué el fuego no sigue la ventana oficial (ver «Hallazgo: la
  mayor parte del fuego cae fuera de la ventana de su zona»): cada comunidad tiene su propio
  calendario. También advierte que una herramienta para el productor tiene que ser muy
  sencilla, o no se va a usar.

Comentario de Misa en el grupo, por confirmar con Leo: los incendios se conocen por
  llamada, al agricultor se le dice cuándo quemar y en el monte grande no hay agua suficiente
  para apagarlos.

### Avisos de incendio que ya existen
- **FIRMS manda correos gratis** a quien dibuje un área en su mapa, o elija un país o un
  área protegida: diarios, semanales o casi en tiempo real.
- FIRMS publica los focos de MODIS y VIIRS **menos de 3 horas** después de que pasa el
  satélite. Cada satélite ve un lugar unas dos veces al día, así que el correo puede tardar
  más que eso.
- **CONABIO** opera un sistema de alerta temprana de incendios desde cerca del año 2000; se
  usa junto con el 911. No confirmamos si hoy manda correos a usuarios.

### Cifras de la página
Salen de `web/datos/`, que escribe `pipeline/exportar_web.py` a partir de la serie armonizada
(`salidas/serie_armonizada.csv`); `python pipeline/exportar_web.py` las vuelve a calcular.
Desde el 14 nov, los días sin datos de S-NPP se cuentan con NOAA-20 (ver «Días sin datos del
satélite» abajo).

- **Qué cuenta la página.** Un «foco de calor» de la página es un cuadrito-día: una celda de
  ≈1.1 km con al menos un foco ese día (`pipeline/rejilla.py`). Varios focos del mismo cuadrito
  el mismo día cuentan una vez, y se usa un satélite por día. Por eso 2026 da 3,320 y no los
  3,789 focos de S-NPP de la tabla de arriba, que cuenta cada foco (y no tiene los días en que
  S-NPP no mandó datos). Las dos cifras dicen lo mismo: 2026 es la temporada más baja desde
  2001.
- **Portada, Yucatán de marzo a mayo:** 3,320 focos en 2026 contra 6,712 de un año normal
  (la mediana de 2001 a 2025): menos de la mitad. 93 de los 106 municipios tuvieron menos
  fuego que lo normal y ninguno tuvo más. El día con más fuego en la península fue el 30 de
  abril, con 682 (los vio NOAA-20: ese día S-NPP no mandó datos).
- **El año con más fuego fue 2003:** 16,850 focos, y 83 de los 106 municipios tuvieron más
  fuego que lo normal (se ve al tocar 2003 en las barras de la portada).
- **Tekax:** 213 focos en 2026 contra 390 de un año normal (un poco más de la mitad). En un
  año normal, 8 de cada 10 focos (79 %) aparecen después del 3 de abril, cuando cierra la
  ventana de su zona.
- **Un año normal, día por día** (`pipeline/datos_web.py`, `normal_diario`): es la forma
  promedio de la temporada de 2001 a 2025, escalada para que sume la mediana de los totales.
  Hasta el 14 de noviembre se restaba día a día la mediana del acumulado; como el año que queda
  en medio cambia de un día a otro, salían días en cero y saltos (Tekax tenía 20 focos el 31 de
  mayo después de cinco días en cero). Con la corrección, la frase «k de cada 10 focos aparecen
  después de…» cambió en 35 municipios (Dzitas pasó de 9 a 5); Tekax y los totales no cambian.
- **Umán, el municipio de ejemplo de la página** (`web/datos/municipio/uman.json`; issue #30):
  42 focos en un año normal. En 2025, la segunda temporada más tranquila del registro, tuvo 63 (1.5 veces
  lo normal, «arriba»), y en 2024, 54 («arriba»); en 2026, 19 (antes de contar los días sin
  datos de S-NPP con NOAA-20 eran 14). Se ve al tocar 2025 en sus barras. Lo respalda CONAFOR: 5 incendios forestales en 2015–2024, todos en selva y 4 de ellos
  por cazadores, con 890 ha (`datos_peninsula/incendios_conafor_2015_2024.csv`), y 264.29 ha de
  selva mediana en 2025 (Diario de Yucatán, 12 ene 2026, con cifras preliminares de CONAFOR).
  **Ojo:** en 2016 CONAFOR registra 601 ha, pero el satélite da 26 focos, menos que lo normal:
  el satélite no ve todos los incendios (ver «Validación con CONAFOR»). Reemplaza a Tekax como
  ejemplo porque muestra un año malo (2025) cuando el resto del estado estuvo tranquilo. Con los
  datos actuales Tekax 2024 también sale «arriba» (617 contra 390), no «dentro de lo normal».
  No va en el pitch: solo es el ejemplo de la página.
- **Focos fuera de las fechas permitidas, de enero a junio de 2026** (`web/datos/zonas.json`):

  | Zona | Fechas permitidas | Fuera de fecha |
  |---|---|---|
  | 1 | 1 mar–15 abr | 9 de cada 10 (91 %) |
  | 2 | 20 abr–31 may | 4 de cada 10 (40 %) |
  | 3 | 10 mar–3 abr | 9 de cada 10 (91 %) |
  | 4 | 10 mar–3 abr | 96 % |

  Igual que en el hallazgo de 2025: no son «quemas ilegales».
- **El salto de 2012** (`web/datos/metodo.json`): en Yucatán, en temporada, el promedio de
  2013–2015 entre el de 2009–2011 es ×3.0 sin calibrar y ×0.93 con el factor. NOAA-20 ve 0.99
  focos por cada uno de S-NPP. Falta contrastarlo con la prueba 1 de Nico (`pipeline/validar.py`
  en su rama), que usa la península completa.
- **El factor de Aqua en temporada** (`salidas/factores.csv`, zonas de Yucatán): S-NPP ve entre
  2.8 y 3.8 focos por cada uno de Aqua (2.84 en la zona 1, 3.83 en la 2, 3.10 en la 3 y 3.84 en
  la 4). «Cómo lo medimos» muestra ese rango.
- **127 municipios en el mapa, no 130:** los límites de geoBoundaries no traen Dzitbalché,
  Seybaplaya ni Puerto Morelos, que son municipios recientes; sus focos caen en los municipios
  de los que se separaron. Yucatán sí tiene sus 106.

### Días sin datos del satélite (verificado el 14 nov)
La serie usa un satélite por día. Si ese satélite no mandó datos, antes el día contaba como
cero fuego aunque otro satélite lo viera. Ahora (docs/02, «Método») se cuenta con su respaldo:
NOAA-20 por S-NPP y Terra por Aqua. Lista completa en `salidas/dias_sin_datos.csv`.

- **Días rellenados (12):** S-NPP vio 0 en toda la península y NOAA-20 vio 50 o más el 30 may –
  3 jun 2024 (de 380 a 898 por día), el 10–12 mar 2026 (56 a 116) y el 28–30 abr 2026 (347 a
  682, en el pico de la temporada). Aqua vio 0 y Terra 174 el 12 may 2003.
- **Efecto en la página:** Yucatán de marzo a mayo de 2026 pasa de 2,883 a 3,320 focos
  (+15 %); sigue siendo la temporada más baja desde 2001. En 2024, +2.5 %. Lo normal (6,712) y
  el salto de 2012 no cambian. La frase anterior «el día con más fuego fue el 1 de mayo, con
  653» era falsa: S-NPP no mandó datos el 30 de abril, cuando NOAA-20 vio 682.
- **Caída de S-NPP de 2022, a propósito sin rellenar:** S-NPP entró en modo seguro y NASA da
  por perdidos sus datos del 26 jul al 20 ago 2022 (VIIRS volvió el 10 ago). En la península
  S-NPP vio 0 del 27 jul al 10 ago y el 18 y 19 ago; NOAA-20 vio unos 90 cuadritos en esos
  días. No se rellena: es fuera de temporada y la regla del umbral (50 o más) está hecha para
  no confundir «sin fuego» con «sin datos». Queda en `dias_sin_datos.csv` para explicarlo.
- **Terra en 2001, sin respaldo:** MODIS de Terra estuvo apagado por una falla de su fuente
  de poder del 15 jun al 2 jul 2001 (NASA MCST). Antes de julio de 2002 no hay otro satélite,
  así que esos 18 días cuentan como cero. Es junio, fuera de temporada, y 2001 es uno de los 25
  años de lo normal. Se reporta y no se toca.
- **Lo que no se detecta:** días en que el satélite mandó datos a medias (S-NPP del 11 al 17
  ago 2022), días fuera de temporada en que el respaldo vio menos de 50 (12 días de junio a
  agosto) y del 19 al 28 mar 2002, cuando Terra no vio ni un foco en plena temporada (causa sin
  verificar: no se dice como caída).
- **El mismo método que otros:** GFED5NRT (Chen et al., *ESSD* 18:7535, 2026) usa el VIIRS disponible
  cuando falta el otro. Es la misma familia de método, no la copiamos de ahí.

## Pendiente de verificar

- Datos del campo que faltan (tarea 21): si la zona 2 es la henequenera, las zonas inferidas
  de Baca, Dzan y Tekit y el comentario de Misa.
- «Lo que viven Protección Civil y SEDER»: las notas de prensa ya se revisaron. Se quitó la
  iniciativa de ley del 25 feb 2026 (sin liga oficial) y lo que no era un dato de alguna nota:
  El Niño a finales de 2026, incendios en varias zonas a la vez que desbordan a las brigadas,
  que el permiso se pide «en papel», que Protección Civil «se entera cuando ya hay fuego» y la
  conclusión «casi nadie avisa antes de quemar».
- Cifras que **no** van al pitch porque chocan entre fuentes: Yucatán 2023 (765 o 760 ha),
  2024 (20,334 o 20,333 ha) y 2026 (3 incendios y 335.83 ha, u otro reporte de más de 400 ha).

- **Por qué Aqua vio menos fuego en 2022** («2022: Aqua estuvo apagado 17 días»). Lo
  comprobado: no son los fuegos de ese año (Terra sale normal) y empieza en marzo, antes del
  apagón. Lo que falta: buscar en los avisos de NASA (MCST, LAADS) si algo de Aqua cambió en
  2022, por ejemplo una maniobra de órbita o un ajuste del instrumento. Después del modo seguro
  NASA reprocesó bandas térmicas de Aqua, pero no las que se usan para detectar fuego. Hasta
  confirmarlo, no se dice en el pitch cuál es la causa.

## Fuentes

- NASA FIRMS, archivos anuales por país: <https://firms.modaps.eosdis.nasa.gov/data/country/>
  (MODIS C6.1 y VIIRS S-NPP 375 m; campo `type` 0 = presunto incendio de vegetación).
- CONAFOR, base de incendios forestales 2015–2024: <https://www.datos.gob.mx/dataset/incendios_forestales>
- CONAFOR, cierre de temporada 2024: <https://www.gob.mx/cms/uploads/attachment/file/965295/Cierre_de_la_Temporada_2024.pdf>
- CONAFOR, cierre de temporada 2025: <https://www.gob.mx/cms/uploads/attachment/file/1084029/Cierre_de_la_Temporada_2025.pdf>
- Natural Earth, límites estatales (admin 1, 1:10m).
- NASA LAADS, transición MODIS→VIIRS: <https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition>
  y documento de abril de 2025: <https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/MODIS-VIIRS_Transition.pdf>
- NASA Earthdata, modo seguro de Aqua (31 mar – 17 abr 2022): <https://www.earthdata.nasa.gov/data/alerts-outages/aqua-safe-mode-alert>
- NASA MCST, el evento de modo seguro de Aqua: <https://mcst.gsfc.nasa.gov/news/aqua-safe-mode-event>
- NASA LAADS, reprocesamiento de Aqua después del modo seguro: <https://ladsweb.modaps.eosdis.nasa.gov/alerts-and-issues/171771>
- FIRMS, focos de los últimos 7 días (comprobación en vivo): <https://firms.modaps.eosdis.nasa.gov/data/active_fire/>
- Guía de usuario VIIRS VNP14: <https://lpdaac.usgs.gov/documents/427/VNP14_User_Guide_V1.pdf>
- NOM-015-SEMARNAT-AGRICULTURA-2023 (catálogo de la Secretaría de Economía): <https://platiica.economia.gob.mx/normalizacion/?p=248501>
- NASA Earthdata, S-NPP en modo seguro (datos del 26 jul al 20 ago 2022 no recuperables):
  <https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-recovers-from-safe-mode>
- NSIDC, VIIRS de S-NPP de vuelta el 10 ago 2022:
  <https://nsidc.org/data/user-resources/data-announcements/update-snppviirs-safe-mode>
- NASA MCST, operaciones de MODIS de Terra en 2001: apagado el 15 jun
  (<https://mcst.gsfc.nasa.gov/iot/am1weekly2001-1672001-173>) y de vuelta el 2 jul a las
  22:48 UTC (<https://mcst.gsfc.nasa.gov/iot/am1weekly2001-1812001-187>).
- Posta, calendario de quemas en Yucatán (3 abr 2024): <https://www.posta.com.mx/mexico/durante-marzo-se-controlaron-434-reportes-de-incendios/vl1559689>
- Diario de Yucatán, calidad del aire (14 may 2024): <https://www.yucatan.com.mx/merida/2024/05/14/aire-en-merida-entre-los-mas-contaminados-de-mexico-hoy.html>
- Diario de Yucatán, incendio del basurero de Yaxkukul (10 nov 2026): <https://www.yucatan.com.mx/yucatan/2026/11/10/controlan-el-incendio-registrado-en-el-basurero-municipal-de-yaxkukul-el-humo-afecto-a-merida.html>
  y (9 nov 2026): <https://www.yucatan.com.mx/merida/2026/11/09/densa-humareda-sorprende-a-colonias-de-merida-huele-a-quemado-reportan.html>
- Por Esto, humo en Mérida por el incendio de Yaxkukul (10 nov 2026): <https://www.poresto.com/yucatan/merida/2026/11/10/humo-merida-noche-lunes-noviembre-ssp-explica-origen.html>
- Gaceta UNAM, sistemas de alerta temprana: <https://www.gaceta.unam.mx/fenomeno-global-los-incendios-forestales-de-gran-extension-y-duraderos/>
- CONAE, manual del visor de focos: <https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf>
- NOAA NESDIS, cese de S-NPP (3 ago 2026): <https://www.nesdis.noaa.gov/news/cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-onafter-november-2-2026>
- FIRMS, lista de archivos anuales por país: <https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt>
- CONABIO SATIF: <https://incendios.conabio.gob.mx> · SPPIF: <https://forestales.ujed.mx/incendios2/>
- Calendario de quemas 2026: <https://yucatan.heraldodemexico.com.mx/local/2026/3/2/quemas-agricolas-2026-fechas-municipios-con-autorizacion-en-yucatan-mapa-4389.html>
  y <https://elcronistayucatan.mx/2026/04/14/merida-define-periodo-de-quemas-agricolas-del-20-de-abril-al-31-de-mayo-de-2026/>
- Calendario de quemas 2025 con listas por zona: <https://www.yucatan.com.mx/yucatan/2025/03/06/calendario-de-quemas-2025-en-yucatan-fechas-y-municipios-autorizados.html>
- Programa Especial de Protección Civil 2026 (Yucatán): <https://www.yucatan.gob.mx/docs/procivy/archivos/programa_especial_de_proteccion_civil_2026.pdf>
- Protección Civil y SEDER (reunidas por Leo; referencias APA en `docs/campo-y-datos-pc-seder.pdf`):
  Quadratín, «Recibe Procivy 19 reportes diarios de incendios» (24 mar 2023): <https://yucatan.quadratin.com.mx/?p=271037>;
  Diario de Yucatán, «Península de Yucatán, con 98 incendios forestales» (Daniel Valdez Cetz, 12 ene 2026): <https://www.yucatan.com.mx/mexico/2026/01/12/peninsula-de-yucatan-con-98-incendios-forestales.html>;
  Diario de Yucatán, «Temporada de quemas 2024 en Yucatán: Fechas, requisitos y recomendaciones» (Emanuel Rincón Becerra, 26 feb 2024): <https://www.yucatan.com.mx/merida/2024/02/26/temporada-de-quemas-2024-en-yucatan-fechas-requisitos-y-recomendaciones.html>;
  Posta, «Estas son las razones por las cuales Yucatán es afectado por los incendios forestales» (Adity Cupil, 3 abr 2025): <https://www.posta.com.mx/yucatan/estas-son-las-razones-por-las-cuales-yucatan-es-afectado-por-los-incendios-forestales-/vl2020641>;
  Por Esto, «Incendio consume más de 35 hectáreas en Sucopó, Tizimín» (Raquel Margarita Huerta, 18 may 2021): <https://www.poresto.com/yucatan/2021/5/18/incendio-consume-mas-de-35-hectareas-en-sucopo-tizimin.html>;
  Por Esto, «Incendio acaba con 15 hectáreas del "oro verde" en Oxkutzcab» (Carlos Ek, Jaime Tun y Roberto Hernández, 21 abr 2022): <https://www.poresto.com/yucatan/2022/4/21/incendio-acaba-con-15-hectareas-del-oro-verde-en-oxkutzcab.html>;
  Diario de Yucatán, «Alarma en Umán por incendio cerca de dos fraccionamientos» (Carolina Uc Quintal, 25 mar 2025): <https://www.yucatan.com.mx/yucatan/2025/03/25/alarma-en-uman-incendio-cerca-de-dos-fraccionamientos.html>;
  Por Esto, «Quemas agrícolas y calor extremo elevan riesgo de incendios en Yucatán» (José Borges, 6 abr 2026): <https://www.poresto.com/yucatan/2026/4/6/quemas-agricolas-y-calor-extremo-elevan-riesgo-de-incendios-en-yucatan.html>;
  Por Esto, «Instalan el Comité del Programa de Prevención y Combate de Incendios Agrícolas y Forestales en Yucatán» (Omar Xool, 26 feb 2026): <https://www.poresto.com/yucatan/merida/2026/2/26/instalan-el-comite-del-programa-de-prevencion-y-combate-de-incendios-agricolas-y-forestales-en-yucatan.html>.
- geoBoundaries, municipios de México (CC BY 4.0): <https://www.geoboundaries.org>
- Lista de los 106 municipios de Yucatán: Wikipedia, «Anexo:Municipios de Yucatán».
- NASA Earthdata, FIRMS y su latencia: <https://www.earthdata.nasa.gov/learn/articles/nasa-firms-helps-fight-wildland-fires-in-near-real-time>
  y hoja de FIRMS (2022): <https://wiki.earthdata.nasa.gov/download/attachments/2228234/FIRMS_One%20Pager_2022_Prnt-Web.pdf?api=v2>
- Alertas por correo de FIRMS (cómo suscribirse): <https://wildfiretoday.com/?p=758>
  y NASA Earth Observatory, «Fire Alerts Go Global»: <https://earthobservatory.nasa.gov/Features/FireAlerts/fire_alerts2.php>
