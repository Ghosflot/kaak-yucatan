"""Pruebas de la tarea 3: factores Aqua→S-NPP y Terra→S-NPP por zona y época.

Casi todas usan cuadritos-día inventados, con números redondos para que el resultado se
pueda comprobar a mano. Hay más pruebas de «lo que debe fallar o no dejarse engañar» que de
«lo que debe salir bien», a propósito: buscan los casos que el cálculo podría no tomar en
cuenta. Las de «Con los datos reales» se saltan si no está datos_peninsula/.
"""
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
import armonizar  # noqa: E402
import cargar  # noqa: E402
import rejilla  # noqa: E402

ZONAS = armonizar.ZONAS


def cuadritos(satelite, dia, n, zona="Yucatán 1", municipio="A", desde=0):
    """n cuadritos-día distintos de un satélite en un día y una zona (como sale de rejilla).

    Cada zona tiene sus propias latitudes, para que dos zonas nunca compartan cuadrito.
    """
    dia = pd.Timestamp(dia)
    base = 10 * ZONAS.index(zona) if zona in ZONAS else 90
    return [
        {"satelite": satelite, "dia_local": dia, "anio": dia.year, "mes": dia.month,
         "lat_celda": base + (desde + i) / 100, "lon_celda": -89.0, "estado": "X",
         "municipio": municipio, "zona": zona, "n_focos": 1}
        for i in range(n)
    ]


def tabla(*grupos) -> pd.DataFrame:
    return pd.DataFrame([fila for g in grupos for fila in cuadritos(*g)])


def peninsula(por_zona: pd.DataFrame) -> pd.DataFrame:
    """La misma tabla sin municipio: cada cuadrito una vez (como cuadritos_dia_peninsula)."""
    return por_zona.drop_duplicates(["satelite", "dia_local", "lat_celda", "lon_celda"])


def base(otro="Aqua", saltar=()):
    """Todas las zonas con fuego en las dos épocas y en dos años, nada débil.

    Por zona: S-NPP 300 y otro 100 en temporada; S-NPP 400 y otro 100 en el resto.
    """
    grupos = []
    for zona in ZONAS:
        for anio in (2015, 2016):
            for dia, ref in ((f"{anio}-04-10", 300), (f"{anio}-08-10", 400)):
                if (zona, dia) in saltar:
                    continue
                grupos += [("S-NPP", dia, ref, zona), (otro, dia, 100, zona, "A", 500)]
    return grupos


def calcular(*grupos, otro="Aqua", pen_extra=()):
    z = tabla(*grupos)
    pen = pd.concat([peninsula(z), tabla(*pen_extra)]) if pen_extra else peninsula(z)
    return armonizar.factores_modis(z, pen, otro).set_index(["zona", "epoca"])


# ---------------------------------------------------------------------------
# Lo que debe fallar o no dejarse engañar


@pytest.mark.parametrize("otro", ["NOAA-20", "S-NPP", "Landsat", "MODIS"])
def test_falla_si_no_es_aqua_ni_terra(otro):
    with pytest.raises(armonizar.FactorError):
        calcular(*base(), otro=otro)


def test_falla_con_una_zona_desconocida():
    with pytest.raises(armonizar.FactorError, match="zonas desconocidas"):
        calcular(*base(), ("S-NPP", "2015-04-10", 5, "Yucatán 9"))


def test_falla_con_una_zona_vacia():
    z = tabla(*base())
    z.loc[0, "zona"] = None
    with pytest.raises(armonizar.FactorError, match="zonas desconocidas o vacías"):
        armonizar.factores_modis(z, peninsula(z), "Aqua")


def test_falla_si_falta_la_columna_zona():
    z = tabla(*base()).drop(columns="zona")
    with pytest.raises(armonizar.FactorError, match="faltan columnas"):
        armonizar.factores_modis(z, peninsula(tabla(*base())), "Aqua")


