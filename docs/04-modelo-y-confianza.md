# El modelo de K'áak': ecuaciones, comparación de modelos y nivel de confianza

Lo construyen Gadiel (calibración) y Nico (validación). Guille escribe el modelo en `docs/05-modelo.md` y lleva los resultados a la
página, a docs/01 y al guion.

## Por qué

- No tenemos un modelo matemático formal. El
  método existe y funciona, pero está escrito en prosa (docs/02, «Método»).
- «Validez» es uno de los cinco criterios de los jueces: «¿es científicamente
  válido? ¿hace lo que promete?».
- Cada cosa que digamos tiene que llevar con qué seguridad la podemos decir, y hay que
  decirlo.
- El trabajo de Gadiel y Nico tiene que llegar a la página, a docs/01 y al pitch antes del
  domingo. Si no llega, se pierde.

## Metas

1. **El modelo escrito** (`docs/05-modelo.md`): notación, ecuaciones, supuestos con su fuente
   y cómo se comprueba cada uno.
2. **Comparación de cinco modelos** con la misma prueba a ciegas y la misma regla, fijada
   antes de correrla.
3. **Un intervalo de 95 % para cada factor.**
4. **Un nivel de confianza para cada cifra** de la página y del guion, dicho con palabras
   calibradas.
5. **La gráfica de la prueba a ciegas** en «Cómo lo medimos» y en una lámina del pitch.

## Fuera de alcance hasta el domingo

Convertir a hectáreas (estilo GFED5NRT), usar la energía del fuego (FRP), un modelo bayesiano
de fuego oculto, aprendizaje automático, corregir por el ángulo de visión del satélite y
promediar S-NPP con NOAA-20. Quedan en `docs/05-modelo.md` como trabajo futuro, con su razón.

## Lo que sería un fracaso aunque funcione

- Que las cifras de la página cambien el domingo.
- Cambiar un criterio después de ver los números.
- Decir que «nos basamos en GFED5NRT»: el método se escribió antes de leer GFED5NRT. Lo cierto es «usamos la misma familia de método que GFED5NRT».
- Presentar una decisión razonable (heurística) como si fuera un resultado probado.
- Un trabajo que no llega a `main` antes del corte: se pierde. Por eso cada tarea deja algo
  que sirve solo, aunque la siguiente no se termine.

## Restricciones

- **Dos cortes protegen el alcance:**
  - **Corte 1, sábado 14 nov a las 14:00:** comparación de modelos, intervalos y pruebas
    integrados en `main`. Es una hora antes de la mentoría de las 15:00, donde se muestra la
    calibración.
  - **Corte 2, sábado 14 nov a las 20:00:** página, docs/01 y lámina con los resultados.
  - **Domingo:** nada nuevo. Solo ensayo y entrega a las 12:00.
- **La tarea 8 (cargador del kit) va primero.**
- **Una cifra = una fuente:** docs/01 o un archivo de `salidas/` que escriba el código.
- **Mismo protocolo de siempre:** una rama por tarea, PR a `main`, ruff y pytest en verde y
  la revisión de otra persona (Misa integra).
- **Sin dependencias nuevas.** Basta con numpy, pandas y scipy, que ya están en
  `requirements.txt`.
- **Nada cambia los archivos que ya lee la página** (`salidas/factores.csv`,
  `salidas/calendario.parquet`, `web/datos/`). Lo nuevo va en archivos nuevos.

## Enfoques considerados

| | Qué es | Por qué sí o por qué no |
|---|---|---|
| A. Escribir el modelo que ya corre | Ecuaciones y supuestos, sin cambiar números | Es la base. Solo no basta: el margen actual de cada factor (mínimo y máximo dejando fuera un año) no es un intervalo de confianza |
| **B. A, más incertidumbre y comparación de modelos (elegido)** | Intervalos por remuestreo, nivel de confianza en cada cifra y cinco modelos con la misma prueba | Responde al profesor y al criterio de validez, y cabe en un día con dos personas |
| C. Modelo bayesiano de fuego oculto | Todos los satélites estiman a la vez el fuego real de cada día | Cambia el método y las cifras a día y medio de la entrega |

Guille eligió B, extendido a cada cifra, y pidió comparar modelos. Los modelos que
se descartaron para el domingo, y su razón, están en «Comparación de modelos».

## El modelo (lo que va a `docs/05-modelo.md`)

### Notación

