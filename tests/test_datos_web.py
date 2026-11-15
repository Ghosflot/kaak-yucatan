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


def test_normal_diario_reparte_la_mediana_con_la_forma_promedio():
    por_anio = {}
    for anio, (i, v) in zip(range(2001, 2004), [(0, 1.0), (1, 2.0), (2, 3.0)]):
        a = np.zeros(92)
        a[i] = v
        por_anio[anio] = a
    d = dw.normal_diario(por_anio, range(2001, 2004))
    assert d.shape == (92,)
    # La forma promedio es 1, 2, 3 (de 6) y la mediana de los totales es 2.
    assert np.allclose(d[:3], [1 / 3, 2 / 3, 1.0])
    assert d[3:].sum() == 0.0
    n = dw.normal_acumulado(por_anio, range(2001, 2004))
    assert np.allclose(n, np.cumsum(d))
    assert n[91] == 2.0  # = la mediana de los totales


def test_normal_diario_no_inventa_dias_en_cero_ni_saltos():
    # Restar la mediana del acumulado de un día al siguiente daba ceros y un salto al final.
    rng = np.random.default_rng(1)
    por_anio = {a: rng.poisson(rng.uniform(0.5, 3.0), 92).astype(float) for a in range(2001, 2026)}
    d = dw.normal_diario(por_anio, range(2001, 2026))
    promedio = np.vstack(list(por_anio.values())).mean(axis=0)
    assert (d[promedio > 0] > 0).all()
    assert d[-1] < 3 * d[-8:-1].max()


def test_normal_diario_sin_fuego():
    por_anio = {a: np.zeros(92) for a in range(2001, 2004)}
    assert dw.normal_diario(por_anio, range(2001, 2004)).sum() == 0.0


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


def _cuadritos(satelite, dia, n, municipio="A", zona="Yucatán 1"):
    dia = pd.Timestamp(dia)
    return [{"satelite": satelite, "dia_local": dia, "anio": dia.year, "mes": dia.month,
             "lat_celda": 2000 + i, "lon_celda": -8900, "estado": "Yucatán",
             "municipio": municipio, "zona": zona} for i in range(n)]


def test_la_pagina_usa_el_respaldo_en_dias_sin_datos_como_la_serie():
    """H1: la página y la serie eligen los mismos cuadritos-día (serie.elegir)."""
    cuadritos = pd.DataFrame(_cuadritos("S-NPP", "2024-06-10", 1, "R", "Quintana Roo")
                             + _cuadritos("NOAA-20", "2024-06-02", 60)    # S-NPP en 0: entra
                             + _cuadritos("NOAA-21", "2024-06-03", 60))   # nunca es respaldo
    factores = pd.DataFrame({"satelite": "NOAA-20", "zona": "Península",
                             "epoca": ["temporada", "resto"], "factor": [1.0, 0.5]})
    elegidos = dw.elegidos_con_factor(cuadritos, factores)
    assert set(elegidos["satelite"]) == {"S-NPP", "NOAA-20"}
    assert elegidos.loc[elegidos["satelite"] == "NOAA-20", "eq"].sum() == 30   # 60 × 0.5
    assert elegidos["eq"].sum() == 31


# ---------------------------------------------------------------------------
# Hechos de cada municipio (datos_web.hechos) y sus piezas


def test_rango_p25_p75():
    assert dw.rango(range(1, 101)) == [25.8, 75.2]  # np.percentile, interpolación lineal


def test_dia_del_anio_sin_29_de_febrero():
    """El 1 de marzo es el día 59 en todos los años; el 29 de febrero cae en el 28."""
    d = dw.dia_del_anio(pd.to_datetime(["2023-03-01", "2024-03-01", "2024-02-29", "2024-02-28",
                                        "2024-01-01", "2024-12-31"]))
    assert list(d) == [59, 59, 58, 58, 0, 364]
    assert dw.mes_dia(59) == "03-01" and dw.mes_dia(0) == "01-01" and dw.mes_dia(364) == "12-31"


def test_perfil_anual_suma_los_anios_pedidos():
    dias = pd.Series([1.0, 2.0, 5.0], index=pd.to_datetime(["2001-01-01", "2002-01-01", "2026-01-01"]))
    p = dw.perfil_anual(dias, range(2001, 2026))
    assert p.shape == (365,) and p[0] == 3.0 and p.sum() == 3.0
    assert dw.perfil_anual(pd.Series(dtype=float, index=pd.DatetimeIndex([])), range(2001, 2026)).sum() == 0


def test_dia_con_fraccion():
    p = np.zeros(365)
    p[[10, 20, 30, 40]] = 1.0  # 25 % en cada uno
    assert dw.dia_con_fraccion(p, 0.1) == 10
    assert dw.dia_con_fraccion(p, 0.5) == 20  # el día en que se llega a la mitad, no el siguiente
    assert dw.dia_con_fraccion(np.zeros(365), 0.5) is None


def test_semana_pico_de_7_dias_y_la_52_con_el_dia_que_sobra():
    p = np.zeros(365)
    p[126:133] = 1.0  # del 7 al 13 de mayo (semana 19)
    assert [dw.mes_dia(d) for d in dw.semana_pico(p)] == ["05-07", "05-13"]
    q = np.zeros(365)
    q[364] = 5.0
    assert [dw.mes_dia(d) for d in dw.semana_pico(q)] == ["12-24", "12-31"]


def test_puesto_desde_2012_de_menos_a_mas_y_racha():
    totales = {a: 100.0 for a in range(2001, 2027)}
    totales.update({2001: 1.0, 2024: 80.0, 2025: 50.0, 2026: 60.0})
    # 2001 tiene menos, pero no cuenta: los puestos van desde 2012 (15 temporadas).
    assert dw.puesto(totales, 2026, 2012) == (2, 15)
    assert dw.racha_abajo(totales, 90.0, 2026) == 3
    assert dw.racha_abajo(totales, 70.0, 2026) == 2
    totales[2026] = 50.0  # empate con 2025: se queda con el peor lugar (no es «la de menos»)
    assert dw.puesto(totales, 2026, 2012) == (2, 15)


def _perfil_de(total: float) -> np.ndarray:
    p = np.zeros(365)
    p[59:151] = total / 92  # todo el fuego de marzo a mayo, parejo
    return p


def test_hechos_con_guardas():
    totales = {a: 50.0 for a in range(2001, 2026)} | {2026: 10.0}
    h = dw.hechos(totales, 50.0, _perfil_de(50.0), 2026, 70, (3, 106))
    assert h == {"puesto26": 1, "temporadas": 15, "lugar": 3, "de": 106, "empieza": "03-10",
                 "empiezaZona": "03-12", "semanaPico": ["03-05", "03-11"], "mitad": "04-15"}
    # La racha solo con 3 o más: 2023, 2024 y 2025 también abajo.
    totales.update({2023: 40.0, 2024: 40.0, 2025: 40.0})
    assert dw.hechos(totales, 50.0, _perfil_de(50.0), 2026, None, (3, 106))["racha"] == 4
    # Con lo normal entre 5 y 20, sin fechas.
    h = dw.hechos(totales, 10.0, _perfil_de(10.0), 2026, 70, (50, 106))
    assert set(h) == {"puesto26", "temporadas", "lugar", "de"}
    # Con menos de 5 en un año normal, nada.
    assert dw.hechos(totales, 4.0, _perfil_de(4.0), 2026, 70, (100, 106)) == {}
