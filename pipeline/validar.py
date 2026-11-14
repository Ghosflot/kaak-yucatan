"""Las cuatro pruebas de que la armonización funciona (tarea 7; criterios del commit 4972835, PR #3).

Uso: python pipeline/validar.py

Pruebas (criterios congelados antes de ver datos reales, en el commit 4972835, PR #3):
1. salto_2012: el salto de sensor de 2012 disminuye (2009–2011 contra 2013–2015, península).
2. aqua_fuera_muestra: los factores funcionan en años que no se usaron (Aqua 2021–2025),
   y si el modelo por zona y época le gana a un solo factor.
3. conafor: el satélite detecta los incendios que registró CONAFOR (siempre «informativa»:
   mide detección, no el factor).
4. viirs: S-NPP, NOAA-20 y NOAA-21 coinciden entre sí.
Salida: salidas/validacion.json y las gráficas en salidas/graficas/.

Estado: revisa los contratos de entrada (S2), tiene las métricas que comparten
las pruebas (S3), calcula las Pruebas 1 (S4), 2 (S5), 3 (S6) y 4 (S7), elige el texto de cada
resultado (S8), dibuja sus gráficas (S9), sabe escribir validacion.json sin dejarlo a
medias (S10), revisa los archivos reales antes de calcular (S11, `--preflight`) y corre todo
con los datos reales (S12): preflight → cuatro pruebas → validacion.json y gráficas. Si algo
falla, sale con 1 y lo anterior queda intacto; correr_todo.py se detiene ahí (decidido el 14 nov).

Reglas:
- Solo lee. Nunca escribe en las entradas: quien valida no corrige lo que valida.
- Si una entrada no cumple su contrato, se detiene con ValidacionError antes de calcular.
  Un hueco nunca se rellena con ceros: un año faltante convertido en «0 fuego» parece un
  año tranquilo.
"""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import math
import os
import re
import shutil
import sys
import tempfile
import unicodedata
from datetime import date
from functools import cache
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib import rc_context
from matplotlib.figure import Figure
from matplotlib.lines import Line2D
from matplotlib.ticker import FixedLocator, FuncFormatter

import armonizar
import serie

RAIZ = Path(__file__).resolve().parent.parent

# La serie definitiva empieza aquí (docs/02, tabla de periodos). El calendario provisional
# de la tarea 1 tiene el mismo contrato pero empieza en 2012, con el primer día de S-NPP.
PRIMER_ANIO = 2001
ANIO_PROVISIONAL = 2012
# Prueba 1: años de antes y de después del cambio de sensor; 2012 es de transición (Aqua
# hasta el 19 ene, S-NPP desde el 20) y no entra en ninguno de los dos promedios.
ANIOS_ANTES = (2009, 2011)
ANIOS_DESPUES = (2013, 2015)
ANIO_TRANSICION = 2012
ANIOS_SALTO = range(ANIOS_ANTES[0], ANIOS_DESPUES[1] + 1)
# Rango natural: la misma comparación entre años que son todos de S-NPP, donde el satélite
# no cambia y solo cambia el fuego (la misma regla que serie.razones_salto).
ANIOS_SOLO_SNPP = (2013, 2025)
# Lo que la Prueba 1 necesita completo en el calendario.
ANIOS_REQUERIDOS = range(ANIOS_ANTES[0], ANIOS_SOLO_SNPP[1] + 1)
SEMANAS = 52
# La Prueba 1 se decide en toda la península; Yucatán es solo un desglose.
ESTADOS = ("Yucatán", "Campeche", "Quintana Roo")
ESTADO_DESGLOSE = "Yucatán"
# Criterio congelado antes de ver datos reales (commit 4972835, PR #3). Límites inclusivos.
UMBRAL_SALTO = {"reduccion_minima": 0.50, "razon_min": 0.67, "razon_max": 1.50}

CLAVE_CALENDARIO = ["estado", "municipio", "anio", "semana"]
CONTEOS = ["cuadritos_viirs_eq", "cuadritos_modis_crudo", "cuadritos_viirs_crudo"]
COLUMNAS_CALENDARIO = CLAVE_CALENDARIO + CONTEOS


class ValidacionError(ValueError):
    """Una entrada no cumple lo que las pruebas necesitan."""


# ---------------------------------------------------------------------------
# Contratos de entrada


def validar_calendario(cal: pd.DataFrame) -> None:
    """El calendario definitivo de la tarea 5, completo en lo que usa la Prueba 1."""
    faltan = [c for c in COLUMNAS_CALENDARIO if c not in cal.columns]
    if faltan:
        raise ValidacionError(f"Al calendario le faltan las columnas {faltan}")
    if cal.empty:
        raise ValidacionError("El calendario está vacío")

    primero = int(cal["anio"].min())
    if primero >= ANIO_PROVISIONAL:
        raise ValidacionError(
            f"El calendario empieza en {primero}: parece el provisional de la tarea 1 (solo "
            f"S-NPP). La tarea 7 necesita el definitivo de la tarea 5, desde {PRIMER_ANIO}")
    if primero != PRIMER_ANIO:
        raise ValidacionError(f"El calendario empieza en {primero}, no en {PRIMER_ANIO}")

    faltan_estados = [e for e in ESTADOS if e not in set(cal["estado"])]
    if faltan_estados:
        raise ValidacionError(f"Al calendario le faltan estados de la península: {faltan_estados}")

    repetidas = cal.duplicated(CLAVE_CALENDARIO, keep=False)
    if repetidas.any():
        ejemplos = cal.loc[repetidas, CLAVE_CALENDARIO].drop_duplicates().head(5)
        raise ValidacionError(f"El calendario tiene semanas repetidas: {ejemplos.to_dict('records')}")

    municipios = cal[["estado", "municipio"]].drop_duplicates()
    usados = cal[cal["anio"].isin(ANIOS_REQUERIDOS)]
    semanas = usados.groupby(["anio", "estado", "municipio"]).size()
    for anio in ANIOS_REQUERIDOS:
        if anio not in semanas.index.get_level_values("anio"):
            raise ValidacionError(f"Al calendario le falta el año {anio}, que usa la Prueba 1")
        del_anio = semanas.loc[anio]
        incompletos = len(municipios) - int((del_anio == SEMANAS).sum())
        if incompletos:
            raise ValidacionError(
                f"En {anio}, {incompletos} municipios no tienen sus {SEMANAS} semanas: "
                "la Prueba 1 sumaría menos fuego del que hubo")

    for columna in CONTEOS:
        valores = pd.to_numeric(usados[columna], errors="coerce")
        malos = valores.isna() | (valores < 0)
        if malos.any():
            anios = sorted(usados.loc[malos, "anio"].unique().tolist())
            raise ValidacionError(
                f"{columna} tiene valores vacíos o negativos en {anios}; no se rellenan con 0")


def validar_factores(factores: pd.DataFrame) -> None:
    """Los 26 factores de las tareas 3 y 4, con la misma regla que usa la tarea 5."""
    try:
        serie.validar_factores(factores)
    except serie.SerieError as e:
        raise ValidacionError(str(e)) from e


# ---------------------------------------------------------------------------
# Métricas (funciones puras: no leen archivos ni guardan nada)
#
# Un denominador en cero, un vacío o un negativo es un error, no un número: un NaN o un
# infinito que llegue al JSON parecería un resultado.


def _conteos(valores, nombre: str) -> np.ndarray:
    """Lista de conteos no vacía, sin vacíos, sin infinitos y sin negativos."""
    arr = np.asarray(valores, dtype=float)
    if arr.ndim != 1 or arr.size == 0:
        raise ValidacionError(f"{nombre}: se necesita al menos un valor")
    if not np.isfinite(arr).all():
        raise ValidacionError(f"{nombre}: hay valores vacíos o infinitos")
    if (arr < 0).any():
        raise ValidacionError(f"{nombre}: hay valores negativos")
    return arr


def _numero(valor, nombre: str, positivo: bool = False) -> float:
    """Un número finito, mayor o igual que 0 (o mayor que 0 si positivo=True)."""
    x = float(valor)
    if not math.isfinite(x) or x < 0 or (positivo and x == 0):
        regla = "mayor que 0" if positivo else "0 o más"
        raise ValidacionError(f"{nombre} debe ser un número finito {regla}, no {valor!r}")
    return x


def razon(antes, despues) -> float:
    """Promedio de después entre promedio de antes (por ejemplo, totales anuales)."""
    a = _conteos(antes, "antes").mean()
    d = _conteos(despues, "despues").mean()
    if a == 0:
        raise ValidacionError("antes no tiene fuego: no hay con qué dividir")
    return float(d / a)


def distancia_log(r: float) -> float:
    """Qué tan lejos está una razón de 1, igual para el doble que para la mitad: |ln r|."""
    return abs(math.log(_numero(r, "la razón", positivo=True)))


def reduccion_salto(cruda: float, armonizada: float) -> float:
    """Qué parte del salto crudo quitó la armonización: 1 − dist(armonizada) / dist(cruda).

    1 es que el salto desapareció, 0 que quedó igual (aunque sea al revés) y un valor
    negativo que la armonización lo empeoró.
    """
    d_cruda = distancia_log(cruda)
    if d_cruda == 0:
        raise ValidacionError("la serie cruda no tiene salto: no hay nada que reducir")
    return 1 - distancia_log(armonizada) / d_cruda


def wape(observado, predicho) -> float:
    """Error ponderado: suma de errores absolutos entre suma de lo observado.

    Cada celda pesa según cuánto fuego tiene, así que una celda con 2 cuadritos no domina
    el resultado (como sí pasaría promediando el error porcentual de cada celda).
    """
    o = _conteos(observado, "observado")
    p = _conteos(predicho, "predicho")
    if o.shape != p.shape:
        raise ValidacionError(f"observado ({o.size}) y predicho ({p.size}) no tienen las mismas celdas")
    total = o.sum()
    if total == 0:
        raise ValidacionError("no hay nada observado: no hay con qué dividir")
    return float(np.abs(p - o).sum() / total)


def mejora_relativa(base: float, modelo: float) -> float:
    """Cuánto baja el error del modelo respecto del de base, como fracción del de base.

    De 0.20 a 0.18 son 2 puntos, pero 0.10 de mejora relativa. Negativo si empeora.
    """
    b = _numero(base, "el error de base", positivo=True)
    m = _numero(modelo, "el error del modelo")
    return (b - m) / b


def error_relativo(observado: float, predicho: float) -> float:
    """(predicho − observado) / observado, con signo: positivo si el modelo se pasa."""
    o = _numero(observado, "lo observado", positivo=True)
    p = _numero(predicho, "lo predicho")
    return (p - o) / o


def periodo_comun(a: tuple[date, date], b: tuple[date, date]) -> tuple[date, date]:
    """Los días que cubren los dos sensores (ambos extremos entran)."""
    for inicio, fin in (a, b):
        if inicio > fin:
            raise ValidacionError(f"periodo al revés: {inicio} > {fin}")
    inicio, fin = max(a[0], b[0]), min(a[1], b[1])
    if inicio > fin:
        raise ValidacionError(f"los periodos {a} y {b} no tienen ningún día en común")
    return inicio, fin


# ---------------------------------------------------------------------------
# Prueba 1: el salto de 2012


def totales_anuales(cal: pd.DataFrame, estados=ESTADOS) -> pd.DataFrame:
    """Cuadritos-día por año de una región, en las dos series.

    crudo: MODIS y VIIRS crudos sumados, como si se unieran sin calibrar.
    armonizado: cuadritos_viirs_eq, la serie de la tarea 5.
    """
    region = cal[cal["estado"].isin(list(estados))]
    return (
        region.assign(crudo=region["cuadritos_modis_crudo"] + region["cuadritos_viirs_crudo"])
        .groupby("anio")
        .agg(crudo=("crudo", "sum"), armonizado=("cuadritos_viirs_eq", "sum"))
    )


def _valores_entre(serie: pd.Series, desde: int, hasta: int) -> list[float]:
    anios = list(range(desde, hasta + 1))
    faltan = [a for a in anios if a not in serie.index]
    if faltan:
        raise ValidacionError(f"faltan los años {faltan} para comparar {desde}–{hasta}")
    return serie.loc[anios].tolist()


