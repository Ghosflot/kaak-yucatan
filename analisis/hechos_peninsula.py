"""Reproduce las cifras de docs/01-verified-facts.md.

Uso:
    ./analisis/descargar_datos.sh
    python analisis/hechos_peninsula.py

Qué hace:
1. CONAFOR 2015-2024: número de incendios forestales y hectáreas por estado y año,
   causas, municipios y meses en Yucatán.
2. FIRMS (NASA): asigna cada foco de calor a Yucatán, Campeche o Quintana Roo y
   cuenta por año, sensor y mes. Solo «presunto incendio de vegetación» (type 0);
   MODIS con confianza >= 30, VIIRS con confianza nominal o alta.
3. Compara VIIRS contra MODIS en los años en que ambos operan (el corazón del reto).

Las cifras de CONAFOR 2025 vienen del PDF de cierre (no hay CSV público aún).
"""
from __future__ import annotations

import glob
import json
from pathlib import Path

import pandas as pd
from shapely import contains_xy
from shapely.geometry import shape

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
PENINSULA = ("Yucatán", "Campeche", "Quintana Roo")
# Caja que contiene la península; acelera el filtro antes del punto-en-polígono.
CAJA = dict(lat=(17.7, 21.8), lon=(-92.6, -86.6))


def conafor() -> None:
    d = pd.read_csv(DATA / "conafor/incendios_2015_2024.csv", low_memory=False)
    pen = d[d["Estado"].isin(PENINSULA)]
    print("== CONAFOR: incendios forestales y hectáreas por año (península)")
    t = pen.pivot_table(index="anio", columns="Estado", values="Total_hectareas",
                        aggfunc=["count", "sum"]).round(0)
    print(t.to_string())
    nac = d.groupby("anio").agg(incendios=("Total_hectareas", "size"),
                                hectareas=("Total_hectareas", "sum")).round(0)
    print("\n== CONAFOR: total nacional"); print(nac.to_string())

    y = d[d["Estado"] == "Yucatán"]
    print("\n== Yucatán: causa específica (2015-2024)")
    print(y.groupby("Causa_especifica")["Total_hectareas"].agg(["count", "sum"])
          .sort_values("count", ascending=False).round(0).head(8).to_string())
    print("\n== Yucatán: municipios con más hectáreas (2015-2024)")
    print(y.groupby("Municipio")["Total_hectareas"].agg(["count", "sum"])
          .sort_values("sum", ascending=False).round(0).head(8).to_string())
    print("\n== Yucatán: mes de inicio de los incendios (2015-2024)")
    print(pd.to_datetime(y["Fecha_Inicio"], errors="coerce").dt.month
          .value_counts().sort_index().to_string())
    print("\n== Yucatán: 10 incendios más grandes (2015-2024)")
    cols = ["anio", "Municipio", "Predio", "Causa_especifica", "Fecha_Inicio",
            "Tipo_Vegetacion", "Total_hectareas"]
    print(y.sort_values("Total_hectareas", ascending=False)[cols].head(10).to_string())


def firms() -> pd.DataFrame:
    gj = json.loads((DATA / "geo/admin1.geojson").read_text())
    estados = {f["properties"]["name"]: shape(f["geometry"]) for f in gj["features"]
               if f["properties"].get("admin") == "Mexico"
               and f["properties"].get("name") in PENINSULA}
    partes = []
    for fn in sorted(glob.glob(str(DATA / "firms/*.csv"))):
        sensor = "MODIS" if Path(fn).name.startswith("modis") else "VIIRS"
        d = pd.read_csv(fn, low_memory=False, usecols=lambda c: c in (
            "latitude", "longitude", "acq_date", "confidence", "frp", "type"))
        d = d[d.latitude.between(*CAJA["lat"]) & d.longitude.between(*CAJA["lon"])].copy()
        d["sensor"] = sensor
        d["confidence"] = d["confidence"].astype(str)
        d["estado"] = None
        for nombre, geom in estados.items():
            d.loc[contains_xy(geom, d.longitude.values, d.latitude.values), "estado"] = nombre
        partes.append(d[d.estado.notna()])
    a = pd.concat(partes)
    a["acq_date"] = pd.to_datetime(a.acq_date)
    a["anio"], a["mes"] = a.acq_date.dt.year, a.acq_date.dt.month
    a = a[a["type"] == 0]  # presunto incendio de vegetación
    modis = a[(a.sensor == "MODIS") & (pd.to_numeric(a.confidence, errors="coerce") >= 30)]
    viirs = a[(a.sensor == "VIIRS") & a.confidence.isin(["n", "h"])]
    return pd.concat([modis, viirs])


def resumen_firms(f: pd.DataFrame) -> None:
    for sensor in ("MODIS", "VIIRS"):
        t = f[f.sensor == sensor].groupby("anio").size().rename("Península").to_frame()
        print(f"\n== FIRMS {sensor}: focos de calor de vegetación por año"); print(t.to_string())

    por_anio = f.groupby(["sensor", "anio"]).size().unstack(0)
    ratio = (por_anio["VIIRS"] / por_anio["MODIS"]).loc[2013:2025].round(2)
    print("\n== VIIRS / MODIS en la península (años completos 2013-2025)")
    print(ratio.to_dict())

    # Las cifras de Yucatán salen de analisis/cifras_yucatan.py, que asigna el estado por
    # municipio. Aquí solo se usan los totales de la península, que no dependen de eso.


if __name__ == "__main__":
    conafor()
    resumen_firms(firms())
