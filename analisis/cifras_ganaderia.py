"""Cifras de la sección «Ganadería» de docs/01 (issue #60).

Cruza los focos de Yucatán con el pastizal ganadero y el ganado bovino que prepara
analisis/preparar_ganaderia.py. Usa los mismos focos que analisis/cifras_yucatan.py
(vegetación y confianza nominal o alta) y solo S-NPP de 2013 a 2025, los años completos.

Preguntas:
  1. Antes que nada, reproducir el cálculo previo del issue #60 (los 7 municipios del noreste).
  2. ¿Qué parte de los focos cae sobre pastizal, contra la parte de la superficie que es pastizal?
  3. ¿Qué municipios tienen más focos sobre pastizal y más bovinos por km²?
  4. 2025: ¿qué parte de los focos sobre pastizal cae dentro de la ventana de su zona?
  5. ¿Cuántos incendios de CONAFOR (2015–2024) fueron por «quema para pastoreo»?

Uso:  python analisis/cifras_ganaderia.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
from shapely import contains_xy
from shapely.geometry import shape
from shapely.ops import unary_union

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "analisis"))
from cifras_yucatan import cargar  # noqa: E402

GANADERIA = RAIZ / "datos_peninsula" / "ganaderia_municipios.csv"
PASTIZAL = RAIZ / "datos_peninsula" / "pastizal_yucatan.geojson"
CONAFOR = RAIZ / "datos_peninsula" / "incendios_conafor_2015_2024.csv"
DESDE, HASTA = 2013, 2025
NORESTE = ["Tizimín", "Panabá", "Sucilá", "Buctzotz", "Cenotillo", "Río Lagartos", "San Felipe"]


def sobre_pastizal(f: pd.DataFrame) -> pd.Series:
    capas = json.loads(PASTIZAL.read_text(encoding="utf-8"))["features"]
    pasto = unary_union([shape(c["geometry"]) for c in capas])
    return pd.Series(contains_xy(pasto, f["longitude"].to_numpy(), f["latitude"].to_numpy()), index=f.index)


def focos_snpp() -> pd.DataFrame:
    """Focos S-NPP de Yucatán de DESDE a HASTA, con la columna `pasto` (cae sobre pastizal)."""
    f = cargar()
    s = f[(f["sensor"] == "S-NPP") & f["anio"].between(DESDE, HASTA)].copy()
    s["pasto"] = sobre_pastizal(s)
    return s


def dentro_ventana(f: pd.DataFrame) -> pd.Series:
    md = f["acq_date"].dt.strftime("%m-%d")
    return (md >= f["ventana_inicio"]) & (md <= f["ventana_fin"])


def main() -> None:
    g = pd.read_csv(GANADERIA).set_index("municipio")
    s = focos_snpp()
    km2 = g["km2"].sum()

    print(f"== 1. Cálculo previo: los 7 municipios del noreste (S-NPP {DESDE}–{HASTA}) ==")
    ne = s["municipio"].isin(NORESTE)
    print(f"Focos: {ne.sum():,} de {len(s):,} ({100 * ne.mean():.1f} %); "
          f"superficie: {100 * g.loc[NORESTE, 'km2'].sum() / km2:.1f} %")
    tz = s["municipio"] == "Tizimín"
    print(f"Tizimín: {tz.sum():,} focos ({100 * tz.mean():.1f} %); superficie {100 * g.loc['Tizimín', 'km2'] / km2:.1f} %")
    v25 = s[(s["anio"] == 2025) & s["ventana_inicio"].notna()]
    print(f"2025, dentro de su ventana: noreste {100 * dentro_ventana(v25[v25['municipio'].isin(NORESTE)]).mean():.1f} %; "
          f"todo Yucatán {100 * dentro_ventana(v25).mean():.1f} %")
    print(f"Bovinos: {100 * g.loc[NORESTE, 'bovinos_2022'].sum() / g['bovinos_2022'].sum():.1f} % del estado; "
          f"pastizal: {100 * g.loc[NORESTE, 'km2_pastizal'].sum() / g['km2_pastizal'].sum():.1f} % del estado")

    print("\n== 2. Focos sobre pastizal ==")
    print(f"{s['pasto'].sum():,} de {len(s):,} focos ({100 * s['pasto'].mean():.1f} %) caen sobre pastizal, "
          f"que es el {100 * g['km2_pastizal'].sum() / km2:.1f} % de la superficie")
    por_anio = s.groupby("anio")["pasto"].mean().mul(100).round(1)
    print(f"Por año: de {por_anio.min()} a {por_anio.max()} %")

    print("\n== 3. Municipios ==")
    m = s.groupby("municipio").agg(focos=("pasto", "size"), en_pasto=("pasto", "sum"))
    m = m.join(g[["bovinos_2022", "bovinos_km2", "pct_pastizal"]])
    print("Más focos sobre pastizal:")
    print(m.sort_values("en_pasto", ascending=False).head(10).to_string())
    print("\nMás bovinos por km²:")
    print(g.sort_values("bovinos_km2", ascending=False).head(10)[
        ["bovinos_2022", "km2", "bovinos_km2", "pct_pastizal"]].to_string())
    print(f"\nTizimín: {100 * g.loc['Tizimín', 'bovinos_2022'] / g['bovinos_2022'].sum():.1f} % de los bovinos del estado")
    print(f"Correlación entre bovinos por km² y % de pastizal (106 municipios): "
          f"{g['bovinos_km2'].corr(g['pct_pastizal']):.2f}")

    print("\n== 4. 2025: focos sobre pastizal dentro de la ventana de su zona ==")
    p25 = v25.assign(pasto=s.loc[v25.index, "pasto"])
    for nombre, sub in (("sobre pastizal", p25[p25["pasto"]]), ("fuera de pastizal", p25[~p25["pasto"]])):
        print(f"{nombre}: {100 * dentro_ventana(sub).mean():.1f} % dentro (n={len(sub):,})")

    print("\n== 5. CONAFOR 2015–2024: incendios por «quema para pastoreo» ==")
    c = pd.read_csv(CONAFOR)
    p = c[c["Causa_especifica"].fillna("").str.contains("pastoreo", case=False)]
    print(p.groupby("Estado").agg(incendios=("anio", "size"), hectareas=("Total_hectareas", "sum")).round(1).to_string())
    print(p.loc[p["Estado"] == "Yucatán", ["anio", "Municipio", "Total_hectareas"]].to_string(index=False))


if __name__ == "__main__":
    main()