def test_falla_si_le_pasan_focos_y_no_cuadritos_en_la_peninsula():
    z = tabla(*base())
    focos = z.rename(columns={"dia_local": "acq_date"})
    with pytest.raises(armonizar.FactorError, match="faltan columnas"):
        armonizar.factores_modis(z, focos, "Aqua")


def test_falla_si_una_zona_no_tiene_dias_en_una_epoca():
    saltar = {("Campeche", "2015-08-10"), ("Campeche", "2016-08-10")}
    with pytest.raises(armonizar.FactorError, match="Campeche, resto"):
        calcular(*base(saltar=saltar))


def test_falla_si_todas_las_zonas_juntas_son_debiles():
    pocos = [("S-NPP", "2015-04-10", 30, z) for z in ZONAS] + \
            [("Aqua", "2015-04-10", 10, z, "A", 500) for z in ZONAS] + \
            [("S-NPP", "2015-08-10", 30, z) for z in ZONAS] + \
            [("Aqua", "2015-08-10", 10, z, "A", 500) for z in ZONAS]
    with pytest.raises(armonizar.FactorError, match="todas las zonas juntas es débil"):
        calcular(*pocos)


def test_no_guarda_filas_repetidas(tmp_path):
    f = calcular(*base()).reset_index()[armonizar.COLUMNAS]
    with pytest.raises(armonizar.FactorError, match="repetidas"):
        armonizar.guardar_factores(pd.concat([f, f.head(1)]), tmp_path / "f.csv")
    assert not (tmp_path / "f.csv").exists()


def test_un_dia_sin_aqua_con_mucho_fuego_de_snpp_se_quita():
    f = calcular(*base(), ("S-NPP", "2015-04-20", 60, "Campeche"))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)


def test_un_dia_sin_snpp_con_mucho_fuego_de_aqua_se_quita():
    f = calcular(*base(), ("Aqua", "2015-04-20", 60, "Campeche", "A", 500))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)


def test_el_umbral_de_hueco_es_50_exacto():
    # 50 de S-NPP y 0 de Aqua es hueco: no cambia el factor.
    f = calcular(*base(), ("S-NPP", "2015-04-20", 50, "Campeche"))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)


def test_un_dia_tranquilo_sin_aqua_si_cuenta():
    # 49 de S-NPP y 0 de Aqua: es poco fuego, no una falla. Cuenta: (600 + 49) / 200.
    f = calcular(*base(), ("S-NPP", "2015-04-20", 49, "Campeche"))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(649 / 200)


def test_aqua_en_cero_en_una_zona_no_quita_el_dia_si_vio_fuego_en_otra():
    # El error que tenía la regla de la tarea 4 con MODIS: S-NPP ve 40 en Campeche y Aqua
    # nada ahí, pero Aqua sí ve fuego en Quintana Roo ese día. El día cuenta en Campeche.
    f = calcular(*base(), ("S-NPP", "2015-04-20", 40, "Campeche"),
                 ("S-NPP", "2015-04-20", 30, "Quintana Roo"),
                 ("Aqua", "2015-04-20", 10, "Quintana Roo", "A", 500))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(640 / 200)


def test_el_hueco_se_mira_en_toda_la_peninsula_no_en_la_zona():
    # 60 de S-NPP en Campeche, Aqua 0 en Campeche pero 5 en la península (foco sin
    # municipio): Aqua sí mandó datos, no es hueco.
    f = calcular(*base(), ("S-NPP", "2015-04-20", 60, "Campeche"),
                 pen_extra=[("Aqua", "2015-04-20", 5, "Sin zona")])
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(660 / 200)


@pytest.mark.parametrize("dia", ["2012-12-31", "2021-01-01"])
def test_no_entran_dias_fuera_de_2013_2020(dia):
    f = calcular(*base(), ("S-NPP", dia, 40, "Campeche"), ("Aqua", dia, 1, "Campeche", "A", 500))
    assert f.loc[("Campeche", "resto"), "factor"] == pytest.approx(4.0)


