# Datos de la península (listos para usar)

Paquete de trabajo del equipo. Lo genera `analisis/preparar_peninsula.py` a partir de los
datos crudos (que no van a Git por su tamaño, ~900 MB). Datos hasta el 2026-11-07 (AAAA-MM-DD).

## Archivos

| Archivo | Qué es | Tamaño |
|---|---|---|
| `focos_peninsula.parquet` | Todos los focos de fuego de FIRMS en Yucatán, Campeche y Quintana Roo, de todos los satélites, con estado y municipio | 24 MB |
| `incendios_conafor_2015_2024.csv` | Incendios forestales registrados por CONAFOR en los tres estados (uno por fila: fecha, municipio, hectáreas, causa) | 0.4 MB |
| `estados_peninsula.geojson` | Límites de los tres estados (simplificados) | — |
| `municipios_peninsula.geojson` | Límites municipales (simplificados) | 1 MB |

**Zona de quema de cada municipio:** `analisis/municipios_zona.csv` (municipio, estado, zona y
ventana oficial de quema). Es la tabla que hay que usar para unir focos con zonas: ya corrige
los nombres que se escriben distinto (Dzán, Tixmehuac).

## Focos: columnas principales

| Columna | Significado |
|---|---|
| `acq_date`, `acq_time` | Fecha y hora UTC de la pasada del satélite (`acq_time` en formato HHMM) |
| `latitude`, `longitude` | Centro del píxel donde se detectó el fuego |
| `sensor` | `MODIS` (Terra y Aqua), `S-NPP`, `NOAA-20` o `NOAA-21` |
| `satellite` | `Terra` / `Aqua` en MODIS; `N` (S-NPP), `N20`, `N21` en VIIRS |
| `producto` | `SP` (procesamiento estándar, definitivo) o `NRT` (casi en tiempo real, lo más reciente) |
| `confidence` | MODIS: 0–100. VIIRS: `l` baja, `n` nominal, `h` alta |
| `type` | 0 = presunto incendio de vegetación, 2 = otra fuente fija en tierra, 3 = en el mar. Vacío en NRT |
| `frp` | Potencia radiativa del fuego (MW): qué tan intenso es |
| `daynight` | `D` día, `N` noche |
| `municipio` | Municipio donde cae el foco (límites de geoBoundaries) |
| `estado` | El estado de su municipio. Solo los focos que no caen en ningún municipio (0.2 %) toman el estado del mapa de estados |

**Filtro que usamos en las cifras de docs/01:** `type == 0` (o vacío en NRT) y confianza
nominal o alta (VIIRS `n`/`h`, MODIS ≥ 30).

El cálculo (`pipeline/cargar.py`) quita además los focos NRT sin `type` que caen en un cuadrito
de 0.01° donde FIRMS marcó alguna vez `type` 2: son fuentes fijas que llegaron sin marca (desde
julio de 2026 se colaban así las del suroeste de Mérida y las de Carmen).

## Cobertura por satélite

| Satélite | Desde | Hasta |
|---|---|---|
| MODIS (Terra) | 6 nov 2000 | 6 nov 2026 |
| MODIS (Aqua) | 4 jul 2002 | 5 nov 2026 |
| S-NPP | 20 ene 2012 | 2 nov 2026 (dejó de enviar datos ese día) |
| NOAA-20 | 1 abr 2018 | 7 nov 2026 |
| NOAA-21 | 1 mar 2023 | 7 nov 2026 |

## Cómo cargarlo (Python)

```python
import pandas as pd
focos = pd.read_parquet("datos_peninsula/focos_peninsula.parquet")
yuc = focos[(focos.estado == "Yucatán") & (focos["type"].fillna(0) == 0)]
viirs = yuc[yuc.sensor.isin(["S-NPP", "NOAA-20", "NOAA-21"]) & yuc.confidence.isin(["n", "h"])]
print(viirs.groupby(viirs.acq_date.dt.year).size())
```

Hace falta `pandas` y `pyarrow` (`pip install pandas pyarrow`).

## Cuidados

- **Un foco no es un incendio.** Un incendio grande produce muchos focos.
- **No sumes satélites VIIRS sin quitar duplicados**: ven el mismo fuego con minutos de
  diferencia.
- Los límites son aproximados (geoBoundaries usa un mapa municipal viejo). Faltan tres
  municipios creados hace poco: Puerto Morelos (Quintana Roo), y Seybaplaya y Dzitbalché
  (Campeche). Sus focos quedan en el municipio del que se separaron.
- Tzucacab (Yucatán) estaba asignado a Quintana Roo por un error del mapa de estados; se
  corrigió en `analisis/preparar_peninsula.py`.

## Fuentes y licencias

- **NASA FIRMS** (MODIS C6.1 y VIIRS C2, 375 m): datos abiertos de NASA. Citar «NASA FIRMS».
- **CONAFOR**, base de incendios forestales 2015–2024, vía datos.gob.mx (Libre Uso MX).
- **geoBoundaries** (Banco Mundial), municipios: CC BY 4.0, se debe citar.
- **Natural Earth**, estados: dominio público.
