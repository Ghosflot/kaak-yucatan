"""Pruebas de la tarea 5: serie armonizada de 25 años y lo normal (pipeline/serie.py).

Casi todas usan cuadritos-día inventados y factores redondos, para que el resultado se pueda
comprobar a mano:
    Aqua   temporada 3, resto 4 (Yucatán 2: 2 y 2)
    Terra  temporada 5, resto 6
    NOAA-20 (toda la península) temporada 1, resto 0.5
Hay más pruebas de «lo que debe fallar o no dejarse engañar» que de «lo que debe salir
bien», a propósito: buscan los casos que el cálculo podría no tomar en cuenta. Las de «Con
los datos reales» se saltan si no está datos_peninsula/.
"""
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
import armonizar  # noqa: E402
import calendario_provisional as cp  # noqa: E402
import serie  # noqa: E402

CATALOGO = pd.DataFrame({
    "municipio": ["A", "B", "C", "R"],
    "estado": ["Yucatán", "Yucatán", "Campeche", "Quintana Roo"],
    "zona": ["Yucatán 1", "Yucatán 2", "Campeche", "Quintana Roo"],
    "ventana_inicio": ["03-01", "04-20", None, None],
    "ventana_fin": ["04-15", "05-31", None, None],
})
LON = {"A": -89.0, "B": -88.5, "C": -90.5, "R": -88.0}