def razon_periodos(serie: pd.Series, antes: tuple[int, int], despues: tuple[int, int]) -> float:
    """Promedio anual de después entre el de antes, sobre una serie indexada por año."""
    return razon(antes=_valores_entre(serie, *antes), despues=_valores_entre(serie, *despues))


def rango_natural(armonizado: pd.Series) -> dict:
    """Cuánto cambia la razón sin cambio de sensor: la menor y la mayor entre años S-NPP.

    Repite la forma de la Prueba 1 (mismo número de años y misma separación) en todas las
    posiciones posibles dentro de ANIOS_SOLO_SNPP. Las ventanas se enciman, así que no son
    datos independientes: es una regla para saber de qué tamaño suelen ser los cambios, no
    una prueba de significancia.
    """
    largo = ANIOS_ANTES[1] - ANIOS_ANTES[0]
    separacion = ANIOS_DESPUES[0] - ANIOS_ANTES[0]
    primero, ultimo = ANIOS_SOLO_SNPP
    ventanas = []
    for inicio in range(primero, ultimo - separacion - largo + 1):
        antes = (inicio, inicio + largo)
        despues = (inicio + separacion, inicio + separacion + largo)
        ventanas.append({"antes": antes, "despues": despues,
                         "razon": razon_periodos(armonizado, antes, despues)})
    razones = [v["razon"] for v in ventanas]
    return {"min": min(razones), "max": max(razones), "ventanas": ventanas}


def decidir_salto(reduccion: float, razon_armonizada: float) -> str:
    """Criterio congelado: el salto baja al menos 50 % y la razón queda en 0.67–1.50."""
    u = UMBRAL_SALTO
    reduce = reduccion >= u["reduccion_minima"]
    en_rango = u["razon_min"] <= razon_armonizada <= u["razon_max"]
    return "pasa" if reduce and en_rango else "no_pasa"


def salto_region(totales: pd.DataFrame) -> dict:
    """Las métricas de la Prueba 1 para una región (sin decidir el estado)."""
    cruda = razon_periodos(totales["crudo"], ANIOS_ANTES, ANIOS_DESPUES)
    armonizada = razon_periodos(totales["armonizado"], ANIOS_ANTES, ANIOS_DESPUES)
    natural = rango_natural(totales["armonizado"])
    return {
        "razon_cruda": cruda,
        "razon_armonizada": armonizada,
        "distancia_cruda": distancia_log(cruda),
        "distancia_armonizada": distancia_log(armonizada),
        "reduccion": reduccion_salto(cruda, armonizada),
        "rango_natural": natural,
        "dentro_rango_natural": bool(natural["min"] <= armonizada <= natural["max"]),
        "totales": [
            {"anio": int(a), "crudo": float(totales.loc[a, "crudo"]),
             "armonizado": float(totales.loc[a, "armonizado"]),
             "transicion": a == ANIO_TRANSICION}
            for a in ANIOS_SALTO
        ],
    }


def prueba_salto(cal: pd.DataFrame) -> dict:
    """Prueba 1: ¿se reduce el salto de 2012? Decide la península; Yucatán es desglose."""
    validar_calendario(cal)
    peninsula = salto_region(totales_anuales(cal))
    yucatan = salto_region(totales_anuales(cal, estados=[ESTADO_DESGLOSE]))
    return {
        "id": "salto_2012",
        "estado": decidir_salto(peninsula["reduccion"], peninsula["razon_armonizada"]),
        "metricas": {"peninsula": peninsula, "yucatan": yucatan},
        "umbral": dict(UMBRAL_SALTO),
    }


# ---------------------------------------------------------------------------
# Prueba 2: Aqua en años que no se usaron para calibrar, y factor único
#
# Se cuenta con las mismas reglas con que se calcularon los factores (armonizar.py de la
# tarea 3: día solar, días hueco de la península, un cuadrito de frontera una vez por zona).
# Los huecos se calculan siempre con el mismo periodo que se cuenta.

PERIODO_AQUA = (date(2021, 1, 1), date(2025, 12, 31))
# Criterio congelado (commit 4972835, PR #3). Límites inclusivos.
UMBRAL_AQUA = {"wape_max": 0.25, "mejora_minima": 0.05}
# Margen para comparar contra los límites sin que el redondeo de la computadora decida.
_TOL = 1e-12


def _dias_aqua(por_zona: pd.DataFrame, zona: str | None, huecos, periodo) -> pd.DataFrame:
    try:
        return armonizar.dias_por_zona(por_zona, "Aqua", zona, huecos, periodo=periodo)
    except armonizar.FactorError as e:
        raise ValidacionError(str(e)) from e


def factor_unico(por_zona: pd.DataFrame, peninsula: pd.DataFrame) -> float:
    """Un solo factor Aqua→S-NPP para todo, calculado solo con 2013–2020 (sin ver 2021–2025)."""
    periodo = armonizar.PERIODO_MODIS
    huecos = armonizar.dias_hueco(peninsula, "Aqua", *periodo)
    dias = _dias_aqua(por_zona, None, huecos, periodo)
    aqua = dias["otro"].sum()
    if aqua == 0:
        raise ValidacionError("Aqua no tiene cuadritos-día en 2013–2020: no hay factor único")
    return float(dias["ref"].sum() / aqua)


def celdas_aqua(por_zona: pd.DataFrame, peninsula: pd.DataFrame,
                periodo: tuple[date, date] = PERIODO_AQUA) -> tuple[pd.DataFrame, pd.DatetimeIndex]:
    """Cuadritos-día de S-NPP (ref) y Aqua (otro) por año × zona × época, y los días hueco.

    Devuelve todas las celdas del periodo, también las que no tuvieron fuego (con 0): en un
    periodo cubierto por los dos satélites, ningún cuadrito-día es un 0 de verdad.
    """
    huecos = armonizar.dias_hueco(peninsula, "Aqua", *periodo)
    partes = []
    for zona in armonizar.ZONAS:
        dias = _dias_aqua(por_zona, zona, huecos, periodo)
        partes.append(dias.groupby(["anio", "epoca"])[["ref", "otro"]].sum()
                      .reset_index().assign(zona=zona))
    todas = pd.MultiIndex.from_product(
        [range(periodo[0].year, periodo[1].year + 1), armonizar.ZONAS, armonizar.EPOCAS],
        names=["anio", "zona", "epoca"])
    celdas = (pd.concat(partes, ignore_index=True)
              .set_index(["anio", "zona", "epoca"])[["ref", "otro"]]
              .reindex(todas, fill_value=0).reset_index())
    celdas[["ref", "otro"]] = celdas[["ref", "otro"]].astype("int64")
    return celdas, huecos


def decidir_modelo(wape_zona: float, wape_unico: float) -> dict:
    """Regla completa congelada (commit 4972835, PR #3).

    1. Si solo uno de los dos modelos cumple WAPE ≤ 25 %, gana ese. Si cumplen los dos o
       ninguno, gana zona×época si mejora ≥ 5 % relativo al único; si no, el único.
    2. Pasa si el modelo elegido cumple WAPE ≤ 25 %.
    """
    u = UMBRAL_AQUA
    z_ok = wape_zona <= u["wape_max"] + _TOL
    u_ok = wape_unico <= u["wape_max"] + _TOL
    mejora = mejora_relativa(base=wape_unico, modelo=wape_zona) if wape_unico > 0 else None
    if z_ok != u_ok:
        modelo = "zona_epoca" if z_ok else "unico"
    else:
        gana_zona = mejora is not None and mejora >= u["mejora_minima"] - _TOL
        modelo = "zona_epoca" if gana_zona else "unico"
    elegido_ok = z_ok if modelo == "zona_epoca" else u_ok
    return {"modelo": modelo, "estado": "pasa" if elegido_ok else "no_pasa", "mejora": mejora}


def _wapes(celdas: pd.DataFrame) -> dict:
    return {"wape_zona_epoca": wape(celdas["ref"], celdas["pred_zona"]),
            "wape_unico": wape(celdas["ref"], celdas["pred_unico"])}


def evaluar_aqua(celdas: pd.DataFrame, factores: pd.DataFrame, factor_unico: float) -> dict:
    """Prueba 2 sobre celdas ya contadas: predice S-NPP desde Aqua con los dos modelos."""
    aqua = factores[factores["satelite"] == "Aqua"].set_index(["zona", "epoca"])["factor"]
    clave = pd.MultiIndex.from_frame(celdas[["zona", "epoca"]])
    if not clave.isin(aqua.index).all():
        raise ValidacionError("hay celdas de una zona o época sin factor de Aqua")
    c = celdas.assign(pred_zona=celdas["otro"].to_numpy() * aqua.reindex(clave).to_numpy(),
                      pred_unico=celdas["otro"] * factor_unico)
    globales = _wapes(c)
    decision = decidir_modelo(globales["wape_zona_epoca"], globales["wape_unico"])

    por_anio = []
    for anio, a in c.groupby("anio"):
        obs = float(a["ref"].sum())
        por_anio.append({
            "anio": int(anio), "observado": obs,
            "predicho_zona_epoca": float(a["pred_zona"].sum()),
            "predicho_unico": float(a["pred_unico"].sum()),
            "error_zona_epoca": error_relativo(obs, a["pred_zona"].sum()),
            "error_unico": error_relativo(obs, a["pred_unico"].sum()),
        })
    por_epoca = {e: _wapes(c[c["epoca"] == e])
                 for e in armonizar.EPOCAS if c.loc[c["epoca"] == e, "ref"].sum() > 0}
    return {
        "id": "aqua_fuera_muestra",
        "estado": decision["estado"],
        "metricas": {
            **globales,
            "mejora": decision["mejora"],
            "modelo": decision["modelo"],
            "factor_unico": factor_unico,
            "por_anio": por_anio,
            "por_epoca": por_epoca,
            "cuadritos_snpp": int(c["ref"].sum()),
            "cuadritos_aqua": int(c["otro"].sum()),
            "celdas": len(c),
        },
        "umbral": dict(UMBRAL_AQUA),
    }


def _anios_sin_datos(peninsula: pd.DataFrame, satelite: str, periodo) -> list[int]:
    dias = pd.to_datetime(peninsula.loc[peninsula["satelite"] == satelite, "dia_local"])
    con_datos = set(dias[dias.between(pd.Timestamp(periodo[0]), pd.Timestamp(periodo[1]))].dt.year)
    return [a for a in range(periodo[0].year, periodo[1].year + 1) if a not in con_datos]


def _snpp_cero_no_marcados(peninsula: pd.DataFrame, huecos, periodo,
                           otro: str = "Aqua") -> list[str]:
    """Días con S-NPP en 0 y el otro con algo en la península que la regla de hueco no marca
    (el otro vio menos de UMBRAL_HUECO). Entran a la prueba con S-NPP en 0: se reportan."""
    dia = pd.to_datetime(peninsula["dia_local"])
    en = peninsula[dia.between(pd.Timestamp(periodo[0]), pd.Timestamp(periodo[1])).to_numpy()]
    por_dia = (en.assign(dia_local=pd.to_datetime(en["dia_local"]))
               .groupby(["dia_local", "satelite"]).size().unstack(fill_value=0)
               .reindex(columns=["S-NPP", otro], fill_value=0))
    sospechosos = por_dia[(por_dia["S-NPP"] == 0) & (por_dia[otro] > 0)].index
    return [d.date().isoformat() for d in sospechosos if d not in set(huecos)]


def prueba_aqua(por_zona: pd.DataFrame, peninsula: pd.DataFrame, factores: pd.DataFrame,
                periodo: tuple[date, date] = PERIODO_AQUA) -> dict:
    """Prueba 2 completa desde los cuadritos-día (rejilla.cuadritos_dia y su versión península)."""
    validar_factores(factores)
    for satelite in ("Aqua", "S-NPP"):
        faltan = _anios_sin_datos(peninsula, satelite, periodo)
        if faltan:
            raise ValidacionError(f"{satelite} no tiene datos en {faltan}: la Prueba 2 los necesita")
    fu = factor_unico(por_zona, peninsula)
    celdas, huecos = celdas_aqua(por_zona, peninsula, periodo)
    resultado = evaluar_aqua(celdas, factores, fu)
    resultado["metricas"].update({
        "periodo": [periodo[0].isoformat(), periodo[1].isoformat()],
        "huecos": [d.date().isoformat() for d in huecos],
        "dias_snpp_cero_no_marcados": _snpp_cero_no_marcados(peninsula, huecos, periodo),
    })
    return resultado


