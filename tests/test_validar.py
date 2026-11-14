"""Pruebas de la tarea 7: las cuatro pruebas de que la armonización funciona (pipeline/validar.py).

S2 — contratos de entrada. Antes de calcular cualquier prueba, el validador revisa que lo
que recibe es lo que necesita, y se detiene con un mensaje claro si no:
- calendario.parquet: el definitivo de la tarea 5 (desde 2001), no el provisional de la
  tarea 1 (desde 2012); con 2009–2025 completos en toda la península: 2009–2015 para el
  salto de la Prueba 1 y 2013–2025 (solo S-NPP) para su rango natural.
- factores.csv: exactamente los 26 factores (12 Aqua, 12 Terra y 2 NOAA-20), sin repetidos,
  sin vacíos y mayores que 0. La regla es la de la tarea 5 (serie.validar_factores); aquí
  se comprueba que el validador la aplica y que su error es un ValidacionError.
Un hueco nunca se rellena con ceros: un año faltante convertido en «0 fuego» parece un año
tranquilo y la prueba lo leería como dato real.

Todo con datos inventados: estas pruebas no leen salidas/ ni datos_peninsula/.
"""
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
import armonizar  # noqa: E402
import validar  # noqa: E402

# Un municipio por estado: lo mínimo para que sea «toda la península».
MUNICIPIOS = [
    ("Yucatán", "Tekax", "Yucatán 1"),
    ("Campeche", "Calakmul", "Campeche"),
    ("Quintana Roo", "Bacalar", "Quintana Roo"),
]


def calendario(desde=2001, hasta=2025):
    """Calendario sintético con las columnas que usa la tarea 7, 52 semanas por año."""
    filas = [
        {"estado": e, "municipio": m, "zona": z, "anio": a, "semana": s,
         "cuadritos_viirs_eq": 3.0, "cuadritos_modis_crudo": 1.0 if a < 2012 else 0.0,
         "cuadritos_viirs_crudo": 0 if a < 2012 else 3}
        for e, m, z in MUNICIPIOS
        for a in range(desde, hasta + 1)
        for s in range(1, 53)
    ]
    return pd.DataFrame(filas)


def factores():
    """Los 26 factores del contrato, con valores redondos."""
    filas = [
        {"zona": z, "epoca": e, "satelite": s, "factor": 3.0, "factor_min": 2.9,
         "factor_max": 3.1, "cuadritos_dia_usados": 1000, "debil": False}
        for s in armonizar.MODIS for z in armonizar.ZONAS for e in armonizar.EPOCAS
    ] + [
        {"zona": armonizar.ZONA_PENINSULA, "epoca": e, "satelite": "NOAA-20", "factor": 1.0,
         "factor_min": 0.99, "factor_max": 1.01, "cuadritos_dia_usados": 1000, "debil": False}
        for e in armonizar.EPOCAS
    ]
    return pd.DataFrame(filas, columns=armonizar.COLUMNAS)


# ---------------------------------------------------------------------------
# Calendario


def test_acepta_un_calendario_definitivo_completo():
    validar.validar_calendario(calendario())


def test_el_error_es_un_valueerror_propio():
    assert issubclass(validar.ValidacionError, ValueError)


def test_rechaza_el_calendario_provisional():
    """El provisional (solo S-NPP) empieza en 2012: no tiene con qué medir el salto."""
    with pytest.raises(validar.ValidacionError, match="provisional"):
        validar.validar_calendario(calendario(desde=2012, hasta=2026))


def test_rechaza_un_calendario_que_no_empieza_en_2001():
    with pytest.raises(validar.ValidacionError, match="2001"):
        validar.validar_calendario(calendario(desde=2005))


@pytest.mark.parametrize("columna", validar.COLUMNAS_CALENDARIO)
def test_rechaza_un_calendario_sin_una_columna_necesaria(columna):
    with pytest.raises(validar.ValidacionError, match=columna):
        validar.validar_calendario(calendario().drop(columns=columna))


@pytest.mark.parametrize("anio", [2009, 2012, 2015, 2020, 2025])
def test_rechaza_un_anio_faltante_de_la_prueba_1(anio):
    cal = calendario()
    with pytest.raises(validar.ValidacionError, match=str(anio)):
        validar.validar_calendario(cal[cal["anio"] != anio])


def test_rechaza_semanas_faltantes_en_el_salto():
    """Un municipio sin la semana 14 de 2013 haría ver ese año con menos fuego."""
    cal = calendario()
    hueco = (cal["municipio"] == "Calakmul") & (cal["anio"] == 2013) & (cal["semana"] == 14)
    with pytest.raises(validar.ValidacionError, match="2013"):
        validar.validar_calendario(cal[~hueco])


def test_rechaza_semanas_repetidas():
    cal = calendario()
    with pytest.raises(validar.ValidacionError, match="repetid"):
        validar.validar_calendario(pd.concat([cal, cal.iloc[[0]]], ignore_index=True))


def test_rechaza_un_estado_faltante():
    """La Prueba 1 es de toda la península: sin Quintana Roo no se puede."""
    cal = calendario()
    with pytest.raises(validar.ValidacionError, match="Quintana Roo"):
        validar.validar_calendario(cal[cal["estado"] != "Quintana Roo"])


@pytest.mark.parametrize("columna", validar.CONTEOS)
@pytest.mark.parametrize("valor", [np.nan, -1])
def test_rechaza_conteos_vacios_o_negativos_en_el_salto(columna, valor):
    """Un vacío no es «0 fuego»: no se rellena, se detiene."""
    cal = calendario()
    cal[columna] = cal[columna].astype(float)
    cal.loc[(cal["anio"] == 2010) & (cal["semana"] == 10), columna] = valor
    with pytest.raises(validar.ValidacionError, match=columna):
        validar.validar_calendario(cal)


def test_no_modifica_el_calendario_que_recibe():
    cal = calendario()
    copia = cal.copy()
    validar.validar_calendario(cal)
    pd.testing.assert_frame_equal(cal, copia)


# ---------------------------------------------------------------------------
# Factores


def test_acepta_los_26_factores():
    validar.validar_factores(factores())


@pytest.mark.parametrize("cual", [
    ("Campeche", "resto", "Aqua"),
    ("Yucatán 2", "temporada", "Terra"),
    ("Península", "temporada", "NOAA-20"),
])
def test_rechaza_un_factor_faltante(cual):
    f = factores()
    zona, epoca, satelite = cual
    quitar = (f["zona"] == zona) & (f["epoca"] == epoca) & (f["satelite"] == satelite)
    with pytest.raises(validar.ValidacionError, match="faltan las filas"):
        validar.validar_factores(f[~quitar])


def test_rechaza_un_factor_de_mas():
    f = factores()
    extra = f.iloc[[0]].assign(satelite="NOAA-21")
    with pytest.raises(validar.ValidacionError, match="inesperadas"):
        validar.validar_factores(pd.concat([f, extra], ignore_index=True))


def test_rechaza_un_factor_repetido():
    f = factores()
    with pytest.raises(validar.ValidacionError, match="repite"):
        validar.validar_factores(pd.concat([f, f.iloc[[3]]], ignore_index=True))


@pytest.mark.parametrize("valor", [0.0, -2.0, np.nan, np.inf])
def test_rechaza_un_factor_cero_negativo_vacio_o_infinito(valor):
    f = factores()
    f.loc[(f["zona"] == "Yucatán 2") & (f["epoca"] == "temporada") & (f["satelite"] == "Aqua"),
          "factor"] = valor
    with pytest.raises(validar.ValidacionError, match="Yucatán 2"):
        validar.validar_factores(f)


@pytest.mark.parametrize("columna", ["zona", "epoca", "satelite", "factor"])
def test_rechaza_factores_sin_una_columna_necesaria(columna):
    with pytest.raises(validar.ValidacionError, match=columna):
        validar.validar_factores(factores().drop(columns=columna))


# ---------------------------------------------------------------------------
# S3 — Métricas. Los números son los ejemplos que se calculan a mano.


def test_razon_es_el_promedio_de_despues_entre_el_de_antes():
    assert validar.razon(antes=[3000, 4000, 5000], despues=[11000, 12000, 13000]) == pytest.approx(3.0)


@pytest.mark.parametrize("antes, despues", [
    ([0, 0, 0], [1, 2, 3]),          # antes sin fuego: no hay con qué dividir
    ([], [1, 2]),                    # sin años
    ([1, 2], []),
    ([1, np.nan], [1, 2]),           # un año vacío no es 0
    ([1, -2], [1, 2]),               # un conteo no puede ser negativo
    ([1, np.inf], [1, 2]),
])
def test_razon_rechaza_entradas_sin_sentido(antes, despues):
    with pytest.raises(validar.ValidacionError):
        validar.razon(antes=antes, despues=despues)


def test_distancia_log_trata_igual_el_doble_y_la_mitad():
    assert validar.distancia_log(2.0) == pytest.approx(validar.distancia_log(0.5))
    assert validar.distancia_log(1.0) == 0
    assert validar.distancia_log(3.0) == pytest.approx(1.0986, abs=1e-4)


@pytest.mark.parametrize("r", [0, -1, np.nan, np.inf])
def test_distancia_log_rechaza_razones_no_positivas(r):
    with pytest.raises(validar.ValidacionError):
        validar.distancia_log(r)


def test_reduccion_salto_del_ejemplo():
    """Crudo 3.0 → armonizado 1.10: el salto se reduce 91 %."""
    assert validar.reduccion_salto(cruda=3.0, armonizada=1.10) == pytest.approx(0.9132, abs=1e-4)


def test_reduccion_salto_completa_y_negativa():
    assert validar.reduccion_salto(cruda=3.0, armonizada=1.0) == pytest.approx(1.0)
    # Pasar de la mitad a menos de la mitad (sobrecorregir) también cuenta como salto.
    assert validar.reduccion_salto(cruda=3.0, armonizada=1 / 3) == pytest.approx(0.0)
    # Si armonizar empeora el salto, la reducción es negativa; no se esconde.
    assert validar.reduccion_salto(cruda=2.0, armonizada=4.0) < 0


def test_reduccion_salto_sin_salto_crudo_es_error():
    """Si la serie cruda no tiene salto, no hay nada que reducir: no es «0 %»."""
    with pytest.raises(validar.ValidacionError, match="salto"):
        validar.reduccion_salto(cruda=1.0, armonizada=1.2)


def test_wape_pesa_por_tamano_y_mape_no():
    """1000→900 y 2→6: MAPE daría 105 %; WAPE da 10.4 %."""
    assert validar.wape(observado=[1000, 2], predicho=[900, 6]) == pytest.approx(104 / 1002)


def test_wape_perfecto_y_simetrico_en_signo():
    assert validar.wape(observado=[10, 20], predicho=[10, 20]) == 0
    assert validar.wape(observado=[10, 10], predicho=[12, 8]) == pytest.approx(0.2)


