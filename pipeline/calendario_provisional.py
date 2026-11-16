"""Calendario provisional (tarea 1): cuadritos-día de S-NPP por municipio, año y semana.

Uso: python pipeline/calendario_provisional.py [--salida RUTA]

Escribe salidas/calendario.parquet con el mismo contrato que tendrá el calendario
armonizado (docs/02, "Data contract"), pero solo con S-NPP (20 ene 2012 – 2 nov 2026)
y sin calibrar. La página puede trabajar con él mientras llega la serie de 25 años
(tarea 5); entonces solo se reemplaza el archivo.

Cobertura: es el periodo en que S-NPP es el satélite de la serie (docs/02, "One satellite
per period"): del 20 ene 2012 al 2 nov 2026, en día solar local. Es un dato fijo, no se
deduce de los focos: que no haya focos no quiere decir que el satélite no observó, y que
el último foco sea de una fecha no quiere decir que ahí terminó la observación. Si algún
cuadrito-día cae fuera del periodo, el generador se detiene.

Semanas parciales: una semana se emite si al menos un día cae dentro de la cobertura, así
que la primera y la última semana del periodo solo están observadas en parte:
- 2012, semana 3 (15–21 ene): observados 2 de 7 días (20 y 21 ene).
- 2026, semana 44 (29 oct – 4 nov): observados 5 de 7 días (29 oct – 2 nov).
En esas dos semanas el conteo es real pero incompleto: un cero o un valor bajo no se puede
comparar con lo normal, y el acumulado de 2026 llega solo hasta el 2 nov. El contrato no
tiene una columna para marcarlas; la tarea 10 las identifica con semanas_parciales(). La
semana 52 dura 8 días (9 en bisiesto) en todos los años; eso es parte del esquema
semanal, no falta de cobertura.

Decisiones provisionales:
- Una fila por municipio del catálogo × año × semana dentro de la cobertura de S-NPP, con
  cero donde no hubo fuego. Las semanas que caen por completo fuera de la cobertura (2012:
  semanas 1–2; 2026: semanas 45–52) no se emiten, porque ahí no hubo observación.
- p10/p50/p90 y acum_p10/p50/p90: percentiles por municipio y semana sobre los años
  completos de S-NPP (2013–2025). Es un baseline corto, no comparable aún con 2001–2011.
- en_ventana: verdadero si al menos un día de la semana cae en la ventana oficial del
  municipio; falso si la semana queda fuera; vacío sin ventana (Campeche y Quintana Roo).
- cuadritos_modis_crudo: vacío (no se calculó), no cero.

Cuando exista la tarea 2 (pipeline/cargar.py y pipeline/rejilla.py), la lectura, el
filtro, el día solar y los cuadritos-día de aquí se cambian por esas funciones.
Todo lo que hay en salidas/ lo escribe el código: no se edita a mano.
"""
from __future__ import annotations

import argparse
import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
FOCOS = RAIZ / "datos_peninsula" / "focos_peninsula.parquet"
MUNICIPIOS_ZONA = RAIZ / "analisis" / "municipios_zona.csv"
SALIDA = RAIZ / "salidas" / "calendario.parquet"

SENSOR = "S-NPP"
# Periodo de S-NPP en la serie (docs/02, "One satellite per period"), en día solar local.
COBERTURA = (date(2012, 1, 20), date(2026, 11, 2))
CONFIANZAS = {"n", "h"}
SEMANAS = 52
# Años completos de S-NPP para «lo normal» provisional (2012 y 2026 son parciales).
ANIOS_BASE = range(2013, 2026)
CUANTILES = {"10": 0.10, "50": 0.50, "90": 0.90}

COLUMNAS_FOCOS = [
    "acq_date", "acq_time", "latitude", "longitude",
    "sensor", "confidence", "type", "municipio", "estado",
]
COLUMNAS_CATALOGO = ["municipio", "estado", "zona", "ventana_inicio", "ventana_fin"]
CLAVE = ["estado", "municipio", "anio", "semana"]