@pytest.mark.parametrize("dia", ["2013-01-01", "2020-12-31"])
def test_si_entran_los_extremos_del_periodo(dia):
    # 30/10 y no 40/10: con 40/10 el día tiene la misma proporción que base() (4) y el factor
    # da 4.0 entre o no entre el día, así que la prueba no detectaba nada.
    f = calcular(*base(), ("S-NPP", dia, 30, "Campeche"), ("Aqua", dia, 10, "Campeche", "A", 500))
    assert f.loc[("Campeche", "resto"), "factor"] == pytest.approx(830 / 210)


@pytest.mark.parametrize("intruso", ["NOAA-20", "Terra", "NOAA-21"])
def test_otros_satelites_no_se_cuelan_en_aqua(intruso):
    f = calcular(*base(), (intruso, "2015-04-10", 999, "Campeche", "A", 2000))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)


def test_el_fuego_de_otra_zona_no_se_cuela():
    f = calcular(*base(), ("S-NPP", "2015-04-10", 30, "Quintana Roo", "B", 2000))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)
    assert f.loc[("Quintana Roo", "temporada"), "factor"] == pytest.approx(630 / 200)


def test_un_cuadrito_en_dos_municipios_de_la_misma_zona_cuenta_una_vez():
    # Los mismos 100 cuadritos de Aqua aparecen también en el municipio B.
    f = calcular(*base(), ("Aqua", "2015-04-10", 100, "Campeche", "B", 500))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)


def test_cuenta_cuadritos_no_focos():
    z = tabla(*base())
    z["n_focos"] = 50
    f = armonizar.factores_modis(z, peninsula(z), "Aqua").set_index(["zona", "epoca"])
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(3.0)


def test_un_debil_se_reemplaza_por_el_de_todas_las_zonas_juntas():
    # Yucatán 1, resto: solo 40 cuadritos-día de Aqua (débil) y un factor raro de 10.
    saltar = {("Yucatán 1", "2015-08-10"), ("Yucatán 1", "2016-08-10")}
    f = calcular(*base(saltar=saltar), ("S-NPP", "2015-08-10", 400, "Yucatán 1"),
                 ("Aqua", "2015-08-10", 40, "Yucatán 1", "A", 500))
    fila = f.loc[("Yucatán 1", "resto")]
    assert bool(fila["debil"]) is True
    assert fila["cuadritos_dia_usados"] == 40
    juntas = (5 * 800 + 400) / (5 * 200 + 40)
    assert fila["factor"] == pytest.approx(juntas)
    assert fila["factor"] != pytest.approx(10.0)


def test_el_reemplazo_usa_la_misma_epoca():
    saltar = {("Yucatán 1", "2015-04-10"), ("Yucatán 1", "2016-04-10")}
    f = calcular(*base(saltar=saltar), ("S-NPP", "2015-04-10", 30, "Yucatán 1"),
                 ("Aqua", "2015-04-10", 10, "Yucatán 1", "A", 500))
    fila = f.loc[("Yucatán 1", "temporada")]
    assert bool(fila["debil"]) is True
    assert fila["factor"] == pytest.approx((5 * 600 + 30) / (5 * 200 + 10))  # temporada, no 4


def test_aqua_en_cero_en_una_zona_no_deja_un_factor_infinito():
    saltar = {("Yucatán 1", "2015-08-10"), ("Yucatán 1", "2016-08-10")}
    f = calcular(*base(saltar=saltar), ("S-NPP", "2015-08-10", 30, "Yucatán 1"))
    fila = f.loc[("Yucatán 1", "resto")]
    assert bool(fila["debil"]) is True and fila["cuadritos_dia_usados"] == 0
    assert fila["factor"] == pytest.approx((5 * 800 + 30) / (5 * 200))  # el de todas juntas
    assert pd.notna(fila["factor_min"]) and pd.notna(fila["factor_max"])


