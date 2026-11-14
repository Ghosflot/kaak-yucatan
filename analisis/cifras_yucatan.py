"""Cifras de Yucatán para docs/01, todas desde el paquete datos_peninsula/.

Usa una sola definición: un foco es de Yucatán si su municipio es de Yucatán
(analisis/municipios_zona.csv). Filtro: vegetación (`type` 0 o vacío) y confianza nominal o
alta (VIIRS `n`/`h`, MODIS ≥ 30).

Uso:
    python analisis/cifras_yucatan.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent


def cargar() -> pd.DataFrame:
    f = pd.read_parquet(RAIZ / "datos_peninsula/focos_peninsula.parquet")
    mz = pd.read_csv(RAIZ / "analisis/municipios_zona.csv")
    f = f.merge(mz[["municipio", "zona", "ventana_inicio", "ventana_fin"]], on="municipio", how="left")
    veg = f["type"].fillna(0) == 0
    conf = f.confidence.isin(["n", "h"]) | ((f.sensor == "MODIS") & (pd.to_numeric(f.confidence, errors="coerce") >= 30))
    f = f[veg & conf & (f.estado == "Yucatán")].copy()
    f["anio"] = f.acq_date.dt.year
    f["mes"] = f.acq_date.dt.month
    return f


def main() -> None:
    f = cargar()
    snpp = f[f.sensor == "S-NPP"]

    anual = snpp.groupby("anio").size().loc[2013:2025]
    print("S-NPP por año (Yucatán):", anual.to_dict())
    print(f"Rango 2013–2025: {anual.min():,} a {anual.max():,}")
    s = snpp[snpp.anio.between(2013, 2025)]
    print(f"Marzo a mayo: {s.mes.isin([3, 4, 5]).mean():.1%}; abril, promedio por año: {(s.mes == 4).sum() / 13:,.0f}")
    dias = snpp[snpp.anio == 2024].groupby("acq_date").size().nlargest(6).sort_index()
    print("2024, días con más focos:", {str(k.date()): v for k, v in dias.items()})

    print("\nTemporada (marzo a mayo):")
    for sensor, desde in (("S-NPP", 2013), ("NOAA-20", 2019), ("MODIS", 2013)):
        t = f[(f.sensor == sensor) & f.mes.isin([3, 4, 5])].groupby("anio").size()
        base = t.loc[desde:2025]
        print(f"  {sensor}: mediana {base.median():,.0f}; máximo {base.max():,} ({base.idxmax()}); "
              f"2025 {t.get(2025, 0):,}; 2026 {t.get(2026, 0):,}")

    print("\nVentana oficial de quema, 2025:")
    for sensor in ("S-NPP", "NOAA-20"):
        v = f[(f.sensor == sensor) & (f.anio == 2025) & f.ventana_inicio.notna()].copy()
        md = v.acq_date.dt.strftime("%m-%d")
        dentro = (md >= v.ventana_inicio) & (md <= v.ventana_fin)
        temporada = v.mes.isin([3, 4, 5])
        print(f"  {sensor}: dentro {dentro.mean():.1%}; en temporada pero fuera {(temporada & ~dentro).mean():.1%}; "
              f"fuera de temporada {(~temporada & ~dentro).mean():.1%} (n={len(v):,})")


if __name__ == "__main__":
    main()
