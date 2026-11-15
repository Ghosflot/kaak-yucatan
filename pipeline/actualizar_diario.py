"""Actualización diaria de focos (tarea 18, docs/02).

Uso (la clave NUNCA se guarda en el repo; se pasa como variable de entorno):
    FIRMS_MAP_KEY=tu_clave python pipeline/actualizar_diario.py
    python pipeline/correr_todo.py

Qué hace, en este orden:
1. Baja por la API de FIRMS los focos de NOAA-20, NOAA-21 y MODIS (producto casi en tiempo
   real, NRT) para la caja de la península, desde el último día que ya tiene cada satélite
   hasta hoy. La API da como mucho 5 días por consulta, así que se pide por tramos; si el
   trabajo dejó de correr unos días, el siguiente rellena el hueco (hasta TOPE_DIAS atrás).
2. Deja solo los focos que caen en Yucatán, Campeche o Quintana Roo y les asigna municipio y
   estado con datos_peninsula/municipios_peninsula.geojson, con la misma regla de
   analisis/preparar_peninsula.py: el estado de un foco es el de su municipio, y solo los que
   no caen en ningún municipio toman el del mapa de estados.
3. Los agrega a datos_peninsula/focos_recientes.parquet, con las mismas columnas y tipos que
   focos_peninsula.parquet, sin repetir focos: ni los que ya estaban en el historial ni los
   que ya se habían bajado otro día.
4. Escribe salidas/actualizacion.json con la fecha de «datos hasta» que muestra la página, y
   web/datos/revision.json con la hora de esta revisión, que la página muestra en su pie.

S-NPP no se pide: dejó de enviar datos el 2 nov 2026. Lo lee pipeline/cargar.py (tarea 2),
que es la única puerta de entrada de los focos para el resto del cálculo.
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

import pandas as pd
from shapely import contains_xy
from shapely.geometry import shape

RAIZ = Path(__file__).resolve().parent.parent
HISTORICOS = RAIZ / "datos_peninsula" / "focos_peninsula.parquet"
RECIENTES = RAIZ / "datos_peninsula" / "focos_recientes.parquet"
MUNICIPIOS = RAIZ / "datos_peninsula" / "municipios_peninsula.geojson"
ESTADOS = RAIZ / "datos_peninsula" / "estados_peninsula.geojson"
ACTUALIZACION = RAIZ / "salidas" / "actualizacion.json"
REVISION_WEB = RAIZ / "web" / "datos" / "revision.json"

BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
CAJA = "-92.6,17.7,-86.6,21.8"  # oeste,sur,este,norte: la misma de analisis/
CAJA_LAT = (17.7, 21.8)
CAJA_LON = (-92.6, -86.6)
DIAS = 5  # lo más que acepta la API en una consulta («Invalid day range. Expects [1..5]»)
TOPE_DIAS = 30  # hasta cuántos días atrás se rellena un hueco; más atrás, actualizar_datos.sh
# Fuente de FIRMS → valor de la columna `sensor` del historial.
FUENTES = {"VIIRS_NOAA20_NRT": "NOAA-20", "VIIRS_NOAA21_NRT": "NOAA-21", "MODIS_NRT": "MODIS"}
INTENTOS = 4

# Columnas y tipos de focos_peninsula.parquet: los recientes deben ser iguales para que
# cargar.py los una y quite repetidos.
TIPOS = {
    "latitude": "float64",
    "longitude": "float64",
    "acq_date": "datetime64[us]",
    "acq_time": "int64",
    "satellite": "object",
    "instrument": "object",
    "confidence": "object",
    "frp": "float64",
    "daynight": "object",
    "type": "float64",
    "brightness": "float64",
    "sensor": "object",
    "producto": "object",
    "estado": "object",
    "municipio": "object",
    "bright_ti4": "float64",
}
OBLIGATORIAS = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence"]
# Lo que identifica a un foco (la misma clave que preparar_peninsula.py).
CLAVE_FOCO = ["sensor", "acq_date", "acq_time", "latitude", "longitude"]


class ActualizacionError(RuntimeError):
    """La API o los datos no trajeron lo que la actualización necesita."""


# ---------------------------------------------------------------------------
# Descarga


def leer_url(url: str) -> str:
    """Pide una URL con reintentos (la red de FIRMS falla a veces)."""
    for intento in range(INTENTOS):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            # Un 4xx es un error de la consulta: repetirla no lo arregla.
            if e.code < 500 or intento == INTENTOS - 1:
                raise
            time.sleep(5 * (intento + 1))
        except (urllib.error.URLError, TimeoutError):
            if intento == INTENTOS - 1:
                raise
            time.sleep(5 * (intento + 1))
    return ""


def tramos(desde: date, hasta: date) -> list[date]:
    """Primer día de cada consulta de DIAS días que cubre de `desde` a `hasta`.

    No va más atrás de TOPE_DIAS días antes de `hasta`.
    """
    inicio = max(desde, hasta - timedelta(days=TOPE_DIAS - 1))
    inicios = []
    while inicio <= hasta:
        inicios.append(inicio)
        inicio += timedelta(days=DIAS)
    return inicios


def descargar(fuente: str, clave: str, inicio: date,
              leer: Callable[[str], str] = leer_url) -> pd.DataFrame:
    """Los focos de una fuente del día `inicio` a `inicio` + DIAS - 1, tal como los da FIRMS."""
    try:
        texto = leer(f"{BASE}/{clave}/{fuente}/{CAJA}/{DIAS}/{inicio.isoformat()}")
    except urllib.error.HTTPError as e:
        # Sin la URL en el mensaje: lleva la clave. El cuerpo dice el motivo («Invalid day range…»).
        try:
            motivo = e.read().decode("utf-8", "replace").strip().replace(clave, "***")[:200]
        except Exception:
            motivo = ""
        raise ActualizacionError(
            f"FIRMS respondió {e.code} para {fuente} desde {inicio}: {motivo or e.reason}") from None
    except (urllib.error.URLError, TimeoutError) as e:
        raise ActualizacionError(f"FIRMS no respondió para {fuente}: {type(e).__name__}") from None
    primera = texto.strip().splitlines()[0] if texto.strip() else ""
    if "latitude" not in primera.split(","):
        raise ActualizacionError(f"Respuesta inesperada de FIRMS para {fuente}: {texto[:200]!r}")
    return pd.read_csv(io.StringIO(texto), dtype={"confidence": str, "acq_time": "Int64"})


# ---------------------------------------------------------------------------
# Pasos


def normalizar(crudo: pd.DataFrame, sensor: str) -> pd.DataFrame:
    """Columnas y tipos del historial. NRT no trae `type`: va vacío (cuenta como vegetación)."""
    faltan = [c for c in OBLIGATORIAS if c not in crudo.columns]
    if faltan:
        raise ActualizacionError(f"A los focos de {sensor} les faltan las columnas {faltan}")
    df = crudo[crudo["latitude"].between(*CAJA_LAT) & crudo["longitude"].between(*CAJA_LON)]
    df = df.assign(
        sensor=sensor,
        producto="NRT",
        acq_date=pd.to_datetime(df["acq_date"], errors="coerce"),
        estado=None,
        municipio=None,
    )
    if df["acq_date"].isna().any() or df["acq_time"].isna().any():
        raise ActualizacionError(f"Focos de {sensor} con fecha u hora vacía o ilegible")
    faltantes = {c: pd.Series(None, index=df.index, dtype=t) for c, t in TIPOS.items() if c not in df.columns}
    return df.assign(**faltantes)[list(TIPOS)].astype(TIPOS)


def vacio() -> pd.DataFrame:
    """Una tabla de focos sin renglones, con las columnas y tipos del historial."""
    return pd.DataFrame({c: pd.Series(dtype=t) for c, t in TIPOS.items()})


def leer_limites(municipios: Path = MUNICIPIOS, estados: Path = ESTADOS):
    """[(municipio, estado, geometría)] y [(estado, geometría)] de datos_peninsula/."""
    mun = json.loads(Path(municipios).read_text(encoding="utf-8"))["features"]
    est = json.loads(Path(estados).read_text(encoding="utf-8"))["features"]
    return (
        [(f["properties"]["municipio"], f["properties"]["estado"], shape(f["geometry"])) for f in mun],
        [(f["properties"]["estado"], shape(f["geometry"])) for f in est],
    )


def asignar_territorio(focos: pd.DataFrame, municipios: list, estados: list) -> pd.DataFrame:
    """Municipio y estado de cada foco; quita los que caen fuera de los tres estados.

    Como preparar_peninsula.py: primero se queda lo que cae en algún estado del mapa; luego
    el estado de cada foco es el de su municipio, o el del mapa si no cae en ninguno.
    """
    lon, lat = focos["longitude"].to_numpy(), focos["latitude"].to_numpy()
    estado_mapa = pd.Series(None, index=focos.index, dtype=object)
    for nombre, geom in estados:
        estado_mapa[contains_xy(geom, lon, lat)] = nombre
    municipio = pd.Series(None, index=focos.index, dtype=object)
    estado_mun = pd.Series(None, index=focos.index, dtype=object)
    for nombre, estado, geom in municipios:
        dentro = contains_xy(geom, lon, lat)
        municipio[dentro] = nombre
        estado_mun[dentro] = estado
    dentro_peninsula = estado_mapa.notna()
    return focos[dentro_peninsula].assign(
        municipio=municipio[dentro_peninsula],
        estado=estado_mun[dentro_peninsula].fillna(estado_mapa[dentro_peninsula]),
    )


def _claves(df: pd.DataFrame) -> pd.MultiIndex:
    return pd.MultiIndex.from_frame(df[CLAVE_FOCO])


def unir(nuevos: pd.DataFrame, recientes: pd.DataFrame, historicos: pd.DataFrame) -> pd.DataFrame:
    """Recientes de antes + nuevos, sin repetidos y sin lo que ya está en el historial."""
    todos = pd.concat([recientes, nuevos], ignore_index=True).drop_duplicates(CLAVE_FOCO, keep="last")
    ya_estaban = _claves(todos).isin(_claves(historicos))
    return todos[~ya_estaban].sort_values(["acq_date", "acq_time"]).reset_index(drop=True)


def fechas_hasta(historicos: pd.DataFrame, recientes: pd.DataFrame) -> dict:
    """Último día con datos, en total y por sensor (fecha UTC de FIRMS)."""
    fechas = pd.concat([historicos[["sensor", "acq_date"]], recientes[["sensor", "acq_date"]]])
    por_sensor = fechas.groupby("sensor")["acq_date"].max()
    return {
        "datos_hasta": fechas["acq_date"].max().date().isoformat(),
        "por_sensor": {s: f.date().isoformat() for s, f in por_sensor.items()},
    }


# ---------------------------------------------------------------------------
# Escritura


def escribir_parquet(df: pd.DataFrame, ruta: Path) -> None:
    """Escribe en un temporal y lo pone en su lugar, para no dejar un archivo a medias."""
    temporal = ruta.with_name(f".{ruta.name}.tmp")
    try:
        df.to_parquet(temporal, index=False, compression="zstd")
        os.replace(temporal, ruta)
    finally:
        if temporal.exists():
            temporal.unlink()


def escribir_actualizacion(datos: dict, ruta: Path = ACTUALIZACION) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Todo junto


def desde_cuando(sensor: str, historicos: pd.DataFrame, recientes: pd.DataFrame, hoy: date) -> date:
    """Último día que ya hay de un satélite (se vuelve a pedir: pudo quedar a medias).

    Si no hay ninguno, los últimos DIAS días.
    """
    fechas = pd.concat([historicos.loc[historicos["sensor"] == sensor, "acq_date"],
                        recientes.loc[recientes["sensor"] == sensor, "acq_date"]])
    if fechas.empty:
        return hoy - timedelta(days=DIAS - 1)
    return min(fechas.max().date(), hoy)


def actualizar(clave: str, leer: Callable[[str], str] = leer_url, hoy: date | None = None) -> dict:
    hoy = hoy or datetime.now(timezone.utc).date()
    historicos = pd.read_parquet(HISTORICOS, columns=CLAVE_FOCO)
    recientes = pd.read_parquet(RECIENTES).astype(TIPOS) if RECIENTES.is_file() else vacio()
    municipios, estados = leer_limites()

    bajados = []
    for fuente, sensor in FUENTES.items():
        inicios = tramos(desde_cuando(sensor, historicos, recientes, hoy), hoy)
        crudo = pd.concat([normalizar(descargar(fuente, clave, i, leer), sensor) for i in inicios],
                          ignore_index=True)
        focos = asignar_territorio(crudo, municipios, estados)
        print(f"{fuente}: {len(focos):,} focos en la península desde {inicios[0]}")
        bajados.append(focos)

    nuevos = pd.concat(bajados, ignore_index=True)
    juntos = unir(nuevos, recientes, historicos)
    escribir_parquet(juntos, RECIENTES)
    resumen = {
        **fechas_hasta(historicos, juntos),
        "focos_recientes": len(juntos),
        "focos_agregados_hoy": len(juntos) - len(recientes),
        "actualizado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    escribir_actualizacion(resumen, ACTUALIZACION)
    # La página dice cuándo se revisaron los datos por última vez, aunque no haya focos nuevos.
    escribir_actualizacion({"revisado": resumen["actualizado"]}, REVISION_WEB)
    return resumen


def main() -> None:
    clave = os.environ.get("FIRMS_MAP_KEY")
    if not clave:
        sys.exit("Falta FIRMS_MAP_KEY en el entorno.")
    try:
        resumen = actualizar(clave)
    except ActualizacionError as e:
        sys.exit(f"Error: {e}")
    print(f"Focos recientes: {resumen['focos_recientes']:,} "
          f"({resumen['focos_agregados_hoy']:+,} hoy). Datos hasta {resumen['datos_hasta']}.")


if __name__ == "__main__":
    main()