| Símbolo | Qué es |
|---|---|
| C(s, m, d) | Cuadritos de 1 km (0.01°) con fuego que vio el satélite s en el municipio m el día solar local d |
| σ(d) | El satélite del periodo de d: Terra hasta el 3 jul 2002, Aqua hasta el 19 ene 2012, S-NPP hasta el 2 nov 2026 y NOAA-20 después |
| z(m), e(d) | Zona de quema del municipio y época del día (temporada de marzo a mayo, o resto del año) |
| k(s, z, e) | Factor del satélite s en la zona z y la época e; para S-NPP vale 1 |

### Ecuaciones

```
k(s,z,e) = Σ_d C(S-NPP,z,d) / Σ_d C(s,z,d)   sumas sobre los días d de la época e
    Terra y Aqua: todos los días de 2013–2020 con fuego en alguno de los dos, menos los
                  días hueco (un satélite con 0 y el otro con 50 o más en la península)
    NOAA-20:      toda la península, del 1 abr 2018 al 1 nov 2026, solo días en que los
                  dos tienen al menos un cuadrito (días comunes)
    Un factor con menos de 100 cuadritos-día (débil) se reemplaza por el de la misma
    época con todas las zonas juntas
Y(m,d)   = k(σ(d), z(m), e(d)) · C(σ(d), m, d)            serie armonizada
W(m,a,w) = Σ Y(m,d) de los días d de la semana w del año a
A(m,a,w) = Σ W(m,a,w') para w' = 1…w                       acumulado del año
Pq(m,w)  = percentil q de { A(m,a,w) : a = 2001…2025 },  q = 10, 50, 90
veredicto(m,a,w) = «casi no hay fuego»  si P90(m,w) < 5
                   «por encima»          si A > P90
                   «por debajo»          si A < P10
                   «dentro de lo normal» en otro caso
```

### Por qué el factor es un estimador y no una regla de tres

El supuesto es que, en una zona y una época, cada satélite ve una fracción fija del mismo
fuego del día, aunque ese fuego cambie de un día a otro y no lo conozcamos:

```
S_d ~ Poisson(p_S · λ_d)     A_d ~ Poisson(p_A · λ_d)     k = p_S / p_A
```

Dado el total N_d = S_d + A_d, S_d sigue una binomial con π = p_S / (p_S + p_A), que no
depende de λ_d. Maximizar la verosimilitud condicional da π̂ = ΣS / ΣN, es decir
k̂ = ΣS / ΣA: el factor que ya usamos. Si los conteos están más dispersos que una Poisson, o
si los dos satélites ven el mismo fuego (y por eso sus conteos van juntos), el estimador
sigue apuntando al valor correcto, pero la varianza de la binomial ya no sirve. Por eso los
intervalos se sacan por remuestreo.

El argumento vale tal cual para la regla de Terra y Aqua, que usa todos los días. La de
NOAA-20 solo usa días comunes, y elegir días según lo que vieron los dos es condicionar la
muestra. Con un factor de 0.99 el efecto es mínimo, y la Prueba 4 de Nico lo revisa por su
cuenta; `docs/05` trata los dos casos por separado.

### Supuestos

Cada supuesto dice en qué se basa y cómo se comprueba. La columna «Tipo» separa lo que tiene
fundamento físico o estadístico de lo que es una decisión razonable sin prueba formal
(heurística).

| # | Supuesto | Tipo | En qué se basa | Cómo se comprueba |
|---|---|---|---|---|
| S1 | Cada satélite ve una fracción fija del fuego, por zona y época | Física y estadística | La detección depende del tamaño del fuego. En los datos de CONAFOR (docs/01), S-NPP ve 3.6 veces lo que ve MODIS en incendios de 0 a 5 ha y 1.2 veces en los de más de 100 ha | Prueba a ciegas 2021–2025. Además, si S1 se cumple, la parte de S-NPP en el total del día (π = S / (S + A)) no depende de cuánto fuego hubo: se calcula π por tercios de días según su total S + A y se ve si los tres coinciden. **La pendiente de la regresión (modelo 3) no sirve para esto**: con conteos ruidosos de los dos lados sale menor que 1 aunque la proporción sea fija (dilución por regresión) |
| S2 | La fracción no cambia de un año a otro | Supuesto comprobable solo hacia adelante | — | Margen dejando fuera un año (ya existe) y errores por año de la prueba a ciegas, incluido el −25 % de 2022. Ver «Lo que la prueba a ciegas no comprueba» |
| S3 | Zonas oficiales de quema y temporada de marzo a mayo como divisiones | Heurística | Calendario de quemas de SEDER (docs/01) | Factor único contra zona y época (13 % contra 11 % de error) |
| S4 | El cuadrito de 0.01° como unidad | Heurística | Quita la diferencia de tamaño de píxel (docs/02) | Fuera de alcance este fin de semana; queda dicho como decisión |
| S5 | Un satélite por periodo | Decisión | Sumar satélites inflaría la serie | — |
| S6 | Lo normal son los percentiles 10, 50 y 90 de 25 años | Heurística | Práctica de climatología (fuente por verificar) | Nivel de confianza del veredicto (ver «Nivel de confianza») |
| S7 | Día en hora solar local | Física | Hora de paso de cada satélite (docs/02) | — |

