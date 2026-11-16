# El campo de Yucatán y el fuego: problema y solución

*14 nov 2026. Aterrizaje de la problemática para el pitch y para implementar. Versión en PDF:
`docs/es/04-campo-y-fuego.pdf`. Las cifras propias se reproducen con `analisis/campo_y_fuego.py`;
las demás, en docs/01, «El campo de Yucatán».*

**En corto:** casi la mitad de Yucatán es campo, y ahí está el fuego: los 10 municipios con
más focos viven de la milpa o del ganado. La ley obliga a cada municipio a autorizar las quemas
y evaluar su temporada, pero lo hace sin datos. K'áak' le da a cada municipio **el calendario
del fuego de su territorio**: dónde y en qué semanas se quema y dónde el fuego ya se ha escapado
(14 años de VIIRS), y si su temporada va peor que lo normal (25 años de MODIS y VIIRS calibrados).

## 1. Qué representa el campo para Yucatán

| Representa | Dato verificado | Lo que significa |
|---|---|---|
| El territorio | 42.3 % del estado es de uso agropecuario (INEGI, Censo Agropecuario 2022) | De cada 10 hectáreas, 4 son campo |
| La tierra que se siembra | 306,991 ha de superficie agrícola en unidades activas (INEGI, ENA 2025); el censo de 2022 daba 402,564 ha | Unas 300 mil hectáreas de cultivo |
| La gente | 58,036 unidades de producción activas; 115,595 personas trabajan en ellas de planta, 52,589 de ellas productores que trabajan su propia unidad, más 57,273 puestos eventuales (INEGI 2022) | Más de 115 mil personas trabajan de planta en el campo |
| La identidad | 96 de cada 100 productores se consideran indígenas (INEGI 2022) | La milpa es la forma maya de trabajar la tierra |
| La materia prima de la comida | Maíz blanco, principal cultivo anual (47.5 mil t); pasto cultivado, principal perenne (946.1 mil t); 381,535 bovinos, 1.6 millones de porcinos y 38 millones de aves en unidades de producción (388,399 bovinos con los de traspatio); 8.4 mil litros de leche al día (INEGI 2022) | La tortilla, la carne, la leche y el alimento del ganado salen de esa tierra |
| El dinero que entra | La carne fue la 2.ª exportación de Yucatán en 2023: 329 millones de dólares (Secretaría de Economía) | El ganado yucateco se vende al mundo |
| El crecimiento | El sector primario creció 9.3 % en el primer semestre de 2025, el mayor aumento desde 2004 (Por Esto, con datos de INEGI) | Es un sector vivo |
| La fragilidad | 81.3 % de la superficie agrícola es de temporal; solo el 2 % de las unidades obtuvo crédito; 50.7 % de los productores solo estudió la primaria (INEGI 2022) | Si se pierde una cosecha, no hay con qué recuperarse |
| El riesgo | 46 % de los incendios forestales empezaron por actividades del campo (220 de 481); 204 por quema para preparar la siembra (CONAFOR 2015–2024) | La herramienta que da de comer también puede quemarlo todo |

## 2. Dónde está el fuego: el top 10 vive del campo

Los 10 municipios con más focos (VIIRS S-NPP, 2012–2025) tienen producción agropecuaria:
9 viven por completo del campo y Valladolid, en parte. Ninguno es una ciudad como Mérida.

| # | Municipio | Fuego al año (cuadritos-día) | Producción agropecuaria | Población 2020 (cabecera) | Incendios CONAFOR 2015–2024 (por el campo) |
|---|---|---|---|---|---|
| 1 | Tizimín | 863 | Total. Carne, leche y queso; el mayor hato del estado (CICY) | 80,672 (52,593) | 65 (34) |
| 2 | Tekax | 423 | Total. Milpa | 45,062 (28,461) | 89 (42) |
| 3 | Yaxcabá | 347 | Total. Milpa | 16,350 (3,310) | 14 (9) |
| 4 | Chemax | 268 | Total. Maíz y frijol; bovinos y porcinos | 38,934 (17,502) | 58 (32) |
| 5 | Valladolid | 222 | Parcial. Maíz, hortalizas y bovinos, más comercio y turismo | 85,460 (56,494) | 14 (9) |
| 6 | Peto | 214 | Total. Maíz, frijol, chile y sandía; bovinos y porcinos | 25,954 (21,456) | 0 |
| 7 | Espita | 193 | Total. Maíz y ganado bovino | 16,779 (12,320) | 0 |
| 8 | Tzucacab | 185 | Total. Milpa | 15,346 (10,879) | 43 (38) |
| 9 | Buctzotz | 183 | Total. Ganadero (CICY) | 9,159 (7,973) | 0 |
| 10 | Panabá | 157 | Total. Ganadero | 7,766 (5,318) | 0 |

