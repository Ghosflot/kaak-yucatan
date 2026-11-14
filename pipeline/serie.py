"""Serie armonizada de 25 años y «lo normal» (tarea 5, docs/02).

Uso: python pipeline/serie.py

Arma, para cada municipio, cuánto fuego hubo cada semana desde el 1 ene 2001 hasta el último
día con datos, en «cuadritos-día equivalentes a S-NPP», y calcula lo normal (p10, p50 y p90)
de la semana y del acumulado del año. Escribe:
- salidas/calendario.parquet: reemplaza al provisional de la tarea 1, con el mismo contrato
  (mismas columnas, mismos tipos, una fila por municipio × año × semana);
- salidas/calendario_mensual.parquet: municipio × año × mes, para el calendario de 25 años
  de la tarea 13;
- salidas/serie_armonizada.csv: lo mismo que el calendario, para descargar, con 4 decimales
  (UTF-8 con BOM, para que Excel muestre bien Tizimín o Dzán).

Reglas (docs/02, «Método»):
- Un satélite por periodo, nunca sumados, en día solar local:
    Terra    1 ene 2001 – 3 jul 2002
    Aqua     4 jul 2002 – 19 ene 2012
    S-NPP   20 ene 2012 – 2 nov 2026  (la referencia: factor 1)
    NOAA-20  desde el 3 nov 2026
  Los cuadritos-día de otro satélite (Aqua después de 2012, Terra de 2000, NOAA-21, S-NPP
  después del 2 nov) se ignoran: existen, pero no son el satélite de ese día.
- Cada cuadrito-día se multiplica por el factor de su satélite (salidas/factores.csv), de la
  zona de su municipio y de la época de su día (marzo a mayo, «temporada»; lo demás,
  «resto»). NOAA-20 usa el de toda la península. Se multiplica día por día y después se
  suma la semana, porque una semana puede tener dos satélites (la 27 de 2002, la 3 de 2012
  y la 44 de 2026) o dos épocas (la 9 y la 22).
- Un factor débil se usa tal como viene en factores.csv: la tarea 3 ya lo reemplazó por el
  de todas las zonas juntas.
- Un cuadrito en la frontera de dos municipios cuenta en cada uno, con el factor de la zona
  de cada uno (tarea 2). Los focos sin municipio no entran en nada municipal, así que no
  necesitan factor.
- cuadritos_modis_crudo y cuadritos_viirs_crudo: cuántos cuadritos-día crudos de MODIS
  (Terra o Aqua) y de VIIRS (S-NPP o NOAA-20) entraron a la serie esa semana; 0 si ese tipo
  de satélite no entró. La serie sin calibrar es su suma.
- Cobertura: del 1 ene 2001 al último día con algún cuadrito-día del satélite en turno. La
  semana de ese día se emite aunque esté incompleta (como en el provisional); no hay filas
  de semanas futuras. resumen["semana_parcial"] dice cuál es.
- Lo normal: por municipio y semana, sobre los 25 años 2001–2025 (el año en curso no entra).
  Las semanas sin fuego cuentan como 0. Si falta un año, se detiene.
- Si el satélite de un periodo no tiene ni un cuadrito-día en un tramo de 30 días o más de
  un año, se detiene: es más probable que falten datos que un año sin fuego.

Todo lo que hay en salidas/ lo escribe el código: no se edita a mano.
"""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

import armonizar
import calendario_provisional as cp

RAIZ = Path(__file__).resolve().parent.parent
FACTORES = RAIZ / "salidas" / "factores.csv"
CALENDARIO = RAIZ / "salidas" / "calendario.parquet"
MENSUAL = RAIZ / "salidas" / "calendario_mensual.parquet"
SERIE_CSV = RAIZ / "salidas" / "serie_armonizada.csv"

# La tabla de periodos de docs/02, en día solar local (ambos extremos entran).
PERIODOS = [
    ("Terra", date(2001, 1, 1), date(2002, 7, 3)),
    ("Aqua", date(2002, 7, 4), date(2012, 1, 19)),
    ("S-NPP", date(2012, 1, 20), date(2026, 11, 2)),
    ("NOAA-20", date(2026, 11, 3), None),
]
INICIO = PERIODOS[0][1]
MODIS = {"Terra", "Aqua"}
VIIRS = {"S-NPP", "NOAA-20"}
# Años de «lo normal» (docs/02: «sobre 2001–2025 armonizado»).
ANIOS_BASE = range(2001, 2026)
# Un tramo más corto que esto puede no tener fuego de verdad (por ejemplo, Aqua del 1 al
# 19 ene 2012 o los primeros días de NOAA-20); no se exige que tenga datos.
TRAMO_MINIMO = 30