@pytest.mark.parametrize("observado, predicho", [
    ([0, 0], [1, 2]),                # nada observado: no hay con qué dividir
    ([], []),
    ([1, 2], [1]),                   # tamaños distintos: celdas que no se corresponden
    ([1, np.nan], [1, 2]),
    ([1, 2], [1, np.nan]),
    ([1, -2], [1, 2]),
    ([1, 2], [1, -2]),
])
def test_wape_rechaza_entradas_sin_sentido(observado, predicho):
    with pytest.raises(validar.ValidacionError):
        validar.wape(observado=observado, predicho=predicho)


def test_mejora_relativa_no_es_la_resta_de_puntos():
    """De 20 % a 18 % son 2 puntos, pero una mejora relativa del 10 %."""
    assert validar.mejora_relativa(base=0.20, modelo=0.18) == pytest.approx(0.10)
    assert validar.mejora_relativa(base=0.20, modelo=0.191) == pytest.approx(0.045)
    assert validar.mejora_relativa(base=0.20, modelo=0.22) == pytest.approx(-0.10)


@pytest.mark.parametrize("base, modelo", [(0, 0.1), (-0.1, 0.1), (np.nan, 0.1), (0.2, np.nan), (0.2, -0.1)])
def test_mejora_relativa_rechaza_entradas_sin_sentido(base, modelo):
    with pytest.raises(validar.ValidacionError):
        validar.mejora_relativa(base=base, modelo=modelo)


def test_error_relativo_conserva_el_signo():
    assert validar.error_relativo(observado=100, predicho=110) == pytest.approx(0.10)
    assert validar.error_relativo(observado=100, predicho=90) == pytest.approx(-0.10)


@pytest.mark.parametrize("observado, predicho", [(0, 5), (-1, 5), (np.nan, 5), (5, np.nan), (5, -1)])
def test_error_relativo_rechaza_entradas_sin_sentido(observado, predicho):
    with pytest.raises(validar.ValidacionError):
        validar.error_relativo(observado=observado, predicho=predicho)


def test_periodo_comun_es_la_interseccion():
    snpp = (date(2012, 1, 20), date(2026, 11, 2))
    noaa21 = (date(2023, 3, 1), date(2026, 11, 7))
    assert validar.periodo_comun(snpp, noaa21) == (date(2023, 3, 1), date(2026, 11, 2))
    assert validar.periodo_comun(noaa21, snpp) == (date(2023, 3, 1), date(2026, 11, 2))
    # Un solo día en común también es un periodo.
    assert validar.periodo_comun((date(2020, 1, 1), date(2020, 1, 5)),
                                 (date(2020, 1, 5), date(2020, 2, 1))) == (date(2020, 1, 5),) * 2


def test_periodo_comun_sin_traslape_o_al_reves_es_error():
    with pytest.raises(validar.ValidacionError, match="común"):
        validar.periodo_comun((date(2001, 1, 1), date(2002, 7, 3)),
                              (date(2012, 1, 20), date(2026, 11, 2)))
    with pytest.raises(validar.ValidacionError, match="revés"):
        validar.periodo_comun((date(2020, 2, 1), date(2020, 1, 1)),
                              (date(2020, 1, 1), date(2020, 3, 1)))


# ---------------------------------------------------------------------------
# S4 — Prueba 1: el salto de 2012. Los números son los del ejemplo hecho a mano.

# Años solo S-NPP inventados (miles de cuadritos-día): rango natural 0.77–1.13.
NATURAL = {2016: 10_000, 2017: 11_000, 2018: 9_000, 2019: 10_500, 2020: 11_000, 2021: 6_000,
           2022: 6_500, 2023: 11_000, 2024: 12_000, 2025: 8_000}
DESPUES = {2013: 12_500, 2014: 11_500, 2015: 12_000}
CRUDO_ANTES = {2009: 3_800, 2010: 4_200, 2011: 4_000}
ARMONIZADO = {  # razón armonizada de cada caso: promedio después (12,000) / promedio antes
    "A": {2009: 8_500, 2010: 9_500, 2011: 9_000},      # 1.33: pasa
    "B": {2009: 7_000, 2010: 8_000, 2011: 7_500},      # 1.60: reduce 57 %, pero se queda corto
    "C": {2009: 19_000, 2010: 21_000, 2011: 20_000},   # 0.60: reduce 53 %, pero sobrecorrige
}


def calendario_con(anuales):
    """Calendario completo con los totales anuales en la semana 1 de un municipio por estado.

    anuales = {estado: {anio: (modis_crudo, viirs_crudo, viirs_eq)}}; lo demás vale 0.
    """
    cal = calendario()
    for c in validar.CONTEOS:
        cal[c] = 0.0
    for estado, por_anio in anuales.items():
        for anio, (modis, viirs, eq) in por_anio.items():
            fila = (cal["estado"] == estado) & (cal["anio"] == anio) & (cal["semana"] == 1)
            cal.loc[fila, validar.CONTEOS] = [eq, modis, viirs]
    return cal


def anuales(caso, crudo_antes=CRUDO_ANTES):
    """Totales de un estado para un caso: MODIS antes de 2012, S-NPP (factor 1) después."""
    datos = {a: (crudo_antes[a], 0, ARMONIZADO[caso][a]) for a in crudo_antes}
    datos[2012] = (0, 12_000, 12_000)
    datos.update({a: (0, v, v) for a, v in {**DESPUES, **NATURAL}.items()})
    return datos


def test_totales_anuales_suman_la_peninsula_y_el_crudo_es_modis_mas_viirs():
    cal = calendario_con({"Yucatán": {2010: (100, 7, 350)}, "Campeche": {2010: (10, 2, 40)}})
    tot = validar.totales_anuales(cal)
    assert tot.loc[2010, "crudo"] == 119          # 100 + 7 + 10 + 2
    assert tot.loc[2010, "armonizado"] == 390     # 350 + 40
    solo_yuc = validar.totales_anuales(cal, estados=["Yucatán"])
    assert solo_yuc.loc[2010, "crudo"] == 107
    assert solo_yuc.loc[2010, "armonizado"] == 350


def test_rango_natural_del_ejemplo():
    serie = pd.Series({**DESPUES, **NATURAL})
    rango = validar.rango_natural(serie)
    assert rango["min"] == pytest.approx(0.7705, abs=1e-4)   # 2017–19 contra 2021–23
    assert rango["max"] == pytest.approx(1.1273, abs=1e-4)   # 2019–21 contra 2023–25
    # Misma forma que la Prueba 1: 3 años contra 3, con uno de separación, todo en 2013–2025.
    assert [(v["antes"], v["despues"]) for v in rango["ventanas"]] == [
        ((a, a + 2), (a + 4, a + 6)) for a in range(2013, 2020)]


def test_rango_natural_falla_si_falta_un_anio_solo_snpp():
    serie = pd.Series({**DESPUES, **NATURAL}).drop(2021)
    with pytest.raises(validar.ValidacionError, match="2021"):
        validar.rango_natural(serie)


@pytest.mark.parametrize("caso, razon, reduccion, estado, en_rango", [
    ("A", 12_000 / 9_000, 0.7381, "pasa", False),
    ("B", 1.60, 0.5722, "no_pasa", False),
    ("C", 0.60, 0.5350, "no_pasa", False),
])
def test_prueba_salto_casos_del_ejemplo(caso, razon, reduccion, estado, en_rango):
    resultado = validar.prueba_salto(calendario_con({"Yucatán": anuales(caso)}))
    pen = resultado["metricas"]["peninsula"]
    assert resultado["id"] == "salto_2012"
    assert resultado["estado"] == estado
    assert pen["razon_cruda"] == pytest.approx(3.0)
    assert pen["razon_armonizada"] == pytest.approx(razon)
    assert pen["reduccion"] == pytest.approx(reduccion, abs=1e-4)
    assert pen["dentro_rango_natural"] is en_rango


def test_el_rango_natural_no_cambia_el_estado():
    """1.33 queda fuera de 0.77–1.13 y aun así pasa: el rango es contexto, no umbral."""
    resultado = validar.prueba_salto(calendario_con({"Yucatán": anuales("A")}))
    pen = resultado["metricas"]["peninsula"]
    assert resultado["estado"] == "pasa"
    assert pen["dentro_rango_natural"] is False
    assert pen["rango_natural"]["max"] < pen["razon_armonizada"]


def test_prueba_salto_muestra_los_siete_totales_y_marca_2012():
    resultado = validar.prueba_salto(calendario_con({"Yucatán": anuales("A")}))
    totales = resultado["metricas"]["peninsula"]["totales"]
    assert [t["anio"] for t in totales] == list(range(2009, 2016))
    assert totales[0] == {"anio": 2009, "crudo": 3_800, "armonizado": 8_500, "transicion": False}
    assert [t["anio"] for t in totales if t["transicion"]] == [2012]


def test_yucatan_es_desglose_y_no_decide_el_estado():
    """Yucatán solo daría 1.60 (no pasa), pero con Campeche la península da 1.12 y pasa."""
    campeche = {a: (10_000, 0, 30_000) for a in range(2009, 2012)}
    campeche.update({a: (0, 30_000, 30_000) for a in range(2012, 2026)})
    resultado = validar.prueba_salto(calendario_con({"Yucatán": anuales("B"), "Campeche": campeche}))
    assert resultado["estado"] == "pasa"
    assert resultado["metricas"]["peninsula"]["razon_armonizada"] == pytest.approx(42_000 / 37_500)
    yuc = resultado["metricas"]["yucatan"]
    assert yuc["razon_armonizada"] == pytest.approx(1.60)
    assert "estado" not in yuc


def test_prueba_salto_guarda_el_umbral_congelado():
    resultado = validar.prueba_salto(calendario_con({"Yucatán": anuales("A")}))
    assert resultado["umbral"] == {"reduccion_minima": 0.50, "razon_min": 0.67, "razon_max": 1.50}


def test_prueba_salto_revisa_el_contrato_antes_de_calcular():
    with pytest.raises(validar.ValidacionError, match="provisional"):
        validar.prueba_salto(calendario(desde=2012, hasta=2026))


@pytest.mark.parametrize("reduccion, razon, estado", [
    (0.50, 1.00, "pasa"),       # reducción justo en el límite: entra
    (0.4999, 1.00, "no_pasa"),
    (0.90, 0.67, "pasa"),       # razón justo en los límites: entra
    (0.90, 0.6699, "no_pasa"),
    (0.90, 1.50, "pasa"),
    (0.90, 1.5001, "no_pasa"),
    (-0.20, 1.00, "no_pasa"),   # armonizar empeoró el salto
])
def test_decidir_salto_limites_inclusivos(reduccion, razon, estado):
    assert validar.decidir_salto(reduccion=reduccion, razon_armonizada=razon) == estado


