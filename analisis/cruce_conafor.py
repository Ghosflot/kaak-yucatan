"""Cruce de los incendios registrados por CONAFOR (2015–2024) con los focos de satélite.

Pregunta: ¿qué parte de los incendios que CONAFOR registró en la península tiene focos de
satélite cerca, en lugar y fecha? Es una validación con datos de campo, independiente de los
satélites.

Regla de coincidencia: al menos un foco a menos de RADIO_KM del punto del incendio, entre un
día antes de la fecha de inicio y un día después de la de término (el margen cubre la
diferencia entre la hora UTC del satélite y la hora local).

Controles, para saber cuánto es azar (en la península hay mucho fuego en temporada):
  - mismo lugar, mismas fechas pero un año antes y un año después;
  - mismas fechas, pero el punto movido 20 km (cuatro direcciones).
Si la coincidencia real no supera con claridad a los controles, el cruce no prueba nada.

Uso:  .venv/bin/python analisis/cruce_conafor.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from scipy.stats import spearmanr

RAIZ = Path(__file__).resolve().parent.parent
RADIO_KM = 2.0
MARGEN = pd.Timedelta(days=1)
LAT0 = np.deg2rad(19.5)  # centro aproximado de la península, para pasar grados a km


def a_km(lat, lon):
    lat, lon = np.asarray(lat, float), np.asarray(lon, float)
    return np.column_stack([lon * 111.32 * np.cos(LAT0), lat * 110.57])


def cargar():
    f = pd.read_parquet(RAIZ / "datos_peninsula/focos_peninsula.parquet")
    f = f[f["type"].fillna(0) == 0]
    viirs = f.sensor.isin(["S-NPP", "NOAA-20", "NOAA-21"]) & f.confidence.astype(str).isin(["n", "h"])
    modis = (f.sensor == "MODIS") & (pd.to_numeric(f.confidence, errors="coerce") >= 30)
    f = f[viirs | modis].copy()
    f["acq_date"] = pd.to_datetime(f.acq_date)
    c = pd.read_csv(RAIZ / "datos_peninsula/incendios_conafor_2015_2024.csv")
    c["ini"] = pd.to_datetime(c.Fecha_Inicio, errors="coerce")
    c["fin"] = pd.to_datetime(c.Fecha_Termino, errors="coerce").fillna(c["ini"])
    c = c.dropna(subset=["latitud", "longitud", "ini"])
    c = c[c.fin >= c.ini]
    return f, c.reset_index(drop=True)


def coincidencias(c: pd.DataFrame, focos: pd.DataFrame, dlat=0.0, dlon=0.0, ddias=0):
    """Por cada incendio: cuántos focos caen dentro del radio y de la ventana de fechas."""
    arbol = cKDTree(a_km(focos.latitude, focos.longitude))
    fechas = focos.acq_date.values
    pts = a_km(c.latitud + dlat, c.longitud + dlon)
    vecinos = arbol.query_ball_point(pts, r=RADIO_KM)
    desde = (c.ini - MARGEN + pd.Timedelta(days=ddias)).values
    hasta = (c.fin + MARGEN + pd.Timedelta(days=ddias)).values
    n = np.zeros(len(c), int)
    for i, idx in enumerate(vecinos):
        if idx:
            d = fechas[idx]
            n[i] = int(((d >= desde[i]) & (d <= hasta[i])).sum())
    return n


def tasa(n):
    return 100 * (n > 0).mean()


def main():
    f, c = cargar()
    grupos = {
        "S-NPP (VIIRS)": f[f.sensor == "S-NPP"],
        "MODIS (Terra + Aqua)": f[f.sensor == "MODIS"],
        "Cualquier satélite": f,
    }
    print(f"Incendios de CONAFOR con coordenadas y fechas válidas: {len(c)} (2015–2024, península)")
    print(f"Regla: foco a < {RADIO_KM:g} km y entre inicio − 1 día y término + 1 día\n")

    km20 = 20 / 110.57
    km20_lon = 20 / (111.32 * np.cos(LAT0))
    for nombre, g in grupos.items():
        n = coincidencias(c, g)
        ctrl_anio = np.mean([tasa(coincidencias(c, g, ddias=d)) for d in (-365, 365)])
        ctrl_lugar = np.mean([tasa(coincidencias(c, g, dlat=a, dlon=b))
                              for a, b in ((km20, 0), (-km20, 0), (0, km20_lon), (0, -km20_lon))])
        print(f"{nombre}: {tasa(n):.1f} % de los incendios con foco cerca "
              f"| control mismo lugar ±1 año: {ctrl_anio:.1f} % | control a 20 km: {ctrl_lugar:.1f} %")
        if nombre == "S-NPP (VIIRS)":
            c["n_snpp"] = n
        if nombre == "MODIS (Terra + Aqua)":
            c["n_modis"] = n
        if nombre == "Cualquier satélite":
            c["n_todos"] = n

    print("\nS-NPP por tamaño del incendio (CONAFOR):")
    orden = c.groupby("Tamano").Total_hectareas.median().sort_values().index
    for t in orden:
        s = c[c.Tamano == t]
        print(f"  {t:<24} {len(s):>5} incendios  S-NPP {tasa(s.n_snpp):5.1f} %  MODIS {tasa(s.n_modis):5.1f} %")

    print("\nS-NPP por estado:")
    for e, s in c.groupby("Estado"):
        print(f"  {e:<15} {len(s):>5} incendios  {tasa(s.n_snpp):5.1f} %")

    grandes = c[c.Total_hectareas >= 50]
    print(f"\nIncendios de 50 ha o más: {len(grandes)}; con foco S-NPP: {tasa(grandes.n_snpp):.1f} %")
    rho, p = spearmanr(c.Total_hectareas, c.n_snpp)
    print(f"¿Más hectáreas, más focos? Spearman entre hectáreas y focos S-NPP: rho = {rho:.2f} (p = {p:.1e})")
    print(f"Incendios en 2024 (peor año): {int((c.anio == 2024).sum())}, con foco S-NPP: "
          f"{tasa(c[c.anio == 2024].n_snpp):.1f} %")

    salida = RAIZ / "analisis/salidas"
    salida.mkdir(exist_ok=True)
    c[["Clave_del_incendio", "anio", "Estado", "Municipio", "ini", "fin", "Total_hectareas",
       "Tamano", "Causa", "n_snpp", "n_modis", "n_todos"]].to_csv(salida / "cruce_conafor.csv", index=False)
    print(f"\nDetalle por incendio: {salida.relative_to(RAIZ)}/cruce_conafor.csv")


if __name__ == "__main__":
    main()