# ---------------------------------------------------------------------------
# Prueba 3: CONAFOR, evidencia externa de detección
#
# Reutiliza analisis/cruce_conafor.py sin copiar sus reglas (radio de 2 km, ±1 día, controles).
# Mide si el satélite detecta incendios reales, no si los factores están bien: multiplicar un
# conteo positivo no cambia «al menos un foco». Por eso su estado es siempre «informativa».

CRUCE_CONAFOR = RAIZ / "analisis" / "cruce_conafor.py"
SENSORES_CONAFOR = ("S-NPP", "MODIS")
TAMANO_GRANDES = "Mayor a 100 Hectáreas"
# Criterio congelado (commit 4972835, PR #3): regresión, no decide nada del método.
UMBRAL_CONAFOR = {"veces_azar_min": 3.0, "grandes_min": 75.0}
# Lo publicado en docs/01 («Validación con CONAFOR»), con la precisión con que se publicó
# (porcentajes enteros). El «por azar» de MODIS se publicó como rango (4–5 %).
PUBLICADO_DOCS01 = {
    "incendios": 1222,
    "grandes_snpp": 84,
    "por_satelite": {"S-NPP": {"real": 53, "azar": {9}}, "MODIS": {"real": 36, "azar": {4, 5}}},
}


@cache
def cruce_conafor():
    """El módulo analisis/cruce_conafor.py, cargado por su ruta (no se copia ni se modifica)."""
    spec = importlib.util.spec_from_file_location("cruce_conafor", CRUCE_CONAFOR)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def tasas_conafor(incendios: pd.DataFrame, focos: pd.DataFrame) -> dict:
    """Porcentaje de incendios con foco cerca: real y los dos controles de azar del análisis.

    control_anio: mismo lugar y fechas, un año antes y uno después (promedio de los dos).
    control_lugar: mismas fechas, el punto movido 20 km en cuatro direcciones (promedio).
    """
    cc = cruce_conafor()
    if focos.empty:
        return {"real": 0.0, "control_anio": 0.0, "control_lugar": 0.0}
    km20_lat = 20 / 110.57
    km20_lon = 20 / (111.32 * np.cos(cc.LAT0))
    return {
        "real": float(cc.tasa(cc.coincidencias(incendios, focos))),
        "control_anio": float(np.mean([cc.tasa(cc.coincidencias(incendios, focos, ddias=d))
                                       for d in (-365, 365)])),
        "control_lugar": float(np.mean([
            cc.tasa(cc.coincidencias(incendios, focos, dlat=a, dlon=b))
            for a, b in ((km20_lat, 0), (-km20_lat, 0), (0, km20_lon), (0, -km20_lon))])),
    }


def supera_azar(real: float, control_anio: float, control_lugar: float) -> bool:
    """Lo real es al menos 3 veces el MAYOR de los dos controles de azar."""
    azar = max(control_anio, control_lugar)
    return bool(real >= UMBRAL_CONAFOR["veces_azar_min"] * azar - _TOL)


def ve_grandes(grandes: float) -> bool:
    """S-NPP ve al menos 75 % de los incendios de más de 100 ha."""
    return bool(grandes >= UMBRAL_CONAFOR["grandes_min"] - _TOL)


def regresion_conafor(real: float, control_anio: float, control_lugar: float,
                      grandes: float) -> bool:
    """Las dos condiciones del criterio congelado (la gráfica marca cada una por separado)."""
    return supera_azar(real, control_anio, control_lugar) and ve_grandes(grandes)


def evaluar_conafor(incendios: pd.DataFrame, focos: dict[str, pd.DataFrame]) -> dict:
    """Prueba 3 con incendios y focos ya cargados: {sensor: focos} para S-NPP y MODIS."""
    cc = cruce_conafor()
    por_satelite = {s: tasas_conafor(incendios, focos[s]) for s in SENSORES_CONAFOR}
    for t in por_satelite.values():
        t["azar_mayor"] = max(t["control_anio"], t["control_lugar"])
    snpp = focos["S-NPP"]
    vistos = (cc.coincidencias(incendios, snpp) > 0) if not snpp.empty else np.zeros(len(incendios), bool)
    por_tamano = {
        str(t): {"incendios": int(m.sum()), "snpp": float(100 * vistos[m.to_numpy()].mean())}
        for t, m in ((t, incendios["Tamano"] == t) for t in incendios["Tamano"].dropna().unique())
    }
    grandes = por_tamano.get(TAMANO_GRANDES, {"snpp": float("nan")})["snpp"]
    s = por_satelite["S-NPP"]
    return {
        "id": "conafor",
        "estado": "informativa",
        "metricas": {
            "incendios": int(len(incendios)),
            "por_satelite": por_satelite,
            "por_tamano": por_tamano,
            "grandes_snpp": grandes,
            "regresion_ok": regresion_conafor(s["real"], s["control_anio"], s["control_lugar"],
                                              grandes),
        },
        "umbral": dict(UMBRAL_CONAFOR),
    }


def reproducir_docs01(metricas: dict) -> dict:
    """Comprueba que el cruce reproduce docs/01 con la precisión publicada; si no, se detiene.

    Para el «por azar», dice a cuál de los dos controles corresponde lo publicado; si ninguno
    redondea a lo publicado, se detiene: cambió algo en los datos o en la regla.
    """
    pub = PUBLICADO_DOCS01
    if metricas["incendios"] != pub["incendios"]:
        raise ValidacionError(f"CONAFOR: {metricas['incendios']} incendios, docs/01 dice "
                              f"{pub['incendios']:,}")
    if round(metricas["grandes_snpp"]) != pub["grandes_snpp"]:
        raise ValidacionError(f"CONAFOR: S-NPP ve {metricas['grandes_snpp']:.1f} % de los de más "
                              f"de 100 ha, docs/01 dice {pub['grandes_snpp']} %")
    control_publicado = {}
    for sensor, esperado in pub["por_satelite"].items():
        t = metricas["por_satelite"][sensor]
        if round(t["real"]) != esperado["real"]:
            raise ValidacionError(f"CONAFOR, {sensor}: {t['real']:.1f} %, docs/01 dice "
                                  f"{esperado['real']} %")
        cuales = [c for c in ("anio", "lugar") if round(t[f"control_{c}"]) in esperado["azar"]]
        if not cuales:
            raise ValidacionError(
                f"CONAFOR, {sensor}: ningún control ({t['control_anio']:.1f} % y "
                f"{t['control_lugar']:.1f} %) coincide con el «por azar» de docs/01 "
                f"({sorted(esperado['azar'])} %)")
        control_publicado[sensor] = cuales
    return {"control_publicado": control_publicado}


def prueba_conafor(focos: pd.DataFrame | None = None, incendios: pd.DataFrame | None = None) -> dict:
    """Prueba 3 completa. Sin argumentos, carga los datos como el análisis (cruce_conafor.cargar)."""
    if focos is None or incendios is None:
        focos, incendios = cruce_conafor().cargar()
    resultado = evaluar_conafor(incendios, {s: focos[focos["sensor"] == s] for s in SENSORES_CONAFOR})
    resultado["metricas"]["reproduce_docs01"] = reproducir_docs01(resultado["metricas"])
    return resultado



# ---------------------------------------------------------------------------
# Prueba 4: los VIIRS coinciden entre sí
#
# S-NPP es la referencia. NOAA-20 continúa la serie desde el 3 nov 2026 y decide el estado;
# NOAA-21 no entra en la serie y es solo corroboración («informativa»: se reporta si cumple
# el mismo rango, pero no cambia el estado). Decidido por el equipo; el
# criterio congelado no decía cómo combinar los dos.
#
# Reglas (acordadas antes de correr datos reales):
# - Solo la cobertura común: del primer día del otro satélite en FIRMS al último día
#   completo de S-NPP. Nunca se suman satélites: se comparan.
# - Se quitan los días hueco (armonizar.dias_hueco: un satélite 0 en la península y el otro
#   UMBRAL_HUECO o más), la misma regla que la Prueba 2.
# - NOAA-20 se multiplica por su factor de cada época (factor = S-NPP / NOAA-20); NOAA-21 va
#   sin factor.
# - Solo los años enteros dentro de la cobertura común deciden; los parciales (2018, 2023,
#   2026) y la razón por época se reportan sin decidir.
# - Pasa si la razón de cada año entero queda en 0.90–1.10 y la diferencia agregada de esos
#   años es 5 % o menos. Límites inclusivos.
# Limitación: el factor de NOAA-20 se calculó con este mismo periodo, así que la diferencia
# agregada sale cerca de 0 por construcción; lo que informa son las razones de cada año.

PERIODOS_VIIRS = {
    "NOAA-20": armonizar.PERIODO_NOAA20,
    "NOAA-21": (date(2023, 3, 1), armonizar.PERIODO_NOAA20[1]),   # docs/01: empieza el 1 mar 2023
}
VIIRS_DECIDE = "NOAA-20"
# Criterio congelado (commit 4972835, PR #3). Límites inclusivos.
UMBRAL_VIIRS = {"razon_min": 0.90, "razon_max": 1.10, "diferencia_max": 0.05}


def anios_enteros(periodo: tuple[date, date]) -> list[int]:
    """Años del 1 ene al 31 dic completos dentro del periodo (ambos extremos entran)."""
    desde, hasta = periodo
    return [a for a in range(desde.year, hasta.year + 1)
            if date(a, 1, 1) >= desde and date(a, 12, 31) <= hasta]


def dias_viirs(peninsula: pd.DataFrame, otro: str,
               periodo: tuple[date, date]) -> tuple[pd.DataFrame, pd.DatetimeIndex]:
    """Cuadritos-día por día de S-NPP (ref) y del otro en toda la península, sin los huecos.

    Entran los días del periodo en que alguno de los dos vio fuego. Devuelve lo mismo que
    armonizar.dias_comunes() (dia_local, anio, epoca, ref, otro) y los días hueco.
    """
    try:
        huecos = armonizar.dias_hueco(peninsula, otro, *periodo)
    except armonizar.FactorError as e:
        raise ValidacionError(str(e)) from e
    dia = pd.to_datetime(peninsula["dia_local"])
    elegidos = peninsula.assign(dia_local=dia)[
        dia.between(pd.Timestamp(periodo[0]), pd.Timestamp(periodo[1])).to_numpy()
        & peninsula["satelite"].isin(["S-NPP", otro]).to_numpy()
        & ~dia.isin(huecos).to_numpy()
    ]
    por_dia = (elegidos.groupby(["dia_local", "satelite"]).size().unstack(fill_value=0)
               .reindex(columns=["S-NPP", otro], fill_value=0)
               .rename(columns={"S-NPP": "ref", otro: "otro"}).reset_index())
    por_dia.columns.name = None
    por_dia["anio"] = por_dia["dia_local"].dt.year
    por_dia["epoca"] = armonizar.epoca_de(por_dia["dia_local"].dt.month).to_numpy()
    return por_dia[["dia_local", "anio", "epoca", "ref", "otro"]], huecos


def _razon_viirs(d: pd.DataFrame) -> float | None:
    """Otro (ajustado) / S-NPP. None si S-NPP no vio nada: no hay con qué dividir."""
    ref = d["ref"].sum()
    return float(d["ajustado"].sum() / ref) if ref > 0 else None


def _en_rango(r: float) -> bool:
    u = UMBRAL_VIIRS
    return u["razon_min"] - _TOL <= r <= u["razon_max"] + _TOL