- **Dos regiones.** El oriente ganadero (Tizimín, Espita, Buctzotz, Panabá) quema para abrir y
  renovar potreros. El sur y centro milperos (Tekax, Yaxcabá, Peto, Tzucacab, Chemax) queman
  para sembrar.
- **Concentran el problema.** Suman el 44 % del fuego que ve el satélite, el 59 % de los
  incendios forestales del estado (283 de 481) y el 53 % de las hectáreas quemadas (35,524 de
  67,512).
- **La causa es el campo.** El 58 % de sus incendios forestales (164 de 283) empezó por
  actividades del campo, casi siempre por quema para preparar la siembra.
- **Lo que solo ve el satélite.** Peto, Espita, Buctzotz y Panabá no tienen ningún incendio
  forestal registrado: su fuego es de quema agrícola y de potreros, que no entra en la
  estadística forestal.
- **Mérida, para comparar:** lugar 19 en fuego total y 77 de 106 por km²; ninguno de sus 6
  incendios de CONAFOR fue por el campo. Por km², los que más arden son pueblos milperos chicos:
  Mayapán, Chacsinkín, Kantunil y Mama.

## 3. El problema

El municipio tiene la obligación legal de autorizar las quemas y evaluar su temporada, pero no
sabe dónde ni cuándo se quema; cuando el fuego se escapa, pierde la misma gente del campo.

1. **La ley obliga al municipio, pero lo deja sin datos.** La Ley de Prevención y Combate de
   Incendios de Yucatán (última reforma de 2019):
    - el presidente municipal autoriza cada quema (art. 16);
    - el permiso exige guardarrayas de 3 m y aviso a los vecinos 5 días antes (art. 18);
    - al cierre de la temporada, el municipio entrega a SEDER un informe con propuestas de
      mejora (art. 23);
    - el calendario del año siguiente debe tomar en cuenta esa evaluación (art. 25);
    - cada municipio debe integrar un Comité Municipal (art. 39).
2. **Lo que se registra no se parece a lo que pasa.** En 2023 hubo 187 permisos de quema contra
   8,757 focos vistos por el satélite: un permiso por cada 47 focos.
3. **La ventana oficial no coincide con cuándo se quema.** En las zonas donde se quema cada año,
   solo 1 de cada 4 fuegos cae en la ventana oficial de su zona (en todo el estado, 19 % en 2025).
   La ventana dice cuándo está permitido quemar, no cuándo se quema. En Muna cierra el 3 de abril
   y los campesinos empiezan a quemar en abril.
4. **No hay con qué comparar.** MODIS y VIIRS ven entre 3 y 5 veces distinta cantidad de fuego.
   Sin calibrarlos, no existe una historia larga para saber qué es lo normal.
5. **Las pérdidas caen en la gente del campo.** Oxkutzcab, 2022: una quema de maleza que se
   salió de control acabó con 15 ha de limón persa. Sucopó, Tizimín, 2021: un campesino quemó
   solo y el fuego dañó 3 parcelas y más de 35 ha, incluidas las de sus vecinos. En 2024 se
   quemaron 20,334 ha en el estado, unas 28,000 canchas de fútbol. Y es gente sin colchón: 8 de
   cada 10 hectáreas dependen de la lluvia y solo 2 de cada 100 unidades de producción
   obtuvieron crédito.

## 4. La solución: el calendario del fuego de cada municipio