def test_el_rango_natural_coincide_con_el_de_la_tarea_5():
    """Dos copias de la misma regla: si alguien cambia una sin la otra, esto falla."""
    import serie
    cal = calendario_con({"Yucatán": anuales("A")})
    nuestro = validar.salto_region(validar.totales_anuales(cal, estados=["Yucatán"]))
    suyo = serie.razones_salto(cal)["2013–15 contra 2009–11"]
    assert nuestro["razon_cruda"] == pytest.approx(suyo["sin_calibrar"])
    assert nuestro["razon_armonizada"] == pytest.approx(suyo["armonizada"])
    assert (nuestro["rango_natural"]["min"], nuestro["rango_natural"]["max"]) == pytest.approx(
        suyo["rango_natural"])


# ---------------------------------------------------------------------------
# S5 — Prueba 2: Aqua en años que no se usaron (2021–2025) y factor único.


ZONA_LON = {z: i * 1000 for i, z in enumerate(armonizar.ZONAS)}  # cuadritos distintos por zona


def cz(satelite, dia, n, zona, desde=0):
    """n cuadritos-día distintos de un satélite en un día y una zona (como rejilla.cuadritos_dia)."""
    return [{"satelite": satelite, "dia_local": pd.Timestamp(dia), "zona": zona,
             "lat_celda": 20 + (desde + i) / 100, "lon_celda": -90 + ZONA_LON[zona] / 100}
            for i in range(n)]


def cuadritos(*grupos):
    """Tabla por zona y su versión península (cada cuadrito una vez)."""
    z = pd.DataFrame([f for g in grupos for f in cz(*g)])
    return z, z.drop_duplicates(["satelite", "dia_local", "lat_celda", "lon_celda"])


def factores_con(**valores):
    """Los 26 factores; valores = {(zona, epoca): factor} para Aqua, el resto 3.0."""
    f = factores()
    for (zona, epoca), v in valores.get("aqua", {}).items():
        f.loc[(f["zona"] == zona) & (f["epoca"] == epoca) & (f["satelite"] == "Aqua"), "factor"] = v
    return f


# El ejemplo hecho a mano: un año, dos zonas, dos épocas.
EJEMPLO_FACTORES = {("Campeche", "temporada"): 3.0, ("Campeche", "resto"): 4.0,
                    ("Quintana Roo", "temporada"): 4.0, ("Quintana Roo", "resto"): 5.0}
EJEMPLO_CELDAS = pd.DataFrame([
    {"anio": 2021, "zona": "Campeche", "epoca": "temporada", "ref": 310, "otro": 100},
    {"anio": 2021, "zona": "Campeche", "epoca": "resto", "ref": 38, "otro": 10},
    {"anio": 2021, "zona": "Quintana Roo", "epoca": "temporada", "ref": 190, "otro": 50},
    {"anio": 2021, "zona": "Quintana Roo", "epoca": "resto", "ref": 42, "otro": 8},
])


def test_evaluar_aqua_ejemplo_hecho_a_mano():
    r = validar.evaluar_aqua(EJEMPLO_CELDAS, factores_con(aqua=EJEMPLO_FACTORES), factor_unico=3.5)
    m = r["metricas"]
    assert m["wape_zona_epoca"] == pytest.approx(24 / 580)
    assert m["wape_unico"] == pytest.approx(72 / 580)
    assert m["mejora"] == pytest.approx(2 / 3)
    assert m["modelo"] == "zona_epoca"
    assert r["estado"] == "pasa"
    assert r["id"] == "aqua_fuera_muestra"
    assert r["umbral"] == {"wape_max": 0.25, "mejora_minima": 0.05}


def test_evaluar_aqua_error_por_anio_con_signo_y_wape_por_epoca():
    r = validar.evaluar_aqua(EJEMPLO_CELDAS, factores_con(aqua=EJEMPLO_FACTORES), factor_unico=3.5)
    anio = r["metricas"]["por_anio"][0]
    assert anio == pytest.approx({"anio": 2021, "observado": 580, "predicho_zona_epoca": 580,
                                  "predicho_unico": 588, "error_zona_epoca": 0.0,
                                  "error_unico": 8 / 580})
    temporada = r["metricas"]["por_epoca"]["temporada"]
    assert temporada["wape_zona_epoca"] == pytest.approx(20 / 500)   # 10 + 10 sobre 310 + 190
    assert temporada["wape_unico"] == pytest.approx(55 / 500)        # 40 + 15


def test_ningun_anio_se_quita_por_tener_error_alto():
    """Un año con Aqua casi ciego (como la deriva de órbita) sigue en las cuentas."""
    malo = pd.DataFrame([{"anio": 2024, "zona": "Campeche", "epoca": "temporada",
                          "ref": 1000, "otro": 1}])
    celdas = pd.concat([EJEMPLO_CELDAS, malo], ignore_index=True)
    r = validar.evaluar_aqua(celdas, factores_con(aqua=EJEMPLO_FACTORES), factor_unico=3.5)
    assert [a["anio"] for a in r["metricas"]["por_anio"]] == [2021, 2024]
    assert r["metricas"]["wape_zona_epoca"] > 0.6
    assert r["estado"] == "no_pasa"


@pytest.mark.parametrize("zona, unico, modelo, estado", [
    (0.12, 0.20, "zona_epoca", "pasa"),    # los dos cumplen, zona mejora 40 %
    (0.19, 0.195, "unico", "pasa"),        # los dos cumplen, mejora 2.6 %: empate → único
    (0.22, 0.18, "unico", "pasa"),         # el único es mejor
    (0.28, 0.20, "unico", "pasa"),         # solo el único cumple
    (0.245, 0.255, "zona_epoca", "pasa"),  # hueco A de la regla vieja: solo la zona cumple
    (0.30, 0.33, "zona_epoca", "no_pasa"), # hueco B: ninguno cumple, zona mejora 9 %
    (0.31, 0.32, "unico", "no_pasa"),      # ninguno cumple, mejora 3 %
])
def test_decidir_modelo_tabla_de_la_regla_completa(zona, unico, modelo, estado):
    d = validar.decidir_modelo(wape_zona=zona, wape_unico=unico)
    assert (d["modelo"], d["estado"]) == (modelo, estado)


@pytest.mark.parametrize("zona, unico, modelo, estado", [
    (0.25, 0.30, "zona_epoca", "pasa"),    # 25 % justo cumple
    (0.19, 0.20, "zona_epoca", "pasa"),    # mejora de 5 % justo: gana la zona
    (0.25, 0.25, "unico", "pasa"),         # empate exacto en el límite
    (0.0, 0.0, "unico", "pasa"),           # los dos perfectos: el más simple
    (0.10, 0.0, "unico", "pasa"),          # único perfecto
])
def test_decidir_modelo_limites(zona, unico, modelo, estado):
    d = validar.decidir_modelo(wape_zona=zona, wape_unico=unico)
    assert (d["modelo"], d["estado"]) == (modelo, estado)


def test_factor_unico_solo_usa_2013_2020():
    """Lo que pase en 2021–2025 no puede mover el factor único: eso sería ver el examen."""
    base = [("S-NPP", "2015-04-10", 40, "Campeche"), ("Aqua", "2015-04-10", 10, "Campeche"),
            ("S-NPP", "2016-08-10", 20, "Yucatán 1"), ("Aqua", "2016-08-10", 10, "Yucatán 1")]
    z, pen = cuadritos(*base)
    assert validar.factor_unico(z, pen) == pytest.approx(60 / 20)
    z2, pen2 = cuadritos(*base, ("S-NPP", "2022-04-10", 900, "Campeche"),
                         ("Aqua", "2022-04-10", 1, "Campeche"),
                         ("S-NPP", "2012-12-31", 900, "Campeche"))
    assert validar.factor_unico(z2, pen2) == pytest.approx(60 / 20)


def test_factor_unico_quita_los_dias_hueco_de_la_calibracion():
    base = [("S-NPP", "2015-04-10", 40, "Campeche"), ("Aqua", "2015-04-10", 10, "Campeche")]
    z, pen = cuadritos(*base, ("S-NPP", "2015-04-11", 60, "Campeche"))  # Aqua 0, S-NPP ≥50
    assert validar.factor_unico(z, pen) == pytest.approx(4.0)


def anios_completos(sin=()):
    """Un día de temporada y uno de resto por año 2021–2025, en Campeche."""
    grupos = []
    for anio in range(2021, 2026):
        for dia, ref, otro in ((f"{anio}-04-10", 30, 10), (f"{anio}-09-10", 8, 2)):
            if anio not in sin:
                grupos += [("S-NPP", dia, ref, "Campeche"), ("Aqua", dia, otro, "Campeche")]
    return grupos


def test_celdas_aqua_cuenta_ano_zona_epoca_con_los_huecos_del_mismo_periodo():
    z, pen = cuadritos(*anios_completos(),
                       ("S-NPP", "2022-04-12", 60, "Campeche"),     # Aqua sin datos: hueco
                       ("S-NPP", "2019-04-10", 99, "Campeche"),     # fuera del periodo
                       ("Aqua", "2019-04-10", 99, "Campeche"))
    celdas, huecos = validar.celdas_aqua(z, pen, validar.PERIODO_AQUA)
    assert list(huecos) == [pd.Timestamp("2022-04-12")]
    assert len(celdas) == 5 * len(armonizar.ZONAS) * len(armonizar.EPOCAS)   # 60, con ceros
    c22 = celdas.set_index(["anio", "zona", "epoca"]).loc[(2022, "Campeche", "temporada")]
    assert (c22["ref"], c22["otro"]) == (30, 10)    # el hueco no entra
    assert celdas["anio"].between(2021, 2025).all()
    sin_fuego = celdas.set_index(["anio", "zona", "epoca"]).loc[(2023, "Yucatán 3", "resto")]
    assert (sin_fuego["ref"], sin_fuego["otro"]) == (0, 0)


def test_prueba_aqua_completa_con_cuadritos():
    calib = [("S-NPP", "2015-04-10", 40, "Campeche"), ("Aqua", "2015-04-10", 10, "Campeche")]
    z, pen = cuadritos(*calib, *anios_completos(), ("S-NPP", "2022-04-12", 60, "Campeche"))
    r = validar.prueba_aqua(z, pen, factores_con(aqua={("Campeche", "temporada"): 3.0,
                                                        ("Campeche", "resto"): 4.0}))
    m = r["metricas"]
    assert m["factor_unico"] == pytest.approx(4.0)
    assert m["wape_zona_epoca"] == pytest.approx(0.0)       # 30 = 10 × 3 y 8 = 2 × 4
    assert m["modelo"] == "zona_epoca" and r["estado"] == "pasa"
    assert [a["anio"] for a in m["por_anio"]] == list(range(2021, 2026))
    assert m["huecos"] == ["2022-04-12"]
    assert m["periodo"] == ["2021-01-01", "2025-12-31"]