def evaluar_viirs(dias: pd.DataFrame, periodo: tuple[date, date],
                  factor_epoca: dict[str, float] | None) -> dict:
    """Prueba 4 para un satélite sobre la tabla diaria de dias_viirs().

    factor_epoca: {"temporada": f, "resto": f} para NOAA-20; None para NOAA-21 (sin factor).
    """
    enteros = anios_enteros(periodo)
    if not enteros:
        raise ValidacionError(f"el periodo {periodo[0]} a {periodo[1]} no tiene ningún año entero")
    f = (dias["epoca"].map(factor_epoca).to_numpy() if factor_epoca is not None
         else np.ones(len(dias)))
    d = dias.assign(ajustado=dias["otro"].to_numpy() * f)

    por_anio, fallas = [], []
    for anio, a in d.groupby("anio"):
        completo = int(anio) in enteros
        r = _razon_viirs(a)
        if completo and r is None:
            raise ValidacionError(f"S-NPP no vio nada en {anio}: no hay con qué comparar")
        ref = int(a["ref"].sum())
        fila = {
            "anio": int(anio), "completo": completo, "dias": len(a),
            "cuadritos_snpp": ref, "cuadritos_otro": int(a["otro"].sum()),
            "cuadritos_otro_ajustado": float(a["ajustado"].sum()),
            "razon_cruda": float(a["otro"].sum() / ref) if ref > 0 else None,
            "razon": r,
            "por_epoca": {e: _razon_viirs(a[a["epoca"] == e]) for e in armonizar.EPOCAS
                          if (a["epoca"] == e).any()},
        }
        por_anio.append(fila)
        if completo and not _en_rango(r):
            fallas.append({"que": "anio", "anio": fila["anio"], "razon": r,
                           "por_epoca": fila["por_epoca"]})

    faltan = sorted(set(enteros) - {a["anio"] for a in por_anio})
    if faltan:
        raise ValidacionError(f"no hay días comparables en los años enteros {faltan}")
    agregada = _razon_viirs(d[d["anio"].isin(enteros)])
    diferencia = abs(agregada - 1)
    if diferencia > UMBRAL_VIIRS["diferencia_max"] + _TOL:
        fallas.append({"que": "agregada", "diferencia": diferencia})
    return {
        "factor": dict(factor_epoca) if factor_epoca is not None else None,
        "anios_enteros": enteros,
        "por_anio": por_anio,
        "razon_agregada": agregada,
        "diferencia_agregada": diferencia,
        "fallas": fallas,
        "cumple_umbral": not fallas,
    }


def _factor_noaa20(factores: pd.DataFrame) -> dict[str, float]:
    n20 = factores[(factores["satelite"] == "NOAA-20")
                   & (factores["zona"] == armonizar.ZONA_PENINSULA)]
    return {e: float(n20.loc[n20["epoca"] == e, "factor"].iloc[0]) for e in armonizar.EPOCAS}


def prueba_viirs(peninsula: pd.DataFrame, factores: pd.DataFrame) -> dict:
    """Prueba 4 completa desde los cuadritos-día de la península (rejilla.cuadritos_dia_peninsula)."""
    validar_factores(factores)
    for otro, periodo in PERIODOS_VIIRS.items():
        for satelite in ("S-NPP", otro):
            faltan = [a for a in _anios_sin_datos(peninsula, satelite, periodo)
                      if a in anios_enteros(periodo)]
            if faltan:
                raise ValidacionError(
                    f"{satelite} no tiene datos en {faltan}: la Prueba 4 ({otro}) los necesita")

    metricas = {}
    for otro, periodo in PERIODOS_VIIRS.items():
        dias, huecos = dias_viirs(peninsula, otro, periodo)
        factor = _factor_noaa20(factores) if otro == "NOAA-20" else None
        r = evaluar_viirs(dias, periodo, factor)
        if otro == VIIRS_DECIDE:
            r["estado"] = "pasa" if r["cumple_umbral"] else "no_pasa"
        else:
            r["estado"] = "informativa"
        r.update({
            "periodo": [periodo[0].isoformat(), periodo[1].isoformat()],
            "huecos": [h.date().isoformat() for h in huecos],
            "dias_snpp_cero_no_marcados": _snpp_cero_no_marcados(peninsula, huecos, periodo, otro),
            "misma_muestra_que_el_factor": otro == "NOAA-20" and periodo == armonizar.PERIODO_NOAA20,
        })
        metricas[otro] = r
    return {
        "id": "viirs",
        "estado": metricas[VIIRS_DECIDE]["estado"],
        "decide": VIIRS_DECIDE,
        "metricas": metricas,
        "umbral": dict(UMBRAL_VIIRS),
    }



# ---------------------------------------------------------------------------
# Textos: de cada resultado a su frase (S8)
#
# Las frases las escribe el equipo, nunca este archivo. Viven en web/textos/es.json y en.json
# (los mismos de la página, docs/02: «nunca escritos dentro del código»), una por caso.
# Aquí solo se decide QUÉ caso es (por hechos ya calculados), se preparan los números y se
# insertan igual que la página (web/js/textos.js: {nombre} → valor).
# - Un caso sin texto (falta, null o vacío) queda «pendiente»: nunca se usa el de otro caso.
# - Un texto con un número que no existe o una palabra prohibida detiene (lo revisa una prueba
#   en cada PR, así que el robot diario no se encuentra con uno).
# Lo que esto no puede ver es el significado: un texto favorable escrito en el espacio de
# «no pasa» solo lo detecta la revisión humana.

TEXTOS_WEB = RAIZ / "web" / "textos"
IDIOMAS = ("es", "en")
CASOS = {
    "salto_2012": ("pasa_dentro", "pasa_fuera", "no_pasa_dentro", "no_pasa_fuera"),
    "aqua_fuera_muestra": ("pasa_zona_epoca", "pasa_unico", "no_pasa_zona_epoca", "no_pasa_unico"),
    "conafor": ("cumple", "no_cumple"),
    "viirs": ("pasa_noaa21_cumple", "pasa_noaa21_no_cumple",
              "no_pasa_noaa21_cumple", "no_pasa_noaa21_no_cumple"),
}
PARTES = ("nombre", "numero", "limitaciones")   # además de la frase de cada caso
# Los números que puede usar cada texto, ya listos para mostrar: razones con 2 decimales
# (como texto, para no perder el cero final de 1.10), porcentajes enteros, años enteros.
VALORES = {
    "salto_2012": ("razonCruda", "razonArmonizada", "reduccionPct", "naturalMin", "naturalMax",
                   "antesDesde", "antesHasta", "despuesDesde", "despuesHasta",
                   "razonCrudaYucatan", "razonArmonizadaYucatan"),
    "aqua_fuera_muestra": ("wapeZonaEpocaPct", "wapeUnicoPct", "mejoraPct", "factorUnico",
                           "desde", "hasta"),
    "conafor": ("incendios", "realSnpp", "azarSnpp", "realModis", "azarModis", "grandesSnpp"),
    "viirs": ("razonMinNoaa20", "razonMaxNoaa20", "diferenciaPctNoaa20", "razonMinNoaa21",
              "razonMaxNoaa21", "aniosDesde", "aniosHasta"),
}
# Plan de la tarea 7 (AC-006), con sus equivalentes en inglés. Se comparan sin mayúsculas ni
# acentos y como parte de una palabra («factor» también atrapa «factores»).
PROHIBIDAS = ("demuestra", "predice", "ve todo el fuego", "quemas ilegales",
              "demonstrat", "predict", "sees all fire", "illegal burn")
# CONAFOR mide detección, no la calibración (Prueba 3).
PROHIBIDAS_CONAFOR = ("calibra", "factor", "armoniz", "calibrat", "harmoniz")
_MARCADOR = re.compile(r"\{(\w+)\}")      # el mismo de web/js/textos.js
_CLAVE_VAL = re.compile(r"^val[A-Z]")


def _camel(texto: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in texto.split("_"))


def clave(id_prueba: str, parte: str) -> str:
    """Clave del texto en web/textos: clave("salto_2012", "pasa_dentro") → valSalto2012PasaDentro."""
    return "val" + _camel(id_prueba) + _camel(parte)


def claves_conocidas() -> dict[str, tuple[str, str]]:
    """{clave: (prueba, parte)} de todos los casos y partes."""
    return {clave(i, parte): (i, parte) for i, casos in CASOS.items() for parte in casos + PARTES}


def caso(resultado: dict) -> str:
    """Qué caso es, solo por hechos ya calculados (estado y lo que distingue cada prueba)."""
    i, estado, m = resultado["id"], resultado["estado"], resultado["metricas"]
    if i == "salto_2012":
        c = f"{estado}_{'dentro' if m['peninsula']['dentro_rango_natural'] else 'fuera'}"
    elif i == "aqua_fuera_muestra":
        c = f"{estado}_{m['modelo']}"
    elif i == "conafor":
        c = "cumple" if m["regresion_ok"] else "no_cumple"
    elif i == "viirs":
        c = f"{estado}_noaa21_{'cumple' if m['NOAA-21']['cumple_umbral'] else 'no_cumple'}"
    else:
        raise ValidacionError(f"prueba desconocida: {i!r}")
    if c not in CASOS[i]:
        raise ValidacionError(f"{i}: el caso {c!r} no está en CASOS")
    return c


def _r2(x) -> str | None:
    return None if x is None or not math.isfinite(x) else f"{x:.2f}"


def _pct(x, de_fraccion: bool = True) -> int | None:
    if x is None or not math.isfinite(x):
        return None
    return int(round(100 * x if de_fraccion else x))


def _razones_enteras(sat: dict) -> list[float]:
    return [a["razon"] for a in sat["por_anio"] if a["completo"]]


def valores(resultado: dict) -> dict:
    """Los números de VALORES[id], listos para mostrar (None si no existe)."""
    i, m = resultado["id"], resultado["metricas"]
    if i == "salto_2012":
        p, y = m["peninsula"], m["yucatan"]
        v = {"razonCruda": _r2(p["razon_cruda"]), "razonArmonizada": _r2(p["razon_armonizada"]),
             "reduccionPct": _pct(p["reduccion"]),
             "naturalMin": _r2(p["rango_natural"]["min"]), "naturalMax": _r2(p["rango_natural"]["max"]),
             "antesDesde": ANIOS_ANTES[0], "antesHasta": ANIOS_ANTES[1],
             "despuesDesde": ANIOS_DESPUES[0], "despuesHasta": ANIOS_DESPUES[1],
             "razonCrudaYucatan": _r2(y["razon_cruda"]),
             "razonArmonizadaYucatan": _r2(y["razon_armonizada"])}
    elif i == "aqua_fuera_muestra":
        v = {"wapeZonaEpocaPct": _pct(m["wape_zona_epoca"]), "wapeUnicoPct": _pct(m["wape_unico"]),
             "mejoraPct": _pct(m["mejora"]), "factorUnico": _r2(m["factor_unico"]),
             "desde": int(m["periodo"][0][:4]), "hasta": int(m["periodo"][1][:4])}
    elif i == "conafor":
        s, mo = m["por_satelite"]["S-NPP"], m["por_satelite"]["MODIS"]
        v = {"incendios": f"{m['incendios']:,}",
             "realSnpp": _pct(s["real"], False), "azarSnpp": _pct(s["azar_mayor"], False),
             "realModis": _pct(mo["real"], False), "azarModis": _pct(mo["azar_mayor"], False),
             "grandesSnpp": _pct(m["grandes_snpp"], False)}
    elif i == "viirs":
        n20, n21 = m["NOAA-20"], m["NOAA-21"]
        r20, r21 = _razones_enteras(n20), _razones_enteras(n21)
        v = {"razonMinNoaa20": _r2(min(r20)), "razonMaxNoaa20": _r2(max(r20)),
             "diferenciaPctNoaa20": f"{100 * n20['diferencia_agregada']:.1f}",
             "razonMinNoaa21": _r2(min(r21)), "razonMaxNoaa21": _r2(max(r21)),
             "aniosDesde": min(n20["anios_enteros"]), "aniosHasta": max(n20["anios_enteros"])}
    else:
        raise ValidacionError(f"prueba desconocida: {i!r}")
    return v


def rellenar(plantilla: str, vals: dict) -> str | None:
    """Pone los números en el texto como la página. None si un número usado no tiene valor."""
    usados = _MARCADOR.findall(plantilla)
    desconocidos = sorted(set(usados) - set(vals))
    if desconocidos:
        raise ValidacionError(f"el texto usa números que no existen: {desconocidos}")
    if any(vals[u] is None for u in usados):
        return None
    return _MARCADOR.sub(lambda mt: str(vals[mt.group(1)]), plantilla)


def _sin_acentos(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texto.lower())
                   if not unicodedata.combining(c))


