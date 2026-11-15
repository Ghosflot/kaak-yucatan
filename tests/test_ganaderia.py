"""datos_peninsula/ganaderia_municipios.csv y pastizal_yucatan.geojson (analisis/preparar_ganaderia.py, #60)."""
import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
G = pd.read_csv(RAIZ / "datos_peninsula" / "ganaderia_municipios.csv")


def test_estan_los_106_municipios_de_yucatan_con_los_nombres_de_la_zona():
    zona = pd.read_csv(RAIZ / "analisis" / "municipios_zona.csv")
    yucatan = set(zona.loc[zona["estado"] == "Yucatán", "municipio"])
    assert len(G) == 106 and G["municipio"].is_unique
    assert set(G["municipio"]) == yucatan
    assert (G["estado"] == "Yucatán").all()


def test_los_bovinos_cuadran_con_el_censo():
    # INEGI, Censo Agropecuario 2022, comunicado 698/23 (cuadro 4): 388,399 = 381,535 + 6,864 de traspatio.
    assert G["bovinos_2022"].sum() == 388_399
    assert G["bovinos_up_2022"].sum() == 381_535
    assert (G["bovinos_up_2022"] <= G["bovinos_2022"]).all()


def test_las_columnas_derivadas_son_consistentes():
    # Se calculan antes de redondear km2 a un decimal: la tolerancia cubre ese redondeo.
    assert (G["km2_pastizal"] <= G["km2"]).all()
    assert ((G["pct_pastizal"] - 100 * G["km2_pastizal"] / G["km2"]).abs() < 0.2).all()
    assert ((G["bovinos_km2"] - G["bovinos_2022"] / G["km2"]).abs() < 0.05).all()


def test_el_pastizal_es_un_geojson_chico_de_municipios_de_yucatan():
    ruta = RAIZ / "datos_peninsula" / "pastizal_yucatan.geojson"
    assert ruta.stat().st_size < 2_000_000  # docs/02, tarea 15: solo datos chicos en el repo
    capas = json.loads(ruta.read_text(encoding="utf-8"))["features"]
    assert {c["properties"]["municipio"] for c in capas} <= set(G["municipio"])