def test_prueba_aqua_reporta_dias_con_snpp_en_cero_que_la_regla_no_marca():
    """Como el 3 jun 2024: S-NPP sin datos pero Aqua vio menos de 50, así que no es hueco."""
    z, pen = cuadritos(("S-NPP", "2015-04-10", 40, "Campeche"), ("Aqua", "2015-04-10", 10, "Campeche"),
                       *anios_completos(), ("Aqua", "2024-06-03", 32, "Campeche"))
    r = validar.prueba_aqua(z, pen, factores())
    assert r["metricas"]["dias_snpp_cero_no_marcados"] == ["2024-06-03"]
    assert r["metricas"]["huecos"] == []


@pytest.mark.parametrize("satelite", ["Aqua", "S-NPP"])
def test_prueba_aqua_falla_si_un_satelite_no_tiene_datos_en_un_anio(satelite):
    grupos = [g for g in anios_completos() if not (g[0] == satelite and g[1].startswith("2025"))]
    z, pen = cuadritos(("S-NPP", "2015-04-10", 40, "Campeche"),
                       ("Aqua", "2015-04-10", 10, "Campeche"), *grupos)
    with pytest.raises(validar.ValidacionError, match="2025"):
        validar.prueba_aqua(z, pen, factores())


def test_prueba_aqua_revisa_los_factores():
    z, pen = cuadritos(("S-NPP", "2015-04-10", 40, "Campeche"),
                       ("Aqua", "2015-04-10", 10, "Campeche"), *anios_completos())
    with pytest.raises(validar.ValidacionError):
        validar.prueba_aqua(z, pen, factores().iloc[1:])


# ---------------------------------------------------------------------------
# S6 — Prueba 3: CONAFOR, evidencia externa de detección (siempre «informativa»).

KM_LAT = 1 / 110.57   # grados de latitud por km, la misma conversión de cruce_conafor.py


def incendio(ini, fin, lat=20.0, lon=-89.0, tamano="21 a 50 Hectáreas"):
    return {"latitud": lat, "longitud": lon, "ini": pd.Timestamp(ini), "fin": pd.Timestamp(fin),
            "Tamano": tamano}


def focos_en(*puntos):
    """Focos: (fecha, lat, lon); lat/lon por defecto en el punto del incendio."""
    filas = []
    for p in puntos:
        fecha, lat, lon = (p + (20.0, -89.0))[:3] if len(p) == 1 else p
        filas.append({"acq_date": pd.Timestamp(fecha), "latitude": lat, "longitude": lon})
    return pd.DataFrame(filas, columns=["acq_date", "latitude", "longitude"])


def tasas(incendios, focos):
    return validar.tasas_conafor(pd.DataFrame(incendios), focos)


def test_conafor_ejemplo_hecho_a_mano():
    """Incendio del 10 al 12 abr 2023: la ventana va del 9 al 13."""
    inc = [incendio("2023-04-10", "2023-04-12")]
    assert tasas(inc, focos_en(("2023-04-13",)))["real"] == 100       # foco B: dentro
    assert tasas(inc, focos_en(("2023-04-08",)))["real"] == 0         # foco A: fuera
    # Foco C (11 abr 2022): coincide en el control «un año antes», no en el real.
    t = tasas(inc, focos_en(("2022-04-11",)))
    assert t["real"] == 0
    assert t["control_anio"] == pytest.approx(50)    # promedio de un año antes (100) y después (0)


def test_conafor_radio_de_2_km():
    inc = [incendio("2023-04-10", "2023-04-12")]
    assert tasas(inc, focos_en(("2023-04-11", 20.0 + 1.8 * KM_LAT, -89.0)))["real"] == 100
    assert tasas(inc, focos_en(("2023-04-11", 20.0 + 2.5 * KM_LAT, -89.0)))["real"] == 0


def test_conafor_control_lugar_mueve_el_punto_20_km():
    inc = [incendio("2023-04-10", "2023-04-12")]
    t = tasas(inc, focos_en(("2023-04-11", 20.0 + 20 * KM_LAT, -89.0)))   # 20 km al norte
    assert t["real"] == 0
    assert t["control_lugar"] == pytest.approx(25)   # coincide en 1 de las 4 direcciones


@pytest.mark.parametrize("real, anio, lugar, grandes, ok", [
    (53, 8.6, 9.4, 84, True),     # controles parecidos: pasa
    (53, 8, 20, 84, False),       # el control mayor (20) manda: 53 < 60
    (53, 9, 9, 74.9, False),      # los grandes no llegan a 75 %
    (30, 10, 10, 75, True),       # límites justos: 3 veces y 75 % entran
    (29.9, 10, 10, 90, False),
])
def test_regresion_conafor_usa_el_control_mayor(real, anio, lugar, grandes, ok):
    assert validar.regresion_conafor(real=real, control_anio=anio, control_lugar=lugar,
                                     grandes=grandes) is ok


def metricas_publicadas(**cambios):
    """Métricas que reproducen docs/01: 1,222 incendios, S-NPP 53 % (9 %), MODIS 36 % (4–5 %),
    84 % en los de más de 100 ha."""
    m = {"incendios": 1222, "grandes_snpp": 84.2,
         "por_satelite": {"S-NPP": {"real": 52.8, "control_anio": 8.7, "control_lugar": 9.3},
                          "MODIS": {"real": 36.1, "control_anio": 4.4, "control_lugar": 5.2}}}
    for ruta, valor in cambios.items():
        *padres, hoja = ruta.split("__")
        d = m
        for p in padres:
            d = d[p]
        d[hoja] = valor
    return m


def test_reproduce_docs01_con_la_precision_publicada():
    r = validar.reproducir_docs01(metricas_publicadas())
    assert r["control_publicado"] == {"S-NPP": ["anio", "lugar"], "MODIS": ["anio", "lugar"]}


def test_reproduce_docs01_dice_cual_control_es_el_publicado():
    m = metricas_publicadas()
    m["por_satelite"]["S-NPP"]["control_anio"] = 7.2      # solo el de lugar redondea a 9
    r = validar.reproducir_docs01(m)
    assert r["control_publicado"]["S-NPP"] == ["lugar"]


@pytest.mark.parametrize("ruta, valor, texto", [
    ("incendios", 1221, "1,222|1222"),
    ("grandes_snpp", 83.4, "84"),
])
def test_reproduce_docs01_se_detiene_si_no_coincide(ruta, valor, texto):
    with pytest.raises(validar.ValidacionError, match=texto):
        validar.reproducir_docs01(metricas_publicadas(**{ruta: valor}))


@pytest.mark.parametrize("satelite, campo, valor", [
    ("S-NPP", "real", 52.4),            # redondea a 52, no a 53
    ("S-NPP", "control_anio", 12.0),    # ningún control redondea a 9...
    ("MODIS", "real", 34.0),
])
def test_reproduce_docs01_se_detiene_por_satelite(satelite, campo, valor):
    m = metricas_publicadas()
    m["por_satelite"][satelite][campo] = valor
    if campo == "control_anio":
        m["por_satelite"][satelite]["control_lugar"] = 11.0   # ...ni el otro
    with pytest.raises(validar.ValidacionError, match=satelite):
        validar.reproducir_docs01(m)


def test_evaluar_conafor_siempre_informativa_y_por_tamano():
    inc = pd.DataFrame([
        incendio("2023-04-10", "2023-04-12", tamano="Mayor a 100 Hectáreas"),
        incendio("2023-05-01", "2023-05-02", lat=20.5, tamano="0 a 5 Hectáreas"),
    ])
    snpp = focos_en(("2023-04-11",))          # solo ve el grande
    modis = focos_en(("2019-01-01",))         # no ve nada
    r = validar.evaluar_conafor(inc, {"S-NPP": snpp, "MODIS": modis})
    assert r["id"] == "conafor" and r["estado"] == "informativa"
    m = r["metricas"]
    assert m["incendios"] == 2
    assert m["por_satelite"]["S-NPP"]["real"] == 50
    assert m["grandes_snpp"] == 100
    assert m["por_tamano"]["Mayor a 100 Hectáreas"] == {"incendios": 1, "snpp": 100}
    assert m["por_tamano"]["0 a 5 Hectáreas"] == {"incendios": 1, "snpp": 0}
    assert r["umbral"] == {"veces_azar_min": 3.0, "grandes_min": 75.0}


def test_evaluar_conafor_informativa_aunque_falle_la_regresion():
    inc = pd.DataFrame([incendio("2023-04-10", "2023-04-12", tamano="Mayor a 100 Hectáreas")])
    vacio = focos_en()
    r = validar.evaluar_conafor(inc, {"S-NPP": vacio, "MODIS": vacio})
    assert r["metricas"]["regresion_ok"] is False
    assert r["estado"] == "informativa"


def test_conafor_reutiliza_las_reglas_del_analisis_sin_copiarlas():
    cc = validar.cruce_conafor()
    assert cc.RADIO_KM == 2.0 and cc.MARGEN == pd.Timedelta(days=1)
    assert Path(cc.__file__).resolve() == RAIZ / "analisis" / "cruce_conafor.py"


# ---------------------------------------------------------------------------
# S7 — Prueba 4: S-NPP contra NOAA-20 (decide) y NOAA-21 (informativa).


def pv(satelite, dia, n):
    """n cuadritos-día de un satélite en un día, en toda la península."""
    return [{"satelite": satelite, "dia_local": pd.Timestamp(dia),
             "lat_celda": 18 + i / 100, "lon_celda": -89.0} for i in range(n)]


def peninsula(*grupos):
    return pd.DataFrame([f for g in grupos for f in pv(*g)])


def factores_noaa20(temporada=1.0, resto=1.0):
    f = factores()
    for epoca, v in (("temporada", temporada), ("resto", resto)):
        f.loc[(f["satelite"] == "NOAA-20") & (f["epoca"] == epoca), "factor"] = v
    return f


def dias(*filas):
    """Tabla diaria como dias_viirs: (dia, ref, otro)."""
    d = pd.DataFrame(filas, columns=["dia_local", "ref", "otro"])
    d["dia_local"] = pd.to_datetime(d["dia_local"])
    d["anio"] = d["dia_local"].dt.year
    d["epoca"] = armonizar.epoca_de(d["dia_local"].dt.month).to_numpy()
    return d[["dia_local", "anio", "epoca", "ref", "otro"]]


SIN_FACTOR = None
PERIODO_2019_2020 = (date(2018, 4, 1), date(2021, 6, 30))   # enteros: 2019 y 2020


def anio_viirs(anio, ref, otro):
    """Un día de temporada y uno de resto con los mismos conteos."""
    return [(f"{anio}-04-10", ref, otro), (f"{anio}-09-10", ref, otro)]