def revisar_textos(textos: dict[str, dict]) -> None:
    """Revisa las claves val… de cada idioma: que existan, su tipo, sus números y sus palabras."""
    conocidas = claves_conocidas()
    for idioma, d in textos.items():
        for k, texto in d.items():
            if not _CLAVE_VAL.match(k) or texto in (None, ""):
                continue
            donde = f"{idioma}:{k}"
            if k not in conocidas:
                raise ValidacionError(f"{donde}: no es un caso ni una parte de ninguna prueba")
            prueba, parte = conocidas[k]
            lista = parte == "limitaciones"
            if lista != isinstance(texto, list) or (
                    lista and not all(isinstance(x, str) for x in texto)) or (
                    not lista and not isinstance(texto, str)):
                tipo = "una lista de textos" if lista else "un texto"
                raise ValidacionError(f"{donde}: tiene que ser {tipo}")
            for t in (texto if lista else [texto]):
                fuera = sorted(set(_MARCADOR.findall(t)) - set(VALORES[prueba]))
                if fuera:
                    raise ValidacionError(f"{donde}: usa números que no son de {prueba}: {fuera}")
                limpio = _sin_acentos(t)
                prohibidas = PROHIBIDAS + (PROHIBIDAS_CONAFOR if prueba == "conafor" else ())
                malas = [w for w in prohibidas if _sin_acentos(w) in limpio]
                if malas:
                    raise ValidacionError(f"{donde}: tiene palabras prohibidas {malas}")


def cargar_textos(carpeta: Path = TEXTOS_WEB) -> dict[str, dict]:
    """Los textos de la página en cada idioma (solo lectura)."""
    return {i: json.loads((carpeta / f"{i}.json").read_text(encoding="utf-8")) for i in IDIOMAS}


def textos_de(resultado: dict, textos: dict[str, dict]) -> dict:
    """Caso, clave, valores y los textos ya rellenados de un resultado, en cada idioma.

    Lo que falte queda en None y su clave en «pendiente» (idioma:clave).
    """
    revisar_textos(textos)
    i = resultado["id"]
    c = caso(resultado)
    vals = valores(resultado)
    sale = {"caso": c, "clave": clave(i, c), "valores": vals, "pendiente": []}
    for parte, nombre in ((c, "frase"),) + tuple((p, p) for p in PARTES):
        k = clave(i, parte)
        sale[nombre] = {}
        for idioma in IDIOMAS:
            texto = textos.get(idioma, {}).get(k)
            if texto in (None, "", []):
                lleno = None
            elif isinstance(texto, list):
                partes = [rellenar(t, vals) for t in texto]
                lleno = None if any(x is None for x in partes) else partes
            else:
                lleno = rellenar(texto, vals)
            if lleno is None:
                sale["pendiente"].append(f"{idioma}:{k}")
            sale[nombre][idioma] = lleno
    return sale



# ---------------------------------------------------------------------------
# Gráficas (S9)
#
# Cada gráfica dibuja SOLO el resultado de su prueba (no recalcula nada, así que no puede
# contradecir al número). Primero una tabla (función pura, se prueba sin mirar pixeles) y
# después el dibujo. Hechas para que cualquiera las lea (pedido de Nico, 14 nov). Reglas:
# - Cada panel dice en su título qué muestra, y cada umbral lleva su texto junto a la línea o
#   la banda, no en una leyenda aparte. Letra grande, nombres escritos, sin jerga.
# - Las barras empiezan en 0; los dos paneles del salto comparten escala.
# - La razón VIIRS va en un rango fijo (0.80–1.20) que solo se amplía si un punto quedaría
#   fuera: nunca se esconde un dato ni se hace zoom a una diferencia chica.
# - Un punto o una barra por año, no solo el promedio. Años parciales en hueco.
# - Además del color: rayas, formas de punto y nombres escritos.
# - Marca ✓/✗ junto a lo que decide (decisión de Nico del 14 nov; antes la regla era
#   «ninguna conclusión»). Sale del resultado (su estado o la misma regla congelada), nunca de
#   comparar en el dibujo, y va sin palabras: las frases las sigue decidiendo el equipo (S8).
# - CONAFOR dibuja solo S-NPP (el que decide) y solo los rangos de tamaño (decisión de Nico,
#   14 nov). Lo que no es un rango (la categoría «0») no se dibuja, pero se dice cuántos
#   incendios quedaron fuera. MODIS y todo lo demás siguen en validacion.json.

GRAFICAS = {
    "salto_2012": "validacion-salto-2012",
    "aqua_fuera_muestra": "validacion-aqua-2021-2025",
    "conafor": "validacion-conafor",
    "viirs": "validacion-viirs",
}
EJE_VIIRS = (0.80, 1.20)
_AZUL, _NARANJA, _AQUA = "#2a78d6", "#eb6834", "#1baf7a"   # orden categorical validado
_GRIS, _TINTA, _BANDA = "#8F877D", "#121212", "#E4E1DC"    # los de la página
_TENUE, _EJE, _RANGO = "#52514e", "#c3c2b7", "#C9C3BA"     # texto secundario, ejes, rango natural
_BIEN, _MAL = "#006300", "#d03b3b"     # ✓ y ✗: la forma basta, el color solo acompaña
_ESTILO = {
    "font.size": 11, "axes.titlesize": 12, "axes.titlelocation": "left", "axes.titlepad": 10,
    "axes.labelsize": 11, "xtick.labelsize": 11, "ytick.labelsize": 11, "legend.fontsize": 10,
    "figure.titlesize": 14, "text.color": _TINTA, "axes.labelcolor": _TINTA,
    "axes.edgecolor": _EJE, "xtick.color": _TENUE, "ytick.color": _TENUE,
}
ETIQUETAS = {
    "es": {
        "titulo_salto": "Prueba 1 · Salto de 2012 · Península de Yucatán",
        "sin_calibrar": "Sin calibrar", "calibrada": "Calibrada",
        "focos_sin_calibrar": "Cuadritos-día por año, sin calibrar",
        "focos_calibrada": "Cuadritos-día por año, calibrada",
        "transicion": "transición,\nfuera del\npromedio", "promedio": "promedio",
        "razon_salto": "Promedio 2013–15 ÷ promedio 2009–11",
        "sin_salto": "(sin salto)", "umbral": "umbral", "rango_natural": "rango natural",
        "titulo_aqua": "Prueba 2 · Aqua en años fuera de la calibración",
        "focos_anio": "Cuadritos-día por año",
        "snpp": "S-NPP (observado)", "aqua_zona": "Aqua × factor por zona y época",
        "aqua_unico": "Aqua × factor único", "error": "Error de Aqua contra S-NPP (%)",
        "limite": "límite", "zona_epoca": "Por zona\ny época", "unico": "Único",
        "elegido": "elegido",
        "titulo_conafor": "Prueba 3 · Incendios de CONAFOR · informativa",
        "con_focos": "Incendios con un foco de S-NPP cerca (%)\na menos de 2 km, ±1 día",
        "real": "Incendios de CONAFOR", "control_anio": "Azar: mismo lugar, otro año",
        "control_lugar": "Azar: mismas fechas, a 20 km", "veces_azar": "3 × el azar mayor",
        "por_tamano": "Incendios que vio S-NPP,\nsegún su tamaño (%)", "minimo": "mínimo",
        "tamano": "Tamaño del incendio en hectáreas (cuántos hay)",
        "sin_rango": "Incendios sin rango de tamaño, no se muestran: {n}",
        "titulo_viirs": "Prueba 4 · NOAA-20 y NOAA-21 contra S-NPP",
        "razon_viirs": "Focos de NOAA ÷ focos de S-NPP", "iguales": "1 = cuentan lo mismo",
        "noaa20": "NOAA-20 con su factor", "noaa21": "NOAA-21 sin factor (informativa)",
        "noaa20_crudo": "NOAA-20 sin factor", "completo": "año completo",
        "parcial": "año parcial (no decide)",
    },
    "en": {
        "titulo_salto": "Test 1 · 2012 jump · Yucatán Peninsula",
        "sin_calibrar": "Uncalibrated", "calibrada": "Calibrated",
        "focos_sin_calibrar": "Grid cell-days per year, uncalibrated",
        "focos_calibrada": "Grid cell-days per year, calibrated",
        "transicion": "transition,\nnot in the\naverage", "promedio": "average",
        "razon_salto": "Average 2013–15 ÷ average 2009–11",
        "sin_salto": "(no jump)", "umbral": "threshold", "rango_natural": "natural range",
        "titulo_aqua": "Test 2 · Aqua in years outside the calibration",
        "focos_anio": "Grid cell-days per year",
        "snpp": "S-NPP (observed)", "aqua_zona": "Aqua × zone and season factor",
        "aqua_unico": "Aqua × single factor", "error": "Aqua error against S-NPP (%)",
        "limite": "limit", "zona_epoca": "Zone and\nseason", "unico": "Single",
        "elegido": "chosen",
        "titulo_conafor": "Test 3 · CONAFOR wildfires · informative",
        "con_focos": "Wildfires with an S-NPP hot spot nearby (%)\nwithin 2 km, ±1 day",
        "real": "CONAFOR wildfires", "control_anio": "Chance: same place, another year",
        "control_lugar": "Chance: same dates, 20 km away", "veces_azar": "3 × the higher chance",
        "por_tamano": "Wildfires S-NPP saw,\nby size (%)", "minimo": "minimum",
        "tamano": "Wildfire size in hectares (how many there are)",
        "sin_rango": "Wildfires without a size range, not shown: {n}",
        "titulo_viirs": "Test 4 · NOAA-20 and NOAA-21 against S-NPP",
        "razon_viirs": "NOAA hot spots ÷ S-NPP hot spots", "iguales": "1 = same count",
        "noaa20": "NOAA-20 with its factor", "noaa21": "NOAA-21 without factor (informative)",
        "noaa20_crudo": "NOAA-20 without factor", "completo": "full year",
        "parcial": "partial year (does not decide)",
    },
}


def _promedio(filas: list[dict], campo: str, anios: tuple[int, int]) -> float:
    return float(np.mean([f[campo] for f in filas if anios[0] <= f["anio"] <= anios[1]]))


def _inicio_rango(tamano: str) -> int | None:
    """Dónde empieza un rango de tamaño de CONAFOR, para ordenarlos de menor a mayor.

    «21 a 50 Hectáreas» → 21; «Mayor a 100 Hectáreas» → 100. Lo que no es un rango (como la
    categoría «0», con un solo incendio en los datos reales) → None.
    """
    n = re.findall(r"\d+", tamano)
    if "mayor" in tamano.lower() and n:
        return int(n[0])
    return int(n[0]) if len(n) == 2 else None


def _tamano_corto(tamano: str) -> str:
    """«21 a 50 Hectáreas» → «21–50 ha»; «Mayor a 100 Hectáreas» → «> 100 ha» (sirve en los dos idiomas)."""
    n = re.findall(r"\d+", tamano)
    if "mayor" in tamano.lower() and n:
        return f"> {n[0]} ha"
    return f"{n[0]}–{n[1]} ha" if len(n) == 2 else tamano