COLUMNAS_CUADRITOS = ["satelite", "dia_local", "anio", "mes", "semana",
                      "lat_celda", "lon_celda", "estado", "municipio", "zona"]
CLAVE_CUADRITO = ["satelite", "dia_local", "lat_celda", "lon_celda", "estado", "municipio"]

# Mismo contrato que el calendario provisional: la página no nota el cambio.
CONTRATO = cp.CONTRATO
CLAVE = cp.CLAVE
CONTRATO_MENSUAL = {
    "estado": "string",
    "municipio": "string",
    "anio": "int16",
    "mes": "int8",
    "cuadritos_viirs_eq": "float64",
}
PERCENTILES = ["p10", "p50", "p90", "acum_p10", "acum_p50", "acum_p90"]
DECIMALES_CSV = 4

FACTORES_ESPERADOS = (
    {(s, z, e) for s in armonizar.MODIS for z in armonizar.ZONAS for e in armonizar.EPOCAS}
    | {("NOAA-20", armonizar.ZONA_PENINSULA, e) for e in armonizar.EPOCAS}
)

# El salto de 2012 (docs/02, tareas 5 y 7): años de antes contra años de después.
COMPARACIONES_SALTO = {
    "2012–13 contra 2010–11": ((2010, 2011), (2012, 2013)),
    "2013–15 contra 2009–11": ((2009, 2011), (2013, 2015)),
}
# Años en que solo hay S-NPP: ahí se mide cuánto cambia el fuego de verdad.
ANIOS_SOLO_SNPP = (2013, 2025)


class SerieError(ValueError):
    """Una entrada o el resultado no cumple lo que la serie necesita."""


# ---------------------------------------------------------------------------
# Factores


def leer_factores(ruta: Path = FACTORES) -> pd.DataFrame:
    if not Path(ruta).is_file():
        raise SerieError(f"No existe {ruta}: corre antes pipeline/armonizar.py")
    factores = pd.read_csv(ruta)
    validar_factores(factores)
    return factores


def validar_factores(factores: pd.DataFrame) -> None:
    """Las 26 filas esperadas (12 de Aqua, 12 de Terra y 2 de NOAA-20), sin huecos."""
    faltan = [c for c in armonizar.COLUMNAS if c not in factores.columns]
    if faltan:
        raise SerieError(f"A factores.csv le faltan las columnas {faltan}")
    claves = [tuple(str(v) for v in fila)
              for fila in factores[["satelite", "zona", "epoca"]].itertuples(index=False)]
    repetidas = sorted({k for k in claves if claves.count(k) > 1})
    if repetidas:
        raise SerieError(f"factores.csv repite filas: {repetidas}")
    inesperadas = sorted(set(claves) - FACTORES_ESPERADOS)
    if inesperadas:
        raise SerieError(f"factores.csv trae filas inesperadas (satélite, zona, época): {inesperadas}")
    faltantes = sorted(FACTORES_ESPERADOS - set(claves))
    if faltantes:
        raise SerieError(f"A factores.csv le faltan las filas (satélite, zona, época): {faltantes}")
    numero = pd.to_numeric(factores["factor"], errors="coerce")
    malos = ~np.isfinite(numero) | (numero <= 0)
    if malos.any():
        filas = factores.loc[malos, ["satelite", "zona", "epoca", "factor"]].to_dict("records")
        raise SerieError(f"factores vacíos, en cero, negativos o infinitos: {filas}")


# ---------------------------------------------------------------------------
# Cuadritos-día


def satelite_del_periodo(dias) -> pd.Series:
    """El satélite que le toca a cada día según la tabla de periodos (vacío antes de 2001)."""
    dia = pd.Series(pd.to_datetime(dias))
    satelite = pd.Series(pd.NA, index=dia.index, dtype="object")
    for nombre, desde, hasta in PERIODOS:
        dentro = dia >= pd.Timestamp(desde)
        if hasta is not None:
            dentro &= dia <= pd.Timestamp(hasta)
        satelite[dentro] = nombre
    return satelite


