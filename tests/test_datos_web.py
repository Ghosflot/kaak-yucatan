"""Pruebas del cálculo de los datos de la página (pipeline/datos_web.py), con datos inventados."""
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import datos_web as dw  # noqa: E402


def test_clase_umbrales():
    assert dw.clase(49, 100) == "muyabajo"
    assert dw.clase(50, 100) == "abajo"
    assert dw.clase(80, 100) == "normal"
    assert dw.clase(125, 100) == "normal"
    assert dw.clase(126, 100) == "arriba"
    assert dw.clase(200, 100) == "arriba"
    assert dw.clase(201, 100) == "muyarriba"
    assert dw.clase(3, 4) == "poco"
    assert dw.clase(0, 0) == "poco"


def test_temporada_92_dias_con_ceros():
    dias = pd.Series([2.0, 5.0, 7.0], index=pd.to_datetime(["2026-03-01", "2026-05-31", "2026-06-01"]))
    t = dw.temporada(dias, 2026)
    assert t.shape == (92,)
    assert t[0] == 2.0 and t[91] == 5.0
    assert t.sum() == 7.0


def test_normal_acumulado_es_mediana_del_acumulado():
    por_anio = {}
    for anio, (i, v) in zip(range(2001, 2004), [(0, 1.0), (1, 2.0), (2, 3.0)]):
        a = np.zeros(92)
        a[i] = v
        por_anio[anio] = a
    n = dw.normal_acumulado(por_anio, range(2001, 2004))
    assert n.shape == (92,)
    assert n[0] == 0.0  # acumulados el día 0: 1, 0, 0
    assert n[2] == 2.0  # acumulados el día 2: 1, 2, 3
    assert n[91] == 2.0  # = la mediana de los totales


def test_unicos_no_cuenta_dos_veces_la_frontera():
    elegidos = pd.DataFrame({
        "satelite": ["S-NPP", "S-NPP", "S-NPP"],
        "dia_local": pd.to_datetime(["2026-03-02"] * 3),
        "lat_celda": [20.00, 20.00, 20.10],
        "lon_celda": [-89.00, -89.00, -89.00],
        "estado": ["Yucatán"] * 3,
        "municipio": ["Tekax", "Tzucacab", "Tekax"],
        "zona": ["Yucatán 3", "Yucatán 4", "Yucatán 3"],
        "eq": [1.0, 1.0, 1.0],
    })
    s = dw.unicos(elegidos, elegidos["estado"] == "Yucatán")
    assert s.loc[pd.Timestamp("2026-03-02")] == 2.0


def test_fraccion_despues():
    assert dw.fraccion_despues(np.array([1.0, 1.0, 2.0]), 0) == 0.75
    assert dw.fraccion_despues(np.zeros(3), 0) is None


def test_ventana_a_indice():
    # 3 de abril = día 33 de la temporada (1 mar = 0); 10 de marzo = 9.
    assert dw.indice_de("04-03") == 33
    assert dw.indice_de("03-10") == 9
    assert dw.indice_de("05-31") == 91


def test_proyeccion_del_lienzo():
    x, y = dw.proyectar(-92.55, 21.75)
    assert (round(x, 6), round(y, 6)) == (0.0, 0.0)
    x, y = dw.proyectar(-89.0, 20.0)
    assert round(y, 1) == 262.5
    assert 0 < x < 825


def test_dia_de_temporada():
    assert dw.dia_de_temporada(date(2026, 3, 1)) == 0
    assert dw.dia_de_temporada(date(2026, 5, 31)) == 91
    assert dw.dia_de_temporada(date(2026, 6, 1)) is None
