"""Cálculos de los datos de la página.

Funciones puras: no leen ni escriben archivos. pipeline/exportar_web.py las usa para armar
web/datos/. Usan los mismos cuadritos-día y los mismos factores que la serie de la tarea 5
(serie.py), pero suman por día en lugar de por semana.

- La temporada va del 1 de marzo al 31 de mayo: 92 días, el 1 de marzo es el día 0.
- Lo normal es la mediana de 2001 a 2025: de los totales, para una cifra; del acumulado de
  cada día, para la curva. Al 31 de mayo las dos dan lo mismo.
- El veredicto compara 2026 con lo normal (umbrales en clase()).
"""
from __future__ import annotations

import math
from datetime import date

import numpy as np
import pandas as pd

import serie

DIAS = 92
ANIO_REF = 2026  # año de referencia para pasar «MM-DD» a día de la temporada (no bisiesto)
MINIMO_NORMAL = 5  # con menos de 5 focos en un año normal no se compara
K_X = math.cos(math.radians(19.8)) * 150
CLASES = ["muyabajo", "abajo", "normal", "arriba", "muyarriba", "poco"]


def proyectar(lon, lat):
    """Lon/lat a las coordenadas del lienzo de la página (825 × 681, y de −90 a 591)."""
    return (np.asarray(lon) + 92.55) * K_X, (21.75 - np.asarray(lat)) * 150


def dia_de_temporada(d: date) -> int | None:
    i = (d - date(d.year, 3, 1)).days
    return i if 0 <= i < DIAS else None


def indice_de(mes_dia: str) -> int:
    """«04-03» → 33 (días desde el 1 de marzo)."""
    mes, dia = (int(x) for x in mes_dia.split("-"))
    return (date(ANIO_REF, mes, dia) - date(ANIO_REF, 3, 1)).days


def clase(v26: float, normal: float) -> str:
    if normal < MINIMO_NORMAL:
        return "poco"
    r = v26 / normal
    if r < 0.5:
        return "muyabajo"
    if r < 0.8:
        return "abajo"
    if r <= 1.25:
        return "normal"
    if r <= 2:
        return "arriba"
    return "muyarriba"


def temporada(dias: pd.Series, anio: int) -> np.ndarray:
    """Valores por día (índice de fechas) → arreglo de los 92 días de la temporada de `anio`."""
    fechas = pd.date_range(date(anio, 3, 1), periods=DIAS, freq="D")
    return dias.reindex(fechas, fill_value=0.0).to_numpy(dtype=float)


def normal_acumulado(por_anio: dict[int, np.ndarray], anios) -> np.ndarray:
    acumulados = np.vstack([np.cumsum(por_anio[a]) for a in anios])
    return np.median(acumulados, axis=0)


def fraccion_despues(diaria: np.ndarray, fin: int) -> float | None:
    """Parte del fuego de la temporada que cae después del día `fin` (incluido el resto)."""
    total = float(np.sum(diaria))
    if total <= 0:
        return None
    return float(np.sum(diaria[fin + 1:])) / total


def elegidos_con_factor(cuadritos: pd.DataFrame, factores: pd.DataFrame) -> pd.DataFrame:
    """Los cuadritos-día del satélite de su periodo, con su factor en `eq` (igual que serie.py)."""
    dia = pd.to_datetime(cuadritos["dia_local"])
    del_periodo = (cuadritos["satelite"] == serie.satelite_del_periodo(dia)).fillna(False).to_numpy(dtype=bool)
    elegidos = cuadritos[del_periodo].assign(dia_local=dia[del_periodo])
    return serie.aplicar_factores(elegidos, factores)


def diario(elegidos: pd.DataFrame, por: list[str]) -> pd.DataFrame:
    return elegidos.groupby(por + ["dia_local"], observed=True)["eq"].sum().reset_index()


def unicos(elegidos: pd.DataFrame, filtro: pd.Series) -> pd.Series:
    """Cuadritos únicos por día dentro de `filtro`: un cuadrito de frontera cuenta una vez.

    Si un cuadrito cae en dos zonas con factores distintos, vale el promedio de los dos.
    """
    sub = elegidos[filtro.to_numpy(dtype=bool)]
    celdas = sub.groupby(["satelite", "dia_local", "lat_celda", "lon_celda"], observed=True)["eq"].mean()
    return celdas.groupby(level="dia_local").sum()