Las fuentes de `docs/05` que no estén comprobadas al escribirlo se marcan «por verificar» y
no se dicen en el pitch.

## Comparación de modelos

### La prueba (la misma para todos)

- Cuadritos-día de Aqua y de S-NPP en días comunes y sin días hueco, como en la Prueba 2 de
  Nico (`validar.celdas_aqua`, rama `nico/7-validacion`).
- **Se calibra con 2013–2020 y se mide con 2021–2025.** Ningún modelo ve 2021–2025 al
  ajustarse.
- **Unidad de evaluación:** la celda año × zona × época (60 celdas), igual que la Prueba 2.
  Los modelos que trabajan por semana suman sus semanas hasta esa celda.
- **Cómo se aplica cada modelo:** sus parámetros se ajustan por zona y época, y se aplican a
  lo que vio Aqua en cada municipio y semana, que es como los usaría la página. Para el WAPE
  se suman los municipios y las semanas hasta la celda.

### Lo que la prueba a ciegas no comprueba

- **Va hacia adelante y la serie usa los factores hacia atrás.** La prueba mide 2021–2025,
  pero los factores de Aqua se aplican a 2002–2012, donde no hay VIIRS para comparar. Hacia
  atrás, la evidencia es indirecta: el salto de 2012 desaparece. Además, desde 2022 la órbita
  de Aqua se desvía, así que la prueba es más dura que el uso real.
- **Terra (2001–2002) no tiene ninguna prueba.** Sus factores van de 4.0 a 9.7 y uno es
  débil. Se dice así en `docs/05` y se mide si algún veredicto cambia al calcular lo normal
  sin 2001 ni 2002 (tarea 35). La página no cambia por eso este fin de semana.

### Los modelos

| # | Modelo | Qué predice para S-NPP |
|---|---|---|
| 0 | Sin convertir | Lo que vio Aqua, tal cual (es la línea base) |
| 1 | Factor único | Aqua × un factor para toda la península |
| 2 | Zona × época (el actual) | Aqua × k(Aqua, z, e) de `salidas/factores.csv` |
| 3 | Regresión logarítmica | Por zona y época, en celdas semanales de 2013–2020: log(S+1) = a + b·log(A+1). Es solo un competidor para predecir: su pendiente no se interpreta (ver S1). La corrección al volver de logaritmos la elige quien lo construye, y la documenta |
| 5 | Mapeo de cuantiles | Por zona y época, la distribución de las semanas de Aqua de 2013–2020 se lleva a la de S-NPP. Es la técnica que se usa para unir sensores de humedad del suelo y para corregir series de lluvia diaria. Quien lo construye decide cómo tratar las semanas en cero, y lo documenta |

**Los que no entran, y por qué:**
- **Modelo de conteo con variables (Poisson o binomial negativa):** sin variables extra da el
  mismo factor que el modelo 2, y sus intervalos los da el remuestreo sin dependencias nuevas.
- **Probabilidad de detección según el tamaño:** necesita la distribución de tamaños de las
  quemas agrícolas, que no tenemos.
- **Aprendizaje automático:** con 8 años de calibración puede memorizar en vez de aprender, y
  no se puede defender ante un profesor.
- **Estilo GFED5NRT y energía del fuego:** cambian la unidad o la pregunta.

### Métricas

- **Decide:** el error porcentual ponderado (WAPE) sobre las 60 celdas, la métrica que Nico
  congeló antes de ver datos reales (docs/02, tarea 7).