def validar_cuadritos(cuadritos: pd.DataFrame, catalogo: pd.DataFrame) -> None:
    """Lo que sale de rejilla.cuadritos_dia(): un renglón por cuadrito-día y municipio."""
    faltan = [c for c in COLUMNAS_CUADRITOS if c not in cuadritos.columns]
    if faltan:
        raise SerieError(
            f"A los cuadritos les faltan las columnas {faltan} "
            "(se espera la salida de rejilla.cuadritos_dia(), no los focos)"
        )
    desconocidos = set(cuadritos["satelite"].dropna()) - armonizar.SATELITES
    if desconocidos or cuadritos["satelite"].isna().any():
        raise SerieError(f"Cuadritos de un satélite desconocido o vacío: {sorted(desconocidos)}")
    for col in ("estado", "municipio"):
        if cuadritos[col].isna().any():
            raise SerieError(f"Hay cuadritos sin {col}: los focos sin municipio no entran a la serie")
    zonas_malas = set(cuadritos["zona"].dropna()) - set(armonizar.ZONAS)
    if zonas_malas or cuadritos["zona"].isna().any():
        raise SerieError(f"Cuadritos con zona vacía o desconocida: {sorted(zonas_malas)}")

    dia = pd.to_datetime(cuadritos["dia_local"], errors="coerce")
    if dia.isna().any():
        raise SerieError("dia_local tiene fechas vacías o ilegibles")
    if (dia != dia.dt.normalize()).any():
        raise SerieError("dia_local trae hora: se espera solo el día solar local")
    distinto = (
        (cuadritos["anio"].to_numpy() != dia.dt.year.to_numpy())
        | (cuadritos["mes"].to_numpy() != dia.dt.month.to_numpy())
        | (cuadritos["semana"].to_numpy() != cp.semana_del_anio(dia.dt.day_of_year))
    )
    if distinto.any():
        raise SerieError(f"{int(distinto.sum())} cuadritos tienen anio, mes o semana que no son los de su día")

    repetidos = cuadritos.duplicated(CLAVE_CUADRITO)
    if repetidos.any():
        raise SerieError(f"{int(repetidos.sum())} cuadritos-día vienen repetidos; se contarían dos veces")

    territorio = catalogo[["municipio", "estado", "zona"]]
    unido = cuadritos[["municipio", "estado", "zona"]].drop_duplicates().merge(
        territorio, on=["municipio", "estado"], how="left", suffixes=("", "_catalogo")
    )
    fuera = unido["zona_catalogo"].isna()
    if fuera.any():
        nombres = sorted(unido.loc[fuera, "municipio"] + " (" + unido.loc[fuera, "estado"] + ")")
        raise SerieError(f"Municipios sin fila en municipios_zona.csv: {nombres}")
    otra_zona = unido["zona"] != unido["zona_catalogo"]
    if otra_zona.any():
        raise SerieError(
            f"Cuadritos con una zona distinta a la de su municipio: "
            f"{unido.loc[otra_zona].to_dict('records')}"
        )


def validar_catalogo(catalogo: pd.DataFrame) -> None:
    try:
        cp.validar_catalogo(catalogo)
    except cp.CalendarioError as e:
        raise SerieError(str(e)) from None
    zonas_malas = set(catalogo["zona"]) - set(armonizar.ZONAS)
    if zonas_malas:
        raise SerieError(f"municipios_zona.csv tiene zonas desconocidas: {sorted(zonas_malas)}")


def aplicar_factores(elegidos: pd.DataFrame, factores: pd.DataFrame) -> pd.DataFrame:
    """Agrega epoca, factor y eq (= factor: cada renglón es un cuadrito-día)."""
    es_modis = elegidos["satelite"].isin(MODIS).to_numpy()
    df = elegidos.assign(
        epoca=armonizar.epoca_de(elegidos["mes"].to_numpy()).to_numpy(),
        zona_factor=np.where(es_modis, elegidos["zona"], armonizar.ZONA_PENINSULA),
    )
    tabla = factores[["satelite", "zona", "epoca", "factor"]].rename(columns={"zona": "zona_factor"})
    df = df.merge(tabla, on=["satelite", "zona_factor", "epoca"], how="left", validate="many_to_one")
    df.loc[df["satelite"] == armonizar.REFERENCIA, "factor"] = 1.0
    sin_factor = df["factor"].isna()
    if sin_factor.any():
        casos = df.loc[sin_factor, ["satelite", "zona_factor", "epoca"]].drop_duplicates()
        raise SerieError(f"Cuadritos-día sin factor: {casos.to_dict('records')}")
    df["factor"] = df["factor"].astype("float64")
    df["eq"] = df["factor"]
    return df.drop(columns="zona_factor")