def test_ejercicio_hecho_a_mano():
    """Día 3: S-NPP 0 y NOAA-20 400 (hueco). Día 6: S-NPP ya apagado (fuera del periodo)."""
    pen = peninsula(("S-NPP", "2025-04-01", 100), ("NOAA-20", "2025-04-01", 95),
                    ("S-NPP", "2025-04-02", 120), ("NOAA-20", "2025-04-02", 118),
                    ("NOAA-20", "2025-04-03", 400),
                    ("S-NPP", "2025-04-04", 90), ("NOAA-20", "2025-04-04", 92),
                    ("S-NPP", "2025-04-05", 110), ("NOAA-20", "2025-04-05", 105),
                    ("NOAA-20", "2025-04-06", 130))
    d, huecos = validar.dias_viirs(pen, "NOAA-20", (date(2025, 4, 1), date(2025, 4, 5)))
    assert list(huecos) == [pd.Timestamp("2025-04-03")]
    assert list(d["dia_local"].dt.day) == [1, 2, 4, 5]
    assert (d["ref"].sum(), d["otro"].sum()) == (420, 410)
    assert d["otro"].sum() / d["ref"].sum() == pytest.approx(0.976, abs=5e-4)


def test_dias_viirs_nunca_suma_satelites():
    pen = peninsula(("S-NPP", "2025-04-01", 10), ("NOAA-20", "2025-04-01", 12),
                    ("NOAA-21", "2025-04-01", 30), ("Aqua", "2025-04-01", 5))
    d, _ = validar.dias_viirs(pen, "NOAA-20", (date(2025, 4, 1), date(2025, 4, 1)))
    assert (d["ref"].sum(), d["otro"].sum()) == (10, 12)


def test_periodos_de_cobertura_comun():
    assert validar.PERIODOS_VIIRS["NOAA-20"] == armonizar.PERIODO_NOAA20
    assert validar.PERIODOS_VIIRS["NOAA-21"] == (date(2023, 3, 1), armonizar.PERIODO_NOAA20[1])
    assert validar.anios_enteros(validar.PERIODOS_VIIRS["NOAA-20"]) == list(range(2019, 2026))
    assert validar.anios_enteros(validar.PERIODOS_VIIRS["NOAA-21"]) == [2024, 2025]


def test_un_anio_parcial_se_reporta_pero_no_decide():
    d = dias(("2018-09-10", 100, 50),                       # 2018 parcial: razón 0.5
             *anio_viirs(2019, 100, 100), *anio_viirs(2020, 100, 100))
    r = validar.evaluar_viirs(d, PERIODO_2019_2020, SIN_FACTOR)
    por_anio = {a["anio"]: a for a in r["por_anio"]}
    assert por_anio[2018]["completo"] is False and por_anio[2018]["razon"] == pytest.approx(0.5)
    assert por_anio[2019]["completo"] is True
    assert r["anios_enteros"] == [2019, 2020]
    assert r["cumple_umbral"] is True and r["fallas"] == []
    assert r["razon_agregada"] == pytest.approx(1.0)        # la agregada es de años enteros


@pytest.mark.parametrize("r19, r20, cumple", [
    (90, 110, True),      # límites exactos: entran
    (89, 111, False),
    (100, 111, False),
])
def test_limites_anuales_inclusivos(r19, r20, cumple):
    d = dias(*anio_viirs(2019, 100, r19), *anio_viirs(2020, 100, r20))
    assert validar.evaluar_viirs(d, PERIODO_2019_2020, SIN_FACTOR)["cumple_umbral"] is cumple


@pytest.mark.parametrize("otro, cumple", [(105, True), (95, True), (106, False), (94, False)])
def test_diferencia_agregada_de_5_por_ciento_entra(otro, cumple):
    d = dias(*anio_viirs(2019, 100, otro), *anio_viirs(2020, 100, otro))
    r = validar.evaluar_viirs(d, PERIODO_2019_2020, SIN_FACTOR)
    assert r["diferencia_agregada"] == pytest.approx(abs(otro / 100 - 1))
    assert r["cumple_umbral"] is cumple
    if not cumple:
        assert r["fallas"] == [{"que": "agregada", "diferencia": pytest.approx(abs(otro / 100 - 1))}]


def test_la_falla_dice_que_anio_y_razon_por_epoca():
    d = dias(("2019-04-10", 100, 70), ("2019-09-10", 100, 100), *anio_viirs(2020, 100, 115))
    r = validar.evaluar_viirs(d, PERIODO_2019_2020, SIN_FACTOR)
    anuales = [f for f in r["fallas"] if f["que"] == "anio"]
    assert anuales == [
        {"que": "anio", "anio": 2019, "razon": pytest.approx(0.85),
         "por_epoca": {"temporada": pytest.approx(0.70), "resto": pytest.approx(1.0)}},
        {"que": "anio", "anio": 2020, "razon": pytest.approx(1.15),
         "por_epoca": {"temporada": pytest.approx(1.15), "resto": pytest.approx(1.15)}},
    ]


def test_aplica_el_factor_de_cada_epoca():
    """Factor = S-NPP / NOAA-20: NOAA-20 × factor se compara contra S-NPP."""
    d = dias(("2019-04-10", 100, 50), ("2019-09-10", 100, 200),
             ("2020-04-10", 100, 50), ("2020-09-10", 100, 200))
    r = validar.evaluar_viirs(d, PERIODO_2019_2020, {"temporada": 2.0, "resto": 0.5})
    a19 = next(a for a in r["por_anio"] if a["anio"] == 2019)
    assert a19["razon_cruda"] == pytest.approx(1.25)
    assert a19["razon"] == pytest.approx(1.0)
    assert a19["cuadritos_otro_ajustado"] == pytest.approx(200.0)
    assert a19["por_epoca"] == {"temporada": pytest.approx(1.0), "resto": pytest.approx(1.0)}


def test_sin_anios_enteros_no_hay_decision():
    d = dias(("2025-04-10", 100, 100))
    with pytest.raises(validar.ValidacionError, match="año entero"):
        validar.evaluar_viirs(d, (date(2025, 3, 1), date(2025, 11, 1)), SIN_FACTOR)


def viirs_completo(n20=1.0, n21=1.0):
    """S-NPP 100 por día; NOAA-20 en 2018–2026 y NOAA-21 en 2023–2026 con su razón."""
    grupos = []
    for anio in range(2018, 2027):
        for dia in (f"{anio}-04-10", f"{anio}-09-10"):
            grupos.append(("S-NPP", dia, 100))
            grupos.append(("NOAA-20", dia, round(100 * n20)))
            if anio >= 2023:
                grupos.append(("NOAA-21", dia, round(100 * n21)))
    return grupos


def test_prueba_viirs_decide_solo_noaa20():
    pen = peninsula(*viirs_completo(n20=1.0, n21=1.30))
    r = validar.prueba_viirs(pen, factores_noaa20())
    assert r["id"] == "viirs" and r["estado"] == "pasa"
    assert r["decide"] == "NOAA-20"
    n21 = r["metricas"]["NOAA-21"]
    assert n21["estado"] == "informativa" and n21["cumple_umbral"] is False
    assert n21["factor"] is None
    assert r["umbral"] == {"razon_min": 0.90, "razon_max": 1.10, "diferencia_max": 0.05}


def test_prueba_viirs_no_pasa_si_falla_noaa20_aunque_noaa21_cumpla():
    pen = peninsula(*viirs_completo(n20=1.20, n21=1.0))
    r = validar.prueba_viirs(pen, factores_noaa20())
    assert r["estado"] == "no_pasa"
    assert r["metricas"]["NOAA-20"]["estado"] == "no_pasa"
    assert r["metricas"]["NOAA-21"]["cumple_umbral"] is True


def test_prueba_viirs_quita_huecos_y_reporta_cobertura():
    pen = peninsula(*viirs_completo(), ("NOAA-20", "2024-05-30", 400))   # S-NPP sin datos
    n20 = validar.prueba_viirs(pen, factores_noaa20())["metricas"]["NOAA-20"]
    assert n20["huecos"] == ["2024-05-30"]
    assert n20["periodo"] == ["2018-04-01", "2026-11-01"]
    assert n20["factor"] == {"temporada": 1.0, "resto": 1.0}
    assert n20["misma_muestra_que_el_factor"] is True
    assert n20["cumple_umbral"] is True


def test_prueba_viirs_reporta_dias_con_snpp_en_cero_que_la_regla_no_marca():
    pen = peninsula(*viirs_completo(), ("NOAA-20", "2024-06-03", 30))
    n20 = validar.prueba_viirs(pen, factores_noaa20())["metricas"]["NOAA-20"]
    assert n20["dias_snpp_cero_no_marcados"] == ["2024-06-03"]


@pytest.mark.parametrize("satelite, anio", [("S-NPP", 2021), ("NOAA-20", 2019), ("NOAA-21", 2025)])
def test_prueba_viirs_falla_si_falta_un_anio_entero(satelite, anio):
    grupos = [g for g in viirs_completo() if not (g[0] == satelite and g[1].startswith(str(anio)))]
    with pytest.raises(validar.ValidacionError, match=f"{satelite}.*{anio}"):
        validar.prueba_viirs(peninsula(*grupos), factores_noaa20())


def test_prueba_viirs_revisa_los_factores_antes_de_calcular():
    f = factores_noaa20()
    f = f[~((f["satelite"] == "NOAA-20") & (f["epoca"] == "resto"))]
    with pytest.raises(validar.ValidacionError):
        validar.prueba_viirs(peninsula(*viirs_completo()), f)


# ---------------------------------------------------------------------------
# S8 — De resultados a textos: caso, clave, valores y relleno. Solo el mecanismo: los textos
# los escribe el equipo en web/textos/; aquí solo hay textos de relleno («TEXTO-…»).


def r_salto(estado="pasa", dentro=True):
    region = {"razon_cruda": 3.0612, "razon_armonizada": 0.9249, "reduccion": 0.9302,
              "rango_natural": {"min": 0.55, "max": 1.4}, "dentro_rango_natural": dentro}
    return {"id": "salto_2012", "estado": estado,
            "metricas": {"peninsula": region, "yucatan": {**region, "razon_cruda": 3.1}}}


def r_aqua(estado="pasa", modelo="zona_epoca", mejora=0.123):
    return {"id": "aqua_fuera_muestra", "estado": estado,
            "metricas": {"wape_zona_epoca": 0.1849, "wape_unico": 0.2105, "mejora": mejora,
                         "modelo": modelo, "factor_unico": 3.987,
                         "periodo": ["2021-01-01", "2025-12-31"]}}


def r_conafor(ok=True, grandes=84.2):
    sat = {"S-NPP": {"real": 53.4, "azar_mayor": 9.1}, "MODIS": {"real": 36.0, "azar_mayor": 4.6}}
    return {"id": "conafor", "estado": "informativa",
            "metricas": {"incendios": 1222, "por_satelite": sat, "grandes_snpp": grandes,
                         "regresion_ok": ok}}