- **Se reportan:**
  - el sesgo, en porcentaje;
  - el R² y el Taylor skill score (Taylor, 2001). Quien lo construye dice qué ecuación de
    Taylor usó. Se reportan también para el modelo 0, porque en 60 celdas los dos salen
    altos solo por la diferencia entre zonas y épocas. **No se comparan con GFED5NRT**: ellos
    miden superficie quemada en otra rejilla, y la comparación no es válida;
  - el error de cada año;
  - el acuerdo del veredicto (ver abajo).
- **Acuerdo del veredicto (lo que ve el usuario):**
  - se calcula para cada municipio y año de 2021 a 2025, con el acumulado a la semana 22
    (fin de mayo);
  - la banda de lo normal se recalcula con 2001–2020, sin los años de la prueba, para que
    S-NPP no se compare contra una banda que él mismo ayudó a formar;
  - el veredicto se saca dos veces contra esa banda: una con lo que vio S-NPP y otra con
    Aqua convertido por el modelo;
  - solo entran los municipios que no caen en «casi no hay fuego». Se dice cuántos
    quedaron fuera;
  - se reportan el porcentaje de coincidencia y la kappa ponderada (pesos lineales), porque
    «por debajo», «dentro» y «por encima» van en orden;
  - **el veredicto «se sostiene» si la kappa es de 0.6 o más** («acuerdo sustancial»,
    Landis y Koch, 1977). Si no llega, `docs/05` dice que el veredicto municipal de los años
    de MODIS es menos firme, y la frase de 2003 («80 de los 106 municipios por encima») ya
    no se dice como hecho.

### Regla de decisión (fijada hoy, antes de correr los modelos 3 y 5)

1. Un modelo **pasa** si su WAPE es de 25 % o menos: el criterio congelado de Nico.
2. Un modelo nuevo (3 o 5) **gana** al 2 si cumple las dos condiciones:
   - su WAPE mejora 5 % o más, en términos relativos, sobre el del modelo 2;
   - su kappa del veredicto no baja más de 0.05.
3. **Este fin de semana, ganar solo se reporta.** La serie, la página y sus cifras siguen con
   el modelo 2, porque `serie.armar_serie` solo sabe multiplicar por un factor, y cambiarla
   el sábado pondría en riesgo todas las cifras de la página. La frase sería: «El mapeo de
   cuantiles mejora X %; es lo siguiente que adoptaríamos».
4. Con 60 celdas, una mejora del 5 % puede caer dentro del ruido. El margen se queda como está
   porque ya se fijó, y `docs/05` lo dice.

### Lo que ya se sabe (corrida de prueba)

La Prueba 2 de Nico, corrida con los factores de `main`:
- **Error total:** WAPE de 11.3 % con el modelo 2 y de 13.0 % con el factor único. La mejora
  relativa es de 13.6 %.
- **Por año:** −5 % en 2021, −25 % en 2022, −1 % en 2023, +11 % en 2024 y −5 % en 2025.
- **Sin convertir,** Aqua ve cerca de 1 cuadrito por cada 3.6 de S-NPP en 2013–2020.

Estas cifras no se dicen hasta que estén en `salidas/validacion.json`. Son de la corrida con
los datos de `main`. Si el kit de la sede (tarea 8) cambia los focos con los que se
calcula, el PR lo dice, se vuelve a correr todo y las cifras nuevas reemplazan a estas. El
criterio de 25 % no cambia.

## Nivel de confianza

### Intervalos de los factores

- **Remuestreo de años completos:** se sortean, con reemplazo, los años del periodo de
  calibración de cada satélite (los 8 de 2013–2020 para Terra y Aqua; los años completos de
  2018–2025 para NOAA-20), se recalculan los 26 factores con las reglas exactas de
  `armonizar.py` (días hueco, días comunes y reemplazo de los débiles), y se repite 2,000
  veces. Los intervalos son los percentiles 2.5 y 97.5.
- **Por qué años y no días:** el factor cambia de un año a otro (el margen dejando fuera un
  año ya llega de 3.96 a 6.56 en Yucatán 1, fuera de temporada). Si se sortearan días o
  semanas, los intervalos saldrían angostos y todo parecería «prácticamente seguro» justo
  donde el profesor va a preguntar. Con solo 8 años los intervalos son gruesos, y eso se dice.
- **Archivos nuevos:**
  - `salidas/factores_ic.csv`: zona, época, satélite, factor, `ic95_min` e `ic95_max`;
  - `salidas/factores_bootstrap.parquet`: las 2,000 réplicas de los 26 factores, sacadas
    juntas para conservar cómo se mueven unos con otros.
- **No se toca `salidas/factores.csv`.** Su margen dejando fuera un año (`factor_min`,
  `factor_max`) se sigue reportando al lado.

