"""Cálculos de los datos de la página.

Funciones puras: no leen ni escriben archivos. pipeline/exportar_web.py las usa para armar
web/datos/. Usan los mismos cuadritos-día y los mismos factores que la serie de la tarea 5
(serie.py), pero suman por día en lugar de por semana.

- La temporada va del 1 de marzo al 31 de mayo: 92 días, el 1 de marzo es el día 0.
- Lo normal es la mediana de 2001 a 2025: de los totales, para una cifra; del acumulado de
  cada día, para la curva. Al 31 de mayo las dos dan lo mismo.
- El veredicto compara 2026 con lo normal (umbrales en clase()).
- Los hechos de cada municipio (hechos()) llevan su guarda: con poca muestra no se dicen, y lo
  que compara años usa solo DESDE_VIIRS en adelante (a escala de municipio, los años de MODIS
  multiplicados por su factor salen exagerados).
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
import pandas as pd

import serie

DIAS = 92
ANIO_REF = 2026  # año de referencia para pasar «MM-DD» a día de la temporada (no bisiesto)
MINIMO_NORMAL = 5  # con menos de 5 focos en un año normal no se compara
MINIMO_FECHAS = 20  # con menos de 20 en un año normal, las fechas (inicio, mitad, pico) son ruido
RACHA_MINIMA = 3  # una racha de 1 o 2 temporadas por debajo de lo normal no se dice
DESDE_VIIRS = 2012  # primer año con el satélite de hoy: los puestos de un municipio se cuentan desde aquí
DIAS_ANIO = 365  # el 29 de febrero se cuenta como 28 (mismo día del año en todos los años)
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


def normal_diario(por_anio: dict[int, np.ndarray], anios) -> np.ndarray:
    """Un año normal, día por día: la forma promedio de la temporada, escalada para que sume la
    mediana de los totales. Restar día a día la mediana del acumulado no sirve: el año que queda en
    medio cambia de un día al siguiente, y eso inventa días en cero seguidos de saltos."""
    diarios = np.vstack([por_anio[a] for a in anios])
    forma = diarios.mean(axis=0)
    suma = float(forma.sum())
    if suma <= 0:
        return np.zeros_like(forma)
    return forma * (float(np.median(diarios.sum(axis=1))) / suma)


def normal_acumulado(por_anio: dict[int, np.ndarray], anios) -> np.ndarray:
    """El acumulado del año normal: termina en la mediana de los totales."""
    return np.cumsum(normal_diario(por_anio, anios))


def fraccion_despues(diaria: np.ndarray, fin: int) -> float | None:
    """Parte del fuego de la temporada que cae después del día `fin` (incluido el resto)."""
    total = float(np.sum(diaria))
    if total <= 0:
        return None
    return float(np.sum(diaria[fin + 1:])) / total


def elegidos_con_factor(cuadritos: pd.DataFrame, factores: pd.DataFrame) -> pd.DataFrame:
    """Los cuadritos-día que entran a la serie, con su factor en `eq`.

    Usa serie.elegir(), la misma selección de la serie: el satélite del periodo y, en los
    días sin datos, su respaldo (H1). Así la página y la serie cuentan lo mismo.
    """
    elegidos, _, _ = serie.elegir(cuadritos)
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


def rango(totales) -> list[float]:
    """[p25, p75] de los totales: la franja de lo normal."""
    p25, p75 = np.percentile(np.asarray(list(totales), dtype=float), [25, 75])
    return [round(float(p25), 1), round(float(p75), 1)]


def dia_del_anio(fechas: pd.DatetimeIndex) -> np.ndarray:
    """Fecha → día del año desde 0 (1 de enero) en un año de 365 días: el 29 de febrero cae
    en el 28, para que el 1 de marzo sea el mismo día en todos los años."""
    fechas = pd.DatetimeIndex(fechas)
    doy = fechas.day_of_year.to_numpy() - 1
    return doy - (fechas.is_leap_year & (doy >= 59)).astype(int)


def mes_dia(i: int) -> str:
    """Día del año desde 0 → «MM-DD» (en un año de 365 días)."""
    return (date(ANIO_REF, 1, 1) + timedelta(days=int(i))).strftime("%m-%d")


def perfil_anual(dias: pd.Series, anios) -> np.ndarray:
    """Fuego de cada día del año (365 valores), sumado en los años `anios`: la forma de un año normal."""
    anios = list(anios)
    sub = dias[dias.index.year.isin(anios)] if len(dias) else dias
    if not len(sub):
        return np.zeros(DIAS_ANIO)
    return np.bincount(dia_del_anio(sub.index), weights=sub.to_numpy(dtype=float), minlength=DIAS_ANIO)


def dia_con_fraccion(perfil: np.ndarray, fraccion: float) -> int | None:
    """Primer día del año en que el acumulado llega a `fraccion` del total (None sin fuego)."""
    total = float(np.sum(perfil))
    if total <= 0:
        return None
    return int(np.searchsorted(np.cumsum(perfil) / total, fraccion - 1e-12))


def semana_pico(perfil: np.ndarray) -> tuple[int, int]:
    """La semana con más fuego: semanas de 7 días desde el 1 de enero; la 52 se lleva el día
    que sobra (como cargar.semana_del_anio). Devuelve el primer y el último día."""
    semana = np.minimum(np.arange(DIAS_ANIO) // 7, 51)
    k = int(np.argmax(np.bincount(semana, weights=perfil, minlength=52)))
    dias = np.flatnonzero(semana == k)
    return int(dias[0]), int(dias[-1])


def puesto(totales: dict[int, float], anio: int, desde: int) -> tuple[int, int]:
    """Lugar de `anio` entre las temporadas de `desde` a `anio`, de menos a más fuego (1 = la
    de menos). Un empate se queda con el peor lugar: «la de menos fuego» solo si no la iguala
    ninguna. Devuelve (lugar, temporadas)."""
    valores = [totales[a] for a in range(desde, anio + 1)]
    return sum(v <= totales[anio] for v in valores), len(valores)


def racha_abajo(totales: dict[int, float], normal: float, hasta: int) -> int:
    """Temporadas seguidas por debajo de lo normal, contando hacia atrás desde `hasta`."""
    n = 0
    for a in range(hasta, min(totales) - 1, -1):
        if totales.get(a, 0.0) >= normal:
            break
        n += 1
    return n


def hechos(totales: dict[int, float], normal: float, perfil: np.ndarray, anio: int,
           empieza_zona: int | None, lugar: tuple[int, int]) -> dict:
    """Lo que se puede decir de un municipio; lo que no pasa su guarda no va (clave ausente).

    - puesto26 y temporadas: lugar de `anio` entre sus temporadas desde DESDE_VIIRS (1 = la de menos).
    - racha: temporadas seguidas por debajo de lo normal hasta `anio`, si son RACHA_MINIMA o más.
    - lugar y de: su lugar en el estado por fuego de un año normal (1 = el de más).
    - empieza (10 % del fuego del año), empiezaZona, mitad (50 %) y semanaPico: con
      MINIMO_FECHAS o más en un año normal.
    Todo lo anterior pide además lo normal ≥ MINIMO_NORMAL (lo mismo que el veredicto).
    """
    if normal < MINIMO_NORMAL:
        return {}
    lugar26, temporadas = puesto(totales, anio, DESDE_VIIRS)
    h = {"puesto26": lugar26, "temporadas": temporadas}
    racha = racha_abajo(totales, normal, anio)
    if racha >= RACHA_MINIMA:
        h["racha"] = racha
    h["lugar"], h["de"] = lugar
    empieza, mitad = dia_con_fraccion(perfil, 0.1), dia_con_fraccion(perfil, 0.5)
    if normal >= MINIMO_FECHAS and empieza is not None:
        h["empieza"] = mes_dia(empieza)
        if empieza_zona is not None:
            h["empiezaZona"] = mes_dia(empieza_zona)
        h["semanaPico"] = [mes_dia(d) for d in semana_pico(perfil)]
        h["mitad"] = mes_dia(mitad)
    return h