def tabla_grafica(resultado: dict) -> dict:
    """Lo que se dibuja, sacado tal cual del resultado (sin recalcular métricas)."""
    i, m = resultado["id"], resultado["metricas"]
    if i == "salto_2012":
        p = m["peninsula"]
        filas = p["totales"]
        return {
            "anios": filas,
            "promedio_antes": {c: _promedio(filas, c, ANIOS_ANTES) for c in ("crudo", "armonizado")},
            "promedio_despues": {c: _promedio(filas, c, ANIOS_DESPUES) for c in ("crudo", "armonizado")},
            "razon_cruda": p["razon_cruda"], "razon_armonizada": p["razon_armonizada"],
            "rango_natural": (p["rango_natural"]["min"], p["rango_natural"]["max"]),
            "umbral": (UMBRAL_SALTO["razon_min"], UMBRAL_SALTO["razon_max"]),
            "pasa": resultado["estado"] == "pasa",
        }
    if i == "aqua_fuera_muestra":
        return {
            "anios": [{"anio": a["anio"], "observado": a["observado"],
                       "zona_epoca": a["predicho_zona_epoca"], "unico": a["predicho_unico"]}
                      for a in m["por_anio"]],
            "wape": {"zona_epoca": m["wape_zona_epoca"], "unico": m["wape_unico"]},
            "elegido": m["modelo"], "umbral": UMBRAL_AQUA["wape_max"],
            "pasa": resultado["estado"] == "pasa",
        }
    if i == "conafor":
        s = m["por_satelite"]["S-NPP"]
        rangos = [(t, v) for t, v in m["por_tamano"].items() if _inicio_rango(t) is not None]
        return {
            "snpp": {k: s[k] for k in ("real", "control_anio", "control_lugar")},
            "meta_azar": UMBRAL_CONAFOR["veces_azar_min"] * max(s["control_anio"], s["control_lugar"]),
            "supera_azar": supera_azar(s["real"], s["control_anio"], s["control_lugar"]),
            "tamanos": [{"tamano": t, **v} for t, v in sorted(rangos, key=lambda tv: _inicio_rango(tv[0]))],
            "sin_rango": sum(v["incendios"] for t, v in m["por_tamano"].items()
                             if _inicio_rango(t) is None),
            "grandes": TAMANO_GRANDES,
            "umbral_grandes": UMBRAL_CONAFOR["grandes_min"],
            "ve_grandes": ve_grandes(m["grandes_snpp"]),
        }
    if i == "viirs":
        sats = {s: [{"anio": a["anio"], "completo": a["completo"], "razon": a["razon"],
                     "razon_cruda": a.get("razon_cruda")} for a in m[s]["por_anio"]]
                for s in PERIODOS_VIIRS}
        vistos = [v for filas in sats.values() for f in filas
                  for v in (f["razon"], f["razon_cruda"]) if v is not None]
        eje = (min([EJE_VIIRS[0]] + [v - 0.05 for v in vistos]),
               max([EJE_VIIRS[1]] + [v + 0.05 for v in vistos]))
        return {"satelites": sats, "banda": (UMBRAL_VIIRS["razon_min"], UMBRAL_VIIRS["razon_max"]),
                "eje": eje, "cumple": {s: bool(m[s]["cumple_umbral"]) for s in PERIODOS_VIIRS}}
    raise ValidacionError(f"prueba desconocida: {i!r}")


def _ejes_simples(ax, grid: str = "y") -> None:
    ax.spines[["top", "right"]].set_visible(False)
    if grid:
        ax.grid(axis=grid, color=_BANDA, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(length=0, pad=6)


def _miles(ax) -> None:
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))


def _marca(ax, ok: bool, junto_a, dx: float = 5, izquierda: bool = False) -> None:
    """✓ o ✗ pegada a un texto ya dibujado (se mueve con él); a la derecha, o a la izquierda
    cuando del otro lado está el punto que el texto nombra."""
    ax.annotate("✓" if ok else "✗", xy=(0 if izquierda else 1, 0.5), xycoords=junto_a,
                xytext=(-dx if izquierda else dx, 0), textcoords="offset points",
                ha="right" if izquierda else "left", va="center", fontsize=16,
                fontweight="bold", color=_BIEN if ok else _MAL)


def _figura_salto(t: dict, e: dict) -> Figure:
    fig = Figure(figsize=(10, 6.4))
    gs = fig.add_gridspec(2, 2, height_ratios=[3, 1.3])
    crudo = fig.add_subplot(gs[0, 0])
    armonizado = fig.add_subplot(gs[0, 1], sharey=crudo)
    razones = fig.add_subplot(gs[1, :])
    anios = [f["anio"] for f in t["anios"]]
    for ax, campo, color, titulo in ((crudo, "crudo", _GRIS, e["focos_sin_calibrar"]),
                                     (armonizado, "armonizado", _AZUL, e["focos_calibrada"])):
        for f in t["anios"]:
            ax.bar(f["anio"], f[campo], width=0.8, color="white" if f["transicion"] else color,
                   edgecolor=color, hatch="///" if f["transicion"] else None, linewidth=1)
            if f["transicion"]:
                ax.annotate(e["transicion"], (f["anio"], f[campo]), xytext=(0, 5),
                            textcoords="offset points", ha="center", va="bottom", fontsize=9,
                            color=_TENUE, linespacing=1.1)
        for periodo, prom in ((ANIOS_ANTES, t["promedio_antes"]), (ANIOS_DESPUES, t["promedio_despues"])):
            ax.plot([periodo[0] - 0.45, periodo[1] + 0.45], [prom[campo]] * 2, color=_TINTA,
                    linewidth=2.2, solid_capstyle="butt")
            ax.text((periodo[0] + periodo[1]) / 2, prom[campo], f"{e['promedio']} {prom[campo]:,.0f}",
                    ha="center", va="center", fontsize=9.5,
                    bbox={"boxstyle": "round,pad=0.25", "facecolor": "white",
                          "edgecolor": _TINTA, "linewidth": 0.8})
        ax.set_title(titulo)
        ax.set_xticks(anios)
        _miles(ax)
        _ejes_simples(ax)
    armonizado.tick_params(labelleft=False)
    alto = max(f[c] for f in t["anios"] for c in ("crudo", "armonizado"))
    crudo.set_ylim(0, alto * 1.15)      # aire arriba para el texto de 2012, sin tapar barras

    lo, hi = t["umbral"]
    nmin, nmax = t["rango_natural"]
    razones.axvspan(lo, hi, color=_BANDA, zorder=0, linewidth=0)
    razones.axvspan(nmin, nmax, ymin=0.3, ymax=0.7, color=_RANGO, zorder=1, linewidth=0)
    razones.axvline(1, color=_TINTA, linewidth=0.8, zorder=2)
    # Textos que no cruzan la línea del 1: «umbral» a su izquierda (los bordes ya son marcas
    # del eje), el rango natural a la derecha de su banda.
    razones.text(lo + 0.02, 0.92, e["umbral"], ha="left", va="top", fontsize=9.5, color=_TENUE)
    razones.text(nmax + 0.03, 0, f"{e['rango_natural']} {nmin:.2f}–{nmax:.2f}",
                 ha="left", va="center", fontsize=9.5, color=_TENUE)
    # Cada nombre hacia afuera: lo calibrado a la izquierda de su punto (a la derecha está el
    # rango natural), lo crudo a la derecha.
    for valor, color, nombre, marca in ((t["razon_cruda"], _GRIS, e["sin_calibrar"], None),
                                        (t["razon_armonizada"], _AZUL, e["calibrada"], t["pasa"])):
        razones.scatter([valor], [0], s=120, color=color, edgecolors="white", linewidths=1.5,
                        zorder=3)
        izquierda = marca is not None
        texto = razones.annotate(f"{nombre}: {valor:.2f}", (valor, 0),
                                 xytext=(-10 if izquierda else 10, 0), textcoords="offset points",
                                 ha="right" if izquierda else "left", va="center",
                                 fontsize=11, fontweight="bold")
        if marca is not None:
            _marca(razones, marca, texto, izquierda=True)
    derecha = max(t["razon_cruda"], t["razon_armonizada"], hi) * 1.25
    izquierda = min(0.0, t["razon_armonizada"] - 0.75)   # sitio para el nombre de lo calibrado
    razones.set_xlim(izquierda, derecha)
    razones.set_ylim(-1, 1)
    marcas = [0, lo, 1, hi] + list(range(2, int(derecha) + 1))
    razones.xaxis.set_major_locator(FixedLocator(marcas))
    razones.xaxis.set_major_formatter(
        FuncFormatter(lambda v, _: f"1\n{e['sin_salto']}" if v == 1 else f"{v:g}"))
    razones.set_yticks([])
    razones.spines[["top", "right", "left"]].set_visible(False)
    razones.tick_params(length=0, pad=6)
    razones.set_title(e["razon_salto"])
    fig.suptitle(e["titulo_salto"])
    return fig


def _figura_aqua(t: dict, e: dict) -> Figure:
    fig = Figure(figsize=(10, 4.8))
    gs = fig.add_gridspec(1, 2, width_ratios=[1.7, 0.75])
    ax, axw = fig.add_subplot(gs[0]), fig.add_subplot(gs[1])
    x = np.arange(len(t["anios"]))
    for k, (campo, color, hatch, nombre) in enumerate((
            ("observado", _AZUL, None, e["snpp"]), ("zona_epoca", _NARANJA, None, e["aqua_zona"]),
            ("unico", _AQUA, "..", e["aqua_unico"]))):
        ax.bar(x + (k - 1) * 0.27, [f[campo] for f in t["anios"]], width=0.25, color=color,
               hatch=hatch, edgecolor="white", label=nombre)
    ax.set_xticks(x, [str(f["anio"]) for f in t["anios"]])
    ax.set_title(e["focos_anio"])
    alto = max(f[c] for f in t["anios"] for c in ("observado", "zona_epoca", "unico"))
    ax.set_ylim(0, alto * 1.35)
    _miles(ax)
    ax.legend(loc="upper left", frameon=False)
    _ejes_simples(ax)

    nombres = [e["zona_epoca"], e["unico"]]
    valores_w = [100 * t["wape"]["zona_epoca"], 100 * t["wape"]["unico"]]
    axw.bar([0, 1], valores_w, width=0.6, color=[_NARANJA, _AQUA], hatch=[None, ".."],
            edgecolor="white")
    elegido = 0 if t["elegido"] == "zona_epoca" else 1
    for k, v in enumerate(valores_w):
        texto = axw.annotate(f"{v:.0f} %", (k, v), xytext=(0, 4), textcoords="offset points",
                             ha="center", va="bottom", fontsize=11,
                             fontweight="bold" if k == elegido else "normal")
        if k == elegido:
            _marca(axw, t["pasa"], texto, dx=3)
    limite = 100 * t["umbral"]
    axw.axhline(limite, color=_TINTA, linestyle="--", linewidth=1)
    axw.text(1.45, limite, f"{e['limite']} {limite:.0f} %", ha="right", va="bottom",
             fontsize=10, color=_TINTA)
    nombres[elegido] += f"\n({e['elegido']})"
    axw.set_xticks([0, 1], nombres)
    axw.set_xlim(-0.55, 1.55)
    axw.set_ylim(0, max(valores_w + [limite]) * 1.3)
    axw.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0f}"))
    axw.set_title(e["error"])
    _ejes_simples(axw)
    fig.suptitle(e["titulo_aqua"])
    return fig


def _figura_conafor(t: dict, e: dict) -> Figure:
    fig = Figure(figsize=(11, 4.9))
    gs = fig.add_gridspec(1, 2, width_ratios=[1.1, 1])
    ax, axt = fig.add_subplot(gs[0]), fig.add_subplot(gs[1])
    filas = (("real", _AZUL, e["real"]), ("control_anio", _GRIS, e["control_anio"]),
             ("control_lugar", _GRIS, e["control_lugar"]))
    y = np.arange(len(filas))[::-1]          # lo real arriba
    for yy, (campo, color, _) in zip(y, filas):
        v = t["snpp"][campo]
        ax.barh(yy, v, height=0.6, color=color)
        texto = ax.annotate(f"{v:.0f} %", (v, yy), xytext=(5, 0), textcoords="offset points",
                            ha="left", va="center", fontsize=11,
                            fontweight="bold" if campo == "real" else "normal")
        if campo == "real":
            _marca(ax, t["supera_azar"], texto)
    ax.axvline(t["meta_azar"], ymax=0.88, color=_TINTA, linestyle="--", linewidth=1)
    ax.text(t["meta_azar"], len(filas) - 0.55, f"{e['veces_azar']} = {t['meta_azar']:.0f} %",
            ha="left", va="center", fontsize=10)
    ax.set_yticks(y, [nombre for _, _, nombre in filas])
    ax.set_ylim(-0.5, len(filas) - 0.25)
    ax.set_xlim(0, 100)
    ax.set_xticks(range(0, 101, 20))
    ax.set_title(e["con_focos"])
    _ejes_simples(ax, grid="x")

    xt = np.arange(len(t["tamanos"]))
    vals = [f["snpp"] for f in t["tamanos"]]
    axt.bar(xt, vals, width=0.6, color=_AZUL)
    for k, f in enumerate(t["tamanos"]):
        grande = f["tamano"] == t["grandes"]
        texto = axt.annotate(f"{f['snpp']:.0f}", (k, f["snpp"]), xytext=(0, 4),
                             textcoords="offset points", ha="center", va="bottom", fontsize=11,
                             fontweight="bold" if grande else "normal")
        if grande:
            _marca(axt, t["ve_grandes"], texto, dx=3)
            u = t["umbral_grandes"]
            axt.plot([k - 0.45, k + 0.45], [u, u], color=_TINTA, linestyle="--", linewidth=1.2)
            axt.annotate(f"{e['minimo']} {u:.0f} %", (k - 0.5, u), xytext=(-2, 2),
                         textcoords="offset points", ha="right", va="bottom", fontsize=10)
    axt.set_xticks(xt, [f"{_tamano_corto(f['tamano']).removesuffix(' ha')}\n({f['incendios']:,})"
                        for f in t["tamanos"]], fontsize=10)
    nota = e["tamano"]
    if t["sin_rango"]:
        nota += "\n" + e["sin_rango"].format(n=t["sin_rango"])
    axt.set_xlabel(nota, fontsize=9.5, color=_TENUE)
    axt.set_ylim(0, 110)
    axt.set_yticks(range(0, 101, 20))
    axt.set_title(e["por_tamano"])
    _ejes_simples(axt)
    fig.suptitle(e["titulo_conafor"])
    return fig