### Nivel de confianza de cada cifra

Cada cifra tiene un identificador, su valor, su intervalo o su «se sostiene en N de cada
100», su método y, si aplica, su palabra. Todo eso va en `salidas/confianza.json`. Hay dos
clases de cifra: las que son un valor (llevan intervalo) y las que afirman algo (llevan «se
sostiene en N de cada 100»). La columna «Lo que tiene que sostenerse» dice qué afirmación se
cuenta.

| Cifra (docs/01) | Método | Lo que tiene que sostenerse |
|---|---|---|
| CONAFOR: S-NPP vio el 53 % (651 de 1,222) | Intervalo de Wilson. Calculado: entre 50.5 y 56.1 % | Valor. Supone incendios independientes y no incluye la regla de 2 km y ±1 día; se dice en una línea |
| CONAFOR: el 84 % de los de más de 100 ha (331 de 395) | Wilson: entre 79.8 y 87.1 % | Valor, con la misma nota |
| NOAA-20 ve 0.99 por cada foco de S-NPP | Intervalo del factor | Valor |
| Salto de 2012: ×3.0 sin calibrar y ×0.93 calibrado | Propagación (abajo) | Que la razón calibrada caiga dentro del rango natural de los años de solo S-NPP (la regla de `serie.razones_salto`) |
| 2026, la temporada más baja desde 2001 | Propagación | Que 2026 siga siendo la más baja |
| 2026 por debajo de lo normal (2,883 contra 6,712) | Propagación | Que 2,883 quede por debajo de la mediana; 6,712 lleva además su intervalo |
| 96 de 106 municipios por debajo de lo normal | Propagación | Valor: intervalo del conteo |
| Tekax: 191 contra 390 de un año normal | Propagación | Que 191 quede por debajo de la mediana; 390 lleva su intervalo |
| Tekax: 8 de cada 10 focos después del 3 de abril | Remuestreo de años completos | Valor |
| Fuera de fecha por zona en 2026; 19 % dentro de la ventana en 2025 | Remuestreo por bloques de días | Valor |
| Error de 11 % en la prueba a ciegas | No se propaga: variar los factores no mide la incertidumbre de un error medido en 5 años | Se dice con el rango por año (de −25 % a +11 %) y sin palabra de confianza |
| 2,883 focos en 2026 | Conteo completo de lo que vio el satélite | Sin intervalo. Su límite se dice: el satélite ve un poco más de la mitad de los incendios que registra CONAFOR |

**Propagación:** se arma la serie con `serie.armar_serie(cuadritos, catalogo, factores)` usando
200 de las 2,000 réplicas de los factores (unos 4 s cada una), y se cuenta en cuántas se
sostiene cada afirmación. La función ya acepta los factores como argumento, así que
`serie.py` no cambia. Lo que mide es la incertidumbre de los factores, incluida la que hay
entre años; el error de la prueba a ciegas se dice aparte. Con 200 réplicas, «99 de cada 100»
exige 198 o más.

**Palabras** (escala del IPCC, Mastrandrea et al., 2010; se verifica antes de citarla):

| Se sostiene en | Palabra |
|---|---|
| 99 o más de cada 100 | prácticamente seguro |
| 90 a 98 | muy probable |
| 66 a 89 | probable |
| menos de 66 | no se dice como hecho |

En el pitch se dice la frecuencia («en 99 de cada 100 simulaciones»), que es el principio de
frecuencias naturales de la spec de la página. La palabra resume esa frecuencia.

**El mapa y la ficha no cambian este fin de semana.** Darle nivel de confianza al veredicto de
cada municipio pediría una tabla por municipio y semana que cambia cada día, textos nuevos en
los dos idiomas y cambiar archivos que ya lee la página. Todo eso choca con los cortes. El
nivel de confianza vive en «Cómo lo medimos», en docs/01 y en el guion. Cuántos municipios
siguen «por debajo» en las réplicas se dice con la cifra de 96 de 106.

## Dónde llega cada resultado

| Archivo | Lo escribe | Lo usa |
|---|---|---|
| `salidas/validacion.json` (las cuatro pruebas) | Nico | docs/01, guion y «Cómo lo medimos» |
| `salidas/factores_ic.csv` y `salidas/factores_bootstrap.parquet` | Gadiel | Propagación, docs/05 y «Cómo lo medimos» |
| `salidas/benchmark.json`: métricas de los cinco modelos y la serie mensual de la prueba a ciegas | Nico | Gráfica y tabla en «Cómo lo medimos», y lámina del pitch |
| `salidas/confianza.json` | Nico, con las réplicas de Gadiel | docs/01 (columna de nivel), página y guion |
| `docs/05-modelo.md` | Guille | Profesor, jueces y preguntas |

