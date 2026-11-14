# H1: satélite de respaldo en días sin datos

Plan del 14 nov (Gadiel, dueño de la calibración), aprobado con las decisiones de abajo e
implementado en la rama `gadiel/5-h1-respaldo`.

**Meta:** si el satélite del periodo no mandó datos un día, ese día se cuenta con su respaldo
y el factor del respaldo. Sigue habiendo un solo satélite por día, nunca dos sumados.

**Restricciones (spec del modelo, `guille/modelo-especificacion`):** sin dependencias nuevas;
no cambian `salidas/factores.csv` ni las columnas o tipos del calendario y de `web/datos/`;
nada cambia el domingo.

## El problema

La serie usa un satélite por día (Terra, Aqua, S-NPP y NOAA-20, docs/02). Si ese satélite no
mandó datos, el día contaba como cero fuego aunque otro satélite lo viera. La regla de días
hueco (`armonizar.dias_hueco`) solo se usaba al calcular los factores. Ejemplo: S-NPP vio 0
del 28 al 30 abr 2026, en el pico de la temporada, mientras NOAA-20 veía 407, 348 y 682.

## Decisiones (Gadiel, 14 nov)

| # | Decisión | Por qué |
|---|---|---|
| 1 | Implementar H1 (no el plan B de solo documentar) | La portada mostraba un 2026 incompleto y la frase del día pico era falsa |
| 2 | La caída de S-NPP de 2022 se reporta y **no** se rellena | Queda visible a propósito para explicarla; es fuera de temporada (unos 90 cuadritos) y la regla no la detecta |
| 3 | Umbral de 50 cuadritos-día | Es la regla de los días hueco de los factores: no es un criterio nuevo elegido después de ver los números |
| 4 | NOAA-21 fuera | En los datos nunca hace falta (siempre que S-NPP y NOAA-20 están en 0, NOAA-21 ve menos de 50); así no se toca `factores.csv` |
| 5 | Terra 2001 sin respaldo: se reporta | No cambia lo normal ni el contrato; qué hacer con esos días se decide después |
| 6 | Archivo nuevo `salidas/dias_sin_datos.csv` | Evidencia para jueces y para quien descargue la serie |
| 7 | Se pueden cambiar archivos de los compañeros (docs/01, pruebas de la página) | Para que las cifras queden consistentes en un solo PR |

## La regla

Un día no tiene datos si el satélite del periodo tiene **0 cuadritos-día en toda la
península** y su respaldo (S-NPP → NOAA-20, Aqua → Terra) tiene **50 o más**. Ese día se
cuenta con el respaldo y su factor. Se mira el día completo y la península completa: un
municipio sin fuego es normal; un satélite en 0 en toda la península mientras el otro ve 50 o
más casi solo pasa si faltan datos. Los días con datos a medias quedan fuera de alcance.

Las caídas que NASA confirma (S-NPP del 26 jul al 20 ago 2022; Terra del 15 jun al 2 jul 2001)
se reportan en `dias_sin_datos.csv` y no se rellenan.

## Dónde vive

- `armonizar.conteo_por_dia(cuadritos, satelites, desde, hasta)`: tabla día × satélite. La
  usan `dias_hueco()` (los factores no cambian) y la serie.
- `serie.RESPALDO`, `serie.CAIDAS_CONFIRMADAS`, `serie.dias_sin_datos(cuadritos, fin)` y
  `serie.elegir(cuadritos) -> (elegidos, huecos, fin)`. `armar_serie` y la página
  (`datos_web.elegidos_con_factor`) usan `elegir()`, así que cuentan lo mismo.
- `validar_tramos` revisa solo el satélite del periodo (un mes sin datos sigue deteniendo
  todo) y `fin` se calcula sin el respaldo (el respaldo no alarga la serie).
- Las revisiones «MODIS después de 2012» y «VIIRS antes de 2012» no cambian, porque el
  respaldo es de la misma familia.

## Pruebas

`tests/test_serie.py`, sección «Días sin datos»: el día se rellena con el respaldo y su factor
(S-NPP→NOAA-20 y Aqua→Terra); el umbral es 50 exacto; nunca dos satélites el mismo día; un
cuadrito de S-NPP en otro municipio basta para que el día no sea hueco; el umbral suma la
península y cuenta una vez los cuadritos de frontera; NOAA-21 nunca es respaldo; el respaldo
no alarga la serie; la caída de 2022 y Terra 2001 se reportan sin rellenarse; con los datos
reales, la lista exacta de días. Más `test_armonizar.py` (conteo por día) y
`test_datos_web.py` (la página elige lo mismo que la serie).

## Resultado (datos al 13 nov)

| Cifra | Antes | Después |
|---|---|---|
| Yucatán, mar–may 2026 | 2,883 | 3,320 (sigue siendo la más baja desde 2001) |
| Un año normal | 6,712 | 6,712 |
| Municipios por debajo de lo normal | 96 de 106 | 93 de 106 |
| Día con más fuego | 1 may, 653 | 30 abr, 682 (NOAA-20) |
| 2003 | 16,518; 80 de 106 por arriba | 16,850; 83 de 106 |
| Tekax | 191 contra 390 («muyabajo») | 213 contra 390 («abajo»; la frase sigue siendo «la mitad») |
| Zona 2 fuera de fecha | 43 % | 40 % |
| Salto de 2012 | ×3.0 y ×0.93 | igual |
| `factores.csv` | — | idéntico |

Días rellenados: 11 de S-NPP (30 may – 3 jun 2024, 10–12 mar 2026, 28–30 abr 2026) y 1 de Aqua
(12 may 2003). Reportados sin rellenar: 17 de S-NPP (2022) y 18 de Terra (2001).

## Efectos en el trabajo de otros

- **Nico:** las pruebas 2, 3 y 4 no cambian (no usan la serie). La Prueba 1 y la propagación
  (tarea 35) se vuelven a correr después de que esto entre a `main`.
- **Guille:** cifras nuevas para la lámina, la tabla de confianza y docs/08 (la sección de
  docs/01 «Días sin datos del satélite» trae el texto y las fuentes).
- **Melany:** el guion no cita cifras que cambien.

## Plan B (no se usó)

No tocar la serie; corregir la frase del 1 de mayo en docs/01 y documentar el límite.