def r_viirs(estado="pasa", n21=True):
    def sat(razones, dif, cumple):
        return {"anios_enteros": sorted(razones),
                "por_anio": [{"anio": a, "completo": True, "razon": r} for a, r in razones.items()]
                + [{"anio": 2018, "completo": False, "razon": 0.5}],
                "diferencia_agregada": dif, "cumple_umbral": cumple}
    return {"id": "viirs", "estado": estado, "metricas": {
        "NOAA-20": sat({2019: 0.951, 2020: 1.064, 2021: 1.0}, 0.0042, estado == "pasa"),
        "NOAA-21": sat({2024: 1.003, 2025: 0.958}, 0.02, n21)}}


@pytest.mark.parametrize("resultado, caso", [
    (r_salto("pasa", True), "pasa_dentro"),
    (r_salto("pasa", False), "pasa_fuera"),
    (r_salto("no_pasa", True), "no_pasa_dentro"),
    (r_aqua("no_pasa", "unico"), "no_pasa_unico"),
    (r_aqua("pasa", "zona_epoca"), "pasa_zona_epoca"),
    (r_conafor(True), "cumple"),
    (r_conafor(False), "no_cumple"),
    (r_viirs("pasa", False), "pasa_noaa21_no_cumple"),
    (r_viirs("no_pasa", True), "no_pasa_noaa21_cumple"),
])
def test_el_caso_sale_de_los_hechos(resultado, caso):
    assert validar.caso(resultado) == caso
    assert caso in validar.CASOS[resultado["id"]]


def test_las_claves_siguen_el_formato_de_la_pagina():
    assert validar.clave("salto_2012", "pasa_dentro") == "valSalto2012PasaDentro"
    assert validar.clave("aqua_fuera_muestra", "no_pasa_unico") == "valAquaFueraMuestraNoPasaUnico"
    assert validar.clave("viirs", "nombre") == "valViirsNombre"
    todas = validar.claves_conocidas()
    assert len(todas) == sum(len(c) + 3 for c in validar.CASOS.values())   # + nombre, numero, limitaciones


@pytest.mark.parametrize("resultado", [r_salto(), r_aqua(), r_conafor(), r_viirs()])
def test_valores_tiene_exactamente_los_nombres_declarados(resultado):
    assert set(validar.valores(resultado)) == set(validar.VALORES[resultado["id"]])


def test_valores_redondeados_para_mostrar():
    v = validar.valores(r_salto())
    assert (v["razonCruda"], v["razonArmonizada"], v["reduccionPct"]) == ("3.06", "0.92", 93)
    assert (v["antesDesde"], v["antesHasta"], v["despuesDesde"], v["despuesHasta"]) == (2009, 2011, 2013, 2015)
    a = validar.valores(r_aqua())
    assert (a["wapeZonaEpocaPct"], a["wapeUnicoPct"], a["mejoraPct"], a["factorUnico"]) == (18, 21, 12, "3.99")
    assert (a["desde"], a["hasta"]) == (2021, 2025)
    c = validar.valores(r_conafor())
    assert (c["incendios"], c["realSnpp"], c["azarSnpp"], c["grandesSnpp"]) == ("1,222", 53, 9, 84)
    w = validar.valores(r_viirs())
    assert (w["razonMinNoaa20"], w["razonMaxNoaa20"], w["diferenciaPctNoaa20"]) == ("0.95", "1.06", "0.4")
    assert (w["aniosDesde"], w["aniosHasta"]) == (2019, 2021)     # solo años enteros: no el 0.5 de 2018
    assert validar.valores(r_viirs(n21=True))["razonMaxNoaa21"] == "1.00"   # conserva el cero final


def test_rellenar_como_la_pagina():
    assert validar.rellenar("TEXTO {a} y {b}", {"a": "0.92", "b": 93}) == "TEXTO 0.92 y 93"
    assert validar.rellenar("TEXTO sin números", {"a": 1}) == "TEXTO sin números"


def test_rellenar_un_valor_vacio_deja_la_frase_pendiente():
    assert validar.rellenar("TEXTO {mejoraPct}", {"mejoraPct": None}) is None


def test_rellenar_se_detiene_con_un_numero_que_no_existe():
    with pytest.raises(validar.ValidacionError, match="razonArmonisada"):
        validar.rellenar("TEXTO {razonArmonisada}", {"razonArmonizada": "0.92"})


def textos(**por_clave):
    """{"es": {...}, "en": {...}} con los mismos textos de relleno en los dos idiomas."""
    return {"es": dict(por_clave), "en": dict(por_clave)}


def test_textos_de_usa_solo_el_texto_de_su_caso():
    t = textos(valSalto2012PasaDentro="TEXTO-PASA {razonArmonizada}",
               valSalto2012NoPasaDentro="TEXTO-NO-PASA {razonArmonizada}")
    sale = validar.textos_de(r_salto("no_pasa", True), t)
    assert sale["frase"] == {"es": "TEXTO-NO-PASA 0.92", "en": "TEXTO-NO-PASA 0.92"}
    assert sale["caso"] == "no_pasa_dentro" and sale["clave"] == "valSalto2012NoPasaDentro"


def test_un_fallo_nunca_recibe_el_texto_de_pasa():
    t = textos(valViirsPasaNoaa21Cumple="TEXTO-PASA")       # el de no pasa no está escrito
    sale = validar.textos_de(r_viirs("no_pasa", True), t)
    assert sale["frase"] == {"es": None, "en": None}
    assert "es:valViirsNoPasaNoaa21Cumple" in sale["pendiente"]
    assert "TEXTO-PASA" not in str(sale)


def test_textos_vacios_o_null_quedan_pendientes_por_idioma():
    t = {"es": {"valConaforCumple": "TEXTO-ES", "valConaforNombre": "TEXTO-N"},
         "en": {"valConaforCumple": None, "valConaforNombre": ""}}
    sale = validar.textos_de(r_conafor(True), t)
    assert sale["frase"] == {"es": "TEXTO-ES", "en": None}
    assert sale["nombre"] == {"es": "TEXTO-N", "en": None}
    assert {"en:valConaforCumple", "en:valConaforNombre", "es:valConaforNumero",
            "es:valConaforLimitaciones"} <= set(sale["pendiente"])


def test_limitaciones_es_una_lista_y_tambien_se_rellena():
    t = textos(valAquaFueraMuestraLimitaciones=["TEXTO-L1 {desde}–{hasta}", "TEXTO-L2"])
    sale = validar.textos_de(r_aqua(), t)
    assert sale["limitaciones"]["es"] == ["TEXTO-L1 2021–2025", "TEXTO-L2"]


def test_textos_de_entrega_los_valores_para_la_pagina():
    sale = validar.textos_de(r_salto(), textos())
    assert sale["valores"] == validar.valores(r_salto())


def test_revisar_textos_acepta_textos_sin_ninguna_clave_de_validacion():
    validar.revisar_textos(textos(otraCosa="cualquier cosa, demuestra"))   # no es de la validación


@pytest.mark.parametrize("texto", ["TEXTO que Demuestra algo", "TEXTO: el satélite PREDICE",
                                   "TEXTO ve todo el fuego", "TEXTO quemas ilegales",
                                   "TEXTO quemas ilegáles"])
def test_revisar_textos_rechaza_palabras_prohibidas(texto):
    with pytest.raises(validar.ValidacionError, match="valSalto2012PasaDentro"):
        validar.revisar_textos(textos(valSalto2012PasaDentro=texto))


@pytest.mark.parametrize("texto", ["TEXTO que calibra", "TEXTO del factor", "TEXTO armonizada",
                                   "TEXTO that calibrates", "TEXTO harmonized"])
def test_conafor_no_usa_palabras_de_calibracion(texto):
    with pytest.raises(validar.ValidacionError, match="valConaforCumple"):
        validar.revisar_textos(textos(valConaforCumple=texto))
    validar.revisar_textos(textos(valAquaFueraMuestraPasaUnico=texto))   # en otra prueba sí se puede


def test_revisar_textos_rechaza_palabras_prohibidas_en_ingles():
    with pytest.raises(validar.ValidacionError, match="en"):
        validar.revisar_textos({"es": {}, "en": {"valViirsNombre": "TEXT that demonstrates"}})


def test_revisar_textos_rechaza_claves_de_validacion_desconocidas():
    with pytest.raises(validar.ValidacionError, match="valSalto2012Empate"):
        validar.revisar_textos(textos(valSalto2012Empate="TEXTO"))


def test_revisar_textos_rechaza_numeros_de_otra_prueba():
    with pytest.raises(validar.ValidacionError, match="wapeUnicoPct"):
        validar.revisar_textos(textos(valSalto2012PasaFuera="TEXTO {wapeUnicoPct}"))


def test_revisar_textos_rechaza_tipos_raros():
    with pytest.raises(validar.ValidacionError):
        validar.revisar_textos(textos(valSalto2012PasaFuera=["TEXTO"]))      # frase: texto, no lista
    with pytest.raises(validar.ValidacionError):
        validar.revisar_textos(textos(valSalto2012Limitaciones="TEXTO"))     # limitaciones: lista


def test_los_textos_reales_de_la_pagina_cumplen_las_reglas():
    """Corre en cada PR: si alguien edita web/textos/ con un error, el PR lo marca."""
    t = validar.cargar_textos()
    assert set(t) == {"es", "en"}
    validar.revisar_textos(t)


# ---------------------------------------------------------------------------
# S9 — Gráficas: solo dibujan el resultado (no recalculan), con texto descriptivo, en
# español e inglés.


def g_salto():
    return validar.prueba_salto(calendario_con({"Yucatán": anuales("A")}))


def g_aqua():
    celdas = pd.concat([EJEMPLO_CELDAS, EJEMPLO_CELDAS.assign(anio=2022)], ignore_index=True)
    return validar.evaluar_aqua(celdas, factores_con(aqua=EJEMPLO_FACTORES), factor_unico=3.5)


def g_conafor():
    inc = pd.DataFrame([
        incendio("2023-04-10", "2023-04-12", tamano="Mayor a 100 Hectáreas"),
        incendio("2023-05-01", "2023-05-02", lat=20.5, tamano="0 a 5 Hectáreas"),
    ])
    return validar.evaluar_conafor(inc, {"S-NPP": focos_en(("2023-04-11",)),
                                         "MODIS": focos_en(("2019-01-01",))})


def g_viirs(n20_2020=110, n21_2025=96):
    def sat(d, periodo, factor):
        return validar.evaluar_viirs(d, periodo, factor)
    n20 = sat(dias(("2018-09-10", 100, 95), *anio_viirs(2019, 100, 97), *anio_viirs(2020, 100, n20_2020)),
              PERIODO_2019_2020, {"temporada": 1.0, "resto": 1.0})
    n21 = sat(dias(("2023-04-10", 100, 90), *anio_viirs(2024, 100, 100), *anio_viirs(2025, 100, n21_2025)),
              (date(2023, 3, 1), date(2026, 6, 30)), None)
    return {"id": "viirs", "estado": "pasa" if n20["cumple_umbral"] else "no_pasa",
            "metricas": {"NOAA-20": n20, "NOAA-21": n21}}