## Tareas (se agregan a docs/02 como 31 a 36)

El orden importa: cada tarea deja algo que sirve aunque la siguiente no se termine.

| # | Tarea | Quién | Horas | Depende de | Terminada cuando |
|---|---|---|---|---|---|
| 31 | Abrir el PR de las cuatro pruebas (`nico/7-validacion`), con `salidas/validacion.json`, frases y gráficas | Nico | 2 | — | Está en `main` con la Prueba 2 dando el mismo WAPE de arriba |
| 32 | Intervalos de los factores por remuestreo de años completos | Gadiel | 2 | — | `factores_ic.csv` y las réplicas en `main`; cada factor queda dentro de su intervalo; las reglas de `armonizar.py` se reusan, no se copian |
| 33 | Comparación de modelos 0, 1 y 2 con todas las métricas (incluida la kappa), la serie mensual de la prueba a ciegas y la revisión del −25 % de 2022 | Nico | 3 | 31 | `benchmark.json` en `main` con las métricas y la regla aplicada |
| 34 | Modelos 3 y 5, que reciben lo que vio Aqua por municipio y semana y devuelven S-NPP predicho, y la prueba de S1 por tercios | Gadiel | 3 | 32 | Los dos entran en `benchmark.json` y la regla dice si alguno gana al 2; π por tercios queda en el mismo archivo |
| 35 | Propagación: nivel de confianza de las cifras que dependen de los factores, y cuántos veredictos cambian si lo normal se calcula sin 2001 ni 2002 | Nico | 2 | 32 y 33 | `confianza.json` con esas cifras |
| 36 | Intervalos de las proporciones (Wilson y remuestreo de años o días) | Nico o Gadiel, el que termine antes | 2 | — | Esas cifras en `confianza.json` |
| — | `docs/05-modelo.md`, docs/01 con la columna de nivel, «Cómo lo medimos» y la lámina | Guille (la lámina, con Melany) | 4 | 31 a 36 | Corte 2 |

- **Horas:** son 9 o 10 por persona entre el viernes a las 22:00 y el corte 1. Si no
  alcanzan, el orden de corte es 36, 35 y 34. Con 31, 32 y 33 en `main` ya hay modelo,
  intervalos, prueba a ciegas y la gráfica.
- **El −25 % de 2022 lo investiga la tarea 33:** días de Aqua y de S-NPP con datos en 2022,
  días hueco y error por zona y época. Si no se encuentra la causa, se dice tal cual.

## Lo que queda a criterio de quien construye

- Cómo se organiza el código (archivo nuevo o funciones en `armonizar.py` y `validar.py`).
- La corrección al volver de logaritmos (modelo 3) y el trato de los ceros (modelo 5), siempre
  documentados en el PR.
- Las 200 réplicas de la propagación: cuáles se toman, siempre con semilla fija.
- El formato interno de los JSON, siempre que cada cifra lleve un identificador, su valor, su
  intervalo o su «N de cada 100» y su método.

## Decisiones que tomé y conviene revisar

- La métrica que decide es el WAPE ya congelado, no el acuerdo del veredicto, para no cambiar
  un criterio después de ver números.
- Un modelo nuevo gana con 5 % de mejora sin perder más de 0.05 de kappa, pero este fin de
  semana ganar solo se reporta: la serie y la página siguen con el modelo 2.
- La unidad sigue siendo «cuadritos-día». Las hectáreas quedan como trabajo futuro.
- El mapa y la ficha no llevan nivel de confianza este fin de semana.
- Los intervalos de los factores se sacan remuestreando años completos, no días, aunque
  salgan más anchos.
- El R² y el Taylor skill score se reportan, pero no se comparan con GFED5NRT.
- Terra se queda en la serie, con la nota de que no tiene prueba.

Revisión del diseño: un revisor independiente lo leyó antes de entregarlo. De ahí
salieron el remuestreo por años, la prueba de S1 por tercios en lugar de la pendiente de la
regresión, la banda sin los años de la prueba para la kappa, la regla de días de cada
satélite en la ecuación del factor, quitar la comparación con GFED5NRT y dejar el mapa como
está.
