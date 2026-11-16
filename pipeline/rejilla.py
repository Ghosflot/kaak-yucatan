"""Focos → cuadritos-día de 1 km, por satélite (tarea 2, docs/02).

Uso:
    from cargar import cargar_focos
    from rejilla import cuadritos_dia, contar
    c = cuadritos_dia(cargar_focos())
    contar(c, ["satelite", "anio"])

Un cuadrito es una celda de 0.01° (≈1.1 km): latitud y longitud redondeadas a dos
decimales. Un cuadrito-día es un cuadrito con al menos un foco ese día (hora solar local).
Así no importa que VIIRS vea en píxeles de 375 m y MODIS en píxeles de 1 km: un fuego que
VIIRS marca con varios focos dentro del mismo cuadrito cuenta una vez, igual que en MODIS.

Reglas:
- Cada satélite se cuenta por separado; nunca se suman (docs/02, "One satellite per
  period"). Por eso `satelite` va siempre en la clave.
- cuadritos_dia(): por municipio. Un cuadrito partido por la frontera de dos municipios
  cuenta una vez para cada uno (≈0.5 % más cuadritos-día), igual que el calendario de la
  tarea 1. Los focos sin municipio no entran.
- cuadritos_dia_peninsula(): sin municipio. Cada cuadrito cuenta una sola vez y entran
  todos los focos. Es para totales de toda la península.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# El cuadrito se calcula como entero (centésimas de grado) para que dos focos del mismo
# cuadrito den exactamente el mismo número; con decimales la computadora puede diferir en
# la última cifra.
ESCALA = 100

CLAVE_PENINSULA = ["satelite", "dia_local", "celda_lat", "celda_lon"]
CLAVE_MUNICIPAL = CLAVE_PENINSULA + ["estado", "municipio"]
# Salen del día o del municipio, así que son iguales en todo el grupo.
DERIVADAS_DIA = ["anio", "mes", "semana"]


def celda(grados) -> np.ndarray:
    """Grados → número entero del cuadrito (20.1251 → 2013)."""
    return np.round(np.asarray(grados, dtype=float) * ESCALA).astype(np.int32)


def _agrupar(focos: pd.DataFrame, clave: list[str], extra: list[str]) -> pd.DataFrame:
    df = focos.assign(celda_lat=celda(focos["latitude"]), celda_lon=celda(focos["longitude"]))
    agrupado = (
        df.groupby(clave, observed=True, sort=True, dropna=False)
        .agg(**{c: (c, "first") for c in extra}, n_focos=("latitude", "size"))
        .reset_index()
    )
    agrupado["lat_celda"] = agrupado["celda_lat"] / ESCALA
    agrupado["lon_celda"] = agrupado["celda_lon"] / ESCALA
    agrupado["n_focos"] = agrupado["n_focos"].astype("int32")
    orden = ["satelite", "dia_local", *DERIVADAS_DIA, "lat_celda", "lon_celda",
             *[c for c in ("estado", "municipio", "zona") if c in agrupado.columns], "n_focos"]
    return agrupado[orden]


def cuadritos_dia(focos: pd.DataFrame) -> pd.DataFrame:
    """Un renglón por satélite × día × cuadrito × municipio (solo focos con municipio).

    Columnas: satelite, dia_local, anio, mes, semana, lat_celda, lon_celda, estado,
    municipio, zona, n_focos (cuántos focos cayeron ahí; no se usa para contar).
    """
    con_municipio = focos[focos["municipio"].notna()]
    return _agrupar(con_municipio, CLAVE_MUNICIPAL, DERIVADAS_DIA + ["zona"])


def cuadritos_dia_peninsula(focos: pd.DataFrame) -> pd.DataFrame:
    """Un renglón por satélite × día × cuadrito, sin importar el municipio."""
    return _agrupar(focos, CLAVE_PENINSULA, DERIVADAS_DIA)


def contar(cuadritos: pd.DataFrame, por: list[str]) -> pd.DataFrame:
    """Cuántos cuadritos-día hay en cada grupo (por ejemplo, ["satelite", "anio"])."""
    return cuadritos.groupby(por, observed=True).size().rename("cuadritos_dia").reset_index()


if __name__ == "__main__":
    from cargar import cargar_focos

    c = cuadritos_dia(cargar_focos())
    tabla = contar(c, ["anio", "satelite"]).pivot(index="anio", columns="satelite", values="cuadritos_dia")
    print("Cuadritos-día por año y satélite (con municipio):")
    print(tabla.fillna(0).astype(int).to_string())
