"""Única puerta de entrada de los focos de fuego (tarea 2, docs/02).

Uso:
    from cargar import cargar_focos
    focos = cargar_focos()

Nadie más lee los parquet de focos directamente: si cambia la fuente (por ejemplo, el kit
de la sede, tarea 8), solo cambia este archivo.

Qué hace cargar_focos(), en este orden:
1. Lee datos_peninsula/focos_peninsula.parquet (historial hasta el 7 nov 2026) y, si existe,
   datos_peninsula/focos_recientes.parquet (la actualización diaria, tarea 18).
2. Quita repetidos: el mismo satélite, fecha, hora, latitud y longitud es el mismo foco.
   Si está dos veces, una como SP (definitivo) y otra como NRT (casi en tiempo real), se
   queda la SP.
3. Filtra (datos_peninsula/LEEME.md): solo vegetación (`type` 0 o vacío) y confianza
   nominal o alta (VIIRS `n` o `h`; MODIS 30 o más).
4. Pone un nombre claro a cada satélite (`satelite`: Terra, Aqua, S-NPP, NOAA-20, NOAA-21).
   La columna `sensor` dice «MODIS» para Terra y para Aqua, así que no sirve para
   separarlos.
5. Calcula el día en hora solar del lugar (UTC + longitud / 15), y de ahí el año, el mes y
   la semana (1 a 52).
6. Une la zona de quema con analisis/municipios_zona.csv. Los focos sin municipio (0.2 %)
   se quedan, con zona vacía: cuentan para la península, no para ningún municipio.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
FOCOS_HISTORICOS = RAIZ / "datos_peninsula" / "focos_peninsula.parquet"
FOCOS_RECIENTES = RAIZ / "datos_peninsula" / "focos_recientes.parquet"
MUNICIPIOS_ZONA = RAIZ / "analisis" / "municipios_zona.csv"

# Columna `satellite` de FIRMS → nombre que usamos en todo el proyecto.
SATELITES = {"Terra": "Terra", "Aqua": "Aqua", "N": "S-NPP", "N20": "NOAA-20", "N21": "NOAA-21"}
MODIS = {"Terra", "Aqua"}

CONFIANZA_VIIRS = {"n", "h"}
CONFIANZA_MODIS_MIN = 30
SEMANAS = 52

COLUMNAS_FOCOS = [
    "acq_date", "acq_time", "latitude", "longitude", "satellite", "sensor",
    "producto", "confidence", "type", "estado", "municipio",
]
# Lo que identifica a un foco: si estas cinco coinciden, es el mismo.
CLAVE_FOCO = ["satellite", "acq_date", "acq_time", "latitude", "longitude"]
# Orden de preferencia cuando un foco viene repetido: el definitivo primero.
PREFERENCIA_PRODUCTO = {"SP": 0, "NRT": 1}


class DatosError(ValueError):
    """Los datos de entrada no tienen lo que el cálculo necesita."""


# ---------------------------------------------------------------------------
# Lectura


def leer_focos(historicos: Path = FOCOS_HISTORICOS, recientes: Path = FOCOS_RECIENTES) -> pd.DataFrame:
    """Lee el historial y, si existe, los focos recientes, en una sola tabla."""
    if not Path(historicos).is_file():
        raise DatosError(f"No existe {historicos}")
    partes = [_leer_parquet(historicos)]
    if Path(recientes).is_file():
        partes.append(_leer_parquet(recientes))
    return pd.concat(partes, ignore_index=True)


def _leer_parquet(ruta: Path) -> pd.DataFrame:
    df = pd.read_parquet(ruta)
    faltan = [c for c in COLUMNAS_FOCOS if c not in df.columns]
    if faltan:
        raise DatosError(f"A {Path(ruta).name} le faltan las columnas {faltan}")
    return df


def leer_catalogo(municipios: Path = MUNICIPIOS_ZONA) -> pd.DataFrame:
    """Municipio, estado y zona de quema (analisis/municipios_zona.csv)."""
    if not Path(municipios).is_file():
        raise DatosError(f"No existe {municipios}")
    return pd.read_csv(municipios, dtype=str, keep_default_na=False, na_values=[""])


# ---------------------------------------------------------------------------
# Pasos


def quitar_repetidos(focos: pd.DataFrame) -> pd.DataFrame:
    """Un foco por satélite, fecha, hora y lugar. Entre SP y NRT, se queda SP."""
    orden = focos["producto"].map(PREFERENCIA_PRODUCTO).fillna(len(PREFERENCIA_PRODUCTO))
    return (
        focos.assign(_orden=orden)
        .sort_values("_orden", kind="stable")
        .drop_duplicates(CLAVE_FOCO, keep="first")
        .drop(columns="_orden")
        .sort_index()
    )


def nombrar_satelites(focos: pd.DataFrame) -> pd.DataFrame:
    """Agrega `satelite` con el nombre claro; se detiene si aparece uno desconocido."""
    desconocidos = set(focos["satellite"].dropna().unique()) - set(SATELITES)
    if desconocidos or focos["satellite"].isna().any():
        raise DatosError(f"Hay focos de un satélite desconocido o vacío: {sorted(map(str, desconocidos))}")
    return focos.assign(satelite=focos["satellite"].map(SATELITES))


def filtrar(focos: pd.DataFrame) -> pd.DataFrame:
    """Solo vegetación y confianza nominal o alta."""
    tipo = pd.to_numeric(focos["type"], errors="coerce")
    vegetacion = focos["type"].isna() | (tipo == 0)

    es_modis = focos["satelite"].isin(MODIS).to_numpy(dtype=bool)
    confianza_modis = (
        pd.to_numeric(focos["confidence"], errors="coerce") >= CONFIANZA_MODIS_MIN
    ).to_numpy(dtype=bool)
    confianza_viirs = (
        focos["confidence"].astype("string").str.strip().isin(CONFIANZA_VIIRS)
        .fillna(False).to_numpy(dtype=bool)
    )
    confiable = np.where(es_modis, confianza_modis, confianza_viirs)

    return focos[vegetacion.to_numpy(dtype=bool) & confiable]


def hora_utc(acq_time: pd.Series) -> pd.Series:
    """HHMM (5, 430, 1330 o «0430») → tiempo desde la medianoche UTC."""
    numero = pd.to_numeric(acq_time, errors="coerce")
    horas, minutos = numero // 100, numero % 100
    validos = numero.notna() & (numero == numero.round()) & horas.between(0, 23) & minutos.between(0, 59)
    if not validos.all():
        ejemplos = acq_time[~validos].astype(str).unique()[:5].tolist()
        raise DatosError(f"acq_time con horas inválidas (se espera HHMM): {ejemplos}")
    return pd.to_timedelta(horas * 60 + minutos, unit="min")


def semana_del_anio(dia_del_anio) -> np.ndarray:
    """Semana 1 a 52: los uno o dos días que sobran al final del año van a la 52."""
    dias = np.asarray(dia_del_anio, dtype=int)
    if ((dias < 1) | (dias > 366)).any():
        raise DatosError("Día del año fuera de 1 a 366")
    return np.minimum((dias - 1) // 7 + 1, SEMANAS)


def agregar_dia_local(focos: pd.DataFrame) -> pd.DataFrame:
    """Día, año, mes y semana en hora solar del lugar: UTC + longitud / 15 horas.

    Se usa la hora solar y no la oficial porque la oficial cambió con los años (horario de
    verano hasta 2022 y Quintana Roo en otra zona desde 2015).
    """
    fecha = pd.to_datetime(focos["acq_date"], errors="coerce")
    if fecha.isna().any():
        raise DatosError("acq_date tiene fechas que no se pueden leer")
    utc = fecha.dt.normalize() + hora_utc(focos["acq_time"])
    desfase = pd.to_timedelta(np.round(focos["longitude"].to_numpy() / 15 * 3600), unit="s")
    solar = utc + desfase
    return focos.assign(
        dia_local=solar.dt.normalize(),
        anio=solar.dt.year.astype("int16"),
        mes=solar.dt.month.astype("int8"),
        semana=semana_del_anio(solar.dt.day_of_year).astype("int8"),
    )


def unir_zona(focos: pd.DataFrame, catalogo: pd.DataFrame) -> pd.DataFrame:
    """Agrega la zona de quema según municipio y estado del foco."""
    zonas = catalogo[["municipio", "estado", "zona"]]
    if zonas.duplicated(["municipio", "estado"]).any():
        raise DatosError("El catálogo de municipios tiene municipios repetidos")
    unido = focos.merge(zonas, on=["municipio", "estado"], how="left", validate="many_to_one")
    unido.index = focos.index
    huerfanos = unido["municipio"].notna() & unido["zona"].isna()
    if huerfanos.any():
        faltan = unido.loc[huerfanos, ["municipio", "estado"]].drop_duplicates().head(5)
        raise DatosError(f"Municipios que no están en el catálogo: {faltan.to_dict('records')}")
    return unido


# ---------------------------------------------------------------------------
# Todo junto


def preparar_focos(focos: pd.DataFrame, catalogo: pd.DataFrame) -> pd.DataFrame:
    """Los pasos 2 a 6 sobre una tabla ya leída (las pruebas la usan sin archivos)."""
    faltan = [c for c in COLUMNAS_FOCOS if c not in focos.columns]
    if faltan:
        raise DatosError(f"A los focos les faltan las columnas {faltan}")
    df = quitar_repetidos(focos)
    df = nombrar_satelites(df)
    df = filtrar(df)
    df = agregar_dia_local(df)
    df = unir_zona(df, catalogo)
    return df.reset_index(drop=True)


def cargar_focos(
    historicos: Path = FOCOS_HISTORICOS,
    recientes: Path = FOCOS_RECIENTES,
    municipios: Path = MUNICIPIOS_ZONA,
) -> pd.DataFrame:
    """Lee, limpia y prepara todos los focos. Un renglón por foco válido."""
    return preparar_focos(leer_focos(historicos, recientes), leer_catalogo(municipios))


if __name__ == "__main__":
    f = cargar_focos()
    print(f"{len(f):,} focos válidos")
    print(f.groupby(["satelite"]).size().to_string())