TODAS = [g_salto, g_aqua, g_conafor, g_viirs]


def test_tabla_salto_sale_de_las_metricas():
    r = g_salto()
    t = validar.tabla_grafica(r)
    p = r["metricas"]["peninsula"]
    assert [f["anio"] for f in t["anios"]] == list(range(2009, 2016))
    assert t["anios"] == p["totales"]
    assert [f["transicion"] for f in t["anios"]].count(True) == 1
    assert t["promedio_antes"]["armonizado"] == pytest.approx(9_000)
    assert t["promedio_despues"]["crudo"] == pytest.approx(12_000)
    assert (t["razon_cruda"], t["razon_armonizada"]) == (p["razon_cruda"], p["razon_armonizada"])
    assert t["umbral"] == (0.67, 1.50)
    assert t["rango_natural"] == (p["rango_natural"]["min"], p["rango_natural"]["max"])


def test_tabla_aqua_por_anio_y_umbral():
    r = g_aqua()
    t = validar.tabla_grafica(r)
    assert [f["anio"] for f in t["anios"]] == [2021, 2022]
    assert t["anios"][0]["observado"] == 580
    assert t["wape"] == {"zona_epoca": r["metricas"]["wape_zona_epoca"], "unico": r["metricas"]["wape_unico"]}
    assert t["elegido"] == "zona_epoca" and t["umbral"] == 0.25


def test_tabla_conafor_con_los_dos_controles_y_tamanos_en_orden():
    t = validar.tabla_grafica(g_conafor())
    assert set(t["satelites"]["S-NPP"]) == {"real", "control_anio", "control_lugar"}
    assert [f["tamano"] for f in t["tamanos"]] == ["0 a 5 Hectáreas", "Mayor a 100 Hectáreas"]
    assert t["umbral_grandes"] == 75.0 and t["veces_azar"] == 3.0


def test_tabla_viirs_marca_parciales_y_rango_fijo():
    t = validar.tabla_grafica(g_viirs())
    n20 = {f["anio"]: f for f in t["satelites"]["NOAA-20"]}
    assert n20[2018]["completo"] is False and n20[2019]["completo"] is True
    assert n20[2019]["razon"] == pytest.approx(0.97)
    assert t["banda"] == (0.90, 1.10)
    assert t["eje"] == (0.80, 1.20)


def test_el_eje_de_viirs_se_amplia_en_vez_de_esconder_un_punto():
    t = validar.tabla_grafica(g_viirs(n20_2020=135))
    assert t["eje"][1] >= 1.35 and t["eje"][0] == 0.80     # se ve el punto, no se recorta


def test_las_barras_empiezan_en_cero_y_el_salto_comparte_escala():
    fig = validar.figura(g_salto(), "es")
    crudo, armonizado = fig.axes[0], fig.axes[1]
    assert crudo.get_ylim() == armonizado.get_ylim()
    assert crudo.get_ylim()[0] == 0
    fig = validar.figura(g_aqua(), "es")
    assert all(ax.get_ylim()[0] == 0 for ax in fig.axes)


def test_2012_va_rayado_y_aparte():
    fig = validar.figura(g_salto(), "es")
    rayadas = [b for b in fig.axes[0].patches if b.get_hatch()]
    assert len(rayadas) == 1


def test_viirs_dibuja_parciales_huecos_y_la_banda():
    fig = validar.figura(g_viirs(), "es")
    ax = fig.axes[0]
    assert ax.get_ylim() == pytest.approx((0.80, 1.20))
    huecos = [c for c in ax.collections if len(c.get_facecolors()) == 0 or c.get_facecolors()[0][3] == 0]
    assert sum(len(c.get_offsets()) for c in huecos) == 2      # 2018 de NOAA-20 y 2023 de NOAA-21


@pytest.mark.parametrize("hacer", TODAS)
@pytest.mark.parametrize("idioma", ["es", "en"])
def test_las_gráficas_no_tienen_palabras_prohibidas(hacer, idioma):
    r = hacer()
    texto = " ".join(validar.textos_figura(validar.figura(r, idioma)))
    assert texto
    prohibidas = validar.PROHIBIDAS + (validar.PROHIBIDAS_CONAFOR if r["id"] == "conafor" else ())
    assert not [w for w in prohibidas if w in validar._sin_acentos(texto)]


def test_cada_idioma_tiene_sus_etiquetas():
    assert set(validar.ETIQUETAS["es"]) == set(validar.ETIQUETAS["en"])
    es = " ".join(validar.textos_figura(validar.figura(g_salto(), "es")))
    en = " ".join(validar.textos_figura(validar.figura(g_salto(), "en")))
    assert "Focos de calor" in es and "Hot spots" in en and "Focos" not in en


def test_guardar_graficas_escribe_las_dos_versiones_con_ruta_fija(tmp_path):
    rutas = validar.guardar_graficas(g_viirs(), tmp_path)
    assert rutas == {"es": "graficas/validacion-viirs-es.png", "en": "graficas/validacion-viirs-en.png"}
    for ruta in rutas.values():
        assert (tmp_path / Path(ruta).name).read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"


def test_dos_corridas_dan_la_misma_imagen(tmp_path):
    validar.guardar_graficas(g_salto(), tmp_path / "a")
    validar.guardar_graficas(g_salto(), tmp_path / "b")
    for nombre in ("validacion-salto-2012-es.png", "validacion-salto-2012-en.png"):
        assert (tmp_path / "a" / nombre).read_bytes() == (tmp_path / "b" / nombre).read_bytes()


def test_figura_rechaza_una_prueba_o_idioma_desconocidos():
    with pytest.raises(validar.ValidacionError):
        validar.figura({"id": "otra", "estado": "pasa", "metricas": {}}, "es")
    with pytest.raises(validar.ValidacionError):
        validar.figura(g_salto(), "fr")


# ---------------------------------------------------------------------------
# S10 — validacion.json: cuatro pruebas en orden fijo, sin NaN ni rutas absolutas ni fechas,
# con la huella de cada gráfica; se escribe completo o no se escribe.



def resultados_completos():
    aqua = g_aqua()
    aqua["metricas"]["periodo"] = ["2021-01-01", "2025-12-31"]
    viirs = g_viirs()
    viirs.update({"decide": "NOAA-20", "umbral": dict(validar.UMBRAL_VIIRS)})
    return [g_salto(), aqua, g_conafor(), viirs]


SIN_TEXTOS = {"es": {}, "en": {}}


def test_el_json_tiene_las_cuatro_pruebas_en_orden_fijo():
    r = resultados_completos()
    doc = validar.armar_validacion(list(reversed(r)), SIN_TEXTOS, validar.dibujar_todas(r))
    assert doc["schema_version"] == 1
    assert doc["criterios"] == {"congelados": "docs/02, tarea 7", "regla_prueba_2": "docs/02, tarea 7"}
    assert [p["id"] for p in doc["pruebas"]] == ["salto_2012", "aqua_fuera_muestra", "conafor", "viirs"]


def test_cada_prueba_lleva_resumen_y_auditoria():
    r = resultados_completos()
    p = validar.armar_validacion(r, SIN_TEXTOS, validar.dibujar_todas(r))["pruebas"][3]
    for campo in ("id", "estado", "caso", "clave", "nombre", "numero", "frase", "limitaciones",
                  "pendiente", "valores", "grafica", "huella_grafica", "metricas", "umbral"):
        assert campo in p
    assert p["decide"] == "NOAA-20"
    assert p["grafica"] == {"es": "graficas/validacion-viirs-es.png", "en": "graficas/validacion-viirs-en.png"}
    assert p["huella_grafica"]["es"].startswith("sha256:")


def test_sin_textos_todo_queda_pendiente_y_nada_se_inventa():
    r = resultados_completos()
    for p in validar.armar_validacion(r, SIN_TEXTOS, validar.dibujar_todas(r))["pruebas"]:
        assert p["frase"] == {"es": None, "en": None}
        assert p["pendiente"]


@pytest.mark.parametrize("cambio", ["falta", "repetida"])
def test_el_json_exige_exactamente_las_cuatro_pruebas(cambio):
    r = resultados_completos()
    r = r[:3] if cambio == "falta" else r + [r[0]]
    with pytest.raises(validar.ValidacionError, match="cuatro|salto_2012|viirs"):
        validar.armar_validacion(r, SIN_TEXTOS, {})


def test_un_nan_detiene_y_dice_donde():
    r = resultados_completos()
    r[2]["metricas"]["grandes_snpp"] = float("nan")
    with pytest.raises(validar.ValidacionError, match=r"conafor\.metricas\.grandes_snpp"):
        validar.armar_validacion(r, SIN_TEXTOS, validar.dibujar_todas(r))


@pytest.mark.parametrize("valor, texto", [
    ("/home/alguien/kaak/salidas/x.csv", "ruta"),
    ("C:\\datos\\x.csv", "ruta"),
    ("2026-11-13T10:22:31", "fecha"),
])
def test_rutas_absolutas_y_fechas_con_hora_detienen(valor, texto):
    r = resultados_completos()
    r[0]["metricas"]["extra"] = valor
    with pytest.raises(validar.ValidacionError, match=texto):
        validar.armar_validacion(r, SIN_TEXTOS, validar.dibujar_todas(r))


def test_las_fechas_sin_hora_si_se_permiten():
    r = resultados_completos()
    doc = validar.armar_validacion(r, SIN_TEXTOS, validar.dibujar_todas(r))
    assert doc["pruebas"][1]["metricas"]["periodo"] == ["2021-01-01", "2025-12-31"]


def test_el_json_es_json_estricto_con_tipos_simples():
    r = resultados_completos()
    texto = validar.serializar(validar.armar_validacion(r, SIN_TEXTOS, validar.dibujar_todas(r)))
    json.loads(texto, parse_constant=lambda c: pytest.fail(f"constante no estándar: {c}"))
    assert texto.endswith(b"\n")


def test_escribe_json_y_graficas_con_huellas_que_coinciden(tmp_path):
    doc = validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path)
    assert json.loads((tmp_path / "validacion.json").read_text(encoding="utf-8")) == doc
    for p in doc["pruebas"]:
        for idioma in ("es", "en"):
            png = (tmp_path / p["grafica"][idioma]).read_bytes()
            assert p["huella_grafica"][idioma] == "sha256:" + hashlib.sha256(png).hexdigest()
    assert len(list((tmp_path / "graficas").glob("validacion-*.png"))) == 8
    assert not [x for x in tmp_path.iterdir() if x.name.startswith(".validacion-")]


def test_dos_corridas_dan_los_mismos_bytes(tmp_path):
    for carpeta in ("a", "b"):
        validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path / carpeta)
    archivos = sorted(x.relative_to(tmp_path / "a") for x in (tmp_path / "a").rglob("*") if x.is_file())
    assert len(archivos) == 9
    for a in archivos:
        assert (tmp_path / "a" / a).read_bytes() == (tmp_path / "b" / a).read_bytes()