def cuadritos(satelite, dia, n=1, municipio="A", desde=0, lon=None):
    """n cuadritos-día distintos de un satélite en un día y un municipio (como rejilla)."""
    dia = pd.Timestamp(dia)
    datos = CATALOGO.set_index("municipio").loc[municipio]
    return [
        {"satelite": satelite, "dia_local": dia, "anio": dia.year, "mes": dia.month,
         "semana": min((dia.day_of_year - 1) // 7 + 1, 52),
         "lat_celda": 20 + (desde + i) / 100, "lon_celda": LON[municipio] if lon is None else lon,
         "estado": datos["estado"], "municipio": municipio, "zona": datos["zona"], "n_focos": 1}
        for i in range(n)
    ]


def relleno(sin=()):
    """Un cuadrito-día por año del satélite de su periodo, en R (Quintana Roo), de 2001 a
    2026. Es lo mínimo para que haya datos en cada tramo; R no se usa en las cuentas."""
    grupos = [("Terra", "2001-06-15"), ("Terra", "2002-03-15"), ("Aqua", "2002-08-15")]
    grupos += [("Aqua", f"{a}-06-15") for a in range(2003, 2012)]
    grupos += [("S-NPP", f"{a}-06-15") for a in range(2012, 2027)]
    return [(s, d, 1, "R") for s, d in grupos if d not in sin and d[:4] not in sin]


def tabla(*grupos, sin=(), con_relleno=True):
    todos = list(grupos) + (relleno(sin) if con_relleno else [])
    return pd.DataFrame([f for g in todos for f in cuadritos(*g)])


def factores(cambios=None):
    """Las 26 filas, con números redondos. cambios: {(satelite, zona, epoca): factor}."""
    filas = []
    for s in armonizar.MODIS:
        for z in armonizar.ZONAS:
            for e in armonizar.EPOCAS:
                f = {"Aqua": {"temporada": 3.0, "resto": 4.0},
                     "Terra": {"temporada": 5.0, "resto": 6.0}}[s][e]
                if s == "Aqua" and z == "Yucatán 2":
                    f = 2.0
                filas.append((s, z, e, f))
    filas += [("NOAA-20", "Península", "temporada", 1.0), ("NOAA-20", "Península", "resto", 0.5)]
    df = pd.DataFrame(filas, columns=["satelite", "zona", "epoca", "factor"])
    for (s, z, e), f in (cambios or {}).items():
        df.loc[(df["satelite"] == s) & (df["zona"] == z) & (df["epoca"] == e), "factor"] = f
    return df.assign(factor_min=df["factor"], factor_max=df["factor"],
                     cuadritos_dia_usados=1000, debil=False)[armonizar.COLUMNAS]


def armar(*grupos, fac=None, cat=None, sin=(), con_relleno=True):
    resumen = {}
    cal, men = serie.armar_serie(tabla(*grupos, sin=sin, con_relleno=con_relleno),
                                 CATALOGO if cat is None else cat,
                                 factores() if fac is None else fac, resumen)
    return cal, men, resumen


def fila(cal, municipio, anio, semana):
    f = cal[(cal["municipio"] == municipio) & (cal["anio"] == anio) & (cal["semana"] == semana)]
    assert len(f) == 1
    return f.iloc[0]


def crudos(cal, municipio):
    m = cal[cal["municipio"] == municipio]
    return int(m["cuadritos_modis_crudo"].sum() + m["cuadritos_viirs_crudo"].sum())


# ---------------------------------------------------------------------------
# Debe detenerse con un error claro: factores


def test_falla_si_no_existe_factores(tmp_path):
    with pytest.raises(serie.SerieError, match="No existe"):
        serie.leer_factores(tmp_path / "factores.csv")


@pytest.mark.parametrize("columna", ["factor", "zona", "epoca", "satelite", "debil"])
def test_falla_si_a_factores_le_falta_una_columna(columna):
    with pytest.raises(serie.SerieError, match="faltan las columnas"):
        serie.validar_factores(factores().drop(columns=columna))


def test_falla_si_falta_una_fila_de_factores_y_dice_cual():
    f = factores()
    f = f[~((f["satelite"] == "Aqua") & (f["zona"] == "Yucatán 2") & (f["epoca"] == "resto"))]
    with pytest.raises(serie.SerieError, match="Aqua', 'Yucatán 2', 'resto"):
        serie.validar_factores(f)


def test_falla_si_una_fila_de_factores_esta_repetida():
    f = factores()
    with pytest.raises(serie.SerieError, match="repite"):
        serie.validar_factores(pd.concat([f, f.iloc[[3]]], ignore_index=True))


@pytest.mark.parametrize("malo", [float("nan"), 0.0, -3.0, math.inf])
def test_falla_con_un_factor_vacio_cero_negativo_o_infinito(malo):
    with pytest.raises(serie.SerieError, match="factores vacíos"):
        serie.validar_factores(factores({("Terra", "Campeche", "resto"): malo}))


def test_falla_con_una_zona_mal_escrita():
    f = factores()
    f["zona"] = f["zona"].replace({"Yucatán 1": "Yucatan 1"})
    with pytest.raises(serie.SerieError, match="inesperadas"):
        serie.validar_factores(f)


def test_falla_con_un_satelite_inesperado_en_factores():
    extra = factores().iloc[[-1]].assign(satelite="NOAA-21")
    with pytest.raises(serie.SerieError, match="inesperadas"):
        serie.validar_factores(pd.concat([factores(), extra], ignore_index=True))


def test_falla_con_una_epoca_mal_escrita():
    f = factores()
    f["epoca"] = f["epoca"].replace({"temporada": "Temporada"})
    with pytest.raises(serie.SerieError, match="inesperadas"):
        serie.validar_factores(f)


# ---------------------------------------------------------------------------
# Debe detenerse con un error claro: cuadritos y catálogo


@pytest.mark.parametrize("zona", [None, "Yucatán 9"])
def test_falla_si_un_cuadrito_no_tiene_zona_o_es_desconocida(zona):
    t = tabla(("Aqua", "2005-04-12"))
    t.loc[0, "zona"] = zona
    with pytest.raises(serie.SerieError, match="zona vacía o desconocida"):
        serie.armar_serie(t, CATALOGO, factores())


def test_falla_si_un_cuadrito_viene_repetido():
    t = tabla(("Aqua", "2005-04-12"))
    with pytest.raises(serie.SerieError, match="repetidos"):
        serie.armar_serie(pd.concat([t, t.iloc[[0]]], ignore_index=True), CATALOGO, factores())


@pytest.mark.parametrize("columna", ["zona", "dia_local", "mes", "municipio", "lat_celda"])
def test_falla_si_faltan_columnas_en_los_cuadritos(columna):
    with pytest.raises(serie.SerieError, match="faltan las columnas"):
        serie.armar_serie(tabla().drop(columns=columna), CATALOGO, factores())


def test_falla_si_le_pasan_focos_y_no_cuadritos():
    focos = pd.DataFrame({"acq_date": ["2005-04-12"], "acq_time": [1900], "latitude": [20.1],
                          "longitude": [-89.0], "satellite": ["Aqua"], "municipio": ["A"]})
    with pytest.raises(serie.SerieError, match="no los focos"):
        serie.armar_serie(focos, CATALOGO, factores())


def test_falla_si_un_cuadrito_no_tiene_municipio():
    t = tabla(("Aqua", "2005-04-12"))
    t.loc[0, "municipio"] = None
    with pytest.raises(serie.SerieError, match="sin municipio"):
        serie.armar_serie(t, CATALOGO, factores())


def test_falla_con_un_satelite_desconocido_en_los_cuadritos():
    t = tabla(("GOES", "2005-04-12"))
    with pytest.raises(serie.SerieError, match="satélite desconocido"):
        serie.armar_serie(t, CATALOGO, factores())


def test_falla_si_al_satelite_del_periodo_le_falta_un_anio():
    with pytest.raises(serie.SerieError, match="Aqua del 2005-01-01 al 2005-12-31"):
        armar(sin=("2005",))


def test_falla_si_los_datos_empiezan_en_2003():
    with pytest.raises(serie.SerieError, match="Terra del 2001-01-01"):
        armar(sin=("2001", "2002"))


def test_falla_si_los_datos_no_llegan_al_fin_de_2025():
    with pytest.raises(serie.SerieError, match="2001–2025 completos"):
        armar(sin=("2026",))


def test_falla_con_un_municipio_que_no_esta_en_el_catalogo():
    cat = CATALOGO[CATALOGO["municipio"] != "B"]
    with pytest.raises(serie.SerieError, match=r"B \(Yucatán\)"):
        armar(("Aqua", "2005-04-12", 1, "B"), cat=cat)


def test_falla_si_la_zona_del_cuadrito_no_es_la_de_su_municipio():
    t = tabla(("Aqua", "2005-04-12"))
    t.loc[0, "zona"] = "Yucatán 3"
    with pytest.raises(serie.SerieError, match="zona distinta"):
        serie.armar_serie(t, CATALOGO, factores())


def test_falla_si_el_catalogo_tiene_un_municipio_sin_zona():
    cat = CATALOGO.copy()
    cat.loc[2, "zona"] = None
    with pytest.raises(serie.SerieError, match="zona vacío"):
        armar(cat=cat)


@pytest.mark.parametrize("columna, valor", [("mes", 5), ("anio", 2006), ("semana", 16)])
def test_falla_si_anio_mes_o_semana_no_son_los_de_su_dia(columna, valor):
    t = tabla(("Aqua", "2005-04-12"))
    t.loc[0, columna] = valor
    with pytest.raises(serie.SerieError, match="no son los de su día"):
        serie.armar_serie(t, CATALOGO, factores())


def test_falla_si_dia_local_trae_hora():
    t = tabla(("Aqua", "2005-04-12"))
    t.loc[0, "dia_local"] = pd.Timestamp("2005-04-12 19:30")
    with pytest.raises(serie.SerieError, match="trae hora"):
        serie.armar_serie(t, CATALOGO, factores())


# ---------------------------------------------------------------------------
# Debe detenerse con un error claro: el resultado antes de escribirlo


@pytest.fixture(scope="module")
def valido():
    cal, men, resumen = armar(("Aqua", "2005-04-12", 10), ("S-NPP", "2015-04-10", 3, "B"))
    return cal, men, resumen["fin"]


def _cambiar(cal, condicion, columna, valor):
    cal = cal.copy()
    cal.loc[condicion(cal), columna] = valor
    return cal


SABOTAJES_SERIE = {
    "columna de más": (lambda c: c.assign(extra=1), "Columnas distintas"),
    "tipo distinto": (lambda c: c.astype({"anio": "int64"}), "Tipos distintos"),
    "falta una fila": (lambda c: c.drop(index=5), "debe tener"),
    "percentil vacío": (lambda c: _cambiar(c, lambda d: d.index == 7, "p50", np.nan), "vacíos"),
    "armonizado negativo": (lambda c: _cambiar(c, lambda d: d.index == 7, "cuadritos_viirs_eq", -1.0),
                            "negativos"),
    "armonizado sin crudos": (lambda c: _cambiar(c, lambda d: d.index == 7, "cuadritos_viirs_eq", 5.0),
                              "sin crudos"),
    "VIIRS antes de 2012": (
        lambda c: _cambiar(_cambiar(c, lambda d: (d["municipio"] == "C") & (d["anio"] == 2005)
                                    & (d["semana"] == 20), "cuadritos_viirs_crudo", 1),
                           lambda d: (d["municipio"] == "C") & (d["anio"] == 2005)
                           & (d["semana"] == 20), "cuadritos_viirs_eq", 1.0),
        "VIIRS en semanas anteriores"),
    "acumulado que baja": (lambda c: _cambiar(c, lambda d: (d["municipio"] == "A") & (d["anio"] == 2005)
                                              & (d["semana"] == 30), "acum", 0.0), "disminuye"),
    "percentiles al revés": (lambda c: c.assign(p10=c["p90"] + 1), "fuera de orden"),
    "lo normal cambia entre años": (lambda c: _cambiar(c, lambda d: d.index == 7, "p90",
                                                       c.loc[7, "p90"] + 1), "cambia de un año"),
    "ventana en Campeche": (lambda c: _cambiar(c, lambda d: d["municipio"] == "C", "en_ventana", True),
                            "no llevan ventana"),
}


@pytest.mark.parametrize("nombre", list(SABOTAJES_SERIE))
def test_validar_serie_detiene_un_resultado_roto(valido, nombre):
    cal, _, fin = valido
    serie.validar_serie(cal, fin)  # sin romper, pasa
    romper, mensaje = SABOTAJES_SERIE[nombre]
    with pytest.raises(serie.SerieError, match=mensaje):
        serie.validar_serie(romper(cal), fin)


def test_validar_mensual_detiene_si_no_cuadra_con_el_semanal(valido):
    cal, men, _ = valido
    serie.validar_mensual(men, cal)
    roto = men.copy()
    roto.loc[0, "cuadritos_viirs_eq"] += 1
    with pytest.raises(serie.SerieError, match="por meses no es igual"):
        serie.validar_mensual(roto, cal)
    with pytest.raises(serie.SerieError, match="Tipos del mensual"):
        serie.validar_mensual(men.astype({"mes": "int64"}), cal)


# ---------------------------------------------------------------------------
# Trampas que no deben engañarlo


@pytest.mark.parametrize("satelite, dia", [
    ("Aqua", "2015-04-10"),      # Aqua sigue mandando, pero desde 2012 toca S-NPP
    ("Terra", "2005-04-10"),     # Terra después del 3 jul 2002
    ("NOAA-21", "2024-04-10"),   # NOAA-21 nunca entra
    ("NOAA-20", "2024-04-10"),   # NOAA-20 antes del 3 nov 2026
    ("Terra", "2000-12-20"),     # antes de que empiece la serie
])
def test_satelite_equivocado_para_la_fecha_no_entra(satelite, dia):
    cal, _, resumen = armar((satelite, dia, 4))
    assert crudos(cal, "A") == 0
    assert cal.loc[cal["municipio"] == "A", "cuadritos_viirs_eq"].sum() == 0
    assert resumen["ignorados"][satelite] == 4


@pytest.mark.parametrize("satelite, dia, entra", [
    ("Terra", "2002-07-03", True), ("Aqua", "2002-07-03", False),
    ("Aqua", "2002-07-04", True), ("Terra", "2002-07-04", False),
    ("Aqua", "2012-01-19", True), ("S-NPP", "2012-01-19", False),
    ("S-NPP", "2012-01-20", True), ("Aqua", "2012-01-20", False),
    ("S-NPP", "2026-11-02", True), ("NOAA-20", "2026-11-02", False),
    ("NOAA-20", "2026-11-03", True), ("S-NPP", "2026-11-03", False),
])
def test_bordes_exactos_de_los_periodos(satelite, dia, entra):
    cal, _, _ = armar((satelite, dia, 1))
    assert crudos(cal, "A") == (1 if entra else 0)


def test_snpp_y_noaa20_el_mismo_dia_no_se_suman():
    cal, _, _ = armar(("S-NPP", "2026-11-03", 4), ("NOAA-20", "2026-11-03", 2))
    f = fila(cal, "A", 2026, 44)
    assert f["cuadritos_viirs_crudo"] == 2
    assert f["cuadritos_viirs_eq"] == pytest.approx(1.0)  # 2 × 0.5


def test_semana_con_dos_satelites_usa_cada_uno_con_su_factor():
    # Semana 27 de 2002 (2–8 jul): 2 de Terra el 3 (resto, 6) y 3 de Aqua el 4 (resto, 4).
    cal, _, _ = armar(("Terra", "2002-07-03", 2), ("Aqua", "2002-07-04", 3))
    f = fila(cal, "A", 2002, 27)
    assert f["cuadritos_modis_crudo"] == 5
    assert f["cuadritos_viirs_eq"] == pytest.approx(2 * 6 + 3 * 4)


def test_semana_con_dos_epocas_usa_el_factor_de_cada_dia():
    # Semana 9 de 2005 (26 feb – 4 mar): 28 feb es resto (4) y 1 mar es temporada (3).
    cal, _, _ = armar(("Aqua", "2005-02-28", 1), ("Aqua", "2005-03-01", 1, "A", 5))
    assert fila(cal, "A", 2005, 9)["cuadritos_viirs_eq"] == pytest.approx(7)


def test_cuadrito_de_frontera_cuenta_en_cada_municipio_con_el_factor_de_su_zona():
    # El mismo cuadrito y día en A (Yucatán 1: 3) y en B (Yucatán 2: 2).
    cal, _, _ = armar(("Aqua", "2005-04-12", 1, "A", 0, -88.9), ("Aqua", "2005-04-12", 1, "B", 0, -88.9))
    assert fila(cal, "A", 2005, 15)["cuadritos_viirs_eq"] == pytest.approx(3)
    assert fila(cal, "B", 2005, 15)["cuadritos_viirs_eq"] == pytest.approx(2)


def test_un_factor_debil_se_usa_tal_como_viene_en_el_csv():
    fac = factores({("Aqua", "Yucatán 1", "temporada"): 7.0})
    fac.loc[(fac["satelite"] == "Aqua") & (fac["zona"] == "Yucatán 1")
            & (fac["epoca"] == "temporada"), "debil"] = True
    cal, _, resumen = armar(("Aqua", "2005-04-12", 2), fac=fac)
    assert fila(cal, "A", 2005, 15)["cuadritos_viirs_eq"] == pytest.approx(14)
    assert resumen["debiles"] == [{"satelite": "Aqua", "zona": "Yucatán 1", "epoca": "temporada"}]


def test_una_semana_sin_fuego_tiene_fila_en_cero_y_entra_a_lo_normal():
    # Solo 2010 tuvo fuego en la semana 15 de A (10 × 3 = 30). Con los otros 24 años en 0,
    # la mediana es 0; si se saltaran los ceros, sería 30.
    cal, _, _ = armar(("Aqua", "2010-04-12", 10))
    f = fila(cal, "A", 2015, 15)
    assert f["cuadritos_viirs_eq"] == 0
    assert f["p50"] == 0
    assert fila(cal, "A", 2010, 15)["cuadritos_viirs_eq"] == pytest.approx(30)


def test_un_municipio_sin_fuego_no_desaparece():
    cal, men, _ = armar(("Aqua", "2005-04-12", 1))
    c = cal[cal["municipio"] == "C"]
    assert len(c) == len(cal[cal["municipio"] == "A"])
    assert (c[["cuadritos_viirs_eq", "acum", *serie.PERCENTILES]] == 0).all().all()
    assert len(men[men["municipio"] == "C"]) == len(men[men["municipio"] == "A"])


def test_el_anio_en_curso_no_mueve_lo_normal():
    sin, _, _ = armar(*[("S-NPP", f"{a}-04-10", a - 2010) for a in range(2012, 2026)])
    con, _, _ = armar(*[("S-NPP", f"{a}-04-10", a - 2010) for a in range(2012, 2026)],
                      ("S-NPP", "2026-04-10", 1000))
    for col in serie.PERCENTILES:
        assert fila(con, "A", 2026, 15)[col] == fila(sin, "A", 2026, 15)[col]
    assert fila(con, "A", 2026, 15)["cuadritos_viirs_eq"] == 1000


def test_no_hay_semanas_futuras_y_la_incompleta_se_avisa():
    # El relleno llega al 15 jun 2026 (semana 24: 11–17 jun).
    cal, men, resumen = armar()
    por_anio = cal.groupby("anio")["semana"].agg(["min", "max", "nunique"])
    assert tuple(por_anio.loc[2026]) == (1, 24, 24)
    assert (por_anio.loc[2001:2025, "nunique"] == 52).all()
    assert men["mes"][men["anio"] == 2026].max() == 6
    assert resumen["semana_parcial"] == {"anio": 2026, "semana": 24, "dias_semana": 7,
                                         "dias_observados": 5}


def test_31_de_diciembre_de_bisiesto_es_semana_52():
    cal, _, _ = armar(("Aqua", "2004-12-31", 1))
    assert fila(cal, "A", 2004, 52)["cuadritos_modis_crudo"] == 1


# ---------------------------------------------------------------------------
# Lo que debe salir bien (cuentas a mano)


def test_aqua_en_abril_se_multiplica_por_su_factor():
    cal, _, _ = armar(("Aqua", "2005-04-12", 10))
    f = fila(cal, "A", 2005, 15)
    assert (f["cuadritos_modis_crudo"], f["cuadritos_viirs_crudo"]) == (10, 0)
    assert f["cuadritos_viirs_eq"] == pytest.approx(30)


def test_noaa20_en_noviembre_usa_el_de_la_peninsula():
    cal, _, _ = armar(("NOAA-20", "2026-11-04", 10))
    f = fila(cal, "A", 2026, 44)
    assert (f["cuadritos_modis_crudo"], f["cuadritos_viirs_crudo"]) == (0, 10)
    assert f["cuadritos_viirs_eq"] == pytest.approx(5)


def test_snpp_vale_uno():
    cal, _, _ = armar(("S-NPP", "2015-04-10", 7))
    f = fila(cal, "A", 2015, 15)
    assert f["cuadritos_viirs_eq"] == f["cuadritos_viirs_crudo"] == 7


def test_percentiles_y_acumulado_a_mano():
    # Con todos los factores en 1, el año 2001 + i tiene i cuadritos-día en la semana 20 de A:
    # 25 valores, 0 a 24. p10 = 2.4, p50 = 12, p90 = 21.6 (interpolando, como el provisional).
    fac = factores()
    fac["factor"] = 1.0
    grupos = []
    for i in range(1, 25):
        dia = pd.Timestamp(2001 + i, 5, 16)
        grupos.append((serie.satelite_del_periodo([dia]).iloc[0], dia, i))
    cal, _, _ = armar(*grupos, fac=fac)
    f = fila(cal, "A", 2010, 20)
    assert (f["p10"], f["p50"], f["p90"]) == pytest.approx((2.4, 12, 21.6))
    assert (f["acum_p10"], f["acum_p50"], f["acum_p90"]) == pytest.approx((2.4, 12, 21.6))
    antes = fila(cal, "A", 2010, 19)
    assert (antes["acum"], antes["acum_p90"]) == (0, 0)
    assert fila(cal, "A", 2010, 52)["acum"] == 9


def test_el_mensual_suma_lo_mismo_que_el_semanal():
    cal, men, _ = armar(("Aqua", "2005-04-12", 10), ("Aqua", "2005-02-28", 1), ("Aqua", "2005-03-01", 1, "A", 20),
                        ("Terra", "2002-07-03", 2), ("Aqua", "2002-07-04", 3))
    abril = men[(men["municipio"] == "A") & (men["anio"] == 2005) & (men["mes"] == 4)]
    assert abril["cuadritos_viirs_eq"].tolist() == [30]
    for anio in (2002, 2005):
        semanas = cal[(cal["municipio"] == "A") & (cal["anio"] == anio)]["cuadritos_viirs_eq"].sum()
        meses = men[(men["municipio"] == "A") & (men["anio"] == anio)]["cuadritos_viirs_eq"].sum()
        assert meses == pytest.approx(semanas)


def test_columnas_y_tipos_iguales_al_calendario_provisional():
    cal, men, _ = armar(("Aqua", "2005-04-12", 1))
    assert serie.CONTRATO is cp.CONTRATO
    assert {c: str(t) for c, t in cal.dtypes.items()} == cp.CONTRATO
    assert list(men.columns) == ["estado", "municipio", "anio", "mes", "cuadritos_viirs_eq"]


def test_csv_es_el_calendario_con_4_decimales_y_bom(tmp_path, valido):
    cal, _, _ = valido
    ruta = tmp_path / "serie_armonizada.csv"
    serie.escribir_csv(cal, ruta)
    assert ruta.read_bytes()[:3] == b"\xef\xbb\xbf"
    leido = pd.read_csv(ruta, encoding="utf-8-sig")
    assert list(leido.columns) == list(cal.columns)
    assert len(leido) == len(cal)
    np.testing.assert_allclose(leido["cuadritos_viirs_eq"], cal["cuadritos_viirs_eq"], atol=5e-5)
    assert [p.name for p in tmp_path.iterdir()] == ["serie_armonizada.csv"]


def test_mismo_resultado_si_se_corre_dos_veces():
    grupos = [("Aqua", "2005-04-12", 10), ("S-NPP", "2015-04-10", 3, "B")]
    a, am, _ = armar(*grupos)
    b, bm, _ = armar(*reversed(grupos))
    pd.testing.assert_frame_equal(a, b)
    pd.testing.assert_frame_equal(am, bm)


def test_razones_del_salto_a_mano():
    # Yucatán: 10 al año sin calibrar hasta 2011 y 30 desde 2012; armonizado, 30 siempre.
    filas = [{"estado": "Yucatán", "anio": a,
              "cuadritos_modis_crudo": 10.0 if a < 2012 else 0.0,
              "cuadritos_viirs_crudo": 0 if a < 2012 else 30,
              "cuadritos_viirs_eq": 30.0} for a in range(2001, 2026)]
    r = serie.razones_salto(pd.DataFrame(filas))
    for nombre in serie.COMPARACIONES_SALTO:
        assert r[nombre]["sin_calibrar"] == pytest.approx(3)
        assert r[nombre]["armonizada"] == pytest.approx(1)
        assert r[nombre]["rango_natural"] == pytest.approx((1, 1))


# ---------------------------------------------------------------------------
# Con los datos reales

hay_datos = pytest.mark.skipif(
    not (RAIZ / "datos_peninsula" / "focos_peninsula.parquet").is_file(),
    reason="sin datos_peninsula/",
)


@pytest.fixture(scope="module")
def reales():
    from cargar import cargar_focos, leer_catalogo
    from rejilla import cuadritos_dia

    resumen = {}
    cal, men = serie.armar_serie(cuadritos_dia(cargar_focos()), leer_catalogo(),
                                 serie.leer_factores(), resumen)
    return cal, men, resumen


@hay_datos
def test_reales_forma_del_calendario(reales):
    cal, men, resumen = reales
    fin = resumen["fin"]
    assert fin >= pd.Timestamp("2026-11-03").date()  # ya hay NOAA-20
    assert cal["municipio"].nunique() == 127
    por_anio = cal.groupby("anio")["semana"].nunique()
    assert list(por_anio.index) == list(range(2001, fin.year + 1))
    assert (por_anio.loc[2001:2025] == 52).all()
    semanas_2026 = por_anio.loc[2026]
    assert len(cal) == 127 * (25 * 52 + semanas_2026)
    assert len(men) == 127 * (25 * 12 + fin.month)
    assert "NOAA-21" in resumen["ignorados"]
    assert set(resumen["usados"]) == {"Terra", "Aqua", "S-NPP", "NOAA-20"}


@hay_datos
def test_reales_snpp_igual_al_calendario_provisional(reales):
    """El provisional de la tarea 1 cuenta S-NPP con su propio código: debe dar lo mismo en
    todas sus semanas, menos la 44 de 2026, que en la serie también lleva NOAA-20."""
    cal, _, _ = reales
    prov = cp.generar_calendario()
    prov = prov[~((prov["anio"] == 2026) & (prov["semana"] == 44))]
    unido = prov[cp.CLAVE + ["cuadritos_viirs_crudo"]].merge(
        cal[cp.CLAVE + ["cuadritos_viirs_crudo"]], on=cp.CLAVE, how="left",
        suffixes=("_prov", "_serie"), validate="one_to_one",
    )
    assert unido["cuadritos_viirs_crudo_serie"].notna().all()
    assert (unido["cuadritos_viirs_crudo_prov"] == unido["cuadritos_viirs_crudo_serie"]).all()
    assert unido["cuadritos_viirs_crudo_prov"].sum() > 380_000


def _recalculo_aparte(satelite, municipio, anio, zona):
    """Cuadritos-día armonizados contados directo del parquet, sin cargar.py ni rejilla.py."""
    f = pd.read_parquet(RAIZ / "datos_peninsula" / "focos_peninsula.parquet")
    tipo = pd.to_numeric(f["type"], errors="coerce")
    f = f[(f["satellite"] == satelite) & (f["type"].isna() | (tipo == 0))
          & (pd.to_numeric(f["confidence"], errors="coerce") >= 30) & (f["municipio"] == municipio)]
    hhmm = f["acq_time"].astype(int)
    solar = (f["acq_date"] + pd.to_timedelta(hhmm // 100 * 60 + hhmm % 100, unit="min")
             + pd.to_timedelta(f["longitude"] / 15, unit="h"))
    dias = pd.DataFrame({"dia": solar.dt.floor("D"), "lat": f["latitude"].round(2),
                         "lon": f["longitude"].round(2)}).drop_duplicates()
    dias = dias[dias["dia"].dt.year == anio]
    fac = pd.read_csv(RAIZ / "salidas" / "factores.csv")
    fac = fac[(fac["satelite"] == satelite) & (fac["zona"] == zona)].set_index("epoca")["factor"]
    temporada = dias["dia"].dt.month.isin([3, 4, 5])
    return len(dias), float(temporada.sum() * fac["temporada"] + (~temporada).sum() * fac["resto"])


@hay_datos
@pytest.mark.parametrize("satelite, anio", [("Aqua", 2005), ("Terra", 2001)])
def test_reales_tekax_recalculado_aparte(reales, satelite, anio):
    cal, _, _ = reales
    crudo, armonizado = _recalculo_aparte(satelite, "Tekax", anio, "Yucatán 3")
    t = cal[(cal["municipio"] == "Tekax") & (cal["anio"] == anio)]
    assert crudo > 0
    assert int(t["cuadritos_modis_crudo"].sum()) == crudo
    assert t["cuadritos_viirs_eq"].sum() == pytest.approx(armonizado)


@hay_datos
def test_reales_ya_no_hay_salto_en_2012(reales):
    """Criterio fijado en el plan: la razón armonizada queda dentro de lo que cambia el
    fuego entre años de S-NPP (2013–2025); la razón sin calibrar, fuera."""
    cal, _, _ = reales
    for nombre, r in serie.razones_salto(cal).items():
        bajo, alto = r["rango_natural"]
        assert bajo <= r["armonizada"] <= alto, nombre
        assert r["sin_calibrar"] > alto, nombre