def _figura_viirs(t: dict, e: dict) -> Figure:
    fig = Figure(figsize=(10, 5))
    ax = fig.add_subplot()
    lo, hi = t["banda"]
    anios = sorted({f["anio"] for filas in t["satelites"].values() for f in filas})
    ax.axhspan(lo, hi, color=_BANDA, linewidth=0, zorder=0)
    ax.annotate(f"{e['umbral']} {lo:.2f}–{hi:.2f}", (anios[0] - 0.6, hi), xytext=(6, -5),
                textcoords="offset points", ha="left", va="top", fontsize=9.5, color=_TENUE)
    ax.axhline(1, color=_TINTA, linewidth=0.8, zorder=1)
    estilos = {"NOAA-20": (_AZUL, "o", -0.08, e["noaa20"]), "NOAA-21": (_NARANJA, "s", 0.08, e["noaa21"])}
    for sat, filas in t["satelites"].items():
        color, marca, dx, nombre = estilos[sat]
        for completo in (True, False):
            sel = [f for f in filas if f["completo"] is completo and f["razon"] is not None]
            if sel:
                ax.scatter([f["anio"] + dx for f in sel], [f["razon"] for f in sel], s=75,
                           marker=marca, facecolors=color if completo else "none",
                           edgecolors=color, linewidths=1.8, zorder=3)
        if sat == "NOAA-20":
            crudas = [f for f in filas if f["razon_cruda"] is not None]
            ax.plot([f["anio"] + dx for f in crudas], [f["razon_cruda"] for f in crudas],
                    linestyle="none", marker="_", markersize=12, markeredgewidth=1.5, color=_GRIS,
                    zorder=2)
        # Nombre escrito junto a la serie: NOAA-20 sobre su punto más alto; NOAA-21 a la
        # izquierda de su primer punto (empieza después, ahí hay espacio).
        con_razon = [f for f in filas if f["razon"] is not None]
        if not con_razon:
            continue
        if sat == "NOAA-20":
            f = max(con_razon, key=lambda f: f["razon"])
            texto = ax.annotate(nombre, (f["anio"] + dx, f["razon"]), xytext=(0, 11),
                                textcoords="offset points", ha="center", va="bottom",
                                fontsize=10.5, fontweight="bold")
        else:
            f = min(con_razon, key=lambda f: f["anio"])
            texto = ax.annotate(nombre, (f["anio"] + dx, f["razon"]), xytext=(-12, 0),
                                textcoords="offset points", ha="right", va="center",
                                fontsize=10.5, fontweight="bold")
        _marca(ax, t["cumple"][sat], texto, izquierda=sat != "NOAA-20")
    claves = [Line2D([], [], linestyle="none", marker="o", markersize=8, color=_GRIS),
              Line2D([], [], linestyle="none", marker="o", markersize=8, markerfacecolor="none",
                     markeredgecolor=_GRIS, markeredgewidth=1.8),
              Line2D([], [], linestyle="none", marker="_", markersize=12, markeredgewidth=1.5,
                     color=_GRIS)]
    ax.legend(claves, [e["completo"], e["parcial"], e["noaa20_crudo"]], loc="lower left",
              ncol=3, frameon=False)
    ax.set_xticks(anios)
    ax.set_xlim(anios[0] - 0.6, anios[-1] + 0.6)
    ax.set_ylabel(f"{e['razon_viirs']}\n({e['iguales']})")
    ax.set_ylim(*t["eje"])
    _ejes_simples(ax, grid="")
    fig.suptitle(e["titulo_viirs"])
    return fig


_DIBUJOS = {"salto_2012": _figura_salto, "aqua_fuera_muestra": _figura_aqua,
            "conafor": _figura_conafor, "viirs": _figura_viirs}


def figura(resultado: dict, idioma: str) -> Figure:
    """La gráfica de una prueba en un idioma (sin guardar)."""
    if idioma not in ETIQUETAS:
        raise ValidacionError(f"idioma desconocido: {idioma!r}")
    if resultado["id"] not in _DIBUJOS:
        raise ValidacionError(f"prueba desconocida: {resultado['id']!r}")
    with rc_context(_ESTILO):
        fig = _DIBUJOS[resultado["id"]](tabla_grafica(resultado), ETIQUETAS[idioma])
    fig.set_layout_engine("constrained")
    return fig


def textos_figura(fig: Figure) -> list[str]:
    """Todo el texto visible de una figura (títulos, ejes, leyendas, notas)."""
    textos = [fig.get_suptitle()]
    for ax in fig.axes:
        textos += [ax.get_title(loc=lado) for lado in ("left", "center", "right")]
        textos += [ax.get_xlabel(), ax.get_ylabel()]
        textos += [x.get_text() for x in ax.get_xticklabels() + ax.get_yticklabels() + ax.texts]
        if ax.get_legend():
            textos += [x.get_text() for x in ax.get_legend().get_texts()]
    return [x for x in textos if x]


def archivo_grafica(id_prueba: str, idioma: str) -> str:
    nombre = GRAFICAS.get(id_prueba)
    if nombre is None:
        raise ValidacionError(f"prueba desconocida: {id_prueba!r}")
    return f"{nombre}-{idioma}.png"


def dibujar_graficas(resultado: dict) -> dict[str, bytes]:
    """La gráfica de una prueba en cada idioma, como PNG en memoria (sin escribir nada)."""
    imagenes = {}
    for idioma in IDIOMAS:
        archivo_grafica(resultado["id"], idioma)
        buf = io.BytesIO()
        with rc_context(_ESTILO):        # lo que matplotlib arma hasta dibujar usa el mismo estilo
            figura(resultado, idioma).savefig(buf, format="png", dpi=150, metadata={"Software": None})
        imagenes[idioma] = buf.getvalue()
    return imagenes


def dibujar_todas(resultados: list[dict]) -> dict[str, dict[str, bytes]]:
    return {r["id"]: dibujar_graficas(r) for r in resultados}


def guardar_graficas(resultado: dict, carpeta: Path) -> dict[str, str]:
    """Escribe la gráfica en cada idioma; devuelve sus rutas relativas a salidas/.

    Primero dibuja todo en memoria y solo después escribe, para no dejar una a medias.
    """
    imagenes = dibujar_graficas(resultado)
    carpeta.mkdir(parents=True, exist_ok=True)
    rutas = {}
    for idioma, datos in imagenes.items():
        archivo = archivo_grafica(resultado["id"], idioma)
        (carpeta / archivo).write_bytes(datos)
        rutas[idioma] = f"graficas/{archivo}"
    return rutas


# ---------------------------------------------------------------------------
# validacion.json (S10)
#
# Un solo archivo con las cuatro pruebas, en orden fijo. Resumen (estado, caso, valores,
# textos) para la página y el guion; métricas y umbral para auditar.
# - Estable: sin fechas ni horas, así que con los mismos datos sale igual byte por byte (el
#   robot diario solo sube lo que cambia; ninguna prueba usa datos después del 1 nov 2026).
# - Honesto: un NaN o un infinito detiene y dice en qué campo (no se convierte en null); los
#   None que ya existen a propósito (texto pendiente, época sin fuego) salen como null.
#   Sin rutas absolutas.
# - Completo o nada: todo se arma y se revisa en memoria, se escribe en una carpeta temporal
#   dentro de salidas/, se verifica y solo entonces se mueve: primero las gráficas y al final
#   el JSON, que es el sello de la corrida. El JSON guarda la huella (sha256) de cada gráfica
#   para que cualquiera compruebe que salió de la misma corrida. Si la corrida falla, el robot
#   no sube nada (correr_todo.py se detiene).

SALIDAS = RAIZ / "salidas"
ARCHIVO_VALIDACION = "validacion.json"
CARPETA_GRAFICAS = "graficas"
SCHEMA_VERSION = 1
ORDEN = ("salto_2012", "aqua_fuera_muestra", "conafor", "viirs")
CRITERIOS = {"congelados": "commit 4972835 (PR #3)", "regla_prueba_2": "commit 4972835 (PR #3)"}
_RUTA_ABSOLUTA = re.compile(r"^(/|[A-Za-z]:[\\/]|~)")
_FECHA_HORA = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")


def _a_json(valor, donde: str):
    """Convierte a tipos simples de JSON; detiene con NaN, infinitos o tipos raros."""
    if valor is None or isinstance(valor, str):
        return valor
    if isinstance(valor, (bool, np.bool_)):
        return bool(valor)
    if isinstance(valor, (int, np.integer)):
        return int(valor)
    if isinstance(valor, (float, np.floating)):
        if not math.isfinite(valor):
            raise ValidacionError(f"{donde}: vale {valor} (NaN o infinito); no se convierte en null")
        return float(valor)
    if isinstance(valor, dict):
        fuera = [k for k in valor if not isinstance(k, str)]
        if fuera:
            raise ValidacionError(f"{donde}: claves que no son texto {fuera}")
        return {k: _a_json(v, f"{donde}.{k}") for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_a_json(v, f"{donde}[{n}]") for n, v in enumerate(valor)]
    raise ValidacionError(f"{donde}: tipo que no va en JSON ({type(valor).__name__})")


def _textos_sueltos(valor, donde: str):
    if isinstance(valor, str):
        yield donde, valor
    elif isinstance(valor, dict):
        for k, v in valor.items():
            yield from _textos_sueltos(v, f"{donde}.{k}")
    elif isinstance(valor, list):
        for n, v in enumerate(valor):
            yield from _textos_sueltos(v, f"{donde}[{n}]")


def revisar_json(doc: dict) -> None:
    """Las cuatro pruebas en orden, sin rutas absolutas ni fechas con hora."""
    if doc.get("schema_version") != SCHEMA_VERSION:
        raise ValidacionError(f"schema_version tiene que ser {SCHEMA_VERSION}")
    ids = [p.get("id") for p in doc.get("pruebas", [])]
    if ids != list(ORDEN):
        raise ValidacionError(f"tienen que ser las cuatro pruebas {list(ORDEN)}, no {ids}")
    for donde, texto in _textos_sueltos(doc, "validacion"):
        if _RUTA_ABSOLUTA.match(texto) or str(RAIZ) in texto:
            raise ValidacionError(f"{donde}: ruta absoluta {texto!r}")
        if _FECHA_HORA.search(texto):
            raise ValidacionError(f"{donde}: fecha con hora {texto!r}; haría que cada corrida cambie")


def _entrada(resultado: dict, textos: dict, imagenes: dict[str, bytes]) -> dict:
    i = resultado["id"]
    t = textos_de(resultado, textos)
    e = {"id": i, "estado": resultado["estado"]}
    e.update({k: v for k, v in resultado.items() if k not in ("id", "estado", "metricas", "umbral")})
    e.update({
        "caso": t["caso"], "clave": t["clave"],
        "nombre": t["nombre"], "numero": t["numero"], "frase": t["frase"],
        "limitaciones": t["limitaciones"], "pendiente": t["pendiente"], "valores": t["valores"],
        "grafica": {idioma: f"{CARPETA_GRAFICAS}/{archivo_grafica(i, idioma)}" for idioma in IDIOMAS},
        "huella_grafica": {idioma: "sha256:" + hashlib.sha256(imagenes[idioma]).hexdigest()
                           for idioma in IDIOMAS},
        "metricas": resultado["metricas"],
        "umbral": resultado["umbral"],
    })
    return e