def corrida_anterior(carpeta):
    (carpeta / "graficas").mkdir(parents=True)
    (carpeta / "validacion.json").write_text("ANTERIOR", encoding="utf-8")
    (carpeta / "graficas" / "validacion-viirs-es.png").write_bytes(b"ANTERIOR")


def sigue_igual(carpeta):
    assert (carpeta / "validacion.json").read_text(encoding="utf-8") == "ANTERIOR"
    assert (carpeta / "graficas" / "validacion-viirs-es.png").read_bytes() == b"ANTERIOR"
    assert not [x for x in carpeta.iterdir() if x.name.startswith(".validacion-")]


def test_si_una_grafica_falla_no_se_toca_lo_anterior(tmp_path, monkeypatch):
    corrida_anterior(tmp_path)
    original = validar.figura

    def falla_en_viirs(resultado, idioma):
        if resultado["id"] == "viirs":
            raise RuntimeError("se rompió el dibujo")
        return original(resultado, idioma)
    monkeypatch.setattr(validar, "figura", falla_en_viirs)
    with pytest.raises(RuntimeError):
        validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path)
    sigue_igual(tmp_path)


def test_si_la_verificacion_falla_no_se_toca_lo_anterior(tmp_path, monkeypatch):
    corrida_anterior(tmp_path)

    def falla(*_):
        raise validar.ValidacionError("verificación saboteada")
    monkeypatch.setattr(validar, "verificar_corrida", falla)
    with pytest.raises(validar.ValidacionError):
        validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path)
    sigue_igual(tmp_path)


def test_si_el_json_no_pasa_la_revision_no_se_toca_lo_anterior(tmp_path):
    corrida_anterior(tmp_path)
    r = resultados_completos()
    r[3]["metricas"]["NOAA-20"]["diferencia_agregada"] = float("inf")
    with pytest.raises(validar.ValidacionError):
        validar.escribir_validacion(r, SIN_TEXTOS, tmp_path)
    sigue_igual(tmp_path)


def test_verificar_corrida_detecta_una_grafica_que_no_corresponde(tmp_path):
    validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path)
    doc = json.loads((tmp_path / "validacion.json").read_text(encoding="utf-8"))
    (tmp_path / "graficas" / "validacion-conafor-en.png").write_bytes(b"\x89PNG\r\n\x1a\nOTRA")
    with pytest.raises(validar.ValidacionError, match="validacion-conafor-en.png"):
        validar.verificar_corrida(tmp_path, doc)


def test_borra_graficas_de_validacion_que_ya_no_existen(tmp_path):
    (tmp_path / "graficas").mkdir()
    vieja = tmp_path / "graficas" / "validacion-salto-2012.png"     # nombre de antes, sin idioma
    ajena = tmp_path / "graficas" / "otra-cosa.png"
    vieja.write_bytes(b"x")
    ajena.write_bytes(b"x")
    validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path)
    assert not vieja.exists() and ajena.exists()


def test_el_json_se_mueve_al_final(tmp_path, monkeypatch):
    """Si se cae a mitad de mover las gráficas, el JSON anterior sigue ahí (el sello no cambió)."""
    corrida_anterior(tmp_path)
    original, movidas = validar.os.replace, []

    def se_cae_en_la_tercera(origen, destino):
        movidas.append(Path(destino).name)
        if len(movidas) == 3:
            raise OSError("se cayó")
        return original(origen, destino)
    monkeypatch.setattr(validar.os, "replace", se_cae_en_la_tercera)
    with pytest.raises(OSError):
        validar.escribir_validacion(resultados_completos(), SIN_TEXTOS, tmp_path)
    assert (tmp_path / "validacion.json").read_text(encoding="utf-8") == "ANTERIOR"
    assert "validacion.json" not in movidas[:3]


# ---------------------------------------------------------------------------
# S11 — Preflight: los archivos reales cumplen lo que cada prueba necesita, antes de calcular.


def entradas_sinteticas(sin=()):
    """Entradas mínimas que cumplen todos los contratos. sin = {(satelite, anio)} que se quitan."""
    grupos = []
    for sat, desde, hasta in (("S-NPP", 2013, 2025), ("Aqua", 2013, 2025),
                              ("NOAA-20", 2019, 2025), ("NOAA-21", 2024, 2025)):
        for anio in range(desde, hasta + 1):
            if (sat, anio) not in sin:
                for zona in armonizar.ZONAS:
                    grupos.append((sat, f"{anio}-04-10", 1, zona))
    z, pen = cuadritos(*grupos)
    inc = pd.DataFrame([incendio("2023-04-10", "2023-04-12", tamano="Mayor a 100 Hectáreas"),
                        incendio("2023-05-01", "2023-05-02", lat=20.5, tamano="0 a 5 Hectáreas")])
    focos = pd.concat([focos_en(("2023-04-11",)).assign(sensor=s) for s in ("S-NPP", "MODIS")],
                      ignore_index=True)
    return {"calendario": calendario(), "factores": factores(), "por_zona": z, "peninsula": pen,
            "conafor_incendios": inc, "conafor_focos": focos, "textos": {"es": {}, "en": {}}}


REVISIONES = ["calendario", "factores", "focos_peninsula", "focos_zona", "cobertura_aqua",
              "cobertura_viirs", "conafor", "textos"]


def fallas(reporte):
    return {r["que"]: r["detalle"] for r in reporte["revisiones"] if not r["ok"]}


def test_preflight_pasa_con_entradas_que_cumplen():
    r = validar.preflight(entradas_sinteticas())
    assert [x["que"] for x in r["revisiones"]] == REVISIONES
    assert r["ok"] is True and fallas(r) == {}
    textos = next(x for x in r["revisiones"] if x["que"] == "textos")
    assert textos["detalle"] == "es: 0 de 26 textos escritos; en: 0 de 26 textos escritos"


def sin_tamano_grande(e):
    e["conafor_incendios"] = e["conafor_incendios"].assign(Tamano="0 a 5 Hectáreas")


def zona_desconocida(e):
    e["por_zona"] = e["por_zona"].assign(zona="Yucatán 9")


def falta_una_zona(e):
    e["por_zona"] = e["por_zona"][e["por_zona"]["zona"] != "Yucatán 3"]


def texto_prohibido(e):
    e["textos"]["es"]["valViirsNombre"] = "TEXTO que demuestra"


@pytest.mark.parametrize("cambio, que, texto", [
    (lambda e: e.update(calendario=calendario(desde=2012)), "calendario", ""),
    (lambda e: e.update(factores=factores().iloc[1:]), "factores", ""),
    (lambda e: e.update(peninsula=e["peninsula"].rename(columns={"dia_local": "dia"})),
     "focos_peninsula", "dia_local"),
    (lambda e: e.update(por_zona=e["por_zona"].rename(columns={"lat_celda": "celda_lat"})),
     "focos_zona", "lat_celda"),
    (zona_desconocida, "focos_zona", "Yucatán 9"),
    (falta_una_zona, "focos_zona", "Yucatán 3"),
    (lambda e: e.update(entradas_sinteticas(sin={("Aqua", 2023)})), "cobertura_aqua", "Aqua.*2023"),
    (lambda e: e.update(entradas_sinteticas(sin={("S-NPP", 2016)})), "cobertura_aqua", "S-NPP.*2016"),
    (lambda e: e.update(entradas_sinteticas(sin={("NOAA-21", 2025)})), "cobertura_viirs", "NOAA-21.*2025"),
    (lambda e: e.update(entradas_sinteticas(sin={("NOAA-20", 2019)})), "cobertura_viirs", "NOAA-20.*2019"),
    (sin_tamano_grande, "conafor", "Mayor a 100"),
    (lambda e: e.update(conafor_focos=e["conafor_focos"][e["conafor_focos"]["sensor"] == "S-NPP"]),
     "conafor", "MODIS"),
    (lambda e: e.update(conafor_incendios=e["conafor_incendios"].drop(columns="Tamano")),
     "conafor", "Tamano"),
    (texto_prohibido, "textos", "valViirsNombre"),
])
def test_cada_revision_detecta_su_falla(cambio, que, texto):
    e = entradas_sinteticas()
    cambio(e)
    r = validar.preflight(e)
    assert r["ok"] is False
    assert que in fallas(r)
    assert re.search(texto, fallas(r)[que])


def test_si_fallan_los_focos_la_cobertura_no_se_puede_revisar():
    e = entradas_sinteticas()
    e["peninsula"] = e["peninsula"].rename(columns={"satelite": "sat"})
    f = fallas(validar.preflight(e))
    assert set(f) == {"focos_peninsula", "cobertura_aqua", "cobertura_viirs"}
    assert "focos_peninsula" in f["cobertura_aqua"]


def test_el_reporte_junta_todos_los_fallos():
    e = entradas_sinteticas(sin={("NOAA-21", 2025)})
    e["calendario"] = calendario(desde=2012)
    texto_prohibido(e)
    r = validar.preflight(e)
    assert set(fallas(r)) == {"calendario", "cobertura_viirs", "textos"}
    assert sum(x["ok"] for x in r["revisiones"]) == len(REVISIONES) - 3


def test_preflight_no_modifica_las_entradas():
    e = entradas_sinteticas()
    copia = {k: v.copy() if isinstance(v, pd.DataFrame) else v for k, v in e.items()}
    validar.preflight(e)
    for k, v in copia.items():
        if isinstance(v, pd.DataFrame):
            pd.testing.assert_frame_equal(e[k], v)


def test_cargar_entradas_avisa_si_falta_un_archivo(tmp_path):
    with pytest.raises(validar.ValidacionError, match="calendario.parquet"):
        validar.cargar_entradas(salidas=tmp_path)


def test_preflight_por_linea_de_comandos(monkeypatch, capsys):
    monkeypatch.setattr(validar, "cargar_entradas", lambda: entradas_sinteticas())
    assert validar.main(["--preflight"]) == 0
    salida = capsys.readouterr().out
    assert "calendario" in salida and "textos" in salida

    def con_falla():
        e = entradas_sinteticas(sin={("NOAA-21", 2025)})
        return e
    monkeypatch.setattr(validar, "cargar_entradas", con_falla)
    assert validar.main(["--preflight"]) == 1
    assert "NOAA-21" in capsys.readouterr().out


def test_preflight_no_escribe_nada(monkeypatch, tmp_path):
    monkeypatch.setattr(validar, "cargar_entradas", lambda: entradas_sinteticas())
    monkeypatch.setattr(validar, "SALIDAS", tmp_path)
    validar.main(["--preflight"])
    assert list(tmp_path.iterdir()) == []


def test_preflight_con_los_archivos_reales():
    """Integración (solo lectura): las entregas de las tareas 2 a 5 cumplen lo que piden las pruebas."""
    r = validar.preflight(validar.cargar_entradas())
    assert r["ok"], validar.formatear_preflight(r)