**El calendario es el centro de K'áak'.** Tiene dos escalas. Para el municipio, la serie
armonizada de MODIS y VIIRS (25 años) dice si su temporada va peor o mejor que lo normal, semana
a semana. Para cada zona, 14 años de VIIRS (2012–2025) dicen en qué semanas se quema de verdad,
contra la ventana oficial; ahí se usa solo VIIRS porque MODIS no ve los fuegos chicos (docs/02,
tarea 6). Es el mismo calendario que el abuelo de Leo tiene en la cabeza para su parcela, pero
para todo el municipio.

Al elegir un municipio se abre su mapa ampliado:

| Capa | Qué muestra | Qué decide el municipio | Cuándo |
|---|---|---|---|
| **Calendario de cada zona** | Las 4 semanas en que más se quema cada zona, junto a la ventana oficial | Cuándo vigilar cada zona y qué fechas proponer a SEDER | Marzo a mayo, y al cierre |
| Zonas de quema | Donde se quema casi cada año | A qué zonas ir a promover permisos, guardarrayas y la junta de dueños | Diciembre a febrero |
| Zonas de escape | Donde el fuego ya se salió de control (fuegos de 5 días o más) | Dónde poner la vigilancia fuerte | En temporada |
| Cierre de temporada | La temporada contra lo normal, los fuegos largos y la ventana real contra la oficial | Qué poner en el informe del art. 23 | Junio |

**Para quién:** la Protección Civil municipal o quien designe el presidente municipal (art. 5,
fracc. VI), con el Comité Municipal (art. 39). Primero los municipios del campo. Piloto: Tekax
para la evidencia (21 fuegos largos en 8 de 15 años) y Muna para la historia del abuelo.

**Por qué funciona** (`analisis/campo_y_fuego.py`):

- **En las zonas de quema, las 4 semanas históricas de cada zona atrapan el 49 % del fuego del
  año siguiente; la ventana oficial, el 23 %.** Es el doble, y se repite cada año (entre 45 y 55 %,
  de 2019 a 2025). En las zonas 1 y 2 de SEDER la ventana dura 46 y 42 días, más que esas 4
  semanas, y aun así atrapa menos. Se mide en las zonas de quema, no en todo el fuego del estado.
- Las zonas de quema reciben el 46 % de la quema del año siguiente y ocupan el 23.5 % de la
  tierra.
- Los fuegos de 5 días o más separan los años malos: 40 en 2024 contra 1 a 9 en un año normal.
  Coinciden con un incendio de CONAFOR el 31 % de las veces; los de 3 días, el 8 %.
- 22 de 79 fuegos de 5 días o más (2019–2025) empezaron a 2 km o menos de uno de años
  anteriores, en una franja que es el 6 % de la tierra (sin 2024: 7 de 39).

**Qué no hace:** no predice incendios, no avisa en tiempo real (llega horas después de la pasada
del satélite) y no identifica parcelas ni personas: un cuadrito mide 1 km y abarca muchas.

**Prototipo:** existe una vista de prueba con datos reales (mapa por municipio, zonas donde se
repite el fuego, fuegos largos y lista diaria); todavía no está en el repo (tarea 7).

## 5. Bloque del campo para el pitch

Unos 50 segundos, entre «El abuelo» y «El problema, a escala del estado» en la versión de 3
minutos (docs/es/03-guion.md, «Bloque del campo»). Para no pasarse de tiempo, se dice solo la
primera y la última frase de cada párrafo.

**Qué es el campo.** En Yucatán, 4 de cada 10 hectáreas son campo. Ahí trabajan de planta más
de 115 mil personas, y más de 9 de cada 10 productores se consideran indígenas. De esa tierra
sale la materia prima de lo que comemos: el maíz de la tortilla, el pasto del ganado, la leche, los cítricos y la carne, que
es el segundo producto que Yucatán más vende al extranjero.

**Dónde está el fuego.** Revisamos los 10 municipios con más fuego del estado. Los 10 viven del
campo: el oriente ganadero, como Tizimín, Panabá y Buctzotz, y el sur milpero, como Tekax,
Yaxcabá y Peto. Ninguno es una ciudad como Mérida. Esos 10 municipios suman casi 6 de cada 10 incendios
forestales del estado.