def test_99_es_debil_y_100_no():
    saltar = {("Yucatán 2", "2015-04-10"), ("Yucatán 2", "2016-04-10"),
              ("Yucatán 3", "2015-04-10"), ("Yucatán 3", "2016-04-10")}
    f = calcular(*base(saltar=saltar),
                 ("S-NPP", "2015-04-10", 300, "Yucatán 2"), ("Aqua", "2015-04-10", 99, "Yucatán 2", "A", 500),
                 ("S-NPP", "2015-04-10", 300, "Yucatán 3"), ("Aqua", "2015-04-10", 100, "Yucatán 3", "A", 500))
    assert bool(f.loc[("Yucatán 2", "temporada"), "debil"]) is True
    assert bool(f.loc[("Yucatán 3", "temporada"), "debil"]) is False
    assert f.loc[("Yucatán 3", "temporada"), "factor"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# Lo que debe salir bien


def test_doce_filas_seis_zonas_por_dos_epocas():
    f = calcular(*base()).reset_index()
    assert len(f) == 12
    assert set(f["zona"]) == set(ZONAS) and set(f["epoca"]) == {"temporada", "resto"}
    assert set(f["satelite"]) == {"Aqua"}
    assert list(f.columns) == armonizar.COLUMNAS


def test_factor_es_snpp_entre_modis_por_zona_y_epoca():
    f = calcular(*base())
    assert f.loc[("Yucatán 4", "temporada"), "factor"] == pytest.approx(3.0)
    assert f.loc[("Yucatán 4", "resto"), "factor"] == pytest.approx(4.0)


def test_terra_usa_el_mismo_calculo():
    f = calcular(*base(otro="Terra"), otro="Terra").reset_index()
    assert set(f["satelite"]) == {"Terra"}
    assert f.set_index(["zona", "epoca"]).loc[("Campeche", "resto"), "factor"] == pytest.approx(4.0)


def test_margen_quitando_un_anio_a_la_vez():
    # Campeche temporada: 2015 da 300/100 y 2016 da 200/100. Juntos 500/200 = 2.5;
    # sin 2015, 2.0; sin 2016, 3.0.
    saltar = {("Campeche", "2016-04-10")}
    f = calcular(*base(saltar=saltar), ("S-NPP", "2016-04-10", 200, "Campeche"),
                 ("Aqua", "2016-04-10", 100, "Campeche", "A", 500))
    fila = f.loc[("Campeche", "temporada")]
    assert fila["factor"] == pytest.approx(2.5)
    assert (fila["factor_min"], fila["factor_max"]) == pytest.approx((2.0, 3.0))


def test_se_suman_los_dias_antes_de_dividir():
    # Un día suelto de 10 contra 1 no dispara el factor: (600 + 10) / (200 + 1).
    f = calcular(*base(), ("S-NPP", "2015-05-01", 10, "Campeche"),
                 ("Aqua", "2015-05-01", 1, "Campeche", "A", 500))
    assert f.loc[("Campeche", "temporada"), "factor"] == pytest.approx(610 / 201)


def test_guarda_junto_con_noaa20(tmp_path):
    noaa = pd.DataFrame([{"zona": "Península", "epoca": e, "satelite": "NOAA-20", "factor": 1.0,
                          "factor_min": 1.0, "factor_max": 1.0, "cuadritos_dia_usados": 500,
                          "debil": False} for e in ("temporada", "resto")])
    aqua = calcular(*base()).reset_index()[armonizar.COLUMNAS]
    armonizar.guardar_factores(pd.concat([noaa, aqua]), tmp_path / "f.csv")
    leido = pd.read_csv(tmp_path / "f.csv")
    assert len(leido) == 14 and (leido["satelite"] == "NOAA-20").sum() == 2


# ---------------------------------------------------------------------------
# El periodo de dias_por_zona() (para la tarea 7: Aqua 2021–2025)

P_2021_2025 = (date(2021, 1, 1), date(2025, 12, 31))
SIN_HUECOS = pd.DatetimeIndex([])


def contar(grupos, periodo=None, huecos=SIN_HUECOS, zona="Campeche"):
    """dias_por_zona() de Aqua en una zona; sin `periodo` usa el valor por defecto."""
    z = tabla(*grupos)
    extra = {} if periodo is None else {"periodo": periodo}
    return armonizar.dias_por_zona(z, "Aqua", zona, huecos, **extra)


def test_sin_periodo_sigue_siendo_2013_2020():
    # Lo que ya usa factores_modis(): sin pasar periodo da lo mismo que pasar PERIODO_MODIS.
    grupos = base() + [("S-NPP", "2022-04-10", 40, "Campeche"),
                       ("Aqua", "2022-04-10", 10, "Campeche", "A", 500)]
    pd.testing.assert_frame_equal(contar(grupos),
                                  contar(grupos, periodo=armonizar.PERIODO_MODIS))
    assert set(contar(grupos)["anio"]) == {2015, 2016}


def test_respeta_el_periodo_que_se_le_pasa():
    grupos = base() + [("S-NPP", "2022-04-10", 40, "Campeche"),
                       ("Aqua", "2022-04-10", 10, "Campeche", "A", 500)]
    d = contar(grupos, periodo=P_2021_2025)
    assert d["dia_local"].tolist() == [pd.Timestamp("2022-04-10")]
    assert d[["ref", "otro"]].iloc[0].tolist() == [40, 10]


@pytest.mark.parametrize("dia, entra", [("2020-12-31", False), ("2021-01-01", True),
                                        ("2025-12-31", True), ("2026-01-01", False)])
def test_extremos_de_un_periodo_que_no_es_el_de_calibracion(dia, entra):
    d = contar([("S-NPP", dia, 4, "Campeche"), ("Aqua", dia, 1, "Campeche", "A", 500)],
               periodo=P_2021_2025)
    assert (len(d) == 1) is entra


def test_falla_si_el_periodo_esta_al_reves():
    with pytest.raises(armonizar.FactorError, match="periodo al revés"):
        contar(base(), periodo=(date(2025, 12, 31), date(2021, 1, 1)))


def test_falla_si_los_huecos_son_de_otro_periodo():
    # El error que se quiere evitar: huecos de la calibración (2013–2020) con el periodo
    # 2021–2025. Ninguno cae en 2021–2025, así que no se quitaría ninguno sin avisar.
    grupos = base() + [("S-NPP", "2015-04-20", 60, "Campeche")]
    z = tabla(*grupos)
    huecos = armonizar.dias_hueco(peninsula(z), "Aqua", *armonizar.PERIODO_MODIS)
    assert len(huecos) == 1
    with pytest.raises(armonizar.FactorError, match="fuera del periodo"):
        armonizar.dias_por_zona(z, "Aqua", "Campeche", huecos, periodo=P_2021_2025)


def test_falla_si_un_hueco_cae_un_dia_despues_del_periodo():
    huecos = pd.DatetimeIndex(["2026-01-01"])
    with pytest.raises(armonizar.FactorError, match="2026-01-01"):
        contar(base(), periodo=P_2021_2025, huecos=huecos)


def test_los_huecos_del_mismo_periodo_se_quitan():
    # 2022-04-10: S-NPP 60 y Aqua nada (como Aqua del 31 mar al 16 abr de 2022).
    grupos = [("S-NPP", "2022-04-10", 60, "Campeche"),
              ("S-NPP", "2022-04-20", 30, "Campeche"),
              ("Aqua", "2022-04-20", 10, "Campeche", "A", 500)]
    z = tabla(*grupos)
    huecos = armonizar.dias_hueco(peninsula(z), "Aqua", *P_2021_2025)
    d = armonizar.dias_por_zona(z, "Aqua", "Campeche", huecos, periodo=P_2021_2025)
    assert d["dia_local"].tolist() == [pd.Timestamp("2022-04-20")]


def test_huecos_vacios_se_aceptan_aunque_no_se_pueda_saber_si_se_olvidaron():
    # Límite conocido: una lista vacía es válida (hay periodos sin huecos), así que olvidar
    # pasar los huecos no se detecta. El día hueco entra con Aqua en 0.
    d = contar([("S-NPP", "2022-04-10", 60, "Campeche")], periodo=P_2021_2025)
    assert d[["ref", "otro"]].iloc[0].tolist() == [60, 0]


# ---------------------------------------------------------------------------
# Con los datos reales


hay_datos = pytest.mark.skipif(
    not cargar.FOCOS_HISTORICOS.is_file(), reason="falta datos_peninsula/focos_peninsula.parquet"
)


@pytest.fixture(scope="module")
def reales():
    focos = cargar.cargar_focos()
    pen = rejilla.cuadritos_dia_peninsula(focos)
    zona = rejilla.cuadritos_dia(focos)
    f = pd.concat([armonizar.factores_modis(zona, pen, s) for s in armonizar.MODIS])
    return f, zona, pen


@hay_datos
def test_reales_12_de_aqua_y_12_de_terra_sin_vacios(reales):
    f, _, _ = reales
    assert f.groupby("satelite").size().to_dict() == {"Aqua": 12, "Terra": 12}
    assert f[["factor", "factor_min", "factor_max"]].notna().all().all()


@hay_datos
def test_reales_viirs_ve_mas_que_modis_y_el_factor_queda_en_su_margen(reales):
    f, _, _ = reales
    assert (f["factor"] > 1).all()
    assert ((f["factor_min"] <= f["factor"]) & (f["factor"] <= f["factor_max"])).all()


@hay_datos
def test_reales_terra_yucatan_1_resto_es_debil_y_se_reemplaza(reales):
    f, _, _ = reales
    fila = f.set_index(["satelite", "zona", "epoca"]).loc[("Terra", "Yucatán 1", "resto")]
    assert bool(fila["debil"]) is True and fila["cuadritos_dia_usados"] < 100


@hay_datos
def test_reales_recalculo_aparte_de_aqua_campeche_temporada(reales):
    # Mismo número con pandas directo, sin las funciones de armonizar.py.
    f, zona, pen = reales
    p = pen[pen["satelite"].isin(["S-NPP", "Aqua"])].copy()
    p["d"] = pd.to_datetime(p["dia_local"])
    dias = p.groupby(["d", "satelite"]).size().unstack(fill_value=0).reindex(
        pd.date_range("2013-01-01", "2020-12-31"), fill_value=0)
    hueco = dias.index[((dias["Aqua"] == 0) & (dias["S-NPP"] >= 50))
                       | ((dias["S-NPP"] == 0) & (dias["Aqua"] >= 50))]
    z = zona[(zona["zona"] == "Campeche") & zona["satelite"].isin(["S-NPP", "Aqua"])].copy()
    z["d"] = pd.to_datetime(z["dia_local"])
    z = z[z["d"].between("2013-01-01", "2020-12-31") & z["d"].dt.month.isin([3, 4, 5])
          & ~z["d"].isin(hueco)]
    n = z.drop_duplicates(["satelite", "d", "lat_celda", "lon_celda"])["satelite"].value_counts()
    esperado = n["S-NPP"] / n["Aqua"]
    obtenido = f.set_index(["satelite", "zona", "epoca"]).loc[("Aqua", "Campeche", "temporada"),
                                                             "factor"]
    assert obtenido == pytest.approx(esperado)


@hay_datos
def test_reales_huecos_de_aqua_en_2021_2025(reales):
    # Lo que la tarea 7 va a encontrar al revisar Aqua fuera de la calibración.
    _, _, pen = reales
    huecos = armonizar.dias_hueco(pen, "Aqua", *P_2021_2025)
    # Aqua no mandó datos del 31 mar al 16 abr de 2022, en plena temporada (el 8 abr no
    # cuenta como hueco: ese día S-NPP tampoco vio nada).
    bloque = pd.date_range("2022-03-31", "2022-04-16").drop(pd.Timestamp("2022-04-08"))
    assert bloque.isin(huecos).all()
    # S-NPP sin datos del 30 may al 3 jun de 2024: el 3 jun Aqua vio solo 32 (< 50), así
    # que la regla no lo marca y ese día entra con S-NPP en 0. Límite conocido de UMBRAL_HUECO.
    assert pd.date_range("2024-05-30", "2024-06-02").isin(huecos).all()
    assert pd.Timestamp("2024-06-03") not in huecos
