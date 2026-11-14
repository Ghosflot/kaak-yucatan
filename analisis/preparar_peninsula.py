"""Arma el paquete de datos de la península que sí va al repo (datos_peninsula/).

Junta todos los focos de fuego de FIRMS en Yucatán, Campeche y Quintana Roo, de todos los
satélites, y les asigna estado y municipio. También recorta los incendios de CONAFOR y los
límites geográficos. Así el equipo trabaja sin bajar los ~900 MB de datos crudos.

Uso:
    ./analisis/descargar_datos.sh
    FIRMS_MAP_KEY=tu_clave python analisis/descargar_firms_api.py
    python analisis/preparar_peninsula.py
"""
from __future__ import annotations

import glob
import json
from pathlib import Path

import pandas as pd
from shapely import contains_xy
from shapely.geometry import mapping, shape

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
SALIDA = RAIZ / "datos_peninsula"
ESTADOS = ("Yucatán", "Campeche", "Quintana Roo")
CAJA = dict(lat=(17.7, 21.8), lon=(-92.6, -86.6))
# El límite entre estados de Natural Earth es burdo en el centro de la península. Para estos
# municipios, el punto que decide su estado cae del lado equivocado; se corrige a mano.
ESTADO_CORREGIDO = {"Tzucacab": "Yucatán"}
COLUMNAS = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "instrument",
            "confidence", "frp", "daynight", "type", "bright_ti4", "brightness"]


def sensor_de(nombre: str) -> tuple[str, str]:
    """(sensor, producto) a partir del nombre de archivo."""
    n = Path(nombre).name
    if n.startswith("modis") or n.startswith("MODIS"):
        sensor = "MODIS"
    elif "jpss1" in n or "NOAA20" in n:
        sensor = "NOAA-20"
    elif "NOAA21" in n:
        sensor = "NOAA-21"
    else:
        sensor = "S-NPP"
    producto = "NRT" if "_NRT_" in n else "SP"
    return sensor, producto


def main() -> None:
    SALIDA.mkdir(exist_ok=True)
    feats = json.loads((DATA / "geo/admin1.geojson").read_text())["features"]
    estados = {f["properties"]["name"]: shape(f["geometry"]) for f in feats
               if f["properties"].get("admin") == "Mexico" and f["properties"]["name"] in ESTADOS}

    # Municipios de los tres estados (geoBoundaries no trae el estado: se asigna por ubicación).
    municipios = []
    for f in json.loads((DATA / "geo/mex_adm2.geojson").read_text())["features"]:
        g = shape(f["geometry"])
        p = g.representative_point()
        for nombre_estado, ge in estados.items():
            if ge.contains(p):
                nombre = f["properties"]["shapeName"]
                municipios.append((nombre, ESTADO_CORREGIDO.get(nombre, nombre_estado), g))
    estado_de = {nombre: est for nombre, est, _ in municipios}

    partes = []
    archivos = sorted(glob.glob(str(DATA / "firms/*.csv")) + glob.glob(str(DATA / "firms_api/*.csv")))
    for fn in archivos:
        d = pd.read_csv(fn, low_memory=False)
        d = d[d.latitude.between(*CAJA["lat"]) & d.longitude.between(*CAJA["lon"])].copy()
        d = d[[c for c in COLUMNAS if c in d.columns]]
        d["sensor"], d["producto"] = sensor_de(fn)
        d["estado"] = None
        for nombre_estado, ge in estados.items():
            d.loc[contains_xy(ge, d.longitude.values, d.latitude.values), "estado"] = nombre_estado
        d = d[d.estado.notna()]
        d["municipio"] = None
        for nombre, _, g in municipios:
            d.loc[contains_xy(g, d.longitude.values, d.latitude.values), "municipio"] = nombre
        # El estado de un foco es el de su municipio (límites más finos). Solo los focos que no
        # caen en ningún municipio conservan el estado de Natural Earth.
        d["estado"] = d.municipio.map(estado_de).fillna(d.estado)
        partes.append(d)
        print(f"{Path(fn).name}: {len(d)} focos en la península")

    focos = pd.concat(partes, ignore_index=True)
    focos["confidence"] = focos["confidence"].astype(str)
    focos["acq_date"] = pd.to_datetime(focos["acq_date"])
    # Si un mismo foco viene en el producto definitivo (SP) y en el casi en tiempo real (NRT),
    # se queda el definitivo.
    antes = len(focos)
    focos = (focos.sort_values("producto", key=lambda s: s.map({"SP": 0, "NRT": 1}))
             .drop_duplicates(["sensor", "acq_date", "acq_time", "latitude", "longitude"]))
    if len(focos) < antes:
        print(f"Quitados {antes - len(focos)} focos repetidos entre archivos")
    focos = focos.sort_values(["acq_date", "acq_time"]).reset_index(drop=True)
    focos.to_parquet(SALIDA / "focos_peninsula.parquet", index=False, compression="zstd")

    conafor = pd.read_csv(DATA / "conafor/incendios_2015_2024.csv", low_memory=False)
    conafor[conafor["Estado"].isin(ESTADOS)].to_csv(SALIDA / "incendios_conafor_2015_2024.csv", index=False)

    geo_estados = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"estado": n}, "geometry": mapping(g.simplify(0.002))}
        for n, g in estados.items()]}
    (SALIDA / "estados_peninsula.geojson").write_text(json.dumps(geo_estados))
    geo_mun = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"municipio": n, "estado": e}, "geometry": mapping(g.simplify(0.0005))}
        for n, e, g in municipios]}
    (SALIDA / "municipios_peninsula.geojson").write_text(json.dumps(geo_mun))

    resumen = focos.groupby(["sensor", focos.acq_date.dt.year]).size().unstack(0).fillna(0).astype(int)
    print(resumen.to_string())
    print(f"Total: {len(focos)} focos; municipios: {len(municipios)}")


if __name__ == "__main__":
    main()
