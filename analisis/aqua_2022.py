"""Por qué 2022 sale corto en la Prueba 2 (Aqua 2021–2025 contra S-NPP).

Pregunta: en salidas/validacion.json, la predicción de 2022 (Aqua × factores) queda 25 % por
debajo de lo que vio S-NPP. Los demás años quedan entre −5 % y +11 %. ¿A qué se debe?

Cuenta focos de vegetación de la península con confianza nominal o alta (el filtro de
docs/01) y responde cuatro cosas:
  1. Qué vio cada satélite día por día alrededor del apagón de Aqua (31 mar – 16 abr 2022).
  2. En temporada (marzo a mayo) y sin los días del apagón: cuántos focos ve S-NPP por cada
     uno de Aqua, año por año.
  3. Lo mismo contra Terra, el otro MODIS (control): si 2022 también se sale con Terra, la
     causa son los fuegos de ese año; si no, es algo de Aqua. También la potencia típica (FRP
     mediana) de los fuegos que ve S-NPP, por si 2022 tuvo fuegos más chicos.
  4. La razón con Aqua por mes, para ver en qué parte de 2022 se sale de lo normal.

Son focos, no cuadritos-día: sirve para comparar años entre sí, no para reproducir el
factor de salidas/factores.csv.

Uso:  .venv/bin/python analisis/aqua_2022.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
APAGON = (pd.Timestamp("2022-03-31"), pd.Timestamp("2022-04-16"))
# Días en que Aqua ya mandaba datos pero NASA aún los daba por inestables (LAADS: hasta el 21).
RECUPERACION = (pd.Timestamp("2022-04-17"), pd.Timestamp("2022-04-21"))
ANIOS = range(2013, 2026)  # años completos con Aqua, Terra y S-NPP
TEMPORADA = (3, 4, 5)


def cargar() -> pd.DataFrame:
    f = pd.read_parquet(RAIZ / "datos_peninsula/focos_peninsula.parquet",
                        columns=["acq_date", "sensor", "satellite", "type", "confidence", "frp"])
    f = f[f["type"].fillna(0) == 0]
    viirs = (f.sensor == "S-NPP") & f.confidence.astype(str).isin(["n", "h"])
    modis = (f.sensor == "MODIS") & (pd.to_numeric(f.confidence, errors="coerce") >= 30)
    f = f[viirs | modis].copy()
    f["sat"] = f.sensor.where(f.sensor == "S-NPP", f.satellite)  # S-NPP, Aqua o Terra
    f["dia"] = pd.to_datetime(f.acq_date).dt.normalize()
    return f[f.dia.dt.year.isin(ANIOS)]


def sin(f: pd.DataFrame, *tramos) -> pd.DataFrame:
    fuera = pd.Series(False, index=f.index)
    for ini, fin in tramos:
        fuera |= f.dia.between(ini, fin)
    return f[~fuera]


def razones(f: pd.DataFrame, por: list[str], otro: str) -> pd.Series:
    """Focos de S-NPP por cada foco del otro satélite."""
    t = f.assign(**{p: getattr(f.dia.dt, p) for p in por}).groupby(por + ["sat"]).size()
    t = t.unstack(fill_value=0)
    return t["S-NPP"] / t[otro]


def resumen(r: pd.Series, nombre: str) -> None:
    otros = r.drop(2022)
    print(f"{nombre}: otros años {otros.min():.2f} a {otros.max():.2f} (mediana "
          f"{otros.median():.2f}); 2022: {r[2022]:.2f}, {r[2022] / otros.median() - 1:+.0%} "
          "sobre la mediana")


def main() -> None:
    f = cargar()

    print("1. Focos por día alrededor del apagón (península)")
    alrededor = f[f.dia.between("2022-03-27", "2022-04-21") & f.sat.isin(["Aqua", "S-NPP"])]
    print(alrededor.groupby(["dia", "sat"]).size().unstack(fill_value=0).to_string())
    dias = alrededor[alrededor.dia.between(*APAGON)]
    print(f"Del 31 mar al 16 abr: Aqua {int((dias.sat == 'Aqua').sum())} focos, "
          f"S-NPP {int((dias.sat == 'S-NPP').sum())}\n")

    temporada = sin(f[f.dia.dt.month.isin(TEMPORADA)], APAGON)
    aqua = razones(temporada, ["year"], "Aqua")
    terra = razones(temporada, ["year"], "Terra")
    print("2 y 3. Temporada (mar–may) sin el apagón: focos de S-NPP por cada uno de MODIS")
    print(pd.DataFrame({"por Aqua": aqua, "por Terra (control)": terra}).round(2).to_string())
    resumen(aqua, "Aqua")
    resumen(terra, "Terra")
    snpp = temporada[temporada.sat == "S-NPP"]
    frp = snpp.groupby(snpp.dia.dt.year).frp.median()
    print(f"FRP mediana de S-NPP: 2022 {frp[2022]:.1f} MW; otros años "
          f"{frp.drop(2022).min():.1f} a {frp.drop(2022).max():.1f} MW")
    r = razones(sin(f[f.dia.dt.month.isin(TEMPORADA)], APAGON, RECUPERACION), ["year"], "Aqua")
    print(f"Aqua 2022 quitando también la recuperación (17–21 abr): {r[2022]:.2f}\n")

    mensual = razones(sin(f, APAGON), ["year", "month"], "Aqua").unstack("month")[[1, 2, 3, 4, 5, 6]]
    print("4. Focos de S-NPP por cada uno de Aqua, por mes (sin el apagón)")
    print(pd.DataFrame({"2022": mensual.loc[2022],
                        "mediana otros años": mensual.drop(2022).median()}).round(1).to_string())


if __name__ == "__main__":
    main()