def armar_validacion(resultados: list[dict], textos: dict, imagenes: dict[str, dict[str, bytes]]) -> dict:
    """El documento completo en memoria, revisado. imagenes = dibujar_todas(resultados)."""
    ids = [r["id"] for r in resultados]
    if sorted(ids) != sorted(ORDEN):
        raise ValidacionError(f"se necesitan exactamente las cuatro pruebas {list(ORDEN)}, no {ids}")
    por_id = {r["id"]: r for r in resultados}
    doc = {
        "schema_version": SCHEMA_VERSION,
        "criterios": dict(CRITERIOS),
        "pruebas": [_a_json(_entrada(por_id[i], textos, imagenes[i]), i) for i in ORDEN],
    }
    revisar_json(doc)
    return doc


def serializar(doc: dict) -> bytes:
    return (json.dumps(doc, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def verificar_corrida(carpeta: Path, doc: dict) -> None:
    """Que en `carpeta` estén el JSON y las 8 gráficas, y que cada huella coincida."""
    leido = json.loads((carpeta / ARCHIVO_VALIDACION).read_text(encoding="utf-8"))
    if leido != doc:
        raise ValidacionError("el JSON escrito no es el que se armó")
    for p in doc["pruebas"]:
        for idioma, ruta in p["grafica"].items():
            archivo = carpeta / ruta
            if not archivo.is_file():
                raise ValidacionError(f"falta la gráfica {ruta}")
            datos = archivo.read_bytes()
            if not datos.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValidacionError(f"{ruta} no es un PNG")
            if "sha256:" + hashlib.sha256(datos).hexdigest() != p["huella_grafica"][idioma]:
                raise ValidacionError(f"{ruta}: la imagen no corresponde a la huella del JSON")


def escribir_validacion(resultados: list[dict], textos: dict, salidas: Path = SALIDAS) -> dict:
    """Escribe validacion.json y sus 8 gráficas completos, o no toca nada."""
    imagenes = dibujar_todas(resultados)
    doc = armar_validacion(resultados, textos, imagenes)
    datos = serializar(doc)

    salidas.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=".validacion-", dir=salidas))
    try:
        (tmp / CARPETA_GRAFICAS).mkdir()
        for i, por_idioma in imagenes.items():
            for idioma, png in por_idioma.items():
                (tmp / CARPETA_GRAFICAS / archivo_grafica(i, idioma)).write_bytes(png)
        (tmp / ARCHIVO_VALIDACION).write_bytes(datos)
        verificar_corrida(tmp, doc)

        destino = salidas / CARPETA_GRAFICAS
        destino.mkdir(exist_ok=True)
        nuevas = set()
        for png in sorted((tmp / CARPETA_GRAFICAS).iterdir()):
            os.replace(png, destino / png.name)
            nuevas.add(png.name)
        for vieja in destino.glob("validacion-*.png"):
            if vieja.name not in nuevas:
                vieja.unlink()
        os.replace(tmp / ARCHIVO_VALIDACION, salidas / ARCHIVO_VALIDACION)   # el sello, al final
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return doc



# ---------------------------------------------------------------------------
# Preflight (S11): ¿las entregas reales cumplen lo que cada prueba necesita?
#
# Se corre antes de calcular. Solo lee; no escribe nada. Si algo falla, el problema es de la
# entrega (tareas 2 a 5), no de la validación: se reporta a quien la entregó y no se parchea
# desde aquí. Reúne todos los fallos en un reporte en vez de detenerse en el primero. Reusa
# los contratos que ya existen (S2, S5, S7, S8 y los de armonizar.py) sin copiarlos.

ENTRADAS = {"calendario": "calendario.parquet", "factores": "factores.csv"}
COLUMNAS_INCENDIOS = ("latitud", "longitud", "ini", "fin", "Tamano")
COLUMNAS_FOCOS_CONAFOR = ("sensor", "acq_date", "latitude", "longitude")


def cargar_entradas(salidas: Path = SALIDAS) -> dict:
    """Lee las entradas reales (solo lectura): tareas 2 a 5, el cruce con CONAFOR y los textos."""
    faltan = [n for n in ENTRADAS.values() if not (salidas / n).is_file()]
    if faltan:
        raise ValidacionError(f"faltan {faltan} en {salidas.name}/ (tareas 3 a 5)")
    from cargar import cargar_focos
    from rejilla import cuadritos_dia, cuadritos_dia_peninsula

    focos = cargar_focos()
    conafor_focos, conafor_incendios = cruce_conafor().cargar()
    return {
        "calendario": pd.read_parquet(salidas / ENTRADAS["calendario"]),
        "factores": pd.read_csv(salidas / ENTRADAS["factores"]),
        "por_zona": cuadritos_dia(focos),
        "peninsula": cuadritos_dia_peninsula(focos),
        "conafor_incendios": conafor_incendios,
        "conafor_focos": conafor_focos,
        "textos": cargar_textos(),
    }


def _rev_calendario(e: dict) -> str:
    c = e["calendario"]
    validar_calendario(c)
    return f"{c['anio'].min()}–{c['anio'].max()}, {c['municipio'].nunique()} municipios"


def _rev_factores(e: dict) -> str:
    validar_factores(e["factores"])
    return f"{len(e['factores'])} factores"


def _rev_focos_peninsula(e: dict) -> str:
    p = e["peninsula"]
    faltan = sorted(armonizar.NECESARIAS - set(p.columns))
    if faltan:
        raise ValidacionError(f"faltan las columnas {faltan}")
    if p.empty:
        raise ValidacionError("no hay ningún cuadrito-día")
    return f"{len(p):,} cuadritos-día"


def _rev_focos_zona(e: dict) -> str:
    z = e["por_zona"]
    try:   # el contrato de Gadiel tal cual: columnas y zonas conocidas
        armonizar.dias_por_zona(z, "Aqua", None, pd.DatetimeIndex([]), periodo=PERIODO_AQUA)
    except armonizar.FactorError as err:
        raise ValidacionError(str(err)) from err
    vacias = [zona for zona in armonizar.ZONAS if not (z["zona"] == zona).any()]
    if vacias:
        raise ValidacionError(f"zonas sin ningún cuadrito-día: {vacias}")
    return f"{len(z):,} cuadritos-día por municipio, {len(armonizar.ZONAS)} zonas"


def _sin_datos(peninsula: pd.DataFrame, pares) -> None:
    faltan: dict[str, set[int]] = {}
    for satelite, periodo in pares:
        anios = _anios_sin_datos(peninsula, satelite, periodo)
        if anios:
            faltan.setdefault(satelite, set()).update(anios)
    if faltan:
        raise ValidacionError("; ".join(f"{s} sin datos en {sorted(a)}" for s, a in faltan.items()))


def _rev_cobertura_aqua(e: dict) -> str:
    periodos = (armonizar.PERIODO_MODIS, PERIODO_AQUA)
    _sin_datos(e["peninsula"], [(s, p) for p in periodos for s in ("Aqua", "S-NPP")])
    return f"Aqua y S-NPP con datos en cada año de {periodos[0][0].year} a {periodos[1][1].year}"


def _rev_cobertura_viirs(e: dict) -> str:
    pares, partes = [], []
    for otro, periodo in PERIODOS_VIIRS.items():
        enteros = anios_enteros(periodo)
        rango = (date(enteros[0], 1, 1), date(enteros[-1], 12, 31))
        pares += [("S-NPP", rango), (otro, rango)]
        partes.append(f"S-NPP y {otro} en {enteros[0]}–{enteros[-1]}")
    _sin_datos(e["peninsula"], pares)
    return "; ".join(partes)


def _rev_conafor(e: dict) -> str:
    inc, focos = e["conafor_incendios"], e["conafor_focos"]
    faltan = ([c for c in COLUMNAS_INCENDIOS if c not in inc.columns]
              + [c for c in COLUMNAS_FOCOS_CONAFOR if c not in focos.columns])
    if faltan:
        raise ValidacionError(f"faltan las columnas {faltan}")
    if inc.empty:
        raise ValidacionError("no hay incendios")
    sin = [s for s in SENSORES_CONAFOR if not (focos["sensor"] == s).any()]
    if sin:
        raise ValidacionError(f"no hay focos de {sin}")
    if not (inc["Tamano"] == TAMANO_GRANDES).any():
        raise ValidacionError(f"no hay incendios «{TAMANO_GRANDES}»: el % de grandes saldría vacío")
    vistos = ", ".join(f"{s} {(focos['sensor'] == s).sum():,}" for s in SENSORES_CONAFOR)
    return f"{len(inc):,} incendios; focos: {vistos}"


def _rev_textos(e: dict) -> str:
    revisar_textos(e["textos"])
    conocidas = claves_conocidas()
    partes = []
    for idioma in IDIOMAS:
        d = e["textos"].get(idioma, {})
        escritas = sum(1 for k in conocidas if d.get(k) not in (None, "", []))
        partes.append(f"{idioma}: {escritas} de {len(conocidas)} textos escritos")
    return "; ".join(partes)


PREFLIGHT = (
    ("calendario", _rev_calendario),
    ("factores", _rev_factores),
    ("focos_peninsula", _rev_focos_peninsula),
    ("focos_zona", _rev_focos_zona),
    ("cobertura_aqua", _rev_cobertura_aqua),
    ("cobertura_viirs", _rev_cobertura_viirs),
    ("conafor", _rev_conafor),
    ("textos", _rev_textos),
)
# Sin las columnas de los focos no se puede saber qué años tienen datos.
_DEPENDE = {"cobertura_aqua": "focos_peninsula", "cobertura_viirs": "focos_peninsula"}


def preflight(entradas: dict) -> dict:
    """Corre todas las revisiones y devuelve {"ok", "revisiones": [{"que", "ok", "detalle"}]}."""
    revisiones, ok_de = [], {}
    for que, revisar in PREFLIGHT:
        previa = _DEPENDE.get(que)
        if previa and not ok_de[previa]:
            ok, detalle = False, f"no se pudo revisar: falló {previa}"
        else:
            try:
                ok, detalle = True, revisar(entradas)
            except ValidacionError as err:
                ok, detalle = False, str(err)
        ok_de[que] = ok
        revisiones.append({"que": que, "ok": ok, "detalle": detalle})
    return {"ok": all(r["ok"] for r in revisiones), "revisiones": revisiones}


def formatear_preflight(reporte: dict) -> str:
    lineas = [f"  {'bien ' if r['ok'] else 'FALLA'}  {r['que']}: {r['detalle']}"
              for r in reporte["revisiones"]]
    cierre = ("Preflight: todo cumple." if reporte["ok"]
              else "Preflight: hay fallas; no se corre la validación.")
    return "\n".join(lineas + [cierre])


# ---------------------------------------------------------------------------
# La corrida (S12)


def calcular_pruebas(entradas: dict) -> list[dict]:
    """Las cuatro pruebas con las entradas ya cargadas (y revisadas por el preflight)."""
    return [
        prueba_salto(entradas["calendario"]),
        prueba_aqua(entradas["por_zona"], entradas["peninsula"], entradas["factores"]),
        prueba_conafor(entradas["conafor_focos"], entradas["conafor_incendios"]),
        prueba_viirs(entradas["peninsula"], entradas["factores"]),
    ]


def resumen(doc: dict) -> str:
    """Estado, caso y valores de cada prueba, sin frases (las escribe el equipo)."""
    lineas = []
    for p in doc["pruebas"]:
        lineas.append(f"{p['id']}: {p['estado']} ({p['caso']})")
        lineas.append("    " + ", ".join(f"{k}={v}" for k, v in p["valores"].items()))
    return "\n".join(lineas)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    entradas = cargar_entradas()
    reporte = preflight(entradas)
    print(formatear_preflight(reporte))
    if "--preflight" in argv or not reporte["ok"]:
        return 0 if reporte["ok"] else 1
    try:
        doc = escribir_validacion(calcular_pruebas(entradas), entradas["textos"], SALIDAS)
    except ValidacionError as err:
        print(f"La validación se detuvo sin escribir nada: {err}", file=sys.stderr)
        return 1
    print(resumen(doc))
    print(f"Escrito {ARCHIVO_VALIDACION} y {2 * len(ORDEN)} gráficas en {SALIDAS.name}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