**Por qué prevenir.** Para sembrar se quema: es su herramienta de trabajo. Pero cuando el fuego
se escapa, el que pierde es la misma gente del campo. En Oxkutzcab, una quema de maleza que se salió
de control acabó con 15 hectáreas de limón persa. Y es gente que no tiene con qué
recuperarse: 8 de cada 10 hectáreas dependen de la lluvia, y solo 2 de cada 100 unidades de
producción obtuvieron crédito.

**Conclusión.** Prevenir un incendio en Yucatán no es solo cuidar el monte. Es cuidar el trabajo
y la comida de la gente del campo, que en su gran mayoría se considera indígena, y la materia
prima de toda la cadena alimentaria del estado.

**El calendario, en una frase:** «En las zonas donde se quema cada año, solo 1 de cada 4 fuegos
cae en la ventana oficial; la mitad cae en 4 semanas que se repiten año con año. Eso le sirve a
SEDER y a los municipios para planear.»

**En una línea:** K'áak' le dice a cada municipio de Yucatán dónde y en qué semanas se quema su
territorio, con datos de satélite de la NASA, para que prevenga incendios en el lugar y el
momento correctos.

## 6. Plan de implementación

| # | Tarea | Esfuerzo | Terminada cuando |
|---|---|---|---|
| 1 | Problemática y pitch con el municipio como usuario y el bloque del campo | Bajo | docs/03 tiene el bloque y cada cifra sale de docs/01 |
| 2 | **Calendario de cada zona**: las 4 semanas históricas más fuertes de cada mancha, junto a la ventana oficial | Medio | Cada mancha de Tekax muestra sus semanas; la prueba hacia adelante da cerca de 49 % |
| 3 | Mapa ampliado con zonas de quema: cuadritos con fuego en 4 o más de 14 temporadas, en manchas ordenadas | Medio | Al elegir Tekax se ven sus manchas y las 5 primeras con coordenadas |
| 4 | Capa de zonas de escape: fuegos conectados de 5 días o más, con franja de 2 km | Bajo | Tekax 2024 muestra sus fuegos largos sobre las zonas de 2012–2023 |
| 5 | Filtrar fuentes de calor fijas en los focos recientes (cuadritos que FIRMS marcó type 2) | Bajo | Se sabe si los 3 fuegos largos de Mérida fuera de temporada son fuentes fijas |
| 6 | Hoja de cierre para el informe del art. 23, a partir de la ficha | Medio | La hoja cabe en una página y se comparte por WhatsApp |
| 7 | Pasar los cálculos de `analisis/campo_y_fuego.py` al pipeline | Medio | La página muestra las mismas cifras que el script |
| 8 | Enseñárselo a una persona: el comisario ejidal de Muna o Protección Civil de Tekax | Variable | Una frase suya para el pitch |
| 9 | Después del hackatón: localidades y uso de suelo de INEGI; repetir las pruebas con NOAA-20 | Medio | Cada mancha dice su localidad más cercana |

## 7. Lo que no hay que decir

| No decir | Por qué |
|---|---|
| «El agropecuario es el segundo sector de la economía» o «el 63 % de la economía alimenticia» | No encontramos fuente |
| «Medio millón de hectáreas agrícolas» | Son 300 a 436 mil, según la fuente |
| «El campo bajó 24 % desde 2022» | El censo y la encuesta miden distinto |
| «El 80 % de las quemas son ilegales» | Fuera de ventana no es ilegal |
| «Predecimos incendios» o «tiempo real» | No es lo que hace |
| «La SEDER se equivoca» o «el calendario oficial atina a 1 de cada 4» | La ventana dice cuándo está permitido quemar, no intenta adivinar cuándo hay fuego |
| «25 años» para el calendario de cada zona | Son 14 años de VIIRS; los 25 años son la serie armonizada del municipio |
| «Indígenas mayas» o «familias mayas» | INEGI dice que los productores «se consideran indígenas» |
| «El reto pide un calendario» | No pudimos abrir la página del reto para confirmarlo; el calendario es la forma en que K'áak' usa la armonización |

Límites y pendientes: en docs/01, «El campo de Yucatán» y «Pendiente de verificar».