# Contrato de salida: columnas en este orden y con estos tipos.
CONTRATO = {
    "estado": "string",
    "municipio": "string",
    "zona": "string",
    "anio": "int16",
    "semana": "int8",
    "cuadritos_viirs_eq": "float64",
    "cuadritos_modis_crudo": "float64",
    "cuadritos_viirs_crudo": "int32",
    "p10": "float64",
    "p50": "float64",
    "p90": "float64",
    "acum": "float64",
    "acum_p10": "float64",
    "acum_p50": "float64",
    "acum_p90": "float64",
    "en_ventana": "boolean",
}


class CalendarioError(ValueError):
    """Una entrada o el resultado no cumple lo que el calendario necesita."""


# ---------------------------------------------------------------------------
# Entradas


def cargar_entradas(
    focos: Path = FOCOS, municipios: Path = MUNICIPIOS_ZONA
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Lee solo las columnas necesarias de los focos y el catálogo territorial."""
    for ruta in (focos, municipios):
        if not Path(ruta).is_file():
            raise CalendarioError(f"No existe la entrada {ruta}")
    try:
        df = pd.read_parquet(focos, columns=COLUMNAS_FOCOS)
    except (KeyError, ValueError) as e:  # pyarrow avisa así si falta una columna
        raise CalendarioError(f"{Path(focos).name} no tiene las columnas {COLUMNAS_FOCOS}: {e}")
    cat = pd.read_csv(municipios, dtype=str, keep_default_na=False, na_values=[""])
    validar_catalogo(cat)
    return df, cat


def _faltan(df: pd.DataFrame, columnas: list[str], nombre: str) -> None:
    faltan = [c for c in columnas if c not in df.columns]
    if faltan:
        raise CalendarioError(f"A {nombre} le faltan las columnas {faltan}")


def validar_catalogo(cat: pd.DataFrame) -> None:
    _faltan(cat, COLUMNAS_CATALOGO, "municipios_zona.csv")
    for col in ("municipio", "estado", "zona"):
        if cat[col].isna().any():
            raise CalendarioError(f"municipios_zona.csv tiene {col} vacío")
    repetidos = cat[cat.duplicated(["municipio", "estado"], keep=False)]
    if not repetidos.empty:
        raise CalendarioError(
            f"municipios_zona.csv repite municipios: {sorted(repetidos['municipio'])}"
        )
    con_ventana = cat["ventana_inicio"].notna() | cat["ventana_fin"].notna()
    yucatan = cat["estado"] == "Yucatán"
    malos = cat.loc[con_ventana != yucatan, "municipio"]
    if not malos.empty:
        raise CalendarioError(
            f"Ventana inesperada (debe existir solo en Yucatán y completa): {sorted(malos)}"
        )
    for _, fila in cat[con_ventana].iterrows():
        inicio = _mes_dia(fila["ventana_inicio"], 2000)
        fin = _mes_dia(fila["ventana_fin"], 2000)
        if inicio > fin:
            raise CalendarioError(
                f"Ventana de {fila['municipio']} cruza el fin de año o está invertida"
            )


def _mes_dia(texto, anio: int) -> date:
    try:
        mes, dia = (int(p) for p in str(texto).split("-"))
        return date(anio, mes, dia)
    except (TypeError, ValueError):
        raise CalendarioError(f"Ventana con formato inválido (se espera MM-DD): {texto!r}")


# ---------------------------------------------------------------------------
# Focos → cuadritos-día


def _es_vegetacion(tipo: pd.Series) -> pd.Series:
    """`type` 0 o vacío. Acepta números, texto o nulos (parquet puede traer cualquiera)."""
    texto = tipo.astype("string").str.strip()
    vacio = tipo.isna() | (texto == "")
    numero = pd.to_numeric(texto.where(~vacio), errors="coerce")
    return vacio | (numero == 0)


def _celda_texto(focos: pd.DataFrame) -> pd.Series:
    return focos["latitude"].round(2).astype(str) + "|" + focos["longitude"].round(2).astype(str)


def _sin_fuente_fija(focos: pd.DataFrame, todos: pd.DataFrame) -> pd.Series:
    """Falso para un foco sin `type` (NRT) que cae en un cuadrito donde algún foco de `todos`
    (de cualquier satélite) trae `type` 2: es una fuente fija que llegó sin marca."""
    fijas = todos[pd.to_numeric(todos["type"], errors="coerce") == 2]
    vacio = focos["type"].isna() | (focos["type"].astype("string").str.strip() == "")
    return ~(vacio & _celda_texto(focos).isin(set(_celda_texto(fijas))))


def filtrar_snpp(focos: pd.DataFrame, resumen: dict | None = None) -> pd.DataFrame:
    """S-NPP, vegetación, confianza nominal o alta y con municipio."""
    _faltan(focos, COLUMNAS_FOCOS, "los focos")
    pasos = [
        ("sensor S-NPP", lambda d: d["sensor"] == SENSOR),
        ("vegetación (type 0 o vacío)", lambda d: _es_vegetacion(d["type"])),
        ("sin fuente fija (type vacío en un cuadrito con type 2)", lambda d: _sin_fuente_fija(d, focos)),
        ("confianza n o h", lambda d: d["confidence"].astype("string").str.strip().isin(CONFIANZAS)),
        ("con municipio", lambda d: d["municipio"].notna() & (d["municipio"].astype("string").str.strip() != "")),
    ]
    df = focos
    for nombre, condicion in pasos:
        df = df[condicion(df).fillna(False).astype(bool)]
        if resumen is not None:
            resumen.setdefault("filtros", []).append((nombre, len(df)))
    if df.empty:
        raise CalendarioError("No quedó ningún foco de S-NPP después del filtro")
    df = df.copy()
    for col in ("latitude", "longitude"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    malos = ~(np.isfinite(df["latitude"]) & np.isfinite(df["longitude"]))
    malos |= ~df["latitude"].between(-90, 90) | ~df["longitude"].between(-180, 180)
    if malos.any():
        raise CalendarioError(f"{int(malos.sum())} focos de S-NPP tienen coordenadas inválidas")
    return df


def hora_utc(acq_time: pd.Series) -> pd.Series:
    """HHMM (5, 45, 430, 1330 o «0430») → timedelta desde la medianoche UTC."""
    texto = acq_time.astype("string").str.strip().str.replace(r"\.0$", "", regex=True)
    texto = texto.str.zfill(4)
    validos = texto.str.fullmatch(r"\d{4}").fillna(False).astype(bool)
    horas = pd.to_numeric(texto.str[:2].where(validos), errors="coerce")
    minutos = pd.to_numeric(texto.str[2:].where(validos), errors="coerce")
    validos &= horas.between(0, 23).fillna(False) & minutos.between(0, 59).fillna(False)
    if not validos.all():
        ejemplos = acq_time[~validos].astype(str).unique()[:5].tolist()
        raise CalendarioError(f"acq_time con horas inválidas (se espera HHMM): {ejemplos}")
    return pd.to_timedelta(horas * 60 + minutos, unit="min")


def calcular_dia_solar(focos: pd.DataFrame) -> pd.DataFrame:
    """Agrega dia_local, anio y dia_del_anio en hora solar: UTC + longitud / 15 horas."""
    df = focos.copy()
    fecha = pd.to_datetime(df["acq_date"], errors="coerce")
    if fecha.isna().any():
        raise CalendarioError("acq_date tiene fechas que no se pueden leer")
    utc = fecha.dt.normalize() + hora_utc(df["acq_time"])
    desfase = pd.to_timedelta(np.round(df["longitude"].to_numpy() / 15 * 3600), unit="s")
    solar = utc + desfase
    df["dia_local"] = solar.dt.normalize()
    df["anio"] = solar.dt.year
    df["dia_del_anio"] = solar.dt.day_of_year
    return df


def semana_del_anio(dia_del_anio) -> np.ndarray:
    """Semana uniforme 1–52: los días que sobran al final del año van a la 52."""
    dias = np.asarray(dia_del_anio, dtype=int)
    if ((dias < 1) | (dias > 366)).any():
        raise CalendarioError("Día del año fuera de 1–366")
    return np.minimum((dias - 1) // 7 + 1, SEMANAS)


def crear_cuadritos_dia(focos: pd.DataFrame) -> pd.DataFrame:
    """Un renglón por cuadrito de 0.01° con fuego por día local (y semana)."""
    df = focos.assign(
        lat_celda=focos["latitude"].round(2),
        lon_celda=focos["longitude"].round(2),
    )
    clave = ["estado", "municipio", "dia_local", "lat_celda", "lon_celda", "sensor"]
    cuadritos = df.drop_duplicates(clave)[clave + ["anio", "dia_del_anio"]].copy()
    cuadritos["semana"] = semana_del_anio(cuadritos["dia_del_anio"])
    return cuadritos.reset_index(drop=True)


def agregar_semanas(cuadritos: pd.DataFrame) -> pd.DataFrame:
    """Cuadritos-día por municipio, año y semana."""
    return (
        cuadritos.groupby(CLAVE, as_index=False, observed=True)
        .size()
        .rename(columns={"size": "cuadritos_viirs_crudo"})
    )


# ---------------------------------------------------------------------------
# Esqueleto semanal, ventana, acumulados y percentiles


def limites_semana(anio: int, semana: int) -> tuple[date, date]:
    """Primer y último día de una semana uniforme (la 52 llega al 31 de diciembre)."""
    inicio = date(anio, 1, 1) + timedelta(days=7 * (semana - 1))
    fin = date(anio, 12, 31) if semana == SEMANAS else inicio + timedelta(days=6)
    return inicio, fin


def _dias_por_semana(primer_dia: date, ultimo_dia: date) -> pd.DataFrame:
    """Cada semana que toca la cobertura, con sus días totales y sus días observados."""
    if primer_dia > ultimo_dia:
        raise CalendarioError(f"Cobertura invertida: {primer_dia} a {ultimo_dia}")
    filas = []
    for anio in range(primer_dia.year, ultimo_dia.year + 1):
        for semana in range(1, SEMANAS + 1):
            inicio, fin = limites_semana(anio, semana)
            if fin >= primer_dia and inicio <= ultimo_dia:
                observados = (min(fin, ultimo_dia) - max(inicio, primer_dia)).days + 1
                filas.append((anio, semana, (fin - inicio).days + 1, observados))
    return pd.DataFrame(filas, columns=["anio", "semana", "dias_semana", "dias_observados"])


def semanas_cubiertas(primer_dia: date, ultimo_dia: date) -> pd.DataFrame:
    """(anio, semana) que tienen al menos un día dentro de la cobertura."""
    return _dias_por_semana(primer_dia, ultimo_dia)[["anio", "semana"]]


def semanas_parciales(
    primer_dia: date = COBERTURA[0], ultimo_dia: date = COBERTURA[1]
) -> pd.DataFrame:
    """Semanas emitidas que la cobertura solo observa en parte (anio, semana, días)."""
    dias = _dias_por_semana(primer_dia, ultimo_dia)
    return dias[dias["dias_observados"] < dias["dias_semana"]].reset_index(drop=True)


def validar_cobertura(cuadritos: pd.DataFrame, primer_dia: date, ultimo_dia: date) -> None:
    """Todo cuadrito-día debe caer dentro del periodo de S-NPP."""
    dia = cuadritos["dia_local"].dt.date
    fuera = cuadritos[(dia < primer_dia) | (dia > ultimo_dia)]
    if not fuera.empty:
        raise CalendarioError(
            f"{len(fuera)} cuadritos-día de S-NPP caen fuera de la cobertura "
            f"{primer_dia} a {ultimo_dia} (de {fuera['dia_local'].min().date()} "
            f"a {fuera['dia_local'].max().date()})"
        )


def completar_semanas(
    semanal: pd.DataFrame, municipios: pd.DataFrame, cobertura: pd.DataFrame
) -> pd.DataFrame:
    """Todos los municipios × semanas cubiertas, con cero donde no hubo fuego.

    Une estado, zona y ventana del catálogo; si un municipio de los focos no existe en el
    catálogo, se detiene y dice cuál (no se corrigen nombres aquí).
    """
    territorio = municipios[COLUMNAS_CATALOGO]
    conocidos = semanal[["municipio", "estado"]].drop_duplicates().merge(
        territorio, on=["municipio", "estado"], how="left", indicator=True
    )
    desconocidos = conocidos[conocidos["_merge"] == "left_only"]
    if not desconocidos.empty:
        nombres = sorted(desconocidos["municipio"] + " (" + desconocidos["estado"] + ")")
        raise CalendarioError(f"Municipios sin fila en municipios_zona.csv: {nombres}")
    fuera = semanal.merge(cobertura, on=["anio", "semana"], how="left", indicator=True)
    if (fuera["_merge"] == "left_only").any():
        raise CalendarioError("Hay cuadritos-día fuera de la cobertura de S-NPP")

    esqueleto = territorio.merge(cobertura, how="cross")
    cal = esqueleto.merge(
        semanal, on=CLAVE, how="left", validate="one_to_one"
    )
    cal["cuadritos_viirs_crudo"] = cal["cuadritos_viirs_crudo"].fillna(0).astype("int32")
    if len(cal) != len(esqueleto):
        raise CalendarioError("La unión con el catálogo duplicó filas")
    return cal


def agregar_ventana(calendario: pd.DataFrame) -> pd.DataFrame:
    """en_ventana: algún día de la semana dentro de la ventana; vacío si no hay ventana."""
    cal = calendario.copy()
    valores = []
    for anio, semana, v_ini, v_fin in zip(
        cal["anio"], cal["semana"], cal["ventana_inicio"], cal["ventana_fin"]
    ):
        if pd.isna(v_ini) or pd.isna(v_fin):
            valores.append(pd.NA)
            continue
        inicio, fin = limites_semana(int(anio), int(semana))
        valores.append(inicio <= _mes_dia(v_fin, int(anio)) and fin >= _mes_dia(v_ini, int(anio)))
    cal["en_ventana"] = pd.array(valores, dtype="boolean")
    return cal


def agregar_acumulados(calendario: pd.DataFrame) -> pd.DataFrame:
    cal = calendario.sort_values(CLAVE).reset_index(drop=True)
    cal["acum"] = cal.groupby(["estado", "municipio", "anio"])["cuadritos_viirs_eq"].cumsum()
    return cal


def agregar_percentiles(calendario: pd.DataFrame, anios_base=ANIOS_BASE) -> pd.DataFrame:
    """p10/p50/p90 de la semana y del acumulado, por municipio y semana, en los años base."""
    anios_base = list(anios_base)
    base = calendario[calendario["anio"].isin(anios_base)]
    grupo = ["estado", "municipio", "semana"]
    n_anios = base.groupby(grupo)["anio"].nunique()
    if base.empty or (n_anios != len(anios_base)).any():
        raise CalendarioError(
            f"El baseline necesita los {len(anios_base)} años {anios_base[0]}–{anios_base[-1]} "
            "completos en cada municipio y semana"
        )
    g = base.groupby(grupo)
    tabla = pd.DataFrame(index=n_anios.index)
    for sufijo, q in CUANTILES.items():
        tabla[f"p{sufijo}"] = g["cuadritos_viirs_eq"].quantile(q)
        tabla[f"acum_p{sufijo}"] = g["acum"].quantile(q)
    return calendario.merge(tabla.reset_index(), on=grupo, how="left", validate="many_to_one")


# ---------------------------------------------------------------------------
# Contrato


def validar_calendario(calendario: pd.DataFrame, anios: list[int] | None = None) -> None:
    """Detiene todo si el calendario no cumple el contrato (antes de escribir)."""
    cal = calendario
    if list(cal.columns) != list(CONTRATO):
        raise CalendarioError(f"Columnas distintas al contrato: {list(cal.columns)}")
    tipos = {c: str(t) for c, t in cal.dtypes.items()}
    distintos = {c: tipos[c] for c, t in CONTRATO.items() if tipos[c] != t}
    if distintos:
        raise CalendarioError(f"Tipos distintos al contrato: {distintos}")
    if cal.duplicated(CLAVE).any():
        raise CalendarioError("La clave (estado, municipio, anio, semana) está repetida")
    if not cal["semana"].between(1, SEMANAS).all():
        raise CalendarioError("Hay semanas fuera de 1–52")
    if anios is not None and sorted(cal["anio"].unique()) != sorted(anios):
        raise CalendarioError(f"Años inesperados: {sorted(cal['anio'].unique())}")
    for col in ("estado", "municipio", "zona", "anio", "semana",
                "cuadritos_viirs_eq", "cuadritos_viirs_crudo", "acum"):
        if cal[col].isna().any():
            raise CalendarioError(f"{col} tiene valores vacíos")
    if (cal["cuadritos_viirs_crudo"] < 0).any() or (cal["cuadritos_viirs_eq"] < 0).any():
        raise CalendarioError("Hay conteos negativos")
    if not (cal["cuadritos_viirs_eq"] == cal["cuadritos_viirs_crudo"]).all():
        raise CalendarioError("En el provisional, cuadritos_viirs_eq debe ser igual al crudo")
    if cal["cuadritos_modis_crudo"].notna().any():
        raise CalendarioError("En el provisional, cuadritos_modis_crudo debe ir vacío")
    orden = cal.sort_values(CLAVE)
    salto = orden.groupby(["estado", "municipio", "anio"])["acum"].diff()
    if (salto < 0).any() or (orden["acum"] < 0).any():
        raise CalendarioError("El acumulado disminuye o es negativo")
    total = orden.groupby(["estado", "municipio", "anio"]).agg(
        acum=("acum", "last"), suma=("cuadritos_viirs_eq", "sum")
    )
    if not np.allclose(total["acum"], total["suma"]):
        raise CalendarioError("El acumulado de la última semana no es el total del año")
    for col in ("p10", "p50", "p90", "acum_p10", "acum_p50", "acum_p90"):
        if cal[col].isna().any() or (cal[col] < 0).any():
            raise CalendarioError(f"{col} vacío o negativo")
    if not ((cal["p10"] <= cal["p50"]) & (cal["p50"] <= cal["p90"])).all():
        raise CalendarioError("Percentiles de la semana fuera de orden")
    if not ((cal["acum_p10"] <= cal["acum_p50"]) & (cal["acum_p50"] <= cal["acum_p90"])).all():
        raise CalendarioError("Percentiles del acumulado fuera de orden")
    sin_ventana = cal["zona"].isin(["Campeche", "Quintana Roo"])
    if cal.loc[sin_ventana, "en_ventana"].notna().any():
        raise CalendarioError("Campeche y Quintana Roo no llevan ventana")
    if cal.loc[cal["estado"] == "Yucatán", "en_ventana"].isna().any():
        raise CalendarioError("Todo municipio de Yucatán lleva ventana")


def _al_contrato(cal: pd.DataFrame) -> pd.DataFrame:
    cal = cal.copy()
    cal["cuadritos_viirs_eq"] = cal["cuadritos_viirs_crudo"].astype("float64")
    cal["cuadritos_modis_crudo"] = np.nan
    cal = cal[list(CONTRATO)].astype(CONTRATO)
    return cal.sort_values(CLAVE).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Todo junto


def generar_calendario(
    focos: Path = FOCOS,
    municipios: Path = MUNICIPIOS_ZONA,
    resumen: dict | None = None,
    cobertura_snpp: tuple[date, date] = COBERTURA,
) -> pd.DataFrame:
    """Lee las entradas y arma el calendario provisional ya validado (no escribe nada)."""
    resumen = {} if resumen is None else resumen
    primer_dia, ultimo_dia = cobertura_snpp
    resumen["cobertura"] = (primer_dia, ultimo_dia)
    df, cat = cargar_entradas(focos, municipios)
    resumen["focos_leidos"] = len(df)

    snpp = calcular_dia_solar(filtrar_snpp(df, resumen))
    cuadritos = crear_cuadritos_dia(snpp)
    validar_cobertura(cuadritos, primer_dia, ultimo_dia)
    resumen["cuadritos_dia"] = len(cuadritos)
    resumen["detecciones"] = (
        cuadritos["dia_local"].min().date(), cuadritos["dia_local"].max().date()
    )
    resumen["semanas_parciales"] = semanas_parciales(primer_dia, ultimo_dia)

    cobertura = semanas_cubiertas(primer_dia, ultimo_dia)
    cal = completar_semanas(agregar_semanas(cuadritos), cat, cobertura)
    cal["cuadritos_viirs_eq"] = cal["cuadritos_viirs_crudo"].astype("float64")
    cal = agregar_ventana(cal)
    cal = agregar_acumulados(cal)
    cal = agregar_percentiles(cal)
    cal = _al_contrato(cal)

    validar_calendario(cal, anios=list(range(primer_dia.year, ultimo_dia.year + 1)))
    if int(cal["cuadritos_viirs_crudo"].sum()) != len(cuadritos):
        raise CalendarioError("El calendario no suma los mismos cuadritos-día que la rejilla")
    resumen["municipios"] = cal["municipio"].nunique()
    resumen["filas"] = len(cal)
    tekax = cal[(cal["municipio"] == "Tekax") & (cal["anio"] == 2024)]
    resumen["tekax_2024"] = int(tekax["cuadritos_viirs_crudo"].sum())
    resumen["tekax_2024_rejilla"] = int(
        ((cuadritos["municipio"] == "Tekax") & (cuadritos["anio"] == 2024)).sum()
    )
    if resumen["tekax_2024"] != resumen["tekax_2024_rejilla"]:
        raise CalendarioError(
            f"Tekax 2024: calendario {resumen['tekax_2024']} ≠ rejilla "
            f"{resumen['tekax_2024_rejilla']}"
        )
    return cal


def escribir(calendario: pd.DataFrame, salida: Path = SALIDA) -> None:
    """Escribe en un temporal del mismo directorio, lo relee y lo pone en su lugar."""
    salida = Path(salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    temporal = salida.with_name(f".{salida.name}.tmp")
    try:
        calendario.to_parquet(temporal, index=False)
        releido = pd.read_parquet(temporal)
        if not releido.equals(calendario):
            raise CalendarioError("El parquet escrito no se relee igual")
        os.replace(temporal, salida)
    finally:
        if temporal.exists():
            temporal.unlink()


def _relativa(ruta: Path) -> str:
    try:
        return str(Path(ruta).resolve().relative_to(RAIZ))
    except ValueError:
        return str(ruta)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--salida", type=Path, default=SALIDA)
    args = parser.parse_args(argv)

    resumen: dict = {}
    cal = generar_calendario(resumen=resumen)
    escribir(cal, args.salida)

    print(f"Entrada: {_relativa(FOCOS)}")
    print(f"Focos leídos: {resumen['focos_leidos']:,}")
    for nombre, n in resumen["filtros"]:
        print(f"  después de {nombre}: {n:,}")
    print(f"Cuadritos-día únicos: {resumen['cuadritos_dia']:,}")
    ini, fin = resumen["cobertura"]
    print(f"Cobertura S-NPP (día solar, periodo fijo): {ini} a {fin}")
    ini, fin = resumen["detecciones"]
    print(f"Cuadritos-día con fuego: del {ini} al {fin}")
    for p in resumen["semanas_parciales"].itertuples():
        print(f"  semana parcial: {p.anio} semana {p.semana}, "
              f"{p.dias_observados} de {p.dias_semana} días observados")
    print(f"Municipios: {resumen['municipios']}")
    print(f"Filas: {resumen['filas']:,}")
    print(f"Escrito: {_relativa(args.salida)}")
    print(f"Tekax 2024: {resumen['tekax_2024']:,} cuadritos-día (coincide con la rejilla)")


if __name__ == "__main__":
    main()