def validar_tramos(elegidos: pd.DataFrame, fin: date) -> None:
    """El satélite de cada periodo debe tener datos en cada año (tramos de 30 días o más)."""
    dia = elegidos["dia_local"].dt.date
    vacios = []
    for satelite, desde, hasta in PERIODOS:
        hasta = fin if hasta is None else min(hasta, fin)
        for anio in range(desde.year, hasta.year + 1):
            ini, fin_tramo = max(desde, date(anio, 1, 1)), min(hasta, date(anio, 12, 31))
            if (fin_tramo - ini).days + 1 < TRAMO_MINIMO:
                continue
            hay = ((elegidos["satelite"] == satelite) & (dia >= ini) & (dia <= fin_tramo)).any()
            if not hay:
                vacios.append(f"{satelite} del {ini} al {fin_tramo}")
    if vacios:
        raise SerieError(f"Faltan datos: ni un cuadrito-día de {vacios}")


# ---------------------------------------------------------------------------
# Calendario semanal y mensual


def _semanal(elegidos: pd.DataFrame) -> pd.DataFrame:
    df = elegidos.assign(
        modis=elegidos["satelite"].isin(MODIS).astype("int64"),
        viirs=elegidos["satelite"].isin(VIIRS).astype("int64"),
    )
    return df.groupby(CLAVE, as_index=False).agg(
        cuadritos_modis_crudo=("modis", "sum"),
        cuadritos_viirs_crudo=("viirs", "sum"),
        cuadritos_viirs_eq=("eq", "sum"),
    )


def calendario_semanal(elegidos: pd.DataFrame, catalogo: pd.DataFrame, fin: date) -> pd.DataFrame:
    """Todos los municipios × semanas del 1 ene 2001 a `fin`, con cero donde no hubo fuego."""
    territorio = catalogo[cp.COLUMNAS_CATALOGO]
    esqueleto = territorio.merge(cp.semanas_cubiertas(INICIO, fin), how="cross")
    semanal = _semanal(elegidos)
    cal = esqueleto.merge(semanal, on=CLAVE, how="left", validate="one_to_one")
    if len(cal) != len(esqueleto):
        raise SerieError("La unión con el catálogo duplicó filas")
    conteos = ["cuadritos_modis_crudo", "cuadritos_viirs_crudo", "cuadritos_viirs_eq"]
    cal[conteos] = cal[conteos].fillna(0)
    if not np.isclose(cal["cuadritos_viirs_eq"].sum(), semanal["cuadritos_viirs_eq"].sum()):
        raise SerieError("Hay cuadritos-día que no cayeron en ninguna semana del calendario")
    cal = cp.agregar_ventana(cal)
    cal = cp.agregar_acumulados(cal)
    cal = cp.agregar_percentiles(cal, ANIOS_BASE)
    cal = cal[list(CONTRATO)].astype(CONTRATO)
    return cal.sort_values(CLAVE).reset_index(drop=True)


def calendario_mensual(elegidos: pd.DataFrame, catalogo: pd.DataFrame, fin: date) -> pd.DataFrame:
    """Todos los municipios × meses del ene 2001 al mes de `fin`, con cero donde no hubo fuego."""
    clave = ["estado", "municipio", "anio", "mes"]
    meses = pd.period_range(INICIO, fin, freq="M")
    calendario = pd.DataFrame({"anio": meses.year, "mes": meses.month})
    esqueleto = catalogo[["estado", "municipio"]].merge(calendario, how="cross")
    suma = elegidos.groupby(clave, as_index=False).agg(cuadritos_viirs_eq=("eq", "sum"))
    men = esqueleto.merge(suma, on=clave, how="left", validate="one_to_one")
    men["cuadritos_viirs_eq"] = men["cuadritos_viirs_eq"].fillna(0)
    men = men[list(CONTRATO_MENSUAL)].astype(CONTRATO_MENSUAL)
    return men.sort_values(clave).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Revisiones antes de escribir


