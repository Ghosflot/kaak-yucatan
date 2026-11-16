"""El campo y el fuego en Yucatán: las cifras de docs/04-countryside-and-fire.md.

Preguntas:
  1. ¿Qué municipios tienen más fuego, y qué parte del fuego y de los incendios concentran?
  2. ¿Cuántos incendios forestales de CONAFOR empezaron por actividades del campo?
  3. Fuego conectado (cuadritos vecinos con fuego en días seguidos): ¿cuántos fuegos de 5 días
     o más hubo cada año, y cuántos coinciden con un incendio de CONAFOR?
  4. Zonas de quema (cuadritos con fuego en 30 % o más de los años anteriores): ¿qué parte del
     fuego del año siguiente reciben, y qué parte de la tierra ocupan?
  5. Calendario por zona: ¿qué parte del fuego del año siguiente cae en las 4 semanas más
     fuertes de la historia de su zona, contra la ventana oficial de SEDER?
  6. Zonas de escape: ¿cuántos fuegos de 5 días o más empiezan cerca de uno de años anteriores?

Solo VIIRS S-NPP (2012–2026), solo Yucatán, igual que la tarea 6 de docs/02. Un cuadrito es una
celda de 0.01° (pipeline/rejilla.py). Las causas de CONAFOR cambian de nombre en 2018
(«agropecuarias» se separa en «agrícolas» y «pecuarias»): se cuentan las tres.

Uso:  .venv/bin/python analisis/campo_y_fuego.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from shapely.geometry import Point, shape
from shapely.prepared import prep

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
from cargar import cargar_focos  # noqa: E402

CAUSAS_CAMPO = ["Actividades agropecuarias", "Actividades agrícolas", "Actividades pecuarias"]
UMBRAL_ZONA = 0.3  # zona de quema: fuego en 30 % o más de los años anteriores
VECINOS = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1)]


def cuadritos_dia() -> pd.DataFrame:
    """Un renglón por día × cuadrito de Yucatán con fuego (S-NPP), con su fuego conectado."""
    f = cargar_focos()
    f = f[(f["satelite"] == "S-NPP") & (f["estado"] == "Yucatán") & f["municipio"].notna()].copy()
    f["cl"] = np.round(f["latitude"] * 100).astype(int)
    f["co"] = np.round(f["longitude"] * 100).astype(int)
    f["d"] = pd.to_datetime(f["dia_local"])
    cd = (f.groupby(["d", "cl", "co"])
          .agg(mun=("municipio", "first"), frp=("frp", "max")).reset_index())
    # Fuego conectado: une cada cuadrito-día con sus vecinos del mismo día y del día anterior.
    idx = {(d, cl, co): i for i, (d, cl, co) in enumerate(zip(cd["d"], cd["cl"], cd["co"]))}
    padre = list(range(len(cd)))

    def raiz(x: int) -> int:
        while padre[x] != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x

    un_dia = pd.Timedelta(days=1)
    for i, (d, cl, co) in enumerate(zip(cd["d"], cd["cl"], cd["co"])):
        for dd in (d, d - un_dia):
            for a, b in VECINOS:
                j = idx.get((dd, cl + a, co + b))
                if j is not None and j != i:
                    ri, rj = raiz(i), raiz(j)
                    if ri != rj:
                        padre[ri] = rj
    cd["ev"] = [raiz(i) for i in range(len(cd))]
    ev = cd.groupby("ev").agg(ini=("d", "min"), fin=("d", "max")).reset_index()
    ev["dur"] = (ev["fin"] - ev["ini"]).dt.days + 1
    cd = cd.merge(ev, on="ev")
    cd["y"] = cd["d"].dt.year
    return cd


def tierra() -> dict[tuple[int, int], str]:
    """Cuadritos cuyo centro cae en un municipio de Yucatán → nombre del municipio."""
    geo = json.loads((RAIZ / "web" / "datos" / "municipios.geojson").read_text())
    out = {}
    for ft in geo["features"]:
        if ft["properties"]["estado"] != "Yucatán":
            continue
        g = shape(ft["geometry"])
        pg = prep(g)
        x0, y0, x1, y1 = g.bounds
        for cl in range(int(np.floor(y0 * 100)), int(np.ceil(y1 * 100)) + 1):
            for co in range(int(np.floor(x0 * 100)), int(np.ceil(x1 * 100)) + 1):
                if pg.contains(Point(co / 100, cl / 100)):
                    out[(cl, co)] = ft["properties"]["nombre"]
    return out


def manchas(celdas) -> list[list]:
    """Agrupa cuadritos vecinos (8 direcciones) en manchas."""
    celdas = set(celdas)
    vistos, out = set(), []
    for c in celdas:
        if c in vistos:
            continue
        pila, grupo = [c], []
        vistos.add(c)
        while pila:
            q = pila.pop()
            grupo.append(q)
            for a, b in VECINOS:
                v = (q[0] + a, q[1] + b)
                if v in celdas and v not in vistos:
                    vistos.add(v)
                    pila.append(v)
        out.append(grupo)
    return out


def franja(celdas, r: int) -> set:
    return {(cl + a, co + b) for cl, co in celdas for a in range(-r, r + 1) for b in range(-r, r + 1)}


def main() -> None:
    cd = cuadritos_dia()
    land = tierra()
    hist = cd[cd["y"].between(2012, 2025)]
    cf = pd.read_csv(RAIZ / "datos_peninsula" / "incendios_conafor_2015_2024.csv",
                     parse_dates=["Fecha_Inicio", "Fecha_Termino"])
    cf = cf[cf["Estado"] == "Yucatán"].copy()
    cf["campo"] = cf["Causa"].isin(CAUSAS_CAMPO)

    print("== 1. Municipios con más fuego (cuadritos-día al año, 2012–2025) ==")
    fuego = hist.groupby("mun").size() / 14
    top10 = fuego.sort_values(ascending=False).head(10)
    print(top10.round(0).astype(int).to_string())
    area = pd.Series(land).value_counts()
    dens = (fuego / area * 100).sort_values(ascending=False)
    print(f"Mérida: lugar {int(fuego.rank(ascending=False)['Mérida'])} en fuego total y "
          f"{int(dens.rank(ascending=False)['Mérida'])} de {len(dens)} por 100 km²")
    t = top10.index
    g = cf[cf["Municipio"].isin(t)]
    print(f"Top 10: {100 * fuego[t].sum() / fuego.sum():.0f} % del fuego satelital; "
          f"{len(g)} de {len(cf)} incendios CONAFOR ({100 * len(g) / len(cf):.0f} %); "
          f"{g['Total_hectareas'].sum():,.0f} de {cf['Total_hectareas'].sum():,.0f} ha; "
          f"del campo: {int(g['campo'].sum())} ({100 * g['campo'].mean():.0f} %)")

    print("\n== 2. Incendios forestales de CONAFOR por actividades del campo (2015–2024) ==")
    print(f"{int(cf['campo'].sum())} de {len(cf)} ({100 * cf['campo'].mean():.0f} %); "
          f"por quema para preparar la siembra: "
          f"{int((cf['Causa_especifica'] == 'Quema para preparación de siembra').sum())}")
    por_mun = cf.groupby("Municipio").agg(incendios=("campo", "size"), campo=("campo", "sum"))
    print(por_mun.reindex(t).fillna(0).astype(int).to_string())

    print("\n== 3. Fuego conectado de 5 días o más ==")
    e5 = cd[cd["dur"] >= 5].drop_duplicates("ev")
    print(e5.groupby(e5["ini"].dt.year).size().to_string())
    largos = cd[(cd["dur"] >= 3) & cd["y"].between(2015, 2024)]
    hits = {3: [0, 0], 5: [0, 0]}
    for _, ev in largos.groupby("ev"):
        ini, fin = ev["ini"].iat[0], ev["fin"].iat[0]
        cand = cf[(cf["Fecha_Inicio"] <= fin + pd.Timedelta(days=2))
                  & (cf["Fecha_Termino"] >= ini - pd.Timedelta(days=2))]
        hit = False
        for la, lo in zip(cand["latitud"], cand["longitud"]):
            dist = np.hypot((ev["cl"] / 100 - la) * 111, (ev["co"] / 100 - lo) * 104)
            if dist.min() <= 3:
                hit = True
                break
        for u in (3, 5):
            if ev["dur"].iat[0] >= u:
                hits[u][0] += hit
                hits[u][1] += 1
    for u, (h, n) in hits.items():
        print(f"{u}+ días (2015–2024) con un incendio CONAFOR a ≤ 3 km: {h} de {n} ({100 * h / n:.0f} %)")

    print("\n== 4 y 5. Zonas de quema y calendario por zona (prueba hacia adelante) ==")
    mz = pd.read_csv(RAIZ / "analisis" / "municipios_zona.csv")
    mz = mz[mz["estado"] == "Yucatán"].set_index("municipio")
    cd["doy"] = cd["d"].dt.day_of_year
    cd["md"] = cd["d"].dt.strftime("%m-%d")
    zona_fuego = zona_tierra = n_fuego = 0
    en28 = oficial = n_cal = 0
    for y in range(2018, 2026):
        prev = cd[cd["y"] < y]
        n = prev.groupby(["cl", "co"])["y"].nunique()
        zq = set(n[n >= np.ceil(UMBRAL_ZONA * (y - 2012))].index)
        cur = cd[(cd["y"] == y) & (cd["dur"] <= 2)].drop_duplicates(["cl", "co"])
        zona_fuego += sum((c in zq) for c in zip(cur["cl"], cur["co"]))
        n_fuego += len(cur)
        zona_tierra += sum((c in zq) for c in land) / len(land)
        if y < 2019:
            continue
        # Cada zona = una mancha de 3 o más cuadritos vecinos de zona de quema, en un municipio.
        pv = prev.set_index(["cl", "co"]).sort_index()
        actual = cd[cd["y"] == y].set_index(["cl", "co"]).sort_index()
        por_mun: dict[str, list] = {}
        for c in zq:
            if c in land:
                por_mun.setdefault(land[c], []).append(c)
        for m, celdas in por_mun.items():
            for mancha in manchas(celdas):
                if len(mancha) < 3:
                    continue
                dias = pv.loc[[c for c in mancha if c in pv.index], "doy"].to_numpy()
                if len(dias) < 15:
                    continue
                ini = max(range(1, 340), key=lambda s: ((dias >= s) & (dias < s + 28)).sum())
                aqui = [c for c in mancha if c in actual.index]
                if not aqui:
                    continue
                a = actual.loc[aqui]
                en28 += int(((a["doy"] >= ini) & (a["doy"] < ini + 28)).sum())
                vi, vf = mz.loc[m, "ventana_inicio"], mz.loc[m, "ventana_fin"]
                oficial += int(((a["md"] >= vi) & (a["md"] <= vf)).sum())
                n_cal += len(a)
    print(f"Quema de 1–2 días en zonas de quema (2018–2025): {100 * zona_fuego / n_fuego:.0f} %; "
          f"tierra en zonas de quema: {100 * zona_tierra / 8:.1f} %")
    print(f"Calendario por zona (2019–2025): 4 semanas fuertes {100 * en28 / n_cal:.0f} %, "
          f"ventana oficial {100 * oficial / n_cal:.0f} %")

    print("\n== 6. Zonas de escape: fuegos de 5+ días que empiezan a ≤ 2 km de uno anterior ==")
    h = n = h_sin24 = n_sin24 = 0
    for y in range(2019, 2026):
        prev = cd[(cd["y"] < y) & (cd["dur"] >= 5)]
        cerca = franja(set(zip(prev["cl"], prev["co"])), 2)
        hoy = cd[(cd["y"] == y) & (cd["dur"] >= 5) & (cd["d"] == cd["ini"])]
        for _, ev in hoy.groupby("ev"):
            hit = any(c in cerca for c in zip(ev["cl"], ev["co"]))
            h += hit
            n += 1
            if y != 2024:
                h_sin24 += hit
                n_sin24 += 1
    print(f"{h} de {n} ({100 * h / n:.0f} %); sin 2024: {h_sin24} de {n_sin24} "
          f"({100 * h_sin24 / n_sin24:.0f} %)")


if __name__ == "__main__":
    main()
