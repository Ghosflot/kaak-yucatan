"""Tabla única de municipio → estado y zona de quema (analisis/municipios_zona.csv).

Une los municipios del mapa (datos_peninsula/municipios_peninsula.geojson) con el calendario
de quemas de Yucatán (analisis/zonas_quema_yucatan.csv). Las zonas son:
- «Yucatán 1» a «Yucatán 4»: las cuatro zonas de quema de SEDER.
- «Campeche» y «Quintana Roo»: una zona por estado (no tienen calendario por zona).

Los nombres se comparan sin acentos ni mayúsculas, porque el mapa y la nota del periódico
escriben distinto algunos municipios (Dzán/Dzan, Tixmehuac/Tixméhuac).

Uso:
    python analisis/municipios_zona.py
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent


def clave(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(" ", "")


def main() -> None:
    geo = json.loads((RAIZ / "datos_peninsula/municipios_peninsula.geojson").read_text())
    zonas = pd.read_csv(RAIZ / "analisis/zonas_quema_yucatan.csv")
    zonas["clave"] = zonas.municipio.map(clave)
    por_clave = zonas.set_index("clave")

    filas = []
    for f in geo["features"]:
        mun, est = f["properties"]["municipio"], f["properties"]["estado"]
        fila = {"municipio": mun, "estado": est, "zona": est,
                "ventana_inicio": "", "ventana_fin": ""}
        if est == "Yucatán":
            z = por_clave.loc[clave(mun)]  # falla a propósito si un municipio no tiene zona
            fila.update(zona=f"Yucatán {z.zona}", ventana_inicio=z.inicio_2025[5:], ventana_fin=z.fin_2025[5:])
        filas.append(fila)

    tabla = pd.DataFrame(filas).sort_values(["estado", "municipio"])
    tabla.to_csv(RAIZ / "analisis/municipios_zona.csv", index=False)

    en_mapa = {clave(m) for m in tabla.municipio}
    sin_mapa = sorted(zonas.loc[~zonas.clave.isin(en_mapa), "municipio"])
    print(tabla.groupby("zona").size().to_string())
    print("En el calendario pero sin polígono en el mapa:", sin_mapa)


if __name__ == "__main__":
    main()