def _limites(cal: pd.DataFrame) -> pd.DataFrame:
    semanas = cal[["anio", "semana"]].drop_duplicates()
    fechas = [cp.limites_semana(int(a), int(s)) for a, s in semanas.itertuples(index=False)]
    return semanas.assign(
        inicio=pd.to_datetime([f[0] for f in fechas]), fin=pd.to_datetime([f[1] for f in fechas])
    )


def validar_serie(cal: pd.DataFrame, fin: date) -> None:
    """Detiene todo si el calendario no cumple el contrato y las reglas de la serie."""
    if list(cal.columns) != list(CONTRATO):
        raise SerieError(f"Columnas distintas al contrato: {list(cal.columns)}")
    tipos = {c: str(t) for c, t in cal.dtypes.items()}
    distintos = {c: tipos[c] for c, t in CONTRATO.items() if tipos[c] != t}
    if distintos:
        raise SerieError(f"Tipos distintos al contrato: {distintos}")
    if cal.duplicated(CLAVE).any():
        raise SerieError("La clave (estado, municipio, anio, semana) está repetida")
    for col in ("estado", "municipio", "zona", "anio", "semana", "cuadritos_viirs_eq",
                "cuadritos_modis_crudo", "cuadritos_viirs_crudo", "acum", *PERCENTILES):
        if cal[col].isna().any():
            raise SerieError(f"{col} tiene valores vacíos")
    semanas = cp.semanas_cubiertas(INICIO, fin)
    if sorted(cal["anio"].unique()) != list(range(INICIO.year, fin.year + 1)):
        raise SerieError(f"Años inesperados: {sorted(cal['anio'].unique())}")
    if (cal.groupby(["estado", "municipio"]).size() != len(semanas)).any():
        raise SerieError(f"Cada municipio debe tener {len(semanas)} semanas")
    conteos = ["cuadritos_viirs_eq", "cuadritos_modis_crudo", "cuadritos_viirs_crudo", "acum",
               *PERCENTILES]
    if (cal[conteos] < 0).any().any():
        raise SerieError("Hay conteos o percentiles negativos")
    crudos = cal["cuadritos_modis_crudo"] + cal["cuadritos_viirs_crudo"]
    if ((cal["cuadritos_viirs_eq"] > 0) != (crudos > 0)).any():
        raise SerieError("Hay semanas con armonizado sin crudos, o con crudos sin armonizado")

    lim = cal[["anio", "semana"]].merge(_limites(cal), on=["anio", "semana"], how="left")
    antes_de_viirs = (lim["fin"] < pd.Timestamp(PERIODOS[2][1])).to_numpy()
    despues_de_modis = (lim["inicio"] > pd.Timestamp(PERIODOS[1][2])).to_numpy()
    if (cal.loc[antes_de_viirs, "cuadritos_viirs_crudo"] != 0).any():
        raise SerieError("Hay VIIRS en semanas anteriores al 20 ene 2012")
    if (cal.loc[despues_de_modis, "cuadritos_modis_crudo"] != 0).any():
        raise SerieError("Hay MODIS en semanas posteriores al 19 ene 2012")

    orden = cal.sort_values(CLAVE)
    por_anio = orden.groupby(["estado", "municipio", "anio"])
    if (por_anio["acum"].diff().fillna(0) < -1e-9).any():
        raise SerieError("El acumulado disminuye")
    total = por_anio.agg(acum=("acum", "last"), suma=("cuadritos_viirs_eq", "sum"))
    if not np.allclose(total["acum"], total["suma"]):
        raise SerieError("El acumulado de la última semana no es el total del año")
    if not ((cal["p10"] <= cal["p50"]) & (cal["p50"] <= cal["p90"])).all():
        raise SerieError("Percentiles de la semana fuera de orden")
    if not ((cal["acum_p10"] <= cal["acum_p50"]) & (cal["acum_p50"] <= cal["acum_p90"])).all():
        raise SerieError("Percentiles del acumulado fuera de orden")
    if (cal.groupby(["estado", "municipio", "semana"])[PERCENTILES].nunique() != 1).any().any():
        raise SerieError("Lo normal de una semana cambia de un año a otro")

    sin_ventana = cal["zona"].isin(["Campeche", "Quintana Roo"])
    if cal.loc[sin_ventana, "en_ventana"].notna().any():
        raise SerieError("Campeche y Quintana Roo no llevan ventana")
    if cal.loc[cal["estado"] == "Yucatán", "en_ventana"].isna().any():
        raise SerieError("Todo municipio de Yucatán lleva ventana")


def validar_mensual(men: pd.DataFrame, cal: pd.DataFrame) -> None:
    if list(men.columns) != list(CONTRATO_MENSUAL):
        raise SerieError(f"Columnas del mensual distintas al contrato: {list(men.columns)}")
    tipos = {c: str(t) for c, t in men.dtypes.items()}
    if tipos != CONTRATO_MENSUAL:
        raise SerieError(f"Tipos del mensual distintos al contrato: {tipos}")
    if men.duplicated(["estado", "municipio", "anio", "mes"]).any():
        raise SerieError("El mensual repite municipio × año × mes")
    if men["cuadritos_viirs_eq"].isna().any() or (men["cuadritos_viirs_eq"] < 0).any():
        raise SerieError("El mensual tiene valores vacíos o negativos")
    grupo = ["estado", "municipio", "anio"]
    por_mes = men.groupby(grupo)["cuadritos_viirs_eq"].sum()
    por_semana = cal.groupby(grupo)["cuadritos_viirs_eq"].sum()
    if not por_mes.index.equals(por_semana.index) or not np.allclose(por_mes, por_semana):
        raise SerieError("El total del año por meses no es igual al total por semanas")


# ---------------------------------------------------------------------------
# Todo junto


def armar_serie(
    cuadritos: pd.DataFrame,
    catalogo: pd.DataFrame,
    factores: pd.DataFrame,
    resumen: dict | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Calendario semanal y mensual ya revisados (no escribe nada).

    `cuadritos` es la salida de rejilla.cuadritos_dia(); `catalogo`, la de
    cargar.leer_catalogo(); `factores`, la de leer_factores().
    """
    resumen = {} if resumen is None else resumen
    validar_factores(factores)
    validar_catalogo(catalogo)
    validar_cuadritos(cuadritos, catalogo)

    dia = pd.to_datetime(cuadritos["dia_local"])
    del_periodo = (cuadritos["satelite"] == satelite_del_periodo(dia)).fillna(False).to_numpy(dtype=bool)
    elegidos = cuadritos[del_periodo].assign(dia_local=dia[del_periodo])
    resumen["ignorados"] = cuadritos[~del_periodo].groupby("satelite").size().to_dict()
    if elegidos.empty:
        raise SerieError("Ningún cuadrito-día cae en el periodo de su satélite")

    fin = elegidos["dia_local"].max().date()
    if fin < date(ANIOS_BASE[-1], 12, 31):
        raise SerieError(
            f"Los datos llegan solo al {fin}: lo normal necesita los años "
            f"{ANIOS_BASE[0]}–{ANIOS_BASE[-1]} completos"
        )
    validar_tramos(elegidos, fin)
    elegidos = aplicar_factores(elegidos, factores)

    cal = calendario_semanal(elegidos, catalogo, fin)
    men = calendario_mensual(elegidos, catalogo, fin)
    validar_serie(cal, fin)
    validar_mensual(men, cal)
    crudos = cal["cuadritos_modis_crudo"].sum() + cal["cuadritos_viirs_crudo"].sum()
    if int(crudos) != len(elegidos):
        raise SerieError("El calendario no suma los mismos cuadritos-día que entraron")

    resumen["fin"] = fin
    resumen["usados"] = elegidos.groupby("satelite").size().to_dict()
    parcial = cp.semanas_parciales(INICIO, fin)
    resumen["semana_parcial"] = parcial.iloc[0].to_dict() if len(parcial) else None
    resumen["debiles"] = factores.loc[factores["debil"].astype(bool), ["satelite", "zona", "epoca"]].to_dict("records")
    return cal, men


def razones_salto(cal: pd.DataFrame, estado: str = "Yucatán") -> dict:
    """El salto de 2012 en un estado: promedio anual de después entre el de antes.

    Para cada comparación da la razón sin calibrar (MODIS y VIIRS crudos, como si se
    unieran sin más), la armonizada y el rango natural: la menor y la mayor razón con la
    misma forma (mismos años y misma separación) entre años que son todos de S-NPP
    (2013–2025), donde el satélite no cambia y solo cambia el fuego.
    """
    datos = cal[cal["estado"] == estado]
    anual = datos.assign(
        crudo=datos["cuadritos_modis_crudo"] + datos["cuadritos_viirs_crudo"]
    ).groupby("anio").agg(crudo=("crudo", "sum"), armonizado=("cuadritos_viirs_eq", "sum"))

    def razon(col, antes, despues):
        return anual.loc[despues[0]:despues[1], col].mean() / anual.loc[antes[0]:antes[1], col].mean()

    resultado = {}
    for nombre, (antes, despues) in COMPARACIONES_SALTO.items():
        naturales = []
        desde = ANIOS_SOLO_SNPP[0]
        while True:
            a = (desde, desde + antes[1] - antes[0])
            d = (desde + despues[0] - antes[0], desde + despues[1] - antes[0])
            if d[1] > ANIOS_SOLO_SNPP[1]:
                break
            naturales.append(razon("armonizado", a, d))
            desde += 1
        resultado[nombre] = {
            "sin_calibrar": razon("crudo", antes, despues),
            "armonizada": razon("armonizado", antes, despues),
            "rango_natural": (min(naturales), max(naturales)),
        }
    return resultado


def escribir_csv(cal: pd.DataFrame, ruta: Path = SERIE_CSV) -> None:
    """CSV en UTF-8 con BOM, con 4 decimales (como factores.csv): sin eso salen colas como
    1.6000000000000014. Se escribe en un temporal y se pone en su lugar."""
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    temporal = ruta.with_name(f".{ruta.name}.tmp")
    try:
        cal.round(DECIMALES_CSV).to_csv(temporal, index=False, encoding="utf-8-sig")
        releido = pd.read_csv(temporal, encoding="utf-8-sig", usecols=["estado"])
        if len(releido) != len(cal):
            raise SerieError("El CSV escrito no tiene las mismas filas")
        os.replace(temporal, ruta)
    finally:
        if temporal.exists():
            temporal.unlink()


def _relativa(ruta: Path) -> str:
    try:
        return str(Path(ruta).resolve().relative_to(RAIZ))
    except ValueError:
        return str(ruta)


def main() -> None:
    from cargar import cargar_focos, leer_catalogo
    from rejilla import cuadritos_dia

    resumen: dict = {}
    cal, men = armar_serie(cuadritos_dia(cargar_focos()), leer_catalogo(), leer_factores(), resumen)
    cp.escribir(cal, CALENDARIO)
    cp.escribir(men, MENSUAL)
    escribir_csv(cal, SERIE_CSV)

    print(f"Serie del {INICIO} al {resumen['fin']} (día solar local)")
    for satelite, n in resumen["usados"].items():
        print(f"  {satelite}: {n:,} cuadritos-día usados")
    ignorados = ", ".join(f"{s} {n:,}" for s, n in resumen["ignorados"].items())
    print(f"  Ignorados por no ser el satélite de su día: {ignorados}")
    p = resumen["semana_parcial"]
    if p:
        print(f"  Semana incompleta: {p['anio']} semana {p['semana']}, "
              f"{p['dias_observados']} de {p['dias_semana']} días")
    for d in resumen["debiles"]:
        print(f"  Factor débil (usa el de todas las zonas juntas): {d['satelite']}, {d['zona']}, {d['epoca']}")
    print(f"Municipios: {cal['municipio'].nunique()} · filas semanales: {len(cal):,} · "
          f"filas mensuales: {len(men):,}")
    for nombre, r in razones_salto(cal).items():
        bajo, alto = r["rango_natural"]
        print(f"Salto de 2012 en Yucatán, {nombre}: sin calibrar ×{r['sin_calibrar']:.2f}, "
              f"armonizada ×{r['armonizada']:.2f} (entre años de S-NPP: ×{bajo:.2f} a ×{alto:.2f})")
    for ruta in (CALENDARIO, MENSUAL, SERIE_CSV):
        print(f"Escrito {_relativa(ruta)}")


if __name__ == "__main__":
    main()
